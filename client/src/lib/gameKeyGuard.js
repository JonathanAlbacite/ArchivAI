// Keeps the browser's own keyboard and mouse shortcuts away from the game while it is running
// (UnityGame.jsx turns it on when the game is ready and off when the game closes). The game uses
// WASD, Ctrl (crouch), Shift, Space, Tab (slingshot), F, I, the number keys, the arrow keys, the
// mouse buttons and the mouse wheel; the browser has its own meaning for many of the same keys.
//
// WHAT IS STOPPED (preventDefault only - the game still receives every key):
//   - Tab (moves the focus out of the game), Space and the arrow keys, Page Up/Down, Home/End (scroll the
//     page), Backspace, Alt (menu bar, and Alt+Left/Right = back/forward).
//   - F1, F3, F5, F6, F7 (help, find, reload, address bar, caret mode). F11 and F12 are left alone.
//   - Ctrl/Cmd + S, D, F, G, H, J, K, L, O, P, R, U, E, B (save, bookmark, find, history, downloads, open,
//     print, reload, source, search, bookmarks) and Ctrl + plus/minus/zero and Ctrl + wheel (zoom).
//   - The right-click menu on the game.
//
// WHAT A PAGE CANNOT STOP, AND WHAT IS DONE ABOUT IT: Ctrl+W (close tab), Ctrl+T, Ctrl+N, Ctrl+Shift+T/N,
// Ctrl+Tab, Ctrl+PageUp/PageDown and Ctrl+1..9 are kept by the browser itself: the page never gets the
// chance to cancel them, so holding Ctrl (crouch) and pressing W (walk) closes the tab. Two things help:
//   1. Keyboard Lock (Chrome and Edge, FULLSCREEN ONLY): while the game is fullscreen, the keys W, T, N, Q, R,
//      Tab, PageUp/PageDown and 1..9 are sent to the page instead of to the browser's shortcuts, so
//      Ctrl+W no longer closes the tab. Escape and F11 are NOT locked: Escape still opens the pause menu
//      and leaves fullscreen.
//   2. A "Leave this site?" question (beforeunload) while the game runs, so a shortcut that still gets
//      through (windowed mode, Firefox, Safari, Alt+F4) asks before the tab closes instead of closing it.
//
// Nothing is blocked while the pause menu is open (isPaused), so Tab and the arrow keys work in the menu,
// nor while the player types in a text field.

const STOPPED_KEYS = new Set([
    "Tab", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End",
    "Backspace", "Alt", "F1", "F3", "F5", "F6", "F7",
])

// Letters that mean something to the browser with Ctrl (Cmd on a Mac). Ctrl+W, T, N, Q are not here:
// the browser does not let a page stop them (see above).
const STOPPED_CTRL_KEYS = new Set(["s", "d", "f", "g", "h", "j", "k", "l", "o", "p", "r", "u", "e", "b"])

// Ctrl zoom keys; "+" needs Shift on many keyboards, so Shift is allowed for these.
const ZOOM_KEYS = new Set(["+", "=", "-", "_", "0"])

// Keys given to the page by Keyboard Lock while fullscreen (event.code names).
const LOCKED_CODES = [
    "KeyW", "KeyT", "KeyN", "KeyQ", "KeyR", "Tab", "PageUp", "PageDown",
    "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9",
]

const isTyping = (target) => {
    if (!(target instanceof HTMLElement)) return false
    return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

// Turns the guard on. container is the element the game is shown fullscreen on; isPaused() says whether
// the pause menu is open. Returns the function that turns it off again.
export function startGameKeyGuard({ container, isPaused }) {
    const handleKeyDown = (event) => {
        if (isPaused() || isTyping(event.target)) return

        const withCtrl = event.ctrlKey || event.metaKey
        const stop = STOPPED_KEYS.has(event.key)
            || event.altKey
            || (withCtrl && !event.shiftKey && STOPPED_CTRL_KEYS.has(event.key.toLowerCase()))
            || (withCtrl && ZOOM_KEYS.has(event.key))
            || (withCtrl && event.shiftKey && event.key.toLowerCase() === "r")

        if (stop) event.preventDefault()
    }

    // Space on a focused button would press it when the key is released.
    const handleKeyUp = (event) => {
        if (event.key === " " && !isPaused() && !isTyping(event.target)) event.preventDefault()
    }

    // Ctrl + wheel is the browser's zoom. The listener must be non-passive to be allowed to stop it.
    const handleWheel = (event) => {
        if (event.ctrlKey) event.preventDefault()
    }

    const handleContextMenu = (event) => event.preventDefault()

    // The question before the tab closes or the page reloads. It does not appear when the player leaves
    // through the site's own buttons (those do not unload the page).
    const handleBeforeUnload = (event) => {
        event.preventDefault()
        event.returnValue = ""
    }

    // Keyboard Lock: only possible in fullscreen, and only in browsers that have it.
    const handleFullscreenChange = () => {
        const keyboard = navigator.keyboard
        if (!keyboard?.lock) return

        try {
            if (document.fullscreenElement) {
                const request = keyboard.lock(LOCKED_CODES)
                if (request && typeof request.catch === "function") request.catch(() => {})
            } else {
                keyboard.unlock()
            }
        } catch {
            // The browser refused; the "Leave this site?" question is still there.
        }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    window.addEventListener("keyup", handleKeyUp, true)
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true })
    window.addEventListener("beforeunload", handleBeforeUnload)
    container?.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    handleFullscreenChange() // already fullscreen when the game becomes ready

    return () => {
        window.removeEventListener("keydown", handleKeyDown, true)
        window.removeEventListener("keyup", handleKeyUp, true)
        window.removeEventListener("wheel", handleWheel, { passive: false, capture: true })
        window.removeEventListener("beforeunload", handleBeforeUnload)
        container?.removeEventListener("contextmenu", handleContextMenu)
        document.removeEventListener("fullscreenchange", handleFullscreenChange)

        try {
            navigator.keyboard?.unlock?.()
        } catch {
            // Nothing to undo.
        }
    }
}
