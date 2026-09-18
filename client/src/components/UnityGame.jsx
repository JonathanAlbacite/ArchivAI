import { useEffect, useRef, useState } from "react"

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
//      should mount - see StudentRoomPage.jsx / RoomPage.jsx.
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

function UnityGame({ token, roomId, onError }) {
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

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                background: "#000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                // Only fullscreen actually needs to span/center within the
                // viewport - windowed stays exactly as before (a normal,
                // in-page 960px-max box).
                ...(isFullscreen
                    ? { width: "100vw", height: "100vh", justifyContent: "center" }
                    : { width: "100%", maxWidth: "960px" }),
            }}
        >
            {/* The 16:9 "stage" - see FULLSCREEN above for how this sizes
                itself to fit the screen without ever distorting the ratio. */}
            <div
                style={{
                    position: "relative",
                    aspectRatio: "16 / 9",
                    width: isFullscreen ? "min(100vw, 100vh * 16 / 9)" : "100%",
                    height: isFullscreen ? "min(100vh, 100vw * 9 / 16)" : "auto",
                }}
            >
                <canvas
                    id="unity-canvas"
                    ref={canvasRef}
                    style={{
                        width: "100%",
                        height: "100%",
                        display: status === "ready" ? "block" : "none",
                        background: "#000",
                        borderRadius: "12px",
                    }}
                />

                {status === "loading" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#EDE3D0", fontFamily: "monospace", fontSize: "13px" }}>
                        Loading the game... {Math.round(progress * 100)}%
                    </div>
                )}

                {status === "error" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#E08080", fontFamily: "monospace", fontSize: "13px", textAlign: "center", padding: "20px" }}>
                        Failed to load the game. Check the browser console for details.
                    </div>
                )}
            </div>

            {status === "ready" && !isFullscreen && (
                <button
                    onClick={enterFullscreen}
                    style={{
                        alignSelf: "flex-end",
                        marginTop: "8px",
                        padding: "6px 14px",
                        background: "transparent",
                        border: "1px solid #EDE3D0",
                        borderRadius: "6px",
                        color: "#EDE3D0",
                        fontFamily: "monospace",
                        fontSize: "13px",
                        cursor: "pointer",
                    }}
                >
                    Fullscreen
                </button>
            )}
        </div>
    )
}

export default UnityGame
