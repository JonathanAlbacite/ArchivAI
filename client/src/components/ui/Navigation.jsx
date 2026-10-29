import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";

// items: [{ label, to? }] - the last item is the current page.
export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="row" style={{ "--gap": "4px" }}>
              {last || !item.to ? (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
              {!last && <ChevronRight size={14} className="breadcrumbs__sep" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Page title block: optional eyebrow, h1, description, and right-aligned actions.
export function PageHeader({ eyebrow, title, description, actions, breadcrumbs, children }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {breadcrumbs && <div style={{ marginBottom: 12 }}>{breadcrumbs}</div>}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__desc">{description}</p>}
        {children}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

// Dropdown menu (menu button pattern): the trigger toggles it, arrow keys move
// between items, Escape/outside click closes and returns focus to the trigger.
// renderTrigger(props) must spread props onto a button.
// items: [{ label, icon, onSelect, danger, separatorBefore, disabled, checked }] - an item with
// `checked` (true/false) is a radio choice (menuitemradio), e.g. picking a music track.
const ITEM_SELECTOR = '[role^="menuitem"]:not([disabled])';

export function Menu({ renderTrigger, items, align = "right", label }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    requestAnimationFrame(() => wrapRef.current?.querySelector(ITEM_SELECTOR)?.focus());
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e) => {
    const nodes = [...wrapRef.current.querySelectorAll(ITEM_SELECTOR)];
    const index = nodes.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      {renderTrigger({
        ref: triggerRef,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
      })}
      {open && (
        <div id={menuId} role="menu" aria-label={label} className="menu" style={align === "left" ? { left: 0, right: "auto" } : undefined} onKeyDown={onMenuKeyDown}>
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i}>
                {item.separatorBefore && <div className="menu__sep" role="separator" />}
                <button
                  type="button"
                  role={item.checked === undefined ? "menuitem" : "menuitemradio"}
                  aria-checked={item.checked === undefined ? undefined : item.checked}
                  className="menu__item"
                  data-danger={item.danger || undefined}
                  disabled={item.disabled}
                  onClick={() => {
                    close(false);
                    item.onSelect?.();
                  }}
                >
                  {Icon && <Icon size={16} aria-hidden="true" />}
                  <span className="grow">{item.label}</span>
                  {item.checked && <Check size={16} aria-hidden="true" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Number + label tile for overview rows. tone sets the icon color pair.
export function Stat({ icon: Icon, label, value, tone, hint }) {
  const style = tone ? { "--stat-fg": `var(--color-${tone})`, "--stat-soft": `var(--color-${tone}-soft)` } : undefined;
  return (
    <div className="stat" style={style}>
      {Icon && (
        <span className="stat__icon" aria-hidden="true">
          <Icon size={22} />
        </span>
      )}
      <div className="grow">
        <p className="stat__value">{value}</p>
        <p className="stat__label">{label}</p>
        {hint && <p className="text-xs text-subtle">{hint}</p>}
      </div>
    </div>
  );
}

// Pressed-state button group for filters, e.g. All / Published / Drafts.
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
