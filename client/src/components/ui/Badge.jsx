import { CheckCircle2, CircleDashed, PencilLine, PlayCircle } from "lucide-react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

// A pill label. tone: neutral | primary | accent | success | warning | danger |
// info | student | teacher | laboratory | library | tomb | xp | outline.
// Always carries text - color is never the only signal.
export function Badge({ tone = "neutral", size, icon: Icon, className, children, ...rest }) {
  return (
    <span className={cx("chip", size === "lg" && "chip--lg", className)} data-tone={tone} {...rest}>
      {Icon && <Icon size={size === "lg" ? 15 : 13} aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS = {
  published: { tone: "success", icon: CheckCircle2, label: "Published" },
  draft: { tone: "warning", icon: PencilLine, label: "Draft" },
  completed: { tone: "success", icon: CheckCircle2, label: "Completed" },
  inProgress: { tone: "info", icon: PlayCircle, label: "In progress" },
  notStarted: { tone: "neutral", icon: CircleDashed, label: "Not started" },
};

// Fixed status vocabulary (campaign publish state, campaign completion) so the
// same state always looks and reads the same everywhere.
export function StatusChip({ status, label, ...rest }) {
  const meta = STATUS[status] || STATUS.notStarted;
  return (
    <Badge tone={meta.tone} icon={meta.icon} {...rest}>
      {label || meta.label}
    </Badge>
  );
}

export default Badge;
