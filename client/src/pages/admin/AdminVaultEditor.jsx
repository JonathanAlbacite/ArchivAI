import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Lock, Unlock } from "lucide-react";
import Navbar from "../../components/Navbar";
import EmberField from "../../components/EmberField";
import dashboard_bg from "../../assets/dashboard_bg.png";
import { colors, fonts } from "../../theme";
import { getSceneMeta } from "../../scenes";

const CLUE_TYPES = [
  { value: "NORMAL", label: "Normal — 1 answer" },
  { value: "MULTICHOICE", label: "MultiChoice — 1 correct + 3 decoys" },
  { value: "COMBO", label: "Combo — multiple correct answers" },
];

// Admin: designs the ordered sequence of clue-type slots for one vault
// (scene). Draft slots can be freely added/removed/reordered/retyped;
// publishing locks the sequence, matching how a teacher's own campaigns
// publish — to change it again, unpublish first (see handleUnpublish).
// Whatever's published here is exactly the structure campaigns.js now
// requires a teacher's clue set to match, in order, for this scene.
function AdminVaultEditor() {
  const { scene } = useParams();
  const navigate = useNavigate();
  const meta = getSceneMeta(scene);

  const [slots, setSlots] = useState([]);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("token");
  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchTemplate = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/vault-templates/${scene}`, {
        headers: authHeaders,
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
        navigate("/admin/dashboard");
        return;
      }

      setSlots(data.slots.map((s) => ({ type: s.type })));
      setIsPublished(data.isPublished);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const addSlot = () => setSlots((s) => [...s, { type: "NORMAL" }]);
  const removeSlot = (i) => setSlots((s) => s.filter((_, j) => j !== i));
  const setSlotType = (i, type) => setSlots((s) => s.map((slot, j) => (j === i ? { type } : slot)));
  const moveSlot = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= slots.length) return;
    setSlots((s) => {
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const saveDraft = async () => {
    if (slots.length === 0) {
      alert("Add at least one slot first.");
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/vault-templates/${scene}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ slots }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    const ok = await saveDraft();
    if (ok) alert("Draft saved.");
  };

  const handlePublish = async () => {
    const ok = await saveDraft();
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/vault-templates/${scene}/publish`, {
        method: "PATCH",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      setIsPublished(true);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/vault-templates/${scene}/unpublish`, {
        method: "PATCH",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message);
        return;
      }
      setIsPublished(false);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    padding: "9px 12px",
    borderRadius: "8px",
    border: `1px solid ${colors.parchmentLine}`,
    backgroundColor: colors.parchmentPanel,
    fontFamily: fonts.body,
    fontSize: "13px",
    color: colors.ink,
    outline: "none",
  };

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
          <div style={{ padding: "40px", maxWidth: "760px" }}>
            <button
              onClick={() => navigate("/admin/dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                color: colors.brass,
                fontFamily: fonts.body,
                fontSize: "13px",
                cursor: "pointer",
                padding: 0,
                marginBottom: "18px",
              }}
            >
              <ArrowLeft size={15} /> All Vaults
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <meta.Icon size={24} color={meta.color} />
              <h1 style={{ fontFamily: fonts.displayDecorative, fontSize: "30px", color: colors.brassBright, margin: 0 }}>
                {meta.label}
              </h1>
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: "10px",
                  backgroundColor: isPublished ? colors.successBg : colors.draftBg,
                  color: isPublished ? colors.success : colors.draft,
                  fontFamily: fonts.body,
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {isPublished ? "Published" : "Draft"}
              </span>
            </div>
            <p style={{ color: "#C9BBA6", fontFamily: fonts.body, fontSize: "14px", margin: "0 0 28px 0" }}>
              The order and type of clue slots a teacher's campaign must follow when creating a campaign in this vault.
            </p>

            {loading ? (
              <p style={{ fontFamily: fonts.flourish, fontSize: "16px", color: colors.brassBright }}>Loading...</p>
            ) : isPublished ? (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                  {slots.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${colors.vaultBorder}`,
                      }}
                    >
                      <span style={{ fontFamily: fonts.flourish, fontSize: "13px", color: colors.ember, minWidth: "28px" }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontFamily: fonts.body, fontSize: "13px", color: "#EFE6D6", fontWeight: "600" }}>
                        {CLUE_TYPES.find((t) => t.value === s.type)?.label || s.type}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleUnpublish}
                  disabled={saving}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "12px 20px",
                    background: "transparent",
                    color: colors.brassBright,
                    border: `1px solid ${colors.brass}`,
                    borderRadius: "16px",
                    fontFamily: fonts.body,
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: saving ? "default" : "pointer",
                  }}
                >
                  <Unlock size={15} /> Unpublish to Edit
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                  {slots.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.03)",
                        border: `1px solid ${colors.vaultBorder}`,
                      }}
                    >
                      <span style={{ fontFamily: fonts.flourish, fontSize: "13px", color: colors.ember, minWidth: "28px" }}>
                        #{i + 1}
                      </span>
                      <select value={s.type} onChange={(e) => setSlotType(i, e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
                        {CLUE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => moveSlot(i, -1)}
                        disabled={i === 0}
                        title="Move up"
                        style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#5D5145" : colors.brass, display: "flex" }}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => moveSlot(i, 1)}
                        disabled={i === slots.length - 1}
                        title="Move down"
                        style={{ background: "none", border: "none", cursor: i === slots.length - 1 ? "default" : "pointer", color: i === slots.length - 1 ? "#5D5145" : colors.brass, display: "flex" }}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        onClick={() => removeSlot(i)}
                        title="Remove slot"
                        style={{ background: "none", border: "none", cursor: "pointer", color: colors.danger, display: "flex" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {slots.length === 0 && (
                    <p style={{ fontFamily: fonts.body, fontSize: "13px", color: "#B9AC96", fontStyle: "italic" }}>
                      No slots yet — add the first clue below.
                    </p>
                  )}
                </div>

                <button
                  onClick={addSlot}
                  style={{
                    background: "none",
                    border: `1px dashed ${colors.brass}`,
                    borderRadius: "10px",
                    padding: "10px 16px",
                    color: colors.brassBright,
                    fontFamily: fonts.body,
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    marginBottom: "28px",
                  }}
                >
                  + Add Slot
                </button>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "13px",
                      background: "transparent",
                      color: colors.brassBright,
                      border: `1px solid ${colors.vaultBorder}`,
                      borderRadius: "16px",
                      fontFamily: fonts.body,
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: saving ? "default" : "pointer",
                    }}
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={handlePublish}
                    disabled={saving || slots.length === 0}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "13px",
                      background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`,
                      color: "white",
                      border: "none",
                      borderRadius: "16px",
                      fontFamily: fonts.body,
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: saving || slots.length === 0 ? "default" : "pointer",
                      opacity: slots.length === 0 ? 0.6 : 1,
                    }}
                  >
                    <Lock size={15} /> Publish
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminVaultEditor;
