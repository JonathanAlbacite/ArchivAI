import { fonts } from "../theme";

// The green filled dot with "Active" shown next to a member's name while they
// are active (nothing is shown for a member who is not).
const ACTIVE_GREEN = "#3FBF6B";

function ActiveBadge({ active }) {
  if (!active) return null;
  return (
    <span
      title="Active now"
      style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontFamily: fonts.body, fontSize: "11px", fontWeight: "600", color: ACTIVE_GREEN }}
    >
      <span
        style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: ACTIVE_GREEN, boxShadow: `0 0 6px ${ACTIVE_GREEN}` }}
      />
      Active
    </span>
  );
}

export default ActiveBadge;
