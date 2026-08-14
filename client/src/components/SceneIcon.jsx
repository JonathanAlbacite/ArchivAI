import { getSceneMeta } from "../scenes";
import { fonts } from "../theme";

export function SceneIcon({ scene, size = 18 }) {
  const { Icon, color } = getSceneMeta(scene);
  return <Icon size={size} color={color} strokeWidth={2} />;
}

export function SceneBadge({ scene }) {
  const { Icon, color, label } = getSceneMeta(scene);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "10px",
        backgroundColor: `${color}22`,
        border: `1px solid ${color}55`,
        color,
        fontFamily: fonts.body,
        fontSize: "11px",
        fontWeight: "600",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} color={color} />
      {label}
    </span>
  );
}

export default SceneIcon;
