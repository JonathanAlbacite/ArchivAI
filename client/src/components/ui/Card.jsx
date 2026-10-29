const cx = (...parts) => parts.filter(Boolean).join(" ");

// A white rounded surface. `hoverable` adds a subtle hover lift; `selected`
// outlines it in the role accent; `muted` is the tinted variant; `flush`
// drops the padding (for tables/lists that run edge to edge).
export function Card({ as: Tag = "div", hoverable, selected, disabled, muted, flush, className, children, ...rest }) {
  return (
    <Tag
      className={cx(
        "card",
        hoverable && "card--hoverable",
        selected && "card--selected",
        disabled && "card--disabled",
        muted && "card--muted",
        flush && "card--flush",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Card;
