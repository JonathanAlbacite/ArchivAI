import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { User, LogOut, ChevronDown } from "lucide-react";
import { colors, fonts } from "../theme";

const ROLE_LABELS = {
  TEACHER: "Keeper of the Vault",
  STUDENT: "Archivist",
};

function Navbar() {
  const [logoutHover, setLogoutHover] = useState(false);
  const navigate = useNavigate();

  const name = localStorage.getItem("name");
  const role = localStorage.getItem("role");
  const roleLabel = ROLE_LABELS[role] || "Wanderer";
  const accent = role === "STUDENT" ? colors.magicVioletBright : colors.emberBright;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    navigate("/");
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: `linear-gradient(180deg, ${colors.wood} 0%, ${colors.obsidian} 100%)`,
        padding: "16px 24px",
        position: "sticky",
        top: 0,
        zIndex: 100,
        borderBottom: `1px solid ${colors.vaultBorder}`,
        boxShadow: `0 2px 16px rgba(0,0,0,0.5), 0 1px 0 ${accent}55`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <img
          src={logo}
          alt="logo"
          style={{ width: "56px", filter: `drop-shadow(0 0 8px ${accent}66)` }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p
            style={{
              color: colors.brass,
              fontFamily: fonts.displayDecorative,
              fontSize: "19px",
              fontWeight: "700",
              margin: 0,
              letterSpacing: "0.5px",
            }}
          >
            THE ARCHIVIST'S LEGACY
          </p>
          <p
            style={{
              color: colors.brass,
              fontFamily: fonts.flourish,
              fontSize: "11px",
              margin: 0,
              letterSpacing: "2.5px",
              opacity: 0.85,
            }}
          >
            {" "}
            ← KEEPERS OF THE FORGOTTEN VAULTS →
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            backgroundColor: colors.obsidianDeep,
            border: `1px solid ${colors.vaultBorder}`,
            borderRadius: "35px",
            padding: "8px 18px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            height: "45px",
          }}
        >
          <User size={20} color={accent} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
            <p style={{ color: "#FFFFF3", fontFamily: fonts.body, fontSize: "14px", margin: 0, fontWeight: "600" }}>
              {name || "User"}
            </p>
            <p style={{ color: accent, fontFamily: fonts.body, fontSize: "10px", margin: 0, letterSpacing: "0.5px" }}>
              {roleLabel}
            </p>
          </div>
          <ChevronDown size={16} color="#FFFFF3" />
        </div>

        <div
          onClick={handleLogout}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          style={{
            backgroundColor: logoutHover ? colors.vaultBorder : colors.obsidianDeep,
            border: `1px solid ${logoutHover ? colors.emberBright : colors.vaultBorder}`,
            borderRadius: "20px",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            height: "45px",
            boxSizing: "border-box",
            cursor: "pointer",
            transition: "background-color 0.2s, border-color 0.2s, box-shadow 0.2s",
            boxShadow: logoutHover ? `0 0 14px ${colors.emberBright}66` : "none",
          }}
        >
          <LogOut size={20} color={logoutHover ? colors.emberBright : colors.brass} />
          <p style={{ color: "#FFFFF3", fontFamily: fonts.body, fontSize: "14px", margin: 0 }}>Logout</p>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
