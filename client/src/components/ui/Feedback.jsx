import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

// Centered "nothing here yet" panel with optional art and a next step.
export function EmptyState({ art, icon: Icon, title, children, action, plain }) {
  return (
    <div className={plain ? "empty-state empty-state--plain" : "empty-state"}>
      {art && (
        <div className="empty-state__art" aria-hidden="true">
          {art}
        </div>
      )}
      {!art && Icon && (
        <span className="stat__icon" aria-hidden="true">
          <Icon size={22} />
        </span>
      )}
      {title && <h3 className="empty-state__title">{title}</h3>}
      {children && <div className="empty-state__text">{children}</div>}
      {action}
    </div>
  );
}

export function Spinner({ size = 28, label }) {
  return (
    <span role={label ? "status" : undefined} aria-label={label} style={{ display: "inline-flex" }}>
      <span className="spinner" style={{ "--size": `${size}px` }} aria-hidden="true" />
    </span>
  );
}

// Spinner plus a short message, announced politely to screen readers.
export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ width = "100%", height = 16, radius, style }) {
  return <span className="skeleton" aria-hidden="true" style={{ display: "block", width, height, borderRadius: radius, ...style }} />;
}

// A card-shaped placeholder grid shown while a list loads.
export function SkeletonCards({ count = 3, height = 180 }) {
  return (
    <div className="grid-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} radius="var(--radius-xl)" />
      ))}
    </div>
  );
}

const ALERT_ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

// Inline message box. tone: info | success | warning | danger. Danger alerts
// are announced immediately (role="alert"); others politely.
export function Alert({ tone = "info", title, children, action, className }) {
  const Icon = ALERT_ICONS[tone] || Info;
  return (
    <div className={["alert", className].filter(Boolean).join(" ")} data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <Icon size={18} className="alert__icon" aria-hidden="true" />
      <div className="grow stack stack-sm" style={{ "--gap": "2px" }}>
        {title && <p className="alert__title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export default EmptyState;
