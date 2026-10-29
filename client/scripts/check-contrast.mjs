// Checks every text/background pairing the UI components use against WCAG AA
// for both theme modes. Run with: npm run check:contrast
// Exits with code 1 when any pairing falls below its required ratio.
import { colors } from "../src/theme.js";

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// [foreground, background, minimum ratio] - 4.5 for text, 3 for large text / UI parts.
const PAIRS = [
  ["text", "bg", 4.5], ["text", "surface", 4.5], ["text", "surfaceMuted", 4.5], ["text", "surfaceHover", 4.5],
  ["textMuted", "bg", 4.5], ["textMuted", "surface", 4.5], ["textMuted", "surfaceMuted", 4.5],
  ["textSubtle", "surface", 4.5], ["textSubtle", "surfaceMuted", 4.5], ["textSubtle", "bg", 4.5],
  ["textOnPrimary", "primary", 4.5], ["textOnPrimary", "primaryHover", 4.5], ["textOnPrimary", "primaryPressed", 4.5],
  ["textOnPrimary", "secondary", 4.5], ["textOnPrimary", "teacher", 4.5], ["textOnPrimary", "student", 4.5],
  ["textOnPrimary", "danger", 4.5], ["textOnPrimary", "success", 4.5],
  ["primary", "surface", 4.5], ["primary", "primarySoft", 4.5], ["primary", "bg", 4.5],
  ["secondary", "secondarySoft", 4.5], ["teacher", "teacherSoft", 4.5], ["teacher", "surface", 4.5],
  ["student", "studentSoft", 4.5], ["student", "surface", 4.5],
  ["laboratory", "laboratorySoft", 4.5], ["library", "librarySoft", 4.5], ["tomb", "tombSoft", 4.5],
  ["laboratory", "surface", 4.5], ["library", "surface", 4.5], ["tomb", "surface", 4.5],
  ["success", "successSoft", 4.5], ["warning", "warningSoft", 4.5], ["danger", "dangerSoft", 4.5], ["info", "infoSoft", 4.5],
  ["success", "surface", 4.5], ["danger", "surface", 4.5], ["warning", "surface", 4.5],
  ["xp", "surface", 4.5], ["xp", "xpTrack", 3],
  ["gold", "goldSoft", 4.5], ["silver", "silverSoft", 4.5], ["bronze", "bronzeSoft", 4.5], ["slate", "slateSoft", 4.5],
  ["online", "surface", 3], ["focus", "surface", 3], ["focus", "bg", 3], ["borderStrong", "surface", 3],
];

let failures = 0;
for (const mode of ["light", "dark"]) {
  const p = colors[mode];
  for (const [fg, bg, min] of PAIRS) {
    const r = ratio(p[fg], p[bg]);
    if (r < min) {
      failures++;
      console.log(`FAIL ${mode.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)} (needs ${min})`);
    }
  }
}
console.log(failures ? `\n${failures} pairing(s) below AA.` : `All ${PAIRS.length * 2} pairings meet WCAG AA.`);
process.exit(failures ? 1 : 0);
