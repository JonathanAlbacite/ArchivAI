import { getSceneMeta, useEnvironments } from "../scenes";
import { Badge } from "./ui";

export function SceneIcon({ scene, size = 18 }) {
  useEnvironments();
  const { Icon, color } = getSceneMeta(scene);
  return <Icon size={size} color={color} strokeWidth={2} aria-hidden="true" />;
}

// Scene label pill - icon + name, tinted with the scene's color pair. The colors are set on the pill
// itself (not by a fixed tone name), so an environment the admin adds gets its own colors.
export function SceneBadge({ scene, size }) {
  useEnvironments();
  const meta = getSceneMeta(scene);
  return (
    <Badge tone="neutral" icon={meta.Icon} size={size} style={{ "--chip-fg": meta.color, "--chip-bg": meta.soft }}>
      {meta.label}
    </Badge>
  );
}

export default SceneIcon;
