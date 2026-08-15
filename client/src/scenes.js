import { FlaskConical, BookOpen, Skull, HelpCircle } from "lucide-react";
import { colors } from "./theme";

// previewSrc points at /public/scenes/<key>.png — drop the artwork in there
// and it picks it up automatically. Until then callers fall back to the icon
// (see IllustrationFrame's onError handling in SpellBookModal).
export const SCENE_LIST = [
  { key: "laboratory", label: "Laboratory", Icon: FlaskConical, color: colors.sceneLab, previewSrc: "/scenes/laboratory.png" },
  { key: "library", label: "Library", Icon: BookOpen, color: colors.sceneLibrary, previewSrc: "/scenes/library.png" },
  { key: "tomb", label: "Tomb", Icon: Skull, color: colors.sceneTomb, previewSrc: "/scenes/tomb.png" },
];

export function getSceneMeta(scene) {
  const key = (scene || "").toLowerCase().trim();
  return (
    SCENE_LIST.find((s) => s.key === key) || {
      key: "",
      label: scene || "Unknown Realm",
      Icon: HelpCircle,
      color: colors.inkMuted,
      previewSrc: null,
    }
  );
}
