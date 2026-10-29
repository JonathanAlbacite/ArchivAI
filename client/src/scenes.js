import { FlaskConical, BookOpen, Landmark, HelpCircle } from "lucide-react";

// The three playable vaults. `key` is the value stored on Campaign.scene and
// used in the vault-template URLs, so it must not change. Colors are theme
// variables (laboratory = green, library = gold, tomb = plum).
export const SCENE_LIST = [
  { key: "laboratory", label: "Laboratory", Icon: FlaskConical, blurb: "A science lab setting." },
  { key: "library", label: "Library", Icon: BookOpen, blurb: "A library setting." },
  { key: "tomb", label: "Tomb", Icon: Landmark, blurb: "An ancient tomb setting." },
].map((s) => ({ ...s, color: `var(--color-${s.key})`, soft: `var(--color-${s.key}-soft)` }));

const UNKNOWN = {
  key: "",
  Icon: HelpCircle,
  blurb: "",
  color: "var(--color-text-muted)",
  soft: "var(--color-surface-muted)",
};

export function getSceneMeta(scene) {
  const key = (scene || "").toLowerCase().trim();
  return SCENE_LIST.find((s) => s.key === key) || { ...UNKNOWN, label: scene || "No vault" };
}

// Inline style that exposes a scene's pair of colors to CSS (--scene / --scene-soft).
export const sceneStyle = (scene) => {
  const meta = getSceneMeta(scene);
  return { "--scene": meta.color, "--scene-soft": meta.soft };
};
