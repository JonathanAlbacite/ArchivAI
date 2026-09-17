import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Trash2, Lock, Sparkles, Check, X } from "lucide-react";
import EmberField from "../EmberField";
import { colors, fonts } from "../../theme";
import { SCENE_LIST, getSceneMeta } from "../../scenes";
import { SceneBadge } from "../SceneIcon";

const emptyClue = () => ({ question: "", answer: "" });
const FLIP_MS = 420;
const FLIP_SWAP_MS = 210;
const CLOSE_MS = 320;

const PAPER_BG = "#F5EDD6";
const FRAME_BG = "#E4D3A6";

// Scoped to this component's realm cards only — the shared scene tokens in
// theme.js (colors.sceneLab etc.) are used elsewhere (badges, icons) and
// weren't meant to carry this specific teal/purple/gold palette.
const SCENE_CARD_COLORS = { laboratory: "#2F8F86", library: "#6E4FA3", tomb: "#C9A227" };

// Tileable SVG grain so parchment panels read as aged paper instead of flat
// fill. Self-contained (no external image request). Turbulence noise alone
// renders as a near-uniform mid-gray wash, so a contrast boost via
// feComponentTransfer is needed to make individual fibers/specks visible.
const PAPER_NOISE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>" +
  "<filter id='n'>" +
  "<feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch' result='t'/>" +
  "<feColorMatrix in='t' type='saturate' values='0'/>" +
  "<feComponentTransfer>" +
  "<feFuncR type='linear' slope='2.6' intercept='-0.65'/>" +
  "<feFuncG type='linear' slope='2.6' intercept='-0.65'/>" +
  "<feFuncB type='linear' slope='2.6' intercept='-0.65'/>" +
  "</feComponentTransfer>" +
  "</filter>" +
  "<rect width='100%' height='100%' filter='url(#n)' opacity='0.55'/></svg>";
const PAPER_NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(PAPER_NOISE_SVG)}")`;

// A handful of soft warm blotches to read as age/water staining, layered
// under the grain.
const paperStyle = (tint = PAPER_BG) => ({
  backgroundColor: tint,
  backgroundImage: [
    PAPER_NOISE_URL,
    "radial-gradient(ellipse 220px 160px at 8% 12%, rgba(140,100,45,0.10), transparent 70%)",
    "radial-gradient(ellipse 260px 200px at 92% 88%, rgba(140,100,45,0.09), transparent 70%)",
    "radial-gradient(ellipse 180px 140px at 80% 15%, rgba(140,100,45,0.07), transparent 70%)",
  ].join(", "),
  backgroundSize: "160px 160px, 100% 100%, 100% 100%, 100% 100%",
  backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat",
});

function FrameCorner({ corner }) {
  const edge = { border: `2px solid ${colors.brass}` };
  const pos = {
    tl: { top: 6, left: 6, borderTop: edge.border, borderLeft: edge.border },
    tr: { top: 6, right: 6, borderTop: edge.border, borderRight: edge.border },
    bl: { bottom: 6, left: 6, borderBottom: edge.border, borderLeft: edge.border },
    br: { bottom: 6, right: 6, borderBottom: edge.border, borderRight: edge.border },
  }[corner];
  return <div style={{ position: "absolute", width: 16, height: 16, pointerEvents: "none", ...pos }} />;
}

// Left-page illustration slot, shown as-is on every page (page 1 and every
// clue page after it) regardless of which realm is picked. No real artwork
// yet, so the frame content is either the "{label}" placeholder text (page 1
// before a realm is picked, and always on clue pages) or — on page 1 once a
// realm is picked — a large themed lucide icon standing in for that realm's
// artwork. Only the caption below the frame reflects the chosen realm.
function IllustrationFrame({ scene, label, showIcon }) {
  const meta = getSceneMeta(scene);
  const iconOnly = showIcon && Boolean(scene);

  return (
    <div style={{ width: "100%", flexShrink: 0 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "clamp(150px, 30vh, 300px)",
          padding: "9px",
          boxSizing: "border-box",
          background: `linear-gradient(160deg, ${colors.brass}, ${colors.emberDim})`,
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            border: `1px solid ${colors.vaultBorder}`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            ...paperStyle(FRAME_BG),
          }}
        >
          <FrameCorner corner="tl" />
          <FrameCorner corner="tr" />
          <FrameCorner corner="bl" />
          <FrameCorner corner="br" />
          {iconOnly ? (
            <meta.Icon size={72} color={SCENE_CARD_COLORS[scene] || meta.color} strokeWidth={1.5} />
          ) : (
            <p style={{ fontFamily: fonts.flourish, fontSize: "16px", color: colors.inkMuted, letterSpacing: "2px" }}>{label}</p>
          )}
        </div>
      </div>
      {scene && (
        <p style={{ textAlign: "center", margin: "8px 0 0 0", fontFamily: fonts.flourish, fontSize: "12px", color: colors.inkMuted, letterSpacing: "1px" }}>
          {meta.label}
        </p>
      )}
    </div>
  );
}

function SceneCard({ s, active, onClick }) {
  const c = SCENE_CARD_COLORS[s.key] || s.color;
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        padding: "16px 8px",
        cursor: "pointer",
        borderRadius: "6px",
        background: active ? c : `${c}22`,
        border: `2px solid ${c}`,
        boxShadow: active ? `0 4px 12px ${c}88` : "none",
        transition: "background 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.boxShadow = `0 4px 12px ${c}55`)}
      onMouseLeave={(e) => !active && (e.currentTarget.style.boxShadow = "none")}
    >
      <s.Icon size={22} color={active ? "#FFF9EF" : c} />
      <p style={{ margin: 0, fontFamily: fonts.body, fontSize: "13px", fontWeight: "600", color: active ? "#FFF9EF" : c }}>{s.label}</p>
    </div>
  );
}

function ArrowNavButton({ direction, onClick, disabled, badge }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const side = direction === "prev" ? "left" : "right";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={direction === "prev" ? "Previous page" : badge ? "Add a new clue page" : "Next page"}
      style={{
        position: "absolute",
        top: "50%",
        [side]: "-22px",
        transform: "translateY(-50%)",
        width: "48px",
        height: "48px",
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, ${colors.brassBright}, ${colors.brass} 60%, ${colors.emberDim} 100%)`,
        border: `2px solid ${colors.vaultBorder}`,
        boxShadow: disabled ? "none" : "0 6px 14px rgba(0,0,0,0.45)",
        color: colors.obsidianDeep,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        zIndex: 3,
      }}
    >
      <Icon size={22} />
      {badge && (
        <span
          style={{
            position: "absolute",
            top: "-4px",
            [side]: "-4px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: colors.danger,
            color: PAPER_BG,
            fontSize: "12px",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >
          +
        </span>
      )}
    </button>
  );
}

function SealButton({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        width: "100%",
        padding: "14px 20px 14px 58px",
        background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`,
        color: "#FFF9EF",
        border: `1px solid ${colors.vaultBorder}`,
        fontFamily: fonts.displayDecorative,
        fontSize: "16px",
        letterSpacing: "0.5px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
        clipPath: "polygon(0 0,100% 0,97% 50%,100% 100%,0 100%,3% 50%)",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "14px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, #B85050, ${colors.danger} 70%)`,
          boxShadow: "inset 0 2px 3px rgba(255,255,255,0.3), inset 0 -3px 4px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Lock size={14} color="#F5D8B0" />
      </span>
      {children}
    </button>
  );
}

const STATUS_META = {
  pending: { label: "Pending", color: colors.draft, bg: colors.draftBg },
  edited: { label: "Edited", color: colors.brass, bg: `${colors.brass}22` },
  approved: { label: "Approved", color: colors.success, bg: colors.successBg },
  rejected: { label: "Rejected", color: colors.danger, bg: `${colors.danger}22` },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span
      style={{
        padding: "2px 9px",
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
  );
}

// One reviewable clue conjured from a lesson upload. Keeps its own text
// buffer so keystrokes don't round-trip to the server — edits are only
// PATCHed up on blur, and only if they actually changed.
//
// Clicking Approve/Reject right after editing fires a native blur before
// the click handler runs, which would otherwise send the edit-PATCH and
// the approve-PATCH concurrently — whichever lands last on the server wins
// and can silently drop the approval. pendingSave tracks any in-flight (or
// just-kicked-off) edit so approve/reject can await it first and guarantee
// the status change is always the last write.
function GeneratedClueCard({ clue, onSaveEdit, onApprove, onReject }) {
  const [clueText, setClueText] = useState(clue.clueText);
  const [answerText, setAnswerText] = useState(clue.answerText);
  const pendingSave = useRef(null);

  const flushEdit = () => {
    if (clueText !== clue.clueText || answerText !== clue.answerText) {
      pendingSave.current = onSaveEdit(clue.id, { clueText, answerText });
    }
    return pendingSave.current || Promise.resolve();
  };

  const handleApprove = async () => {
    await flushEdit();
    onApprove(clue.id);
  };

  const handleReject = async () => {
    await flushEdit();
    onReject(clue.id);
  };

  const isRejected = clue.status === "rejected";
  const isApproved = clue.status === "approved";

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "6px",
        border: `1px solid ${isApproved ? colors.success : isRejected ? colors.danger : colors.parchmentLine}`,
        backgroundColor: colors.parchmentPanel,
        opacity: isRejected ? 0.55 : 1,
        transition: "opacity 0.15s, border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
        <SceneBadge scene={clue.scene} />
        <StatusPill status={clue.status} />
      </div>

      <textarea
        rows={2}
        value={clueText}
        onChange={(e) => setClueText(e.target.value)}
        onBlur={flushEdit}
        style={{
          width: "100%",
          padding: "8px 10px",
          marginBottom: "8px",
          borderRadius: "4px",
          border: `1px solid ${colors.parchmentLine}`,
          fontFamily: fonts.body,
          fontSize: "13px",
          color: colors.ink,
          boxSizing: "border-box",
          resize: "none",
        }}
      />
      <input
        type="text"
        value={answerText}
        onChange={(e) => setAnswerText(e.target.value)}
        onBlur={flushEdit}
        placeholder="Answer"
        style={{
          width: "100%",
          padding: "8px 10px",
          marginBottom: "10px",
          borderRadius: "4px",
          border: `1px solid ${colors.parchmentLine}`,
          fontFamily: fonts.body,
          fontSize: "13px",
          color: colors.ink,
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          onClick={handleApprove}
          disabled={isApproved}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            padding: "6px 8px",
            borderRadius: "4px",
            border: `1px solid ${colors.success}`,
            backgroundColor: isApproved ? colors.successBg : "transparent",
            color: colors.success,
            fontFamily: fonts.body,
            fontSize: "12px",
            fontWeight: "600",
            cursor: isApproved ? "default" : "pointer",
          }}
        >
          <Check size={13} /> Approve
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isRejected}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            padding: "6px 8px",
            borderRadius: "4px",
            border: `1px solid ${colors.danger}`,
            backgroundColor: isRejected ? `${colors.danger}22` : "transparent",
            color: colors.danger,
            fontFamily: fonts.body,
            fontSize: "12px",
            fontWeight: "600",
            cursor: isRejected ? "default" : "pointer",
          }}
        >
          <X size={13} /> Reject
        </button>
      </div>
    </div>
  );
}

// Takes over the right page while clues conjured from an uploaded lesson
// are awaiting review. Approving/rejecting/editing here persists straight
// to the GeneratedClue rows; only approved ones get inserted as pages.
function GeneratedCluesReview({ clues, onSaveEdit, onApprove, onReject, onInsert, onCancel }) {
  const approvedCount = clues.filter((c) => c.status === "approved").length;

  return (
    <div>
      <h2 style={{ fontFamily: fonts.displayDecorative, fontSize: "20px", color: colors.ink, margin: "0 0 6px 0" }}>
        Review Generated Clues
      </h2>
      <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.inkMuted, margin: "0 0 14px 0" }}>
        Approve the clues you want added to the book. Edit any wording first if needed.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {clues.map((c) => (
          <GeneratedClueCard key={c.id} clue={c} onSaveEdit={onSaveEdit} onApprove={onApprove} onReject={onReject} />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ background: "none", border: "none", cursor: "pointer", color: colors.inkMuted, fontFamily: fonts.body, fontSize: "12px", textDecoration: "underline" }}
        >
          cancel
        </button>
        <button
          type="button"
          onClick={onInsert}
          disabled={approvedCount === 0}
          style={{
            padding: "9px 16px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: approvedCount === 0 ? colors.parchmentDark : colors.ember,
            color: approvedCount === 0 ? colors.inkMuted : "#FFF9EF",
            fontFamily: fonts.body,
            fontSize: "13px",
            fontWeight: "600",
            cursor: approvedCount === 0 ? "default" : "pointer",
          }}
        >
          Add {approvedCount || ""} Approved Clue{approvedCount === 1 ? "" : "s"} to Campaign
        </button>
      </div>
    </div>
  );
}

// activeIndex 0 = the cover/setup page (title, description, realm); indices
// 1..pages.length are clue pages, one per entry in `pages`.
//
// Doubles as the full campaign editor: pass an existing `campaign` (as
// returned by GET /api/campaigns/:id, including its clues) to pre-fill
// every field and switch sealing from create to update. Only reachable for
// drafts (RoomPage only offers Edit while !isPublished) — the server
// enforces that too on both the metadata PATCH and the clues PUT below.
function SpellBookModal({ roomId, campaign, onClose, onSaved }) {
  const isEditing = !!campaign;
  const [title, setTitle] = useState(campaign?.title || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [scene, setScene] = useState(campaign?.scene || "");
  const [pages, setPages] = useState(
    campaign?.clues?.map((c) => ({ question: c.question, answer: c.answer })) || []
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusedField, setFocusedField] = useState(null);
  const [flipping, setFlipping] = useState(null);
  const [closing, setClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Editing only ever opens on a still-draft campaign, so defaulting to its
  // current (always-false) isPublished keeps existing drafts as drafts
  // unless the teacher explicitly opts to publish now; a brand-new campaign
  // still defaults to publishing immediately, matching prior behavior.
  const [publishNow, setPublishNow] = useState(isEditing ? campaign.isPublished : true);

  // "Conjure clues from a lesson" flow: idle -> uploading -> generating ->
  // review (clues awaiting approve/reject) -> back to idle once inserted.
  const [lessonStep, setLessonStep] = useState("idle");
  const [lessonError, setLessonError] = useState("");
  const [generatedClues, setGeneratedClues] = useState([]);
  const fileInputRef = useRef(null);
  const reviewing = lessonStep === "review";

  const lastIndex = pages.length;
  const atFrontier = activeIndex === lastIndex;

  const turnPage = (direction) => {
    if (flipping || closing || reviewing) return;

    if (direction === "prev") {
      if (activeIndex === 0) return;
      setFlipping("prev");
      setTimeout(() => setActiveIndex((i) => i - 1), FLIP_SWAP_MS);
      setTimeout(() => setFlipping(null), FLIP_MS);
      return;
    }

    setFlipping("next");
    setTimeout(() => {
      if (atFrontier) {
        setPages((p) => [...p, emptyClue()]);
      }
      setActiveIndex((i) => i + 1);
    }, FLIP_SWAP_MS);
    setTimeout(() => setFlipping(null), FLIP_MS);
  };

  const updateClue = (field, value) => {
    const clueIndex = activeIndex - 1;
    setPages(pages.map((p, i) => (i === clueIndex ? { ...p, [field]: value } : p)));
  };

  const removeClue = () => {
    const clueIndex = activeIndex - 1;
    if (clueIndex < 0) return;
    const next = pages.filter((_, i) => i !== clueIndex);
    setPages(next);
    setActiveIndex(Math.min(activeIndex, next.length));
  };

  const fieldStyle = (field) => ({
    width: "100%",
    padding: "10px 12px",
    marginTop: "6px",
    borderRadius: "4px",
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

  const labelStyle = { fontFamily: fonts.body, color: colors.ink, fontWeight: "600", fontSize: "13px" };

  // Uploads the chosen lesson file, extracts its text, and asks Gemini to
  // conjure a batch of clues (GeneratedClue rows) to review below.
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!scene) {
      setLessonError("Choose a scene above first — clues are themed to it.");
      setLessonStep("error");
      return;
    }

    const token = localStorage.getItem("token");
    setLessonError("");
    setLessonStep("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch(`${import.meta.env.VITE_API_URL}/api/lesson-modules/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.message || "Upload failed");

      setLessonStep("generating");

      const genRes = await fetch(`${import.meta.env.VITE_API_URL}/api/lesson-modules/${uploadData.id}/generate-clues`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scene }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.message || "Clue generation failed");

      setGeneratedClues(genData);
      setLessonStep("review");
    } catch (err) {
      setLessonError(err.message);
      setLessonStep("error");
    }
  };

  const saveClueEdit = async (id, { clueText, answerText }) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/clues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clueText, answerText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save edit");
      setGeneratedClues((cs) => cs.map((c) => (c.id === id ? data : c)));
    } catch (err) {
      alert(err.message);
    }
  };

  const setClueStatus = async (id, action) => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/clues/${id}/${action}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update clue");
      setGeneratedClues((cs) => cs.map((c) => (c.id === id ? data : c)));
    } catch (err) {
      alert(err.message);
    }
  };

  // Only approved clues become pages; rejected/still-pending ones are left
  // behind (they stay recorded server-side, just never added to the book).
  const insertApprovedClues = () => {
    const approved = generatedClues.filter((c) => c.status === "approved");
    if (approved.length === 0) return;

    setPages((p) => [...p, ...approved.map((c) => ({ question: c.clueText, answer: c.answerText }))]);
    setLessonStep("idle");
    setGeneratedClues([]);
  };

  const cancelReview = () => {
    setLessonStep("idle");
    setGeneratedClues([]);
  };

  // Runs the create/update -> clues -> publish sequence. Editing PATCHes the
  // existing campaign's metadata and PUTs the whole clue set (replacing it,
  // since the teacher may have removed or reordered pages); creating POSTs
  // both fresh. Returns whether it succeeded; does not touch modal/close
  // state so the caller can drive the closing animation around it.
  const seal = async () => {
    const token = localStorage.getItem("token");
    setSubmitting(true);

    try {
      const campaignId = isEditing ? campaign.id : null;

      const metaRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/campaigns${isEditing ? `/${campaignId}` : ""}`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(isEditing ? { title, description, scene } : { title, description, roomId, scene }),
        }
      );

      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        alert(metaData.message);
        return false;
      }

      const finalCampaignId = isEditing ? campaignId : metaData.id;
      const filledClues = pages.filter((c) => c.question && c.answer);

      if (isEditing) {
        // PUT replaces the whole set (including clearing it if the teacher
        // removed every page), unlike POST below which only appends.
        const cluesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${finalCampaignId}/clues`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ clues: filledClues }),
        });
        const cluesData = await cluesRes.json();
        if (!cluesRes.ok) {
          alert(cluesData.message);
          return false;
        }
      } else if (filledClues.length > 0) {
        const cluesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${finalCampaignId}/clues`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ clues: filledClues }),
        });
        const cluesData = await cluesRes.json();
        if (!cluesRes.ok) {
          alert(cluesData.message);
          return false;
        }
      }

      if (publishNow) {
        const publishRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${finalCampaignId}/publish`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        const publishData = await publishRes.json();
        if (!publishRes.ok) {
          alert(publishData.message);
          return false;
        }
      }

      onSaved();
      return true;
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Closing the book is the submit gesture: play the close animation, seal
  // the campaign, and only unmount once that succeeds. On failure the book
  // springs back open so the teacher can fix whatever the server rejected.
  const closeAndSeal = async () => {
    if (closing || submitting) return;
    if (reviewing) {
      alert("Finish reviewing the generated clues first.");
      return;
    }
    if (!title.trim()) {
      alert("Title is required.");
      return;
    }
    setClosing(true);
    const ok = await seal();
    if (!ok) {
      setClosing(false);
      return;
    }
    setTimeout(onClose, CLOSE_MS);
  };

  const discard = () => {
    if (!submitting && !closing) onClose();
  };

  const rightFlipStyle = {
    transform: flipping ? "rotateY(-90deg)" : "rotateY(0deg)",
    opacity: flipping ? 0.3 : 1,
    transition: `transform ${FLIP_SWAP_MS}ms ease-in, opacity ${FLIP_SWAP_MS}ms ease-in`,
    transformOrigin: "left center",
  };

  const isCluePage = activeIndex > 0;
  const currentClue = isCluePage ? pages[activeIndex - 1] : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(6,4,2,0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
        padding: "20px",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      <EmberField variant="ember" count={20} />

      <div
        style={{
          position: "relative",
          width: "min(960px, 96vw)",
          maxHeight: "90vh",
          margin: "auto",
          perspective: "1600px",
          animation: closing ? `spellbookClose ${CLOSE_MS}ms ease-in forwards` : "spellbookOpen 0.5s ease-out",
        }}
      >
        {/* Leather cover */}
        <div
          style={{
            position: "relative",
            background: `radial-gradient(ellipse at 30% 15%, ${colors.wood}, ${colors.obsidian} 78%)`,
            border: `3px solid ${colors.vaultBorder}`,
            borderRadius: "14px",
            boxShadow: `0 24px 60px rgba(0,0,0,0.6), inset 0 0 60px rgba(0,0,0,0.5), inset 0 0 0 2px ${colors.brass}55`,
            padding: "16px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Page counter bookmark */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              background: colors.danger,
              color: PAPER_BG,
              padding: "6px 16px 12px 16px",
              fontFamily: fonts.flourish,
              fontSize: "13px",
              letterSpacing: "1px",
              clipPath: "polygon(0 0,100% 0,100% 78%,50% 100%,0 78%)",
              boxShadow: "0 4px 8px rgba(0,0,0,0.4)",
              zIndex: 2,
            }}
          >
            {activeIndex + 1} / {lastIndex + 1}
          </div>

          {/* HUD bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 6px 14px 6px" }}>
            <button
              type="button"
              onClick={discard}
              disabled={submitting || closing}
              style={{
                background: "none",
                border: "none",
                cursor: submitting || closing ? "default" : "pointer",
                color: colors.brass,
                fontFamily: fonts.body,
                fontSize: "12px",
                opacity: 0.75,
                textDecoration: "underline",
              }}
            >
              {isEditing ? "discard changes" : "discard draft"}
            </button>
            <p style={{ fontFamily: fonts.flourish, fontSize: "16px", color: colors.brassBright, letterSpacing: "1px", margin: 0 }}>
              Campaign Editor
            </p>
            <span style={{ width: "78px" }} />
          </div>

          {/* Pages */}
          <div style={{ display: "flex", gap: "0", flex: 1, minHeight: 0 }}>
            {/* Left page: illustration frame, static */}
            <div style={{ flex: 1, display: "flex" }}>
              <div className="sb-page" style={{ position: "relative", width: "100%", border: `1px solid ${colors.parchmentLine}`, boxShadow: "inset 0 0 34px rgba(120,90,40,0.15), 0 8px 20px rgba(0,0,0,0.3)", ...paperStyle() }}>
                <div style={{ padding: "22px", height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
                  <p style={{ fontFamily: fonts.flourish, fontSize: "11px", color: colors.inkMuted, letterSpacing: "2px", margin: "0 0 10px 0" }}>
                    {isEditing ? "EDITING CAMPAIGN" : "NEW CAMPAIGN"}
                  </p>
                  <IllustrationFrame scene={scene} label={isCluePage ? "Clue Preview" : "Scene Preview"} showIcon={!isCluePage} />
                  <h2 style={{ fontFamily: fonts.displayDecorative, fontSize: "20px", color: colors.ink, margin: "14px 0 0 0" }}>
                    {title || "Untitled Campaign"}
                  </h2>
                  {description && (
                    <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.inkMuted, margin: "8px 0 0 0" }}>{description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Spine */}
            <div
              style={{
                width: "26px",
                flexShrink: 0,
                position: "relative",
                background: `linear-gradient(90deg, ${colors.obsidian}, ${colors.wood} 45%, ${colors.wood} 55%, ${colors.obsidian})`,
                boxShadow: "inset 6px 0 10px -6px rgba(0,0,0,0.6), inset -6px 0 10px -6px rgba(0,0,0,0.6)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 9px, ${colors.brassBright}88 9px, ${colors.brassBright}88 10px, transparent 10px, transparent 13px)`,
                }}
              />
            </div>

            {/* Right page: flips */}
            <div style={{ flex: 1, display: "flex", ...rightFlipStyle }}>
              <div className="sb-page" style={{ position: "relative", width: "100%", border: `1px solid ${colors.parchmentLine}`, boxShadow: "inset 0 0 34px rgba(120,90,40,0.15), 0 8px 20px rgba(0,0,0,0.3)", ...paperStyle() }}>
                <div style={{ padding: "22px", height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
                  {reviewing ? (
                    <GeneratedCluesReview
                      clues={generatedClues}
                      onSaveEdit={saveClueEdit}
                      onApprove={(id) => setClueStatus(id, "approve")}
                      onReject={(id) => setClueStatus(id, "reject")}
                      onInsert={insertApprovedClues}
                      onCancel={cancelReview}
                    />
                  ) : !isCluePage ? (
                    <div>
                      <h2 style={{ fontFamily: fonts.displayDecorative, fontSize: "22px", color: colors.ink, margin: "0 0 18px 0" }}>
                        {isEditing ? "Edit Campaign" : "Create Campaign"}
                      </h2>

                      <label style={labelStyle}>Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onFocus={() => setFocusedField("title")}
                        onBlur={() => setFocusedField(null)}
                        style={{ ...fieldStyle("title"), marginBottom: "16px" }}
                      />

                      <label style={labelStyle}>Description</label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onFocus={() => setFocusedField("description")}
                        onBlur={() => setFocusedField(null)}
                        style={{ ...fieldStyle("description"), marginBottom: "20px" }}
                      />

                      <label style={labelStyle}>Choose a Scene</label>
                      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                        {SCENE_LIST.map((s) => (
                          <SceneCard key={s.key} s={s} active={scene === s.key} onClick={() => setScene(s.key)} />
                        ))}
                      </div>

                      <div style={{ marginTop: "22px", paddingTop: "18px", borderTop: `1px dashed ${colors.parchmentLine}` }}>
                        <label style={labelStyle}>Generate Clues from a Lesson</label>
                        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.inkMuted, margin: "6px 0 10px 0" }}>
                          {scene
                            ? `Upload a lesson document (.pdf, .docx, .doc, .txt) and the AI assistant will draft ${getSceneMeta(scene).label}-themed clues for you to review.`
                            : "Choose a scene above first — generated clues are themed to it."}
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.docx,.doc,.txt"
                          onChange={handleFileChange}
                          style={{ display: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={!scene || lessonStep === "uploading" || lessonStep === "generating"}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                            padding: "9px 14px",
                            borderRadius: "4px",
                            border: `1px solid ${colors.ember}`,
                            backgroundColor: "transparent",
                            color: colors.ember,
                            fontFamily: fonts.body,
                            fontSize: "13px",
                            fontWeight: "600",
                            cursor: !scene || lessonStep === "uploading" || lessonStep === "generating" ? "default" : "pointer",
                            opacity: !scene || lessonStep === "uploading" || lessonStep === "generating" ? 0.6 : 1,
                          }}
                        >
                          <Sparkles size={14} />
                          {lessonStep === "uploading"
                            ? "Uploading..."
                            : lessonStep === "generating"
                            ? "Generating clues..."
                            : "Choose a File"}
                        </button>
                        {lessonStep === "error" && (
                          <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.danger, margin: "8px 0 0 0" }}>
                            {lessonError}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <p style={{ fontFamily: fonts.flourish, fontSize: "14px", color: colors.ember, letterSpacing: "1px", margin: 0 }}>
                          Clue {activeIndex}
                        </p>
                        <button
                          type="button"
                          onClick={removeClue}
                          style={{ background: "none", border: "none", cursor: "pointer", color: colors.inkMuted, display: "flex", alignItems: "center", gap: "4px", fontFamily: fonts.body, fontSize: "12px" }}
                        >
                          <Trash2 size={13} /> remove page
                        </button>
                      </div>

                      <label style={labelStyle}>Question</label>
                      <textarea
                        rows={4}
                        value={currentClue.question}
                        onChange={(e) => updateClue("question", e.target.value)}
                        onFocus={() => setFocusedField("question")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Enter the clue's question"
                        style={{ ...fieldStyle("question"), marginBottom: "18px" }}
                      />

                      <label style={labelStyle}>Answer</label>
                      <input
                        type="text"
                        value={currentClue.answer}
                        onChange={(e) => updateClue("answer", e.target.value)}
                        onFocus={() => setFocusedField("answer")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Correct answer"
                        style={fieldStyle("answer")}
                      />
                    </div>
                  )}
                </div>

                <div className="sb-dogear" onClick={() => turnPage("next")} title="Turn the page" />
              </div>
            </div>
          </div>

          {/* Publish choice */}
          <div style={{ padding: "16px 6px 0 6px", display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="publish-now-checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              disabled={submitting || closing}
              style={{ width: "15px", height: "15px", cursor: submitting || closing ? "default" : "pointer", accentColor: colors.ember }}
            />
            <label
              htmlFor="publish-now-checkbox"
              style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.brassBright, cursor: submitting || closing ? "default" : "pointer" }}
            >
              Publish immediately — uncheck to save as a draft you can keep editing
            </label>
          </div>

          {/* Primary action */}
          <div style={{ padding: "10px 6px 0 6px" }}>
            <SealButton onClick={closeAndSeal} disabled={submitting || closing}>
              {submitting || closing
                ? publishNow
                  ? "Publishing..."
                  : "Saving Draft..."
                : publishNow
                ? isEditing
                  ? "Save & Publish"
                  : "Create & Publish"
                : "Save as Draft"}
            </SealButton>
          </div>
        </div>

        <ArrowNavButton direction="prev" onClick={() => turnPage("prev")} disabled={activeIndex === 0 || flipping || closing || reviewing} />
        <ArrowNavButton direction="next" onClick={() => turnPage("next")} disabled={flipping || closing || reviewing} badge={atFrontier} />
      </div>
    </div>
  );
}

export default SpellBookModal;
