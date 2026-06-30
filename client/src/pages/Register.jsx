import { useState } from "react";
import { useNavigate } from "react-router-dom";
import background from "../assets/background.png";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("STUDENT");
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      alert("Account created! Please login.");
      navigate("/");
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
        <h1 style={{ textAlign: "center", color: "#4a3424" }}>CREATE ACCOUNT</h1>

        <form onSubmit={handleRegister} autoComplete="off">
          <label style={{ display: "block", marginTop: "20px", color: "#4a3424", fontWeight: "bold" }}>
            Name
          </label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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

          <label style={{ display: "block", marginTop: "20px", color: "#4a3424", fontWeight: "bold" }}>
            I am a
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              marginTop: "8px",
              borderRadius: "20px",
              border: "1px solid #c9b896",
              backgroundColor: "white",
            }}
          >
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
          </select>

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
              Create Account
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
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
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;