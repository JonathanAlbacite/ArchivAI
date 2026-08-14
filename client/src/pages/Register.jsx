import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Wand2, Compass, Check } from "lucide-react";
import background from "../assets/background.png";
import EmberField from "../components/EmberField";
import { colors, fonts } from "../theme";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("STUDENT");
  const [focusedField, setFocusedField] = useState(null);
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

  const inputStyle = (field) => ({
    width: "100%",
    padding: "12px 16px",
    borderRadius: "14px",
    border: `1px solid ${focusedField === field ? colors.ember : colors.parchmentLine}`,
    backgroundColor: colors.parchmentPanel,
    fontFamily: fonts.body,
    fontSize: "14px",
    color: colors.ink,
    outline: "none",
    boxSizing: "border-box",
    boxShadow: focusedField === field ? `0 0 0 3px ${colors.ember}33` : "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  });

  const roleCardStyle = (value) => {
    const active = role === value;
    return {
      flex: 1,
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      padding: "16px 10px",
      borderRadius: "16px",
      cursor: "pointer",
      backgroundColor: active ? `${colors.ember}1A` : colors.parchmentPanel,
      border: `2px solid ${active ? colors.ember : colors.parchmentLine}`,
      boxShadow: active ? `0 0 0 3px ${colors.ember}22` : "none",
      transition: "border-color 0.2s, background-color 0.2s, box-shadow 0.2s",
    };
  };

  return (
    <div
      style={{
        backgroundImage: `linear-gradient(rgba(10,6,3,0.55), rgba(10,6,3,0.75)), url(${background})`,
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
        overflowY: "auto",
        padding: "20px 0",
        boxSizing: "border-box",
      }}
    >
      <EmberField variant="ember" count={30} />

      {/* Gold frame */}
      <div
        style={{
          background: `linear-gradient(160deg, ${colors.brass}, ${colors.emberDim})`,
          borderRadius: "28px",
          padding: "3px",
          boxShadow: `0 0 60px rgba(233,155,76,0.25), 0 25px 60px rgba(0,0,0,0.5)`,
          position: "relative",
        }}
      >
        {/* Tome card */}
        <div
          style={{
            backgroundColor: colors.parchment,
            borderRadius: "26px",
            border: `1px solid ${colors.vaultBorder}44`,
            padding: "40px 40px",
            width: "420px",
            boxSizing: "border-box",
          }}
        >
          <p
            style={{
              textAlign: "center",
              margin: "0 0 4px 0",
              fontFamily: fonts.flourish,
              fontSize: "12px",
              letterSpacing: "3px",
              color: colors.inkMuted,
            }}
          >
            BEGIN YOUR LEGEND
          </p>

          <h1
            style={{
              textAlign: "center",
              margin: "0 0 24px 0",
              fontFamily: fonts.displayDecorative,
              fontSize: "30px",
              fontWeight: "700",
              backgroundImage: `linear-gradient(90deg, ${colors.brass} 0%, ${colors.emberBright} 25%, ${colors.brassBright} 50%, ${colors.emberBright} 75%, ${colors.brass} 100%)`,
              backgroundSize: "200% auto",
              color: "transparent",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              animation: "shimmerSweep 5s linear infinite",
            }}
          >
            CREATE ACCOUNT
          </h1>

          <form onSubmit={handleRegister} autoComplete="off">
            <label style={{ display: "block", marginBottom: "8px", color: colors.ink, fontFamily: fonts.body, fontSize: "13px", fontWeight: "600" }}>
              Name
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              autoComplete="off"
              style={inputStyle("name")}
            />

            <label style={{ display: "block", margin: "18px 0 8px 0", color: colors.ink, fontFamily: fonts.body, fontSize: "13px", fontWeight: "600" }}>
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              autoComplete="off"
              style={inputStyle("email")}
            />

            <label style={{ display: "block", margin: "18px 0 8px 0", color: colors.ink, fontFamily: fonts.body, fontSize: "13px", fontWeight: "600" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                autoComplete="new-password"
                style={{ ...inputStyle("password"), paddingRight: "44px" }}
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", cursor: "pointer", display: "flex" }}
              >
                {showPassword ? <EyeOff size={18} color={colors.inkMuted} /> : <Eye size={18} color={colors.inkMuted} />}
              </span>
            </div>

            <label style={{ display: "block", margin: "18px 0 10px 0", color: colors.ink, fontFamily: fonts.body, fontSize: "13px", fontWeight: "600" }}>
              I am a...
            </label>
            <div style={{ display: "flex", gap: "12px" }}>
              <div onClick={() => setRole("TEACHER")} style={roleCardStyle("TEACHER")}>
                {role === "TEACHER" && (
                  <Check size={14} color={colors.ember} style={{ position: "absolute", top: "8px", right: "8px" }} />
                )}
                <Wand2 size={26} color={role === "TEACHER" ? colors.ember : colors.inkMuted} />
                <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: "600", fontSize: "13px", color: colors.ink }}>Teacher</p>
                <p style={{ margin: 0, fontFamily: fonts.body, fontSize: "10px", color: colors.inkMuted, textAlign: "center" }}>I seek to teach</p>
              </div>
              <div onClick={() => setRole("STUDENT")} style={roleCardStyle("STUDENT")}>
                {role === "STUDENT" && (
                  <Check size={14} color={colors.ember} style={{ position: "absolute", top: "8px", right: "8px" }} />
                )}
                <Compass size={26} color={role === "STUDENT" ? colors.ember : colors.inkMuted} />
                <p style={{ margin: 0, fontFamily: fonts.display, fontWeight: "600", fontSize: "13px", color: colors.ink }}>Student</p>
                <p style={{ margin: 0, fontFamily: fonts.body, fontSize: "10px", color: colors.inkMuted, textAlign: "center" }}>I seek to explore</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "26px" }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: "13px",
                  background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`,
                  color: "white",
                  border: "none",
                  borderRadius: "16px",
                  fontFamily: fonts.body,
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                  animation: "glowPulse 3s ease-in-out infinite",
                }}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                style={{
                  flex: 1,
                  padding: "13px",
                  backgroundColor: "transparent",
                  color: colors.ink,
                  border: `1px solid ${colors.vaultBorder}66`,
                  borderRadius: "16px",
                  fontFamily: fonts.body,
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Back to Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Register;
