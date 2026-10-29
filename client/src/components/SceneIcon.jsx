import { getSceneMeta } from "../scenes";
import { Badge } from "./ui";

export function SceneIcon({ scene, size = 18 }) {
  const { Icon, color } = getSceneMeta(scene);
  return <Icon size={size} color={color} strokeWidth={2} aria-hidden="true" />;
}

// Scene label pill - icon + name, tinted with the scene's color pair.
export function SceneBadge({ scene, size }) {
  const meta = getSceneMeta(scene);
  return (
    <Badge tone={meta.key || "neutral"} icon={meta.Icon} size={size}>
      {meta.label}
    </Badge>
  );
}

export default SceneIcon;
