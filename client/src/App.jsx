import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import RoomPage from "./pages/teacher/RoomPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentRoomPage from "./pages/student/StudentRoomPage";
import StudentCampaignPage from "./pages/student/StudentCampaignPage";
import StudentCharacterCustomization from "./pages/student/StudentCharacterCustomization";
import TeacherCharacterCustomization from "./pages/teacher/TeacherCharacterCustomization";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminVaultEditor from "./pages/admin/AdminVaultEditor";
import AdminCharacterSets from "./pages/admin/AdminCharacterSets";
import AdminMusicTracks from "./pages/admin/AdminMusicTracks";
import AdminTrophies from "./pages/admin/AdminTrophies";
import AdminTrophyPreview from "./pages/admin/AdminTrophyPreview";
import StudentProgressPage from "./pages/teacher/StudentProgressPage";
import TeacherCampaignPage from "./pages/teacher/TeacherCampaignPage";
import AdminCharacterCustomization from "./pages/admin/AdminCharacterCustomization";
import RunResults from "./pages/RunResults";
import AppShell from "./components/layout/AppShell";
import ThemeProvider from "./components/ThemeProvider";
import MusicProvider from "./components/MusicProvider";
import ClickEffects from "./components/ClickEffects";
import HoverEffects from "./components/HoverEffects";
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
        {/* Particle bursts on clicks, and tilt + glow on hover, site-wide (playful on the student side). */}
        <ClickEffects />
        <HoverEffects />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Teacher area (admins may enter it as "Teacher Mode"). */}
            <Route element={<AppShell allow={["TEACHER", "ADMIN"]} accent="TEACHER" />}>
              <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
              <Route path="/teacher/room/:id" element={<RoomPage />} />
              <Route path="/teacher/room/:roomId/campaign/:campaignId" element={<TeacherCampaignPage />} />
              <Route path="/teacher/room/:roomId/campaign/:campaignId/progress" element={<StudentProgressPage />} />
              <Route path="/teacher/character" element={<TeacherCharacterCustomization />} />
            </Route>

            <Route element={<AppShell allow={["STUDENT"]} />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/room/:id" element={<StudentRoomPage />} />
              <Route path="/student/room/:id/campaign/:campaignId" element={<StudentCampaignPage />} />
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
              <Route path="/admin/music" element={<AdminMusicTracks />} />
              <Route path="/admin/trophies" element={<AdminTrophies />} />
              <Route path="/admin/trophies/:sceneKey/preview" element={<AdminTrophyPreview />} />
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
