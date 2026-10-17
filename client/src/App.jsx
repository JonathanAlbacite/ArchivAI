import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import RoomPage from "./pages/teacher/RoomPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentRoomPage from "./pages/student/StudentRoomPage";
import StudentCharacterCustomization from "./pages/student/StudentCharacterCustomization";
import TeacherCharacterCustomization from "./pages/teacher/TeacherCharacterCustomization";
import TeacherChatWidget from "./components/teacher/TeacherChatWidget";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminVaultEditor from "./pages/admin/AdminVaultEditor";
import AdminCharacterSets from "./pages/admin/AdminCharacterSets";
import AdminCharacterCustomization from "./pages/admin/AdminCharacterCustomization";

// Wraps every teacher route so the chat widget mounts once and survives
// navigation between teacher pages (Messenger-style persistent bubble)
// instead of remounting — and losing its in-memory state — on every route change.
function TeacherLayout() {
  return (
    <>
      <Outlet />
      <TeacherChatWidget />
    </>
  );
}

// Tells the server this user is here, every 30 seconds while a page is open and visible, so room
// members can see who is active (see GET /api/rooms/:id/members). Nothing is sent when signed out.
function usePresence() {
  useEffect(() => {
    const beat = () => {
      const token = localStorage.getItem("token");
      if (!token || document.visibilityState !== "visible") return;
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 30000);
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("focus", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("focus", beat);
    };
  }, []);
}

function App() {
  usePresence();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<TeacherLayout />}>
          <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
          <Route path="/teacher/room/:id" element={<RoomPage />} />
          <Route path="/teacher/character" element={<TeacherCharacterCustomization />} />
        </Route>
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/room/:id" element={<StudentRoomPage />} />
        <Route path="/student/character" element={<StudentCharacterCustomization />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/vault/:scene" element={<AdminVaultEditor />} />
        <Route path="/admin/character-sets" element={<AdminCharacterSets />} />
        <Route path="/admin/character" element={<AdminCharacterCustomization />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
