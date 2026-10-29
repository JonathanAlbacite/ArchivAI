import { createContext, useContext } from "react";

// toast.success("Saved"), toast.error("Couldn't save", { title }) ... - see
// components/ui/Toast.jsx for the provider and how long each kind stays up.
export const ToastContext = createContext(null);

const noop = () => {};
const fallback = { show: noop, success: noop, info: noop, warning: noop, error: noop, dismiss: noop };

export const useToast = () => useContext(ToastContext) || fallback;
