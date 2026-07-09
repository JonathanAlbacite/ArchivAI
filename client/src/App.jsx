import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import RoomPage from "./pages/teacher/RoomPage";
import StudentDashboard from "./pages/student/StudentDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/teacher/room/:id" element={<RoomPage />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/room/:id" element={<StudentDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;