import { useState } from "react";
import { useNavigate } from "react-router-dom";
import background from "../assets/background.png";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("name", data.name);

      if (data.role === "TEACHER") {
        navigate("/teacher/dashboard");
      } else {
        navigate("/student/dashboard");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    }
  };

  return (
    <div
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "fixed",
        top: 0,
        left: 0,
      }}
    >
      <div
        style={{
          backgroundColor: "#e8dcc4",
          border: "8px solid #6b7d8c",
          borderRadius: "8px",
          padding: "40px",
          width: "400px",
        }}
      >
        <h1 style={{ textAlign: "center", color: "#4a3424" }}>WELCOME BACK</h1>

        <form onSubmit={handleLogin} autoComplete="off">
          <label style={{ display: "block", marginTop: "20px", color: "#4a3424", fontWeight: "bold" }}>
            Email
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            style={{
              width: "100%",
              padding: "12px",
              marginTop: "8px",
              borderRadius: "20px",
              border: "1px solid #c9b896",
            }}
          />

          <label style={{ display: "block", marginTop: "20px", color: "#4a3424", fontWeight: "bold" }}>
            Password
          </label>
          <div style={{ position: "relative", marginTop: "8px" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "12px",
                paddingRight: "70px",
                borderRadius: "20px",
                border: "1px solid #c9b896",
                boxSizing: "border-box",
              }}
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
                fontSize: "12px",
                color: "#6b7d8c",
                fontWeight: "bold",
                userSelect: "none",
              }}
            >
              {showPassword ? "HIDE" : "SHOW"}
            </span>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: "#c0623f",
                color: "white",
                border: "none",
                borderRadius: "20px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => navigate("/register")}
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: "#5d7a8c",
                color: "white",
                border: "none",
                borderRadius: "20px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Create an account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;