import { getToken } from "./session";

export const API_URL = import.meta.env.VITE_API_URL;

// Thin wrapper over fetch for the existing /api endpoints: adds the Bearer
// token, sends `body` as JSON (FormData is passed through untouched), and
// always resolves to { ok, status, data } instead of throwing on HTTP errors,
// so callers can branch on the server's own { message }. Network failures
// still throw, so wrap calls in try/catch.
export async function api(path, { method = "GET", body, headers = {}, signal } = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    signal,
    headers: {
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${getToken()}`,
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// The server's error message for a failed response, or a fallback.
export const errorMessage = (data, fallback = "Something went wrong. Please try again.") =>
  (data && typeof data.message === "string" && data.message) || fallback;
