// The signed-in user, as stored by the login page (see pages/Login.jsx).
export const getToken = () => localStorage.getItem("token");
export const getRole = () => localStorage.getItem("role");
export const getName = () => localStorage.getItem("name");

export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("name");
};

// Where each role lands after signing in.
export const homeFor = (role) =>
  role === "TEACHER" ? "/teacher/dashboard" : role === "ADMIN" ? "/admin/dashboard" : "/student/dashboard";

// The account id inside the JWT payload (the server signs { id, role }).
export const getUserId = () => {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]))?.id ?? null;
  } catch {
    return null;
  }
};
