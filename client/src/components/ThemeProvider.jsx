import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { applyThemeVars } from "../theme";
import { ThemeModeContext, THEME_STORAGE_KEY, readStoredTheme } from "../lib/themeMode";

// Owns the light/dark choice: writes the matching CSS variables onto <html>
// before paint and remembers the choice in this browser.
function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readStoredTheme);

  useLayoutEffect(() => {
    applyThemeVars(mode);
  }, [mode]);

  const setMode = useCallback((next) => {
    setModeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage blocked - the choice just won't persist
    }
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, toggle: () => setMode(mode === "dark" ? "light" : "dark") }),
    [mode, setMode]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export default ThemeProvider;
