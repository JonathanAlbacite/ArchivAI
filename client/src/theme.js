// The Curious Archive - design tokens for The Archivist's Legacy.
//
// This file is the single source of truth. Nothing else hardcodes colors:
// applyThemeVars() (below) turns these values into CSS custom properties on
// <html> (--color-*, --radius-*, --shadow-*, ...), and every stylesheet and
// inline style reads those variables, so switching light/dark only means
// re-running applyThemeVars with the other mode. See DESIGN_SYSTEM.md.
//
// Contrast: every text/background pairing used by the components was checked
// against WCAG AA (scripts/check-contrast.mjs). Values that differ from the
// original palette brief were adjusted for that reason and are marked "AA".

export const colors = {
  light: {
    bg: "#F7F8FC",
    bgWarm: "#FFF9EF",
    surface: "#FFFFFF",
    surfaceMuted: "#F0F3FA",
    surfaceHover: "#E9EEFA",
    border: "#DCE2EF",
    borderStrong: "#7D89A1", // AA: #AEBBD1 was 1.9:1; input borders need 3:1

    text: "#202944",
    textMuted: "#58647C",
    textSubtle: "#5F6C83", // AA: #68758C was 4.3:1 on surfaceMuted
    textOnPrimary: "#FFFFFF",

    primary: "#315FEA",
    primaryHover: "#244CC7",
    primaryPressed: "#1C3CA5",
    primarySoft: "#E7EDFF",

    secondary: "#7955C7",
    secondaryHover: "#6843B5",
    secondarySoft: "#F0E9FF",

    teacher: "#A9550F", // AA: #B85E16 was 4.4:1 against white button text
    teacherSoft: "#FFF0DF",
    student: "#6941C6",
    studentSoft: "#F0E9FF",

    laboratory: "#287A54",
    laboratorySoft: "#DFF4E7",
    library: "#7D5A00", // AA: #8B6500 was 4.4:1 on librarySoft
    librarySoft: "#FFF0C2",
    tomb: "#954568",
    tombSoft: "#F8E5EF",

    success: "#24764A",
    successSoft: "#DFF5E8",
    warning: "#8A4E00", // AA: #945400 was 4.4:1 on warningSoft
    warningSoft: "#FFF0C2",
    danger: "#B42332",
    dangerSoft: "#FDE7E9",
    info: "#2457B8",
    infoSoft: "#E2EDFF",

    xp: "#7048CF",
    xpTrack: "#E9E2F8",
    gold: "#936500",
    goldSoft: "#FFF1C7",
    silver: "#58667A",
    silverSoft: "#E8EEF7",
    bronze: "#9A552F",
    bronzeSoft: "#FBE7DA",
    slate: "#4D586B",
    slateSoft: "#E7EAF0",

    online: "#218653",
    offline: "#68758C",
    focus: "#2457B8",
    overlay: "rgba(25, 34, 57, 0.48)",
  },

  dark: {
    bg: "#141927",
    bgWarm: "#211E25",
    surface: "#20283A",
    surfaceMuted: "#293349",
    surfaceHover: "#34405A",
    border: "#3B4760",
    borderStrong: "#8492AC",

    text: "#F3F5FC",
    textMuted: "#C1CBE0",
    textSubtle: "#A5B2CC",
    // AA: the dark accents are pastel, so text sitting on a solid accent
    // (primary buttons, user chat bubbles) is dark ink instead of white
    // (white on #8EAAFF is only 2.2:1).
    textOnPrimary: "#141927",

    primary: "#8EAAFF",
    primaryHover: "#A6BCFF",
    primaryPressed: "#6F91F7",
    primarySoft: "#293C69",

    secondary: "#C2A7FF",
    secondaryHover: "#D3C1FF",
    secondarySoft: "#392D56",

    teacher: "#FFB777",
    teacherSoft: "#49301F",
    student: "#C2A7FF",
    studentSoft: "#392D56",

    laboratory: "#86D8A8",
    laboratorySoft: "#203E31",
    library: "#F2D477",
    librarySoft: "#463C20",
    tomb: "#F1A4C6",
    tombSoft: "#47283A",

    success: "#86D8A8",
    successSoft: "#203E31",
    warning: "#F2D477",
    warningSoft: "#463C20",
    danger: "#FF9DA6",
    dangerSoft: "#4B252D",
    info: "#A6C4FF",
    infoSoft: "#263858",

    xp: "#C2A7FF",
    xpTrack: "#423657",
    gold: "#F2D477",
    goldSoft: "#463C20",
    silver: "#D0D8E7",
    silverSoft: "#34405A",
    bronze: "#E5A17C",
    bronzeSoft: "#4A3024",
    slate: "#C1CBE0",
    slateSoft: "#293349",

    online: "#86D8A8",
    offline: "#A5B2CC",
    focus: "#A6C4FF",
    overlay: "rgba(0, 0, 0, 0.68)",
  },
};

export const fonts = {
  display: "'Fredoka', 'Inter', system-ui, sans-serif",
  body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'Cascadia Code', Consolas, monospace",
};

export const typeScale = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 28,
  pill: 999,
};

export const shadows = {
  sm: "0 2px 6px rgba(32,41,68,0.05)",
  md: "0 5px 16px rgba(32,41,68,0.08)",
  lg: "0 12px 32px rgba(32,41,68,0.12)",
  pop: "0 4px 0 rgba(36,76,199,0.30)",
};

// Dark surfaces need stronger shadows to read at all.
const darkShadows = {
  sm: "0 2px 6px rgba(0,0,0,0.25)",
  md: "0 5px 16px rgba(0,0,0,0.32)",
  lg: "0 12px 32px rgba(0,0,0,0.42)",
  pop: "0 4px 0 rgba(0,0,0,0.45)",
};

export const motion = {
  fast: "120ms",
  normal: "200ms",
  slow: "320ms",
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

export const theme = {
  colors,
  fonts,
  typeScale,
  spacing,
  radius,
  shadows,
  motion,
};

// "primaryHover" -> "primary-hover", "2xl" -> "2xl"
const kebab = (key) => String(key).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// Every CSS variable for one mode, e.g. { "--color-primary": "#315FEA", "--radius-md": "12px" }.
export function cssVarsFor(mode = "light") {
  const palette = colors[mode] || colors.light;
  const vars = {};
  for (const [k, v] of Object.entries(palette)) vars[`--color-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(fonts)) vars[`--font-${k}`] = v;
  for (const [k, v] of Object.entries(typeScale)) vars[`--text-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(spacing)) vars[`--space-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(radius)) vars[`--radius-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(mode === "dark" ? darkShadows : shadows)) vars[`--shadow-${k}`] = v;
  for (const [k, v] of Object.entries(motion)) vars[`--motion-${k}`] = v;
  return vars;
}

// Writes the variables for `mode` onto <html> and records the mode in
// data-theme (stylesheets key a few mode-specific rules off it).
export function applyThemeVars(mode = "light") {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(cssVarsFor(mode))) root.style.setProperty(name, value);
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

// Shorthand for reading a token in an inline style: cssVar("primary") -> "var(--color-primary)".
export const cssVar = (colorKey) => `var(--color-${kebab(colorKey)})`;

export default theme;
