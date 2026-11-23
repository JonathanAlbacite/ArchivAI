import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Flag, Keyboard, LogOut, Play, RefreshCcw, SlidersHorizontal } from "lucide-react"
import { DEFAULT_GAME_SETTINGS, SENSITIVITY_RANGE } from "../../lib/gameSettings"

// PauseMenu.jsx
//
// The in-game pause menu: Resume, Restart from checkpoint, Controls, Options, Restart game and
// Exit to room. It is drawn by UnityGame.jsx INSIDE the game's own frame (over the canvas), not as
// a normal page dialog, because a dialog portaled to <body> would be invisible while the game is in
// fullscreen. The game is already paused by Unity when this is shown (PauseMenuBridge.cs).
//
// The menu does nothing to the game itself; it only calls the functions it is given:
//   onResume()            - back to the game
//   onRestartCheckpoint() - start the game again from the last checkpoint
//   onRestartGame()       - delete the saved progress and start over; returns a promise that gives
//                           an error text when it failed, or nothing when it worked
//   onExit()              - leave the game (for the room, or for the campaign page: exitTarget is the word shown)
//   onSettingsChange(s)   - the volume or the mouse sensitivity changed
// Anything that throws away progress asks "are you sure?" first, inside the menu.
//
// Esc goes back one step (Controls/Options/a question back to the menu), and from the main menu
// resumes the game. For a moment after the menu opens Esc is ignored, because the same key press
// that released the mouse can also arrive here as a key event.

const CONTROLS = [
    ["Move", "W A S D or the arrow keys"],
    ["Look around", "Mouse"],
    ["Sprint", "Hold Shift"],
    ["Crouch", "Hold Ctrl"],
    ["Switch between first and third person", "Right mouse button"],
    ["Use what the crosshair points at (first person)", "Left mouse button"],
    ["Talk, hold or let go of a crate, take the sword (third person)", "F"],
    ["Attack (weapon drawn)", "Left mouse button"],
    ["Block (weapon drawn)", "Right mouse button"],
    ["Dodge (weapon drawn)", "Space"],
    ["Lock on, draw or put away the weapon", "Tab"],
    ["Choose a hotbar item", "Mouse wheel"],
    ["Leave a close-up view", "Right mouse button"],
    ["Open this menu", "Esc"],
]

const IGNORE_ESC_MS = 400

function PauseMenu({ settings, onSettingsChange, onResume, onRestartCheckpoint, onRestartGame, onExit, exitTarget = "room" }) {
    const [view, setView] = useState("main") // main | controls | options | checkpoint | game | exit
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const openedAt = useRef(performance.now())
    const firstButton = useRef(null)

    const go = (next) => {
        setError("")
        setView(next)
    }

    // Esc: back one step, or resume from the main menu.
    const viewRef = useRef(view)
    const busyRef = useRef(busy)
    const resumeRef = useRef(onResume)
    useEffect(() => {
        viewRef.current = view
        busyRef.current = busy
        resumeRef.current = onResume
    })
    useEffect(() => {
        const handleKey = (event) => {
            if (event.key !== "Escape" || busyRef.current) return
            if (performance.now() - openedAt.current < IGNORE_ESC_MS) return

            event.preventDefault()
            if (viewRef.current === "main") resumeRef.current()
            else {
                setError("")
                setView("main")
            }
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [])

    // Keyboard users start on the first button of whichever view is open.
    useEffect(() => {
        firstButton.current?.focus()
    }, [view])

    const restartGame = async () => {
        setBusy(true)
        setError("")
        const message = await onRestartGame()
        // On success the game restarts and this menu goes away; only a failure comes back here.
        if (message) {
            setError(message)
            setBusy(false)
        }
    }

    return (
        <div className="pause-menu" role="dialog" aria-modal="true" aria-label="Game menu">
            <div className="pause-menu__panel">
                {view === "main" && (
                    <>
                        <h2 className="pause-menu__title">Paused</h2>
                        <div className="pause-menu__list">
                            <button type="button" ref={firstButton} className="pause-menu__btn pause-menu__btn--primary" onClick={onResume}>
                                <Play size={18} aria-hidden="true" /> Resume
                            </button>
                            <button type="button" className="pause-menu__btn" onClick={() => go("checkpoint")}>
                                <Flag size={18} aria-hidden="true" /> Restart from checkpoint
                            </button>
                            <button type="button" className="pause-menu__btn" onClick={() => go("controls")}>
                                <Keyboard size={18} aria-hidden="true" /> Controls
                            </button>
                            <button type="button" className="pause-menu__btn" onClick={() => go("options")}>
                                <SlidersHorizontal size={18} aria-hidden="true" /> Options
                            </button>
                            <button type="button" className="pause-menu__btn" onClick={() => go("game")}>
                                <RefreshCcw size={18} aria-hidden="true" /> Restart game
                            </button>
                            <button type="button" className="pause-menu__btn pause-menu__btn--danger" onClick={() => go("exit")}>
                                <LogOut size={18} aria-hidden="true" /> Exit to {exitTarget}
                            </button>
                        </div>
                    </>
                )}

                {view === "controls" && (
                    <>
                        <h2 className="pause-menu__title">Controls</h2>
                        <dl className="pause-menu__controls">
                            {CONTROLS.map(([action, keys]) => (
                                <div key={action} className="pause-menu__control">
                                    <dt>{action}</dt>
                                    <dd>{keys}</dd>
                                </div>
                            ))}
                        </dl>
                        <BackButton buttonRef={firstButton} onClick={() => go("main")} />
                    </>
                )}

                {view === "options" && (
                    <>
                        <h2 className="pause-menu__title">Options</h2>
                        <label className="pause-menu__field">
                            <span>
                                Volume <strong>{Math.round(settings.volume * 100)}%</strong>
                            </span>
                            <input
                                ref={firstButton}
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={settings.volume}
                                onChange={(event) => onSettingsChange({ ...settings, volume: Number(event.target.value) })}
                            />
                        </label>
                        <label className="pause-menu__field">
                            <span>
                                Mouse sensitivity <strong>{settings.sensitivity.toFixed(2)}x</strong>
                            </span>
                            <input
                                type="range"
                                min={SENSITIVITY_RANGE.min}
                                max={SENSITIVITY_RANGE.max}
                                step={SENSITIVITY_RANGE.step}
                                value={settings.sensitivity}
                                onChange={(event) => onSettingsChange({ ...settings, sensitivity: Number(event.target.value) })}
                            />
                        </label>
                        <p className="pause-menu__note">Saved in this browser. Mouse sensitivity changes how fast the camera turns.</p>
                        <div className="pause-menu__row">
                            <button type="button" className="pause-menu__btn" onClick={() => onSettingsChange({ ...DEFAULT_GAME_SETTINGS })}>
                                Reset
                            </button>
                            <BackButton onClick={() => go("main")} />
                        </div>
                    </>
                )}

                {view === "checkpoint" && (
                    <Question
                        title="Restart from your last checkpoint?"
                        text="The game starts again at your last checkpoint. Anything since then is lost."
                        confirmLabel="Restart"
                        buttonRef={firstButton}
                        onConfirm={onRestartCheckpoint}
                        onCancel={() => go("main")}
                    />
                )}

                {view === "game" && (
                    <Question
                        title="Restart the whole game?"
                        text="Your saved checkpoint and the clues in your journal for this campaign are deleted, and you start from the beginning."
                        confirmLabel="Restart game"
                        danger
                        busy={busy}
                        error={error}
                        buttonRef={firstButton}
                        onConfirm={restartGame}
                        onCancel={() => go("main")}
                    />
                )}

                {view === "exit" && (
                    <Question
                        title="Leave this campaign?"
                        text="Anything since your last checkpoint won't be saved. You can pick up from your last checkpoint next time."
                        confirmLabel="Leave"
                        danger
                        buttonRef={firstButton}
                        onConfirm={onExit}
                        onCancel={() => go("main")}
                    />
                )}
            </div>
        </div>
    )
}

function BackButton({ onClick, buttonRef }) {
    return (
        <button type="button" ref={buttonRef} className="pause-menu__btn" onClick={onClick}>
            <ArrowLeft size={18} aria-hidden="true" /> Back
        </button>
    )
}

// An "are you sure?" step. The cancel button is the one focused first, so Enter never destroys
// anything by accident.
function Question({ title, text, confirmLabel, danger, busy, error, buttonRef, onConfirm, onCancel }) {
    return (
        <>
            <h2 className="pause-menu__title">{title}</h2>
            <p className="pause-menu__text">{text}</p>
            {error && <p className="pause-menu__error" role="alert">{error}</p>}
            <div className="pause-menu__row">
                <button type="button" ref={buttonRef} className="pause-menu__btn" onClick={onCancel} disabled={busy}>
                    Cancel
                </button>
                <button
                    type="button"
                    className={`pause-menu__btn ${danger ? "pause-menu__btn--danger" : "pause-menu__btn--primary"}`}
                    onClick={onConfirm}
                    disabled={busy}
                    aria-busy={busy || undefined}
                >
                    {busy ? "Working..." : confirmLabel}
                </button>
            </div>
        </>
    )
}

export default PauseMenu
