import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import RoomPage from "./pages/teacher/RoomPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentRoomPage from "./pages/student/StudentRoomPage";
import TeacherChatWidget from "./components/teacher/TeacherChatWidget";

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<TeacherLayout />}>
          <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
          <Route path="/teacher/room/:id" element={<RoomPage />} />
        </Route>
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/room/:id" element={<StudentRoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
