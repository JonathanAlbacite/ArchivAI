import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import EmberField from "../../components/EmberField";
import dashboard_bg from "../../assets/dashboard_bg.png";
import { colors, fonts } from "../../theme";
import { SCENE_LIST } from "../../scenes";

const STATUS_META = {
  published: { label: "Published", color: colors.success, bg: colors.successBg },
  draft: { label: "Draft", color: colors.draft, bg: colors.draftBg },
  empty: { label: "Not Started", color: colors.inkMuted, bg: "rgba(255,255,255,0.06)" },
};

function statusFor(template) {
  if (!template || template.slots.length === 0) return "empty";
  return template.isPublished ? "published" : "draft";
}

// Landing page for the admin account: one card per vault (scene), each
// showing whether its question-set template is published, still a draft,
// or not started yet. Clicking a card opens AdminVaultEditor for that
// scene, where the actual slot list is authored.
function AdminDashboard() {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [hoveredScene, setHoveredScene] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTemplates = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/vault-templates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("role");
            localStorage.removeItem("name");
            navigate("/");
            return;
          }
          alert(data.message);
          return;
        }

        setTemplates(Object.fromEntries(data.map((t) => [t.scene, t])));
      } catch (err) {
        console.error(err);
        alert("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar />

      <div
        style={{
          position: "relative",
          display: "flex",
          minHeight: "100vh",
          backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(60,38,20,0.45), rgba(6,4,2,0.94)), url(${dashboard_bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <EmberField variant="ember" count={26} />

        <div
          style={{
            position: "relative",
            background: `linear-gradient(165deg, ${colors.wood} 0%, ${colors.obsidian} 100%)`,
            flex: 1,
            borderRadius: "24px",
            margin: "20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            border: `1px solid ${colors.vaultBorder}`,
          }}
        >
          <div style={{ padding: "40px" }}>
            <p style={{ margin: "0 0 4px 0", fontFamily: fonts.flourish, fontSize: "12px", letterSpacing: "3px", color: colors.brass }}>
              ADMIN DASHBOARD
            </p>
            <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "34px", color: colors.brassBright, margin: 0 }}>
              Vault Templates
            </h1>
            <p style={{ color: "#C9BBA6", fontFamily: fonts.body, fontSize: "14px", margin: "6px 0 0 0", maxWidth: "640px" }}>
              Design the question-set structure for each vault. Once you publish a vault's template, every
              teacher creating a campaign there must follow that same sequence of clue types — they'll fill in
              the content, not the shape.
            </p>

            {loading ? (
              <p style={{ fontFamily: fonts.flourish, fontSize: "16px", color: colors.brassBright, marginTop: "40px" }}>
                Loading vaults...
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginTop: "32px" }}>
                {SCENE_LIST.map((s) => {
                  const template = templates[s.key];
                  const status = statusFor(template);
                  const meta = STATUS_META[status];
                  const hovered = hoveredScene === s.key;

                  return (
                    <div
                      key={s.key}
                      onClick={() => navigate(`/admin/vault/${s.key}`)}
                      onMouseEnter={() => setHoveredScene(s.key)}
                      onMouseLeave={() => setHoveredScene(null)}
                      style={{
                        background: `linear-gradient(165deg, #241A10 0%, ${colors.obsidian} 100%)`,
                        borderRadius: "20px",
                        border: `1px solid ${hovered ? s.color : colors.vaultBorder}`,
                        padding: "24px",
                        minHeight: "180px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        boxShadow: hovered ? `0 10px 34px rgba(0,0,0,0.5), 0 0 22px ${s.color}44` : "0 10px 24px rgba(0,0,0,0.4)",
                        transition: "border-color 0.25s, box-shadow 0.25s",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <s.Icon size={26} color={hovered ? s.color : colors.brass} />
                          <span
                            style={{
                              padding: "2px 10px",
                              borderRadius: "10px",
                              backgroundColor: meta.bg,
                              color: meta.color,
                              fontFamily: fonts.body,
                              fontSize: "11px",
                              fontWeight: "600",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p style={{ fontFamily: fonts.display, fontWeight: "600", fontSize: "18px", color: colors.brassBright, margin: "14px 0 6px 0" }}>
                          {s.label}
                        </p>
                        <p style={{ fontFamily: fonts.body, fontSize: "13px", color: "#B9AC96", margin: 0 }}>
                          {template && template.slots.length > 0
                            ? `${template.slots.length} clue${template.slots.length === 1 ? "" : "s"} in the set`
                            : "No question set designed yet"}
                        </p>
                      </div>

                      <button
                        style={{
                          width: "100%",
                          padding: "10px",
                          background: hovered ? `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})` : "transparent",
                          color: hovered ? "white" : colors.brassBright,
                          border: `1px solid ${colors.ember}`,
                          borderRadius: "18px",
                          fontFamily: fonts.body,
                          fontWeight: "600",
                          fontSize: "14px",
                          cursor: "pointer",
                          marginTop: "16px",
                          transition: "background 0.25s, color 0.25s",
                        }}
                      >
                        {status === "empty" ? "Design Question Set →" : "Edit Question Set →"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
