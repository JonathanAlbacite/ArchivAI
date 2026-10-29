import { forwardRef, useId, useState } from "react";
import { AlertCircle, Eye, EyeOff, HelpCircle } from "lucide-react";
import { IconButton } from "./Button";

const cx = (...parts) => parts.filter(Boolean).join(" ");

// Label + control + hint + error, wired together with ids so screen readers
// announce the hint and error with the control (aria-describedby) and
// errors are flagged with aria-invalid. `children(controlProps)` renders the
// actual control.
export function Field({ label, hint, error, required, optional, help, className, id: idProp, children }) {
  const autoId = useId();
  const id = idProp || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cx("field", className)}>
      {label && (
        <div className="row" style={{ "--gap": "6px" }}>
          <label className="field__label" htmlFor={id}>
            {label}
            {required && (
              <span className="field__required" aria-hidden="true">
                *
              </span>
            )}
            {optional && <span className="field__optional">(optional)</span>}
          </label>
          {help && <HelpTip text={help} label={`About ${typeof label === "string" ? label : "this field"}`} />}
        </div>
      )}
      {children({
        id,
        "aria-describedby": cx(hintId, errorId) || undefined,
        "aria-invalid": error ? "true" : undefined,
        "aria-required": required || undefined,
      })}
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error" role="alert">
          <AlertCircle size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </p>
      )}
    </div>
  );
}

export const TextField = forwardRef(function TextField({ label, hint, error, required, optional, help, className, id, icon: Icon, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} help={help} className={className} id={id}>
      {(controlProps) =>
        Icon ? (
          <div className="input-wrap input-wrap--icon">
            <Icon size={18} className="input-wrap__icon" aria-hidden="true" />
            <input ref={ref} className="input" {...controlProps} {...rest} />
          </div>
        ) : (
          <input ref={ref} className="input" {...controlProps} {...rest} />
        )
      }
    </Field>
  );
});

export const TextAreaField = forwardRef(function TextAreaField({ label, hint, error, required, optional, help, className, id, rows = 3, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} help={help} className={className} id={id}>
      {(controlProps) => <textarea ref={ref} rows={rows} className="input" {...controlProps} {...rest} />}
    </Field>
  );
});

export const SelectField = forwardRef(function SelectField({ label, hint, error, required, optional, help, className, id, children, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} help={help} className={className} id={id}>
      {(controlProps) => (
        <select ref={ref} className="input" {...controlProps} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
});

// Password input with a show/hide toggle that keeps its own accessible name in sync.
export const PasswordField = forwardRef(function PasswordField({ label = "Password", hint, error, required, className, id, ...rest }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} id={id}>
      {(controlProps) => (
        <div className="input-wrap">
          <input ref={ref} className="input" type={visible ? "text" : "password"} {...controlProps} {...rest} />
          <IconButton
            className="input-wrap__action"
            size="sm"
            icon={visible ? EyeOff : Eye}
            label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          />
        </div>
      )}
    </Field>
  );
});

export function Checkbox({ label, className, ...rest }) {
  return (
    <label className={cx("check", className)}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

// A small "?" button that reveals a one-line explanation on hover, focus or
// tap. The text is also its accessible description.
export function HelpTip({ text, label = "More information" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="help__trigger"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        <HelpCircle size={16} aria-hidden="true" />
      </button>
      <span id={id} role="tooltip" className="help__bubble" hidden={!open}>
        {text}
      </span>
    </span>
  );
}

export default Field;
