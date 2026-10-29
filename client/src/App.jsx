import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import RoomPage from "./pages/teacher/RoomPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentRoomPage from "./pages/student/StudentRoomPage";
import StudentCharacterCustomization from "./pages/student/StudentCharacterCustomization";
import TeacherCharacterCustomization from "./pages/teacher/TeacherCharacterCustomization";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminVaultEditor from "./pages/admin/AdminVaultEditor";
import AdminCharacterSets from "./pages/admin/AdminCharacterSets";
import AdminCharacterCustomization from "./pages/admin/AdminCharacterCustomization";
import RunResults from "./pages/RunResults";
import AppShell from "./components/layout/AppShell";
import ThemeProvider from "./components/ThemeProvider";
import MusicProvider from "./components/MusicProvider";
import { ToastProvider } from "./components/ui";

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
    <ThemeProvider>
      <ToastProvider>
        <MusicProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Teacher area (admins may enter it as "Teacher Mode"). The AI assistant is mounted by
                the shell once for every teacher route, so its conversation survives navigation. */}
            <Route element={<AppShell allow={["TEACHER", "ADMIN"]} accent="TEACHER" assistant />}>
              <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
              <Route path="/teacher/room/:id" element={<RoomPage />} />
              <Route path="/teacher/character" element={<TeacherCharacterCustomization />} />
            </Route>

            <Route element={<AppShell allow={["STUDENT"]} />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/room/:id" element={<StudentRoomPage />} />
              <Route path="/student/character" element={<StudentCharacterCustomization />} />
            </Route>

            {/* Any role can finish a run (teachers preview their own campaigns). */}
            <Route element={<AppShell />}>
              <Route path="/results/:campaignId" element={<RunResults />} />
            </Route>

            <Route element={<AppShell allow={["ADMIN"]} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/vault/:scene" element={<AdminVaultEditor />} />
              <Route path="/admin/character-sets" element={<AdminCharacterSets />} />
              <Route path="/admin/character" element={<AdminCharacterCustomization />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </MusicProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
