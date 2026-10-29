import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { ToastContext } from "../../lib/toast";
import { IconButton } from "./Button";

// How long each kind stays up. Errors stay until dismissed so they can
// always be read; hovering any toast pauses its timer.
const DURATION = { success: 4000, info: 5000, warning: 8000, error: null };
const ICONS = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: XCircle };

let nextId = 1;

function ToastItem({ toast, onDismiss }) {
  const timer = useRef(null);
  const Icon = ICONS[toast.tone] || Info;
  const duration = toast.duration === undefined ? DURATION[toast.tone] : toast.duration;

  const start = useCallback(() => {
    if (duration) timer.current = setTimeout(() => onDismiss(toast.id), duration);
  }, [duration, onDismiss, toast.id]);
  const stop = () => clearTimeout(timer.current);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <div
      className="toast"
      data-tone={toast.tone}
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
    >
      <Icon size={20} className="toast__icon" aria-hidden="true" />
      <div className="toast__body">
        {toast.title && <p className="toast__title">{toast.title}</p>}
        {toast.message && <p className={toast.title ? "text-muted" : undefined}>{toast.message}</p>}
      </div>
      <IconButton icon={X} label="Dismiss notification" size="sm" onClick={() => onDismiss(toast.id)} />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback((tone, message, options = {}) => {
    const id = nextId++;
    setToasts((list) => [...list.slice(-3), { id, tone, message, ...options }]);
    return id;
  }, []);

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) => show("success", message, options),
      info: (message, options) => show("info", message, options),
      warning: (message, options) => show("warning", message, options),
      error: (message, options) => show("error", message, options),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
