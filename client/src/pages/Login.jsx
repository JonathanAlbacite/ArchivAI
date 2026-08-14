import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import background from "../assets/background.png";
import EmberField from "../components/EmberField";
import { colors, fonts } from "../theme";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
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
            padding: "44px 40px",
            width: "400px",
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
            THE VAULT AWAITS
          </p>

          <h1
            style={{
              textAlign: "center",
              margin: "0 0 28px 0",
              fontFamily: fonts.displayDecorative,
              fontSize: "36px",
              fontWeight: "700",
              backgroundImage: `linear-gradient(90deg, ${colors.brass} 0%, ${colors.emberBright} 25%, ${colors.brassBright} 50%, ${colors.emberBright} 75%, ${colors.brass} 100%)`,
              backgroundSize: "200% auto",
              color: "transparent",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              animation: "shimmerSweep 5s linear infinite",
            }}
          >
            LOGIN
          </h1>

          <form onSubmit={handleLogin} autoComplete="off">
            <label style={{ display: "block", marginBottom: "8px", color: colors.ink, fontFamily: fonts.body, fontSize: "13px", fontWeight: "600" }}>
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

            <label style={{ display: "block", margin: "20px 0 8px 0", color: colors.ink, fontFamily: fonts.body, fontSize: "13px", fontWeight: "600" }}>
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

            <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
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
                Enter
              </button>
              <button
                type="button"
                onClick={() => navigate("/register")}
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
                Create Account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;
