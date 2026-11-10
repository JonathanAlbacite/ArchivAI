// The player's game options (volume and mouse sensitivity), kept in this browser so they are the
// same the next time the game opens. They are sent to the game when it is ready (UnityGame.jsx) and
// again whenever they are changed in the pause menu (PauseMenu.jsx). Unity applies them in
// PauseMenuBridge.cs.

const STORAGE_KEY = "archivai:game-settings"

export const DEFAULT_GAME_SETTINGS = { volume: 1, sensitivity: 1 }

export const SENSITIVITY_RANGE = { min: 0.25, max: 2, step: 0.05 }

const clamp = (value, min, max, fallback) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

// Reads the saved options, falling back to the defaults for anything missing or unreadable.
export function loadGameSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
        return {
            volume: clamp(saved.volume, 0, 1, DEFAULT_GAME_SETTINGS.volume),
            sensitivity: clamp(saved.sensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max, DEFAULT_GAME_SETTINGS.sensitivity),
        }
    } catch {
        return { ...DEFAULT_GAME_SETTINGS }
    }
}

// Saves the options. Silent if the browser does not allow storage (the options then only last
// until the page is closed).
export function saveGameSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
        // Storage blocked - nothing to do.
    }
}

// Sends both options to the running game. SendMessage only takes text, so they are written as text.
export function sendGameSettings(instance, settings) {
    if (!instance) return
    instance.SendMessage("GameManager", "SetMasterVolume", String(settings.volume))
    instance.SendMessage("GameManager", "SetLookSensitivity", String(settings.sensitivity))
}
