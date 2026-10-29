import { ArrowRight, KeyRound } from "lucide-react";
import { Button, Card } from "./ui";

// One classroom room. Shared by the student and teacher dashboards - the
// accent follows the signed-in role. meta: [{ icon, label }] facts shown under
// the name; progress: { done, total, label } renders a small completion bar;
// menu: optional node (e.g. a <Menu>) placed in the top-right corner.
function RoomCard({ name, code, subtitle, description, meta = [], progress, actionLabel = "Open room", to, menu }) {
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <Card hoverable className="room-card">
      <div className="room-card__band" aria-hidden="true" />
      <div className="row row-between row-nowrap" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h3 className="card__title break-words">{name}</h3>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {menu}
      </div>

      {code && (
        <p className="room-card__code">
          <KeyRound size={14} aria-hidden="true" />
          <span className="sr-only">Room code</span>
          <span className="mono">{code}</span>
        </p>
      )}
      {description && <p className="text-sm text-muted room-card__desc">{description}</p>}

      {meta.length > 0 && (
        <ul className="room-card__meta" role="list">
          {meta.map(({ icon: Icon, label }) => (
            <li key={label}>
              <Icon size={15} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      )}

      {progress && (
        <div className="room-card__progress">
          <div className="row row-between text-xs">
            <span className="font-semibold">{progress.label}</span>
            <span className="text-muted">{pct}%</span>
          </div>
          <div className="mini-track" role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="card__footer">
        <Button to={to} variant="soft" block iconRight={ArrowRight}>
          {actionLabel}
          <span className="sr-only">: {name}</span>
        </Button>
      </div>
    </Card>
  );
}

export default RoomCard;
