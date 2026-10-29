import { forwardRef } from "react";
import { Link } from "react-router-dom";

const cx = (...parts) => parts.filter(Boolean).join(" ");

// variant: primary | accent (role color) | secondary | soft | ghost | danger | danger-ghost
// size: sm | md | lg. `loading` disables the button and swaps the icon for a spinner
// while keeping the label, so its width doesn't jump. Pass `to` to render a router link.
export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", block, loading, icon: Icon, iconRight: IconRight, to, className, children, disabled, type = "button", ...rest },
  ref
) {
  const classes = cx("btn", `btn--${variant}`, size !== "md" && `btn--${size}`, block && "btn--block", className);
  const iconSize = size === "sm" ? 15 : 18;
  const content = (
    <>
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

// Icon-only button. `label` is required: it becomes the accessible name and the tooltip.
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = "ghost", size = "md", className, iconSize, loading, ...rest },
  ref
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cx("btn--icon", className)}
      aria-label={label}
      title={label}
      loading={loading}
      {...rest}
    >
      {!loading && <Icon size={iconSize || (size === "sm" ? 16 : 20)} aria-hidden="true" />}
    </Button>
  );
});

export default Button;
