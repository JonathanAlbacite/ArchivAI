import { useState } from "react";
import { Trash2 } from "lucide-react";
import BookShell from "../book/BookShell";
import { colors, fonts } from "../../theme";
import { SCENE_LIST } from "../../scenes";

const emptyClue = () => ({ question: "", answer: "" });

function SpellBookModal({ roomId, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scene, setScene] = useState("");
  const [pages, setPages] = useState([emptyClue()]);
  const [pageIndex, setPageIndex] = useState(0);
  const [focusedField, setFocusedField] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const updateClue = (field, value) => {
    setPages(pages.map((p, i) => (i === pageIndex ? { ...p, [field]: value } : p)));
  };

  const addPage = () => {
    setPages([...pages, emptyClue()]);
    setPageIndex(pages.length);
  };

  const removePage = () => {
    if (pages.length <= 1) return;
    const next = pages.filter((_, i) => i !== pageIndex);
    setPages(next);
    setPageIndex(Math.min(pageIndex, next.length - 1));
  };

  const fieldStyle = (field) => ({
    width: "100%",
    padding: "10px 12px",
    marginTop: "6px",
    borderRadius: "12px",
    border: `1px solid ${focusedField === field ? colors.ember : colors.parchmentLine}`,
    backgroundColor: colors.parchmentPanel,
    boxSizing: "border-box",
    fontFamily: fonts.body,
    fontSize: "14px",
    color: colors.ink,
    outline: "none",
    boxShadow: focusedField === field ? `0 0 0 3px ${colors.ember}33` : "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    resize: "none",
  });

  const handleSeal = async () => {
    const token = localStorage.getItem("token");

    if (!title) {
      alert("Title is required.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ title, description, roomId, scene }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      const newCampaignId = data.id;
      const filledClues = pages.filter((c) => c.question && c.answer);

      if (filledClues.length > 0) {
        const cluesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${newCampaignId}/clues`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ clues: filledClues }),
        });

        const cluesData = await cluesRes.json();

        if (!cluesRes.ok) {
          alert(cluesData.message);
          return;
        }
      }

      const publishRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${newCampaignId}/publish`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
      });

      const publishData = await publishRes.json();

      if (!publishRes.ok) {
        alert(publishData.message);
        return;
      }

      onCreated();
      onClose();

    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentClue = pages[pageIndex];

  const leftPage = (
    <div>
      <p style={{ fontFamily: fonts.flourish, fontSize: "11px", color: colors.inkMuted, letterSpacing: "2px", margin: "0 0 4px 0" }}>
        NEW CHRONICLE
      </p>
      <h2 style={{ fontFamily: fonts.displayDecorative, fontSize: "26px", color: colors.ink, margin: "0 0 20px 0" }}>Create Campaign</h2>

      <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onFocus={() => setFocusedField("title")}
        onBlur={() => setFocusedField(null)}
        style={{ ...fieldStyle("title"), marginBottom: "16px" }}
      />

      <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Description</label>
      <textarea
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onFocus={() => setFocusedField("description")}
        onBlur={() => setFocusedField(null)}
        style={{ ...fieldStyle("description"), marginBottom: "20px" }}
      />

      <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Choose a Realm</label>
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        {SCENE_LIST.map((s) => {
          const active = scene === s.key;
          return (
            <div
              key={s.key}
              onClick={() => setScene(s.key)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
                padding: "14px 8px",
                borderRadius: "14px",
                cursor: "pointer",
                backgroundColor: active ? `${s.color}22` : colors.parchmentPanel,
                border: `2px solid ${active ? s.color : colors.parchmentLine}`,
                transition: "border-color 0.2s, background-color 0.2s",
              }}
            >
              <s.Icon size={22} color={active ? s.color : colors.inkMuted} />
              <p style={{ margin: 0, fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", color: active ? s.color : colors.inkMuted }}>
                {s.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );

  const rightPage = (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <p style={{ fontFamily: fonts.flourish, fontSize: "13px", color: colors.ember, letterSpacing: "1px", margin: 0 }}>
          Clue {pageIndex + 1}
        </p>
        {pages.length > 1 && (
          <button
            type="button"
            onClick={removePage}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.inkMuted, display: "flex", alignItems: "center", gap: "4px", fontFamily: fonts.body, fontSize: "12px" }}
          >
            <Trash2 size={14} /> Remove page
          </button>
        )}
      </div>

      <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Question</label>
      <textarea
        rows={4}
        value={currentClue.question}
        onChange={(e) => updateClue("question", e.target.value)}
        onFocus={() => setFocusedField("question")}
        onBlur={() => setFocusedField(null)}
        placeholder="What riddle guards this clue?"
        style={{ ...fieldStyle("question"), marginBottom: "18px" }}
      />

      <label style={{ fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" }}>Answer</label>
      <input
        type="text"
        value={currentClue.answer}
        onChange={(e) => updateClue("answer", e.target.value)}
        onFocus={() => setFocusedField("answer")}
        onBlur={() => setFocusedField(null)}
        placeholder="The true answer"
        style={fieldStyle("answer")}
      />
    </div>
  );

  const footer = (
    <div style={{ display: "flex", gap: "10px", padding: "0 20px 20px 20px" }}>
      <button
        type="button"
        onClick={addPage}
        style={{
          flex: 1,
          padding: "12px",
          backgroundColor: "transparent",
          color: colors.ember,
          border: `1px dashed ${colors.ember}`,
          borderRadius: "14px",
          fontFamily: fonts.body,
          fontWeight: "600",
          fontSize: "13px",
          cursor: "pointer",
        }}
      >
        + Add Clue Page
      </button>
      <button
        type="button"
        onClick={handleSeal}
        disabled={submitting}
        style={{
          flex: 1,
          padding: "12px",
          background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`,
          color: "white",
          border: "none",
          borderRadius: "14px",
          fontFamily: fonts.body,
          fontWeight: "600",
          fontSize: "13px",
          cursor: submitting ? "default" : "pointer",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? "Sealing..." : "Seal the Book"}
      </button>
    </div>
  );

  return (
    <BookShell
      leftPage={leftPage}
      rightPage={rightPage}
      pageIndex={pageIndex}
      pageCount={pages.length}
      onPrev={() => setPageIndex(Math.max(0, pageIndex - 1))}
      onNext={() => setPageIndex(Math.min(pages.length - 1, pageIndex + 1))}
      onClose={onClose}
      footer={footer}
    />
  );
}

export default SpellBookModal;
