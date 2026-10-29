import { createContext, useContext } from "react";

export const THEME_STORAGE_KEY = "archivai_theme";

// "light" is the default; only an explicit choice switches to dark.
export const readStoredTheme = () => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

export const ThemeModeContext = createContext({ mode: "light", toggle: () => {}, setMode: () => {} });

export const useThemeMode = () => useContext(ThemeModeContext);
