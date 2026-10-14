import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Trash2, Lock, Sparkles, Check, X, Paperclip, FileText } from "lucide-react";
import EmberField from "../EmberField";
import { colors, fonts } from "../../theme";
import { SCENE_LIST, getSceneMeta } from "../../scenes";
import { SceneBadge } from "../SceneIcon";

// Which Question/Answer/Note "pairing" shape a clue page is authored as -
// mirrors the server's own ClueType enum (see schema.prisma). A campaign's
// clue pages are no longer freely added/typed by the teacher - they're
// fixed by the scene's published VaultTemplate (see fetchTemplate below),
// one page per slot, in that exact order and type. This just controls how
// each page's answer fields render.
const CLUE_TYPES = {
  NORMAL: "Normal — Question, Answer, Note",
  MULTICHOICE: "MultiChoice — Question, Note, Answer + 3 Decoys",
  COMBO: "Combo — Question, Note, extendable Answers & Decoys",
};

// The answers array a clue page starts with for a given type - see header
// above for what each shape means. NORMAL and COMBO both start with one
// blank correct answer (Combo just allows adding more via addAnswerRow());
// MultiChoice starts with all four slots already in place since that
// shape is fixed, not extendable.
const defaultAnswersFor = (type) => {
  if (type === "MULTICHOICE") {
    return [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ];
  }
  return [{ text: "", isCorrect: true }];
};

const emptyClueForType = (type) => ({ type, question: "", note: "", answers: defaultAnswersFor(type) });

const ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip";
const ATTACHMENT_EXTENSIONS = ATTACHMENT_ACCEPT.split(",");
const isAllowedAttachment = (file) => ATTACHMENT_EXTENSIONS.includes(`.${(file.name.split(".").pop() || "").toLowerCase()}`);

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

function ArrowNavButton({ direction, onClick, disabled }) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const side = direction === "prev" ? "left" : "right";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={direction === "prev" ? "Previous page" : "Next page"}
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
// to the GeneratedClue rows; only approved ones get inserted into this
// vault's empty Normal-type pages (see insertApprovedClues).
function GeneratedCluesReview({ clues, onSaveEdit, onApprove, onReject, onInsert, onCancel }) {
  const approvedCount = clues.filter((c) => c.status === "approved").length;

  return (
    <div>
      <h2 style={{ fontFamily: fonts.displayDecorative, fontSize: "20px", color: colors.ink, margin: "0 0 6px 0" }}>
        Review Generated Clues
      </h2>
      <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.inkMuted, margin: "0 0 14px 0" }}>
        Approve the clues you want added. They'll drop into this vault's empty Normal-type pages, in order —
        MultiChoice/Combo pages still need to be filled in by hand.
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
          Add {approvedCount || ""} Approved Clue{approvedCount === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}

// activeIndex 0 = the cover/setup page (title, description, realm); indices
// 1..pages.length are clue pages, one per slot in the scene's published
// VaultTemplate. Unlike the old free-form book, pages here are NOT added
// or removed by the teacher — their count, order, and type come straight
// from the vault's admin-authored template (see fetchTemplate). A scene
// with no published template yet blocks campaign creation entirely
// (templateStatus "none") - see the admin page for authoring one.
//
// Doubles as the full campaign editor: pass an existing `campaign` (as
// returned by GET /api/campaigns/:id, including its typed clues) to
// pre-fill every field and switch sealing from create to update. Only
// reachable for drafts (RoomPage only offers Edit while !isPublished) —
// the server enforces that too on both the metadata PATCH and the clues
// PUT below.
function SpellBookModal({ roomId, campaign, onClose, onSaved }) {
  const isEditing = !!campaign;
  const [title, setTitle] = useState(campaign?.title || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [scene, setScene] = useState(campaign?.scene || "");
  const [pages, setPages] = useState(
    campaign?.clues?.map((c) => ({
      type: c.type || "NORMAL",
      question: c.question,
      note: c.note || "",
      answers: (c.answers || []).map((a) => ({ text: a.text, isCorrect: a.isCorrect })),
    })) || []
  );
  // idle (no scene picked yet) -> loading -> ready (pages match a
  // published template) | none (no published template for this scene).
  // Editing an existing campaign starts "ready" since its pages already
  // came from whatever template was published when it was created.
  const [templateStatus, setTemplateStatus] = useState(isEditing ? "ready" : "idle");
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

  // Campaign resource file — a plain file for students to view/download
  // (unrelated to the lesson-notes upload above, which is AI clue-generation
  // input, not something students ever see). No campaign row exists yet on
  // create, so the chosen file is staged locally and only actually uploaded
  // once seal() has a real campaignId to attach it to (see seal() below).
  const [existingAttachment, setExistingAttachment] = useState(
    campaign?.attachmentFilename ? { filename: campaign.attachmentFilename } : null
  );
  const [attachmentFile, setAttachmentFile] = useState(null); // staged File, not yet uploaded
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const attachmentInputRef = useRef(null);

  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isAllowedAttachment(file)) {
      setAttachmentError(`Only ${ATTACHMENT_ACCEPT} files are supported`);
      return;
    }

    setAttachmentError("");
    setAttachmentFile(file);
    setRemoveAttachment(false);
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    if (existingAttachment) setRemoveAttachment(true);
  };

  const lastIndex = pages.length;
  const atFrontier = activeIndex === lastIndex;

  // Loads the published template for a scene and resets `pages` to match
  // it exactly - one blank page per slot, in order, each locked to that
  // slot's type. A 404 means the vault has no published template yet,
  // which blocks creating clue pages there at all (templateStatus "none").
  const loadTemplate = async (nextScene) => {
    setTemplateStatus("loading");
    setPages([]);
    setActiveIndex(0);

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/vault-templates/${nextScene}/published`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 404) {
        setTemplateStatus("none");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setTemplateStatus("error");
        return;
      }

      setPages(data.slots.map((s) => emptyClueForType(s.type)));
      setTemplateStatus("ready");
    } catch (err) {
      console.error(err);
      setTemplateStatus("error");
    }
  };

  // Picking a scene resets the clue pages to that scene's template - if
  // there's already page content (mid-edit, switching scenes), confirm
  // first since it discards whatever's been filled in so far.
  const handleSceneChange = (nextScene) => {
    if (nextScene === scene || flipping || closing || reviewing) return;
    const hasContent = pages.some((p) => p.question.trim() || p.answers.some((a) => a.text.trim()));
    if (hasContent && !window.confirm("Switching vaults resets the clue pages to match the new vault's question set. Continue?")) {
      return;
    }
    setScene(nextScene);
    loadTemplate(nextScene);
  };

  const turnPage = (direction) => {
    if (flipping || closing || reviewing) return;

    if (direction === "prev") {
      if (activeIndex === 0) return;
      setFlipping("prev");
      setTimeout(() => setActiveIndex((i) => i - 1), FLIP_SWAP_MS);
      setTimeout(() => setFlipping(null), FLIP_MS);
      return;
    }

    if (atFrontier) return; // fixed-length book - no page past the last clue
    setFlipping("next");
    setTimeout(() => setActiveIndex((i) => i + 1), FLIP_SWAP_MS);
    setTimeout(() => setFlipping(null), FLIP_MS);
  };

  const updateClue = (field, value) => {
    const clueIndex = activeIndex - 1;
    setPages(pages.map((p, i) => (i === clueIndex ? { ...p, [field]: value } : p)));
  };

  const updateAnswerField = (answerIndex, field, value) => {
    const clueIndex = activeIndex - 1;
    setPages(pages.map((p, i) => {
      if (i !== clueIndex) return p;
      const answers = p.answers.map((a, j) => (j === answerIndex ? { ...a, [field]: value } : a));
      return { ...p, answers };
    }));
  };

  // Combo-only - Normal has exactly 1 answer and MultiChoice's 4 slots are
  // fixed, so only Combo's own render branch ever calls these.
  const addAnswerRow = () => {
    const clueIndex = activeIndex - 1;
    setPages(pages.map((p, i) =>
      i === clueIndex ? { ...p, answers: [...p.answers, { text: "", isCorrect: false }] } : p
    ));
  };

  const removeAnswerRow = (answerIndex) => {
    const clueIndex = activeIndex - 1;
    setPages(pages.map((p, i) =>
      i === clueIndex ? { ...p, answers: p.answers.filter((_, j) => j !== answerIndex) } : p
    ));
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

  // Uploads the chosen lesson file, extracts its text, and asks the AI
  // assistant to conjure a batch of clues (GeneratedClue rows) to review
  // below. Generated clues are always plain Normal-type Q&A pairs.
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!scene || templateStatus !== "ready") {
      setLessonError("Choose a vault with a published question-set first.");
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

  // Only approved clues get used, and only into pages that are (a) Normal
  // type and (b) still blank - AI-generated content is always plain
  // Normal Q&A (see lessonModules.js), so it can never fill a MultiChoice
  // or Combo slot. Any approved clues left over once every empty Normal
  // page is full are simply not added.
  const insertApprovedClues = () => {
    const approved = generatedClues.filter((c) => c.status === "approved");
    if (approved.length === 0) return;

    let used = 0;
    setPages((prev) =>
      prev.map((p) => {
        if (used < approved.length && p.type === "NORMAL" && !p.question.trim()) {
          const c = approved[used];
          used += 1;
          return { ...p, question: c.clueText, answers: [{ text: c.answerText, isCorrect: true }] };
        }
        return p;
      })
    );

    if (used < approved.length) {
      alert(`Only ${used} of ${approved.length} approved clue(s) fit into this vault's empty Normal pages - the rest weren't added.`);
    }

    setLessonStep("idle");
    setGeneratedClues([]);
  };

  const cancelReview = () => {
    setLessonStep("idle");
    setGeneratedClues([]);
  };

  // Every page is required - the vault's template is a fixed contract, not
  // a suggestion, so there's no such thing as a partially-filled clue set
  // going to the server. Returns the 0-based index of the first incomplete
  // page, or -1 if every page is ready to submit.
  const findIncompletePage = () => {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!p.question.trim()) return i;
      if (p.answers.length === 0 || p.answers.some((a) => !a.text.trim())) return i;
      if (p.type === "COMBO" && !p.answers.some((a) => a.isCorrect)) return i;
    }
    return -1;
  };

  // Runs the create/update -> clues -> publish sequence. Editing PATCHes the
  // existing campaign's metadata and PUTs the whole clue set (replacing it);
  // creating POSTs both fresh. Returns whether it succeeded; does not touch
  // modal/close state so the caller can drive the closing animation around it.
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
      const clues = pages.map((p) => ({ type: p.type, question: p.question, note: p.note || null, answers: p.answers }));

      const cluesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${finalCampaignId}/clues`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clues }),
      });
      const cluesData = await cluesRes.json();
      if (!cluesRes.ok) {
        alert(cluesData.message);
        return false;
      }

      if (attachmentFile) {
        const attachmentForm = new FormData();
        attachmentForm.append("file", attachmentFile);

        const attachmentRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${finalCampaignId}/attachment`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: attachmentForm,
        });
        const attachmentData = await attachmentRes.json();
        if (!attachmentRes.ok) {
          alert(attachmentData.message);
          return false;
        }
      } else if (removeAttachment && isEditing) {
        const attachmentRes = await fetch(`${import.meta.env.VITE_API_URL}/api/campaigns/${finalCampaignId}/attachment`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!attachmentRes.ok) {
          const attachmentData = await attachmentRes.json();
          alert(attachmentData.message);
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
    if (!scene || templateStatus !== "ready") {
      alert("Choose a vault with a published question-set before sealing the book.");
      return;
    }
    const incomplete = findIncompletePage();
    if (incomplete !== -1) {
      setActiveIndex(incomplete + 1);
      alert(`Clue ${incomplete + 1} is incomplete - fill in its question and every answer before sealing the book.`);
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

                      <label style={labelStyle}>Choose a Vault</label>
                      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                        {SCENE_LIST.map((s) => (
                          <SceneCard key={s.key} s={s} active={scene === s.key} onClick={() => handleSceneChange(s.key)} />
                        ))}
                      </div>

                      {scene && templateStatus === "loading" && (
                        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.inkMuted, margin: "10px 0 0 0" }}>
                          Loading this vault's question set...
                        </p>
                      )}
                      {scene && templateStatus === "none" && (
                        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.danger, margin: "10px 0 0 0" }}>
                          This vault has no published question-set yet. Ask an admin to publish one before you can create a campaign here.
                        </p>
                      )}
                      {scene && templateStatus === "error" && (
                        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.danger, margin: "10px 0 0 0" }}>
                          Couldn't load this vault's question set. Try picking it again.
                        </p>
                      )}
                      {scene && templateStatus === "ready" && (
                        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.success, margin: "10px 0 0 0" }}>
                          {pages.length} clue{pages.length === 1 ? "" : "s"} in this vault's question set — turn the page to fill them in.
                        </p>
                      )}

                      <div style={{ marginTop: "22px", paddingTop: "18px", borderTop: `1px dashed ${colors.parchmentLine}` }}>
                        <label style={labelStyle}>Generate Clues from a Lesson</label>
                        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.inkMuted, margin: "6px 0 10px 0" }}>
                          {scene && templateStatus === "ready"
                            ? `Upload a lesson document (.pdf, .docx, .doc, .txt) and the AI assistant will draft ${getSceneMeta(scene).label}-themed clues to review — they'll fill this vault's empty Normal pages.`
                            : "Choose a vault with a published question-set above first."}
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
                          disabled={!scene || templateStatus !== "ready" || lessonStep === "uploading" || lessonStep === "generating"}
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
                            cursor: !scene || templateStatus !== "ready" || lessonStep === "uploading" || lessonStep === "generating" ? "default" : "pointer",
                            opacity: !scene || templateStatus !== "ready" || lessonStep === "uploading" || lessonStep === "generating" ? 0.6 : 1,
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

                      <div style={{ marginTop: "22px", paddingTop: "18px", borderTop: `1px dashed ${colors.parchmentLine}` }}>
                        <label style={labelStyle}>Campaign Resource File</label>
                        <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.inkMuted, margin: "6px 0 10px 0" }}>
                          Attach a file (handout, reference sheet, etc.) for students to view alongside this campaign.
                        </p>

                        <input
                          ref={attachmentInputRef}
                          type="file"
                          accept={ATTACHMENT_ACCEPT}
                          onChange={handleAttachmentChange}
                          style={{ display: "none" }}
                        />

                        {attachmentFile || (existingAttachment && !removeAttachment) ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "4px", border: `1px solid ${colors.parchmentLine}`, backgroundColor: colors.parchmentPanel }}>
                            <FileText size={14} color={colors.ember} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, fontFamily: fonts.body, fontSize: "12px", color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {attachmentFile ? attachmentFile.name : existingAttachment.filename}
                            </span>
                            <button
                              type="button"
                              onClick={() => attachmentInputRef.current?.click()}
                              style={{ background: "none", border: "none", cursor: "pointer", color: colors.ember, fontFamily: fonts.body, fontSize: "12px", fontWeight: "600", textDecoration: "underline" }}
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={clearAttachment}
                              title="Remove attachment"
                              style={{ background: "none", border: "none", cursor: "pointer", color: colors.inkMuted, display: "flex" }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => attachmentInputRef.current?.click()}
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
                              cursor: "pointer",
                            }}
                          >
                            <Paperclip size={14} /> Attach a File
                          </button>
                        )}
                        {attachmentError && (
                          <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.danger, margin: "8px 0 0 0" }}>
                            {attachmentError}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <p style={{ fontFamily: fonts.flourish, fontSize: "14px", color: colors.ember, letterSpacing: "1px", margin: 0 }}>
                          Clue {activeIndex} of {lastIndex}
                        </p>
                        <span style={{ fontFamily: fonts.body, fontSize: "11px", fontWeight: "600", color: colors.inkMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {currentClue.type}
                        </span>
                      </div>

                      <p style={{ fontFamily: fonts.body, fontSize: "11px", color: colors.inkMuted, margin: "0 0 14px 0", fontStyle: "italic" }}>
                        {CLUE_TYPES[currentClue.type]} — set by this vault's template, can't be changed here.
                      </p>

                      <label style={labelStyle}>Question</label>
                      <textarea
                        rows={3}
                        value={currentClue.question}
                        onChange={(e) => updateClue("question", e.target.value)}
                        onFocus={() => setFocusedField("question")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="What riddle guards this clue? Shown as the Clue text in-game too."
                        style={{ ...fieldStyle("question"), marginBottom: "14px" }}
                      />

                      <label style={labelStyle}>Note</label>
                      <textarea
                        rows={2}
                        value={currentClue.note}
                        onChange={(e) => updateClue("note", e.target.value)}
                        onFocus={() => setFocusedField("note")}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Free-standing lore text for the Journal's Note panel (optional)"
                        style={{ ...fieldStyle("note"), marginBottom: "18px" }}
                      />

                      {currentClue.type === "NORMAL" && (
                        <>
                          <label style={labelStyle}>Answer</label>
                          <input
                            type="text"
                            value={currentClue.answers[0]?.text || ""}
                            onChange={(e) => updateAnswerField(0, "text", e.target.value)}
                            onFocus={() => setFocusedField("answer0")}
                            onBlur={() => setFocusedField(null)}
                            placeholder="The true answer"
                            style={fieldStyle("answer0")}
                          />
                        </>
                      )}

                      {currentClue.type === "MULTICHOICE" && (
                        <>
                          <label style={labelStyle}>Correct Answer</label>
                          <input
                            type="text"
                            value={currentClue.answers[0]?.text || ""}
                            onChange={(e) => updateAnswerField(0, "text", e.target.value)}
                            onFocus={() => setFocusedField("answer0")}
                            onBlur={() => setFocusedField(null)}
                            placeholder="The one correct answer"
                            style={{ ...fieldStyle("answer0"), marginBottom: "14px" }}
                          />
                          {[1, 2, 3].map((idx) => (
                            <div key={idx}>
                              <label style={labelStyle}>Decoy {idx}</label>
                              <input
                                type="text"
                                value={currentClue.answers[idx]?.text || ""}
                                onChange={(e) => updateAnswerField(idx, "text", e.target.value)}
                                onFocus={() => setFocusedField(`answer${idx}`)}
                                onBlur={() => setFocusedField(null)}
                                placeholder={`Wrong answer ${idx}`}
                                style={{ ...fieldStyle(`answer${idx}`), marginBottom: idx < 3 ? "14px" : 0 }}
                              />
                            </div>
                          ))}
                        </>
                      )}

                      {currentClue.type === "COMBO" && (
                        <>
                          <label style={labelStyle}>Answers &amp; Decoys</label>
                          {currentClue.answers.map((a, idx) => (
                            <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "8px" }}>
                              <input
                                type="text"
                                value={a.text}
                                onChange={(e) => updateAnswerField(idx, "text", e.target.value)}
                                onFocus={() => setFocusedField(`answer${idx}`)}
                                onBlur={() => setFocusedField(null)}
                                placeholder="Answer text"
                                style={{ ...fieldStyle(`answer${idx}`), marginTop: 0, flex: 1 }}
                              />
                              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontFamily: fonts.body, color: colors.ink, whiteSpace: "nowrap" }}>
                                <input
                                  type="checkbox"
                                  checked={a.isCorrect}
                                  onChange={(e) => updateAnswerField(idx, "isCorrect", e.target.checked)}
                                />
                                Correct
                              </label>
                              {currentClue.answers.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeAnswerRow(idx)}
                                  title="Remove this answer option"
                                  style={{ background: "none", border: "none", cursor: "pointer", color: colors.inkMuted, display: "flex" }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addAnswerRow}
                            style={{
                              marginTop: "10px",
                              background: "none",
                              border: `1px dashed ${colors.parchmentLine}`,
                              borderRadius: "4px",
                              padding: "6px 10px",
                              cursor: "pointer",
                              color: colors.ember,
                              fontFamily: fonts.body,
                              fontSize: "12px",
                            }}
                          >
                            + Add Answer / Decoy
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
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
            <SealButton onClick={closeAndSeal} disabled={submitting || closing || templateStatus !== "ready"}>
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
        <ArrowNavButton direction="next" onClick={() => turnPage("next")} disabled={atFrontier || flipping || closing || reviewing} />
      </div>
    </div>
  );
}

export default SpellBookModal;
