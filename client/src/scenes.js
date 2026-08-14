import { FlaskConical, BookOpen, Skull, HelpCircle } from "lucide-react";
import { colors } from "./theme";

export const SCENE_LIST = [
  { key: "laboratory", label: "Laboratory", Icon: FlaskConical, color: colors.sceneLab },
  { key: "library", label: "Library", Icon: BookOpen, color: colors.sceneLibrary },
  { key: "tomb", label: "Tomb", Icon: Skull, color: colors.sceneTomb },
];

export function getSceneMeta(scene) {
  const key = (scene || "").toLowerCase().trim();
  return (
    SCENE_LIST.find((s) => s.key === key) || {
      key: "",
      label: scene || "Unknown Realm",
      Icon: HelpCircle,
      color: colors.inkMuted,
    }
  );
}
