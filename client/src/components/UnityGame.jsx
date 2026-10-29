import { useEffect, useRef, useState } from "react"
import { Maximize2 } from "lucide-react"

// UnityGame.jsx
//
// Loads and mounts a Unity WebGL build, then hands it the student's auth
// context the moment it's actually ready - matching WebGLAuthContext.cs on
// the Unity side exactly:
//
//   unityInstance.SendMessage("GameManager", "SetAuthContext", json)
//
// "GameManager" must be the exact name of a GameObject in Unity's first
// scene (it must exist there for SendMessage to find it), and the JSON
// shape must be { token, roomId } - see WebGLAuthContext.SetAuthContext.
//
// BUILD_NAME below must match your Unity build's actual output file names
// exactly, including case - check Edit > Project Settings > Player >
// Product Name in Unity right after building, since that's what Unity
// names <ProductName>.loader.js / .data / .framework.js / .wasm from.
//
// Setup:
//   1. In Unity: File > Build Settings > WebGL > Build, with Compression
//      Format set to Disabled (Player Settings > Publishing Settings) -
//      this avoids needing to configure Content-Encoding headers on
//      whatever serves the site, which matters a lot more once this is
//      actually deployed than it does testing locally.
//   2. Point the build output folder at client/public/<BUILD_FOLDER> (see
//      the constant below) - anything under client/public/ is served by
//      Vite at the site root automatically, no extra config needed.
//   3. Update BUILD_NAME below to match the actual file names Unity
//      produced - see the note below, it's NOT your Product Name.
//   4. Drop <UnityGame token={...} roomId={...} /> wherever the game
//      should mount - see StudentRoomPage.jsx / RoomPage.jsx. Pass
//      onRunFinished to react when a run ends (it gets { campaignId, saved }).
//
// FULLSCREEN - uses the browser's native Fullscreen API on the outer
// container. The 16:9 "stage" box (canvas + overlays) always keeps that
// exact ratio - in fullscreen it's sized with a CSS min() so it grows as
// large as it can while still fitting the screen, then the outer
// container's own black background fills whatever's left over on the
// short axis (top/bottom on an ultra-wide monitor, left/right on a
// narrower one) - the same letterboxing a video player does, so nothing
// about Unity's UI placement ever changes between windowed and
// fullscreen, just the zoom level. The Fullscreen button only
// ENTERS fullscreen, and is hidden once already in it - there's no exit
// button, since every browser already exits fullscreen on Escape on its
// own with no code needed here. Browsers only allow requestFullscreen()
// to succeed as a direct result of a real user gesture (a click/keypress) -
// NOT from an arbitrary async callback - so the "goes fullscreen when the
// game starts" attempt below is best-effort (works in some browsers if the
// page still has recent user activation from navigating here, silently
// does nothing if not). The Fullscreen button is the one guaranteed way
// in - never rely on the automatic attempt alone.

const BUILD_FOLDER = "unitybuild"

// Unity names Build/<name>.loader.js / .data / .framework.js / .wasm
// after the OUTPUT FOLDER you chose when building, not the Player
// Settings Product Name - so this must match BUILD_FOLDER above unless
// you rename the files by hand after building. Check
// client/public/unitybuild/Build/ if this ever drifts.
const BUILD_NAME = "unitybuild"

function UnityGame({ token, roomId, onError, onRunFinished, onStatusChange }) {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const instanceRef = useRef(null)
    const [status, setStatus] = useState("loading") // loading | ready | error
    const [progress, setProgress] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Keeps isFullscreen in sync no matter how fullscreen was exited -
    // the button, Escape (handled natively by the browser), or F11 - so
    // the button's own label/icon never gets out of sync with reality.
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === containerRef.current)
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange)
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }, [])

    // The game raises the window event "archivai:run-finished" when a run ends (see
    // RunFinishedPlugin.jslib in the Unity project), with detail { campaignId, saved }.
    // saved is true when the website accepted the results. The newest onRunFinished is kept
    // in a ref so the listener is only added once and never goes stale.
    const onRunFinishedRef = useRef(onRunFinished)
    useEffect(() => {
        onRunFinishedRef.current = onRunFinished
    })
    useEffect(() => {
        const handleRunFinished = (event) => onRunFinishedRef.current?.(event.detail)
        window.addEventListener("archivai:run-finished", handleRunFinished)
        return () => window.removeEventListener("archivai:run-finished", handleRunFinished)
    }, [])

    // Enter-only - see FULLSCREEN above for why there's no exit branch
    // here. Escape (native, no code needed) is the way out.
    const enterFullscreen = () => {
        containerRef.current?.requestFullscreen().catch(() => {
            // Browser blocked it (no recent user gesture, unsupported,
            // etc). Nothing to do - the button itself is always a valid
            // direct-click gesture, so a manual click right after this
            // will still work.
        })
    }

    useEffect(() => {
        let cancelled = false

        const buildUrl = `/${BUILD_FOLDER}/Build`
        const loaderUrl = `${buildUrl}/${BUILD_NAME}.loader.js`
        const config = {
            dataUrl: `${buildUrl}/${BUILD_NAME}.data`,
            frameworkUrl: `${buildUrl}/${BUILD_NAME}.framework.js`,
            codeUrl: `${buildUrl}/${BUILD_NAME}.wasm`,
            streamingAssetsUrl: `/${BUILD_FOLDER}/StreamingAssets`,
            companyName: "Archivist Legacy",
            productName: BUILD_NAME,
            productVersion: "1.0",
        }

        const script = document.createElement("script")
        script.src = loaderUrl

        script.onload = () => {
            if (cancelled || !window.createUnityInstance || !canvasRef.current) return

            window.createUnityInstance(canvasRef.current, config, (p) => setProgress(p))
                .then((instance) => {
                    if (cancelled) {
                        instance.Quit().catch(() => {})
                        return
                    }

                    instanceRef.current = instance
                    setStatus("ready")

                    // Best-effort auto-fullscreen the moment the game is
                    // actually ready - see FULLSCREEN above for why this
                    // isn't guaranteed to work in every browser. The
                    // Fullscreen button below is the reliable fallback.
                    containerRef.current?.requestFullscreen().catch(() => {})

                    // Hand off auth context now that Unity is actually
                    // ready to receive it. WebGLAuthContext waits for
                    // this via its own OnAuthContextReady event rather
                    // than assuming any particular timing, so there's no
                    // race here even though Unity's Awake()/Start() ran
                    // long before this line does.
                    instance.SendMessage(
                        "GameManager",
                        "SetAuthContext",
                        JSON.stringify({ token, roomId: Number(roomId) })
                    )
                })
                .catch((err) => {
                    console.error("[UnityGame] Failed to start Unity instance:", err)
                    setStatus("error")
                    onError?.(err)
                })
        }

        script.onerror = () => {
            console.error(`[UnityGame] Failed to load Unity loader script: ${loaderUrl}`)
            setStatus("error")
            onError?.(new Error("Failed to load Unity loader script"))
        }

        document.body.appendChild(script)

        return () => {
            cancelled = true
            if (document.body.contains(script)) document.body.removeChild(script)
            if (instanceRef.current) {
                instanceRef.current.Quit().catch(() => {})
                instanceRef.current = null
            }
        }
    }, [token, roomId])

    // Lets the page around the game react to the real lifecycle (e.g. only ask
    // "leave the campaign?" once the game is actually running).
    const onStatusChangeRef = useRef(onStatusChange)
    useEffect(() => {
        onStatusChangeRef.current = onStatusChange
    })
    useEffect(() => {
        onStatusChangeRef.current?.(status)
    }, [status])

    const pct = Math.round(progress * 100)

    return (
        <div
            ref={containerRef}
            className="unity-frame"
            data-fullscreen={isFullscreen || undefined}
        >
            {/* The 16:9 "stage" - see FULLSCREEN above for how this sizes
                itself to fit the screen without ever distorting the ratio. */}
            <div className="unity-frame__stage">
                <canvas
                    id="unity-canvas"
                    ref={canvasRef}
                    tabIndex={-1}
                    aria-label="Game"
                    className="unity-frame__canvas"
                    style={{ display: status === "ready" ? "block" : "none" }}
                />

                {status === "loading" && (
                    <div className="unity-frame__overlay" role="status" aria-live="polite">
                        <div className="unity-loader" aria-hidden="true">
                            <span /><span /><span />
                        </div>
                        <p className="unity-frame__label">{pct < 100 ? "Loading the game..." : "Almost there..."}</p>
                        <div
                            className="unity-frame__track"
                            role="progressbar"
                            aria-label="Game loading progress"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pct}
                        >
                            <span style={{ width: `${pct}%` }} />
                        </div>
                        <p className="unity-frame__pct">{pct}%</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="unity-frame__overlay" role="alert">
                        <p className="unity-frame__label">The game couldn't load.</p>
                        <p className="unity-frame__pct">Check your connection, then return to the room and try again.</p>
                    </div>
                )}
            </div>

            {status === "ready" && !isFullscreen && (
                <button type="button" onClick={enterFullscreen} className="btn btn--secondary btn--sm unity-frame__fs">
                    <Maximize2 size={15} aria-hidden="true" /> Fullscreen
                </button>
            )}
        </div>
    )
}

export default UnityGame
