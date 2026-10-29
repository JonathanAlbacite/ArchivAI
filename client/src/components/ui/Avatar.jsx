const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

// Picture or initials. `online` must come from real presence data (see
// lib/useRoomMembers.js) - pass undefined when presence isn't known so no
// status dot is drawn at all.
export function Avatar({ name, src, size = 40, online, className }) {
  return (
    <span className={["avatar", className].filter(Boolean).join(" ")} style={{ "--size": `${size}px` }} aria-hidden={!src ? "true" : undefined}>
      {src ? <img src={src} alt={name ? `${name}'s avatar` : ""} /> : initialsOf(name)}
      {online === true && <span className="avatar__status" />}
    </span>
  );
}

// Small labelled presence dot: "Active now" / "Away". Text always accompanies the color.
export function OnlineIndicator({ online, showOffline = false }) {
  if (!online && !showOffline) return null;
  return (
    <span className="presence" data-online={online ? "true" : "false"}>
      <span className="presence__dot" aria-hidden="true" />
      {online ? "Active now" : "Away"}
    </span>
  );
}

export default Avatar;
