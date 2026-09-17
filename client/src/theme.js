// Shared design tokens for The Archivist's Legacy redesign.
// Plain values only (no style-generating helpers) so every page keeps
// composing its own inline style objects, just from a consistent palette.

export const colors = {
  // Shared / base
  obsidian: "#120D08",
  obsidianDeep: "#0A0603",
  wood: "#1C140C",
  vaultBorder: "#483420",
  brass: "#A37845",
  brassBright: "#D9B872",
  parchment: "#F3E9D7",
  parchmentDark: "#E5D5BE",
  parchmentPanel: "#FFF9EF",
  parchmentLine: "#E7DCC7",
  ink: "#3A2A20",
  inkMuted: "#5D5145",

  // Teacher realm — dark fantasy Vault Keeper
  ember: "#A95B2C",
  emberBright: "#E08A3C",
  emberDim: "#7A431F",

  // Student realm — Fairytale Archivist
  magicViolet: "#8B6FB3",
  magicVioletBright: "#B79EDC",
  fairyTeal: "#5FA9A0",
  softGold: "#E8C77E",

  // Scene accents
  sceneLab: "#4E8F6C",
  sceneLibrary: "#C9A227",
  sceneTomb: "#8A4A6B",

  // Status
  success: "#3A6B35",
  successBg: "#DCEEDA",
  draft: "#8A6D3B",
  draftBg: "#F1E4C6",
  danger: "#7A2E2E",

  // "Enchanted glass" — translucent, blurred surfaces (paired with
  // backdrop-filter: blur(...)) for a themed glassmorphism treatment, e.g.
  // the teacher chat widget. Kept high-opacity where real text sits on top
  // (glassParchment) so legibility never trades off against the effect.
  glassDark: "rgba(18, 13, 8, 0.72)",
  glassParchment: "rgba(243, 233, 215, 0.9)",
  glassParchmentBright: "rgba(255, 249, 239, 0.88)",
  glassBorder: "rgba(217, 184, 114, 0.35)",
  glassGlow: "rgba(224, 138, 60, 0.45)",
};

export const fonts = {
  display: "Cinzel, serif",
  displayDecorative: "'Cinzel Decorative', Cinzel, serif",
  body: "Poppins, sans-serif",
  flourish: "'MedievalSharp', cursive",
};
