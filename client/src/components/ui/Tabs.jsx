import { useId, useRef } from "react";

// WAI-ARIA tabs: arrow keys / Home / End move between tabs, only the active
// tab is in the Tab order, and each panel is labelled by its tab.
// tabs: [{ id, label, icon?, count? }]. Controlled via value/onChange.
export function Tabs({ tabs, value, onChange, label, children }) {
  const baseId = useId();
  const listRef = useRef(null);

  const onKeyDown = (e) => {
    const index = tabs.findIndex((t) => t.id === value);
    let next = null;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <div className="tabs">
      <div ref={listRef} className="tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const selected = t.id === value;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-controls={`${baseId}-panel-${t.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className="tabs__tab"
              onClick={() => onChange(t.id)}
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              {t.label}
              {t.count !== undefined && <span className="tabs__count">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${value}`}
        aria-labelledby={`${baseId}-tab-${value}`}
        className="tabs__panel"
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}

export default Tabs;
