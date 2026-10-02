import { useEffect, useRef, useState } from "react"

// CharacterCustomizerGame.jsx
//
// UNUSED - SUPERSEDED. The character customization feature no longer embeds a Unity WebGL build
// at all - StudentCharacterCustomization.jsx now renders the picking UI and 3D preview directly on
// the website with three.js (see CharacterCustomizer3D.jsx), saving/loading through the same
// GET/PUT /api/character-loadout endpoints this component's Unity build used to talk to. Kept here
// for reference rather than deleted (same convention as Outline.shader and
// CharacterCustomizationOrbitCamera.cs on the game side) - not imported anywhere anymore.
//
// Same embed pattern as UnityGame.jsx (see its own header for the full explanation of the
// loading/fullscreen/error behavior below) - this is the character customization scene's own
// build, mounted the same way. The one real difference: this scene never touches campaign/room
// data, so it only ever needs a token, not a roomId - CharacterLoadoutAPIClient.cs (Unity side)
// calls GET/PUT /api/character-loadout directly using that token, the same "Unity calls the API
// itself" pattern CampaignAPIClient.cs already uses for the main game. This component's only job
// is to load the build and hand it the token once - nothing about character data is fetched or
// pushed from this side at all.
//
// unityInstance.SendMessage("GameManager", "SetAuthContext", json) still expects the same
// { token, roomId } shape WebGLAuthContext.SetAuthContext parses on the Unity side (see
// WebGLAuthContext.cs) - roomId is sent as 0 below since this scene's GameManager never reads it,
// just to keep that one shared JSON shape intact rather than adding a second parsing path.
//
// BUILD_NAME below must match this scene's own Unity build's actual output file names exactly,
// including case - check Edit > Project Settings > Player > Product Name in Unity right after
// building, since that's what Unity names <ProductName>.loader.js / .data / .framework.js / .wasm.
//
// Setup:
//   1. In Unity: build the character customization scene via File > Build Settings > WebGL >
//      Build, with Compression Format set to Disabled (Player Settings > Publishing Settings) -
//      same reasoning as UnityGame.jsx's own setup note.
//   2. Point the build output folder at client/public/<BUILD_FOLDER> (see the constant below) -
//      anything under client/public/ is served by Vite at the site root automatically.
//   3. Update BUILD_NAME below to match the actual file names Unity produced.
//   4. Drop <CharacterCustomizerGame token={...} /> wherever the customizer should mount - see
//      StudentCharacterCustomization.jsx.

const BUILD_FOLDER = "customizerbuild"

// Unity names Build/<name>.loader.js / .data / .framework.js / .wasm after the OUTPUT FOLDER you
// chose when building, not the Player Settings Product Name - so this must match BUILD_FOLDER
// above unless you rename the files by hand after building. Check
// client/public/customizerbuild/Build/ if this ever drifts.
const BUILD_NAME = "customizerbuild"

function CharacterCustomizerGame({ token, onError }) {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const instanceRef = useRef(null)
    const [status, setStatus] = useState("loading") // loading | ready | error
    const [progress, setProgress] = useState(0)
    const [isFullscreen, setIsFullscreen] = useState(false)

    // Keeps isFullscreen in sync no matter how fullscreen was exited - the button, Escape
    // (handled natively by the browser), or F11 - see UnityGame.jsx for the same pattern.
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === containerRef.current)
        }
        document.addEventListener("fullscreenchange", handleFullscreenChange)
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }, [])

    // Enter-only - see UnityGame.jsx's FULLSCREEN note for why there's no exit branch here.
    const enterFullscreen = () => {
        containerRef.current?.requestFullscreen().catch(() => {
            // Browser blocked it (no recent user gesture, unsupported, etc). The button itself
            // is always a valid direct-click gesture, so a manual click right after this still
            // works.
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

                    containerRef.current?.requestFullscreen().catch(() => {})

                    // roomId: 0 - this scene never reads it, see file header above.
                    instance.SendMessage(
                        "GameManager",
                        "SetAuthContext",
                        JSON.stringify({ token, roomId: 0 })
                    )
                })
                .catch((err) => {
                    console.error("[CharacterCustomizerGame] Failed to start Unity instance:", err)
                    setStatus("error")
                    onError?.(err)
                })
        }

        script.onerror = () => {
            console.error(`[CharacterCustomizerGame] Failed to load Unity loader script: ${loaderUrl}`)
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
    }, [token])

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                background: "#000",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                ...(isFullscreen
                    ? { width: "100vw", height: "100vh", justifyContent: "center" }
                    : { width: "100%", maxWidth: "960px" }),
            }}
        >
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
                        Loading the customizer... {Math.round(progress * 100)}%
                    </div>
                )}

                {status === "error" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#E08080", fontFamily: "monospace", fontSize: "13px", textAlign: "center", padding: "20px" }}>
                        Failed to load the customizer. Check the browser console for details.
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

export default CharacterCustomizerGame
