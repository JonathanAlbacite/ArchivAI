import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, IconButton } from "./Button";

const cx = (...parts) => parts.filter(Boolean).join(" ");

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open modals, oldest first, so Escape and z-index only ever apply to the top one.
const stack = [];

// Accessible dialog: portaled to <body>, labelled by its title, Escape and the
// close button call onClose (unless `busy`), Tab is kept inside the dialog,
// focus moves in on open and returns to the opener on close, and the page
// behind can't scroll. Clicking the backdrop does NOT close it by default
// (forms shouldn't vanish on a stray click) - pass closeOnBackdrop for
// read-only dialogs.
export function Modal({
  open = true,
  onClose,
  title,
  description,
  size = "md",
  busy = false,
  closeOnBackdrop = false,
  hideClose = false,
  initialFocusRef,
  footer,
  className,
  bodyClassName,
  children,
}) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  // Stacking order, fixed when the dialog opens (dialogs opened later sit above it).
  const [depth] = useState(() => stack.length + 1);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    const token = {};
    stack.push(token);
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus in: the caller's chosen field, else the first field, else the dialog.
    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const target =
        initialFocusRef?.current ||
        dialog.querySelector("[data-autofocus]") ||
        dialog.querySelector(FOCUSABLE.split(", ").map((s) => `.modal__body ${s}`).join(", ")) ||
        dialog;
      target.focus({ preventScroll: true });
    });

    const onKeyDown = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape" && !busyRef.current) {
        e.stopPropagation();
        onCloseRef.current?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) document.body.style.overflow = previousOverflow;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus({ preventScroll: true });
    };
    // initialFocusRef is read once on open by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tab / Shift+Tab wrap around inside the dialog.
  const trapTab = (e) => {
    if (e.key !== "Tab") return;
    const nodes = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      style={{ "--z": 900 + depth * 10 }}
      onMouseDown={(e) => {
        if (closeOnBackdrop && !busy && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={cx("modal", `modal--${size}`, className)}
        onKeyDown={trapTab}
      >
        {(title || !hideClose) && (
          <div className="modal__header">
            <div className="modal__heading">
              {title && (
                <h2 id={titleId} className="modal__title">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="modal__desc">
                  {description}
                </p>
              )}
            </div>
            {!hideClose && <IconButton icon={X} label="Close dialog" onClick={onClose} disabled={busy} />}
          </div>
        )}
        <div className={cx("modal__body", bodyClassName)}>{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// Yes/no confirmation for destructive or irreversible actions. The parent
// owns `loading` so the dialog stays open (and un-dismissable) while the
// request runs, and shows any failure in `error`.
export function ConfirmDialog({
  open = true,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  loading = false,
  error,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      busy={loading}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="stack stack-sm text-sm text-muted">{children}</div>
      {error && (
        <p className="field__error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

export default Modal;
