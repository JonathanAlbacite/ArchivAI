import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Check, Ban, Paperclip } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { colors, fonts } from "../../theme";

// Renders the assistant's markdown replies (bold, headings, lists, line
// breaks) styled to match the Cinzel/Poppins theme instead of the browser's
// default markdown look. The teacher's own messages are shown as plain text
// (see the message list below) — only model replies go through this.
const markdownComponents = {
  p: ({ children }) => (
    <p style={{ margin: "0 0 8px 0" }}>{children}</p>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
  h1: ({ children }) => (
    <h1 style={{ margin: "4px 0 8px 0", fontFamily: fonts.display, fontSize: "17px", color: colors.ember }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ margin: "4px 0 8px 0", fontFamily: fonts.display, fontSize: "16px", color: colors.ember }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ margin: "4px 0 6px 0", fontFamily: fonts.display, fontSize: "15px", color: colors.ember }}>
      {children}
    </h3>
  ),
  ul: ({ children }) => <ul style={{ margin: "0 0 8px 0", paddingLeft: "18px" }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: "0 0 8px 0", paddingLeft: "18px" }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: "3px" }}>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: colors.ember }}>
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: "0 0 8px 0",
        paddingLeft: "10px",
        borderLeft: `3px solid ${colors.parchmentLine}`,
        color: colors.inkMuted,
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code
      style={{
        fontFamily: "monospace",
        fontSize: "12px",
        backgroundColor: colors.parchmentDark,
        padding: "1px 4px",
        borderRadius: "4px",
      }}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      style={{
        margin: "0 0 8px 0",
        padding: "8px",
        borderRadius: "8px",
        backgroundColor: colors.parchmentDark,
        overflowX: "auto",
        fontFamily: "monospace",
        fontSize: "12px",
      }}
    >
      {children}
    </pre>
  ),
};

const AssistantMessage = ({ content }) => (
  <div style={{ marginBottom: "-8px" }}>
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  </div>
);

// Small circular avatar identifying the assistant — reused in the header,
// the empty state, next to each assistant reply, and in the typing
// indicator, so the same "face" shows up everywhere it speaks (the same
// pattern Claude's/ChatGPT's own web chat and Intercom-style widgets use).
const AssistantAvatar = ({ size = 26 }) => (
  <div
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "50%",
      flexShrink: 0,
      background: `radial-gradient(circle at 35% 30%, ${colors.emberBright}, ${colors.ember} 70%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 2px 6px rgba(0,0,0,0.25), 0 0 8px ${colors.glassGlow}`,
    }}
  >
    <Sparkles size={Math.round(size * 0.48)} color="#FFF9EF" />
  </div>
);

// Three-dot "assistant is typing" indicator, shown next to the avatar in
// place of a reply while a request is in flight.
const TypingIndicator = () => (
  <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 0" }}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: colors.ember,
          animation: "typingBounce 1.1s ease-in-out infinite",
          animationDelay: `${i * 0.15}s`,
        }}
      />
    ))}
  </div>
);

// The difficulty levels offered when a lesson document is attached (the
// server's lib/clueTemplates.js words the questions and hints for each one).
const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy", hint: "Direct questions in the document's own words" },
  { value: "medium", label: "Medium", hint: "Reworded questions, hints with related facts" },
  { value: "hard", label: "Hard", hint: "Questions that describe the answer, longer reworded hints" },
];

const STORAGE_KEY = "archivai_chat_conv_id";
const ALLOWED_UPLOAD_EXTENSIONS = ".pdf,.docx,.doc,.txt";
const ALLOWED_UPLOAD_EXTENSIONS_LIST = ALLOWED_UPLOAD_EXTENSIONS.split(",");

const isAllowedUpload = (file) => {
  const ext = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
  return ALLOWED_UPLOAD_EXTENSIONS_LIST.includes(ext);
};

// Uploaded-notes turns are stored with the full extracted document text
// (plus whatever the teacher typed alongside it) so Gemini keeps seeing it
// on reload, but that's not something to dump into a chat bubble — collapse
// it to just the filename plus any trailing message for display.
const NOTES_UPLOAD_PATTERN = /^\[Uploaded lesson notes: "([^"]+)"\]\n\n"""\n[\s\S]*?\n"""(?:\n\n([\s\S]*))?$/;
const displayUserContent = (content) => {
  const match = content.match(NOTES_UPLOAD_PATTERN);
  if (!match) return content;
  const [, filename, trailingMessage] = match;
  return trailingMessage ? `📎 Uploaded: ${filename}\n\n${trailingMessage}` : `📎 Uploaded: ${filename}`;
};

const authHeaders = (json = true) => {
  const token = localStorage.getItem("token");
  return json
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { Authorization: `Bearer ${token}` };
};

// The server tries each AI provider in turn (see server/lib/aiProviderChain.js
// — currently groq -> gemini -> openrouter) with its own 20s-per-attempt
// timeout, and always resolves the request either way. In the worst case
// (every provider is slow or failing over) that's up to
// providers.length * 20s before the server itself gives up — so this client
// timeout must stay comfortably above that worst case, or a request that's
// still legitimately working its way through the fallback chain gets
// aborted here and reported as a failure moments before the server would've
// succeeded (this is also a backstop for the response never coming back at
// all, e.g. a wedged server process or a proxy swallowing the connection —
// without it, a stalled fetch() neither resolves nor rejects, so the
// loading spinner would spin forever with no error).
const CHAT_REQUEST_TIMEOUT_MS = 75000;

// The compose textarea grows with what's typed (up to this many pixels,
// roughly 5 lines) instead of staying pinned to one line — matching
// ChatGPT/Claude/Messenger's compose box, and fixing a real usability gap:
// a fixed one-line box meant a longer message scrolled out of view as you
// typed it, so you couldn't see what you'd actually written.
const MAX_TEXTAREA_HEIGHT_PX = 120;
const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_REQUEST_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

// The JWT payload carries the teacher's id (see server/routes/auth.js), so
// decoding it client-side is enough to scope the stored conversation per
// logged-in teacher without any extra login-response plumbing.
const currentTeacherId = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]))?.id ?? null;
  } catch {
    return null;
  }
};

const storageKey = () => `${STORAGE_KEY}_${currentTeacherId() ?? "anon"}`;

// Mounted once at the teacher layout level so it survives route navigation
// like a Messenger chat bubble. "Closed" only hides the panel — state (the
// conversation, its messages, any pending action) is never cleared. The
// active conversationId is persisted in localStorage so it also survives a
// full page reload or reopening the app later; on mount, an existing id is
// resolved by reloading history from the server rather than starting fresh.
// A brand-new conversation is only created lazily, on the teacher's first
// sent message, so idle page loads don't spawn empty ChatConversation rows.
function TeacherChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState(null); // { lessonModuleId, filename, source? } - source "spellbook" = uploaded in the Spell Book
  const [stagingFile, setStagingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, attachment]);

  // Re-measure and grow/shrink the textarea to fit its content on every
  // keystroke (and when a send clears it back to empty).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [input]);

  // Resolve any conversation left over from localStorage exactly once, when
  // this (persistent) widget instance first mounts.
  useEffect(() => {
    const storedId = localStorage.getItem(storageKey());
    if (!storedId) {
      setLoadingHistory(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/${storedId}/messages`, {
          headers: authHeaders(false),
        });
        const data = await res.json();

        if (!res.ok) {
          // Conversation no longer exists or belongs to someone else — drop it and start fresh next send.
          localStorage.removeItem(storageKey());
          return;
        }

        setConversationId(parseInt(storedId));
        setMessages(data.messages);
      } catch {
        // Network hiccup — leave it in localStorage, we'll just retry next mount.
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, []);

  // The Spell Book's "Generate Clues from a Lesson" uploads the file itself,
  // then asks this chat to open with that file attached so the difficulty
  // buttons below can be used (see SpellBookModal).
  useEffect(() => {
    const handleOpenChat = (e) => {
      const { lessonModuleId, filename } = e.detail || {};
      if (!lessonModuleId) return;

      setAttachment({ lessonModuleId, filename, source: "spellbook" });
      setError("");
      setOpen(true);
    };

    window.addEventListener("archivai:open-chat", handleOpenChat);
    return () => window.removeEventListener("archivai:open-chat", handleOpenChat);
  }, []);

  const ensureConversation = async () => {
    if (conversationId) return conversationId;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/start`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not start a conversation");

    localStorage.setItem(storageKey(), String(data.conversationId));
    setConversationId(data.conversationId);
    return data.conversationId;
  };

  // A lesson document always travels with a difficulty. The chosen level goes
  // into the message as a "Difficulty: Hard" line, which the assistant reads
  // (see the system prompt in server/routes/chat.js).
  const submit = async (difficulty) => {
    const typed = input.trim();
    if ((!typed && !attachment) || busy) return;

    if (attachment && !difficulty) {
      setError("Choose Easy, Medium or Hard first.");
      return;
    }

    const difficultyLabel = DIFFICULTY_OPTIONS.find((o) => o.value === difficulty)?.label;
    const text = difficultyLabel ? `Difficulty: ${difficultyLabel}${typed ? `\n\n${typed}` : ""}` : typed;

    const sentAttachment = attachment;
    setInput("");
    setAttachment(null);
    setError("");

    // Uploaded in the Spell Book: the Spell Book drafts the clues itself, so
    // this chat only reports the chosen difficulty back to it.
    if (sentAttachment?.source === "spellbook") {
      setMessages((m) => [
        ...m,
        { role: "user", content: `📎 Uploaded: ${sentAttachment.filename}\n\n${text}` },
        { role: "model", content: `Drafting ${difficultyLabel} questions for the Spell Book. They will appear in its review list.` },
      ]);
      window.dispatchEvent(
        new CustomEvent("archivai:difficulty-chosen", {
          detail: { lessonModuleId: sentAttachment.lessonModuleId, difficulty },
        })
      );
      return;
    }

    const displayContent = sentAttachment
      ? `📎 Uploaded: ${sentAttachment.filename}${text ? `\n\n${text}` : ""}`
      : text;
    setMessages((m) => [...m, { role: "user", content: displayContent }]);
    setBusy(true);

    try {
      const id = await ensureConversation();

      const res = await fetchWithTimeout(`${import.meta.env.VITE_API_URL}/api/chat/${id}/message`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          message: text,
          ...(sentAttachment ? { lessonModuleId: sentAttachment.lessonModuleId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "The assistant couldn't respond");

      if (data.pendingAction) {
        setMessages((m) => [...m, { role: "model", content: data.summary, pendingAction: data.pendingAction }]);
      } else {
        setMessages((m) => [...m, { role: "model", content: data.reply }]);
      }
    } catch (err) {
      setError(err.name === "AbortError" ? "The assistant took too long to respond. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = () => submit(null);

  // Uploads a lesson document and extracts its text (reusing the same
  // lesson-modules upload the standalone lesson-module flow uses), then
  // stages it as a removable chip in the input area. Nothing is sent to the
  // assistant until the teacher picks Easy, Medium or Hard (see submit), which
  // sends the file along with that difficulty.
  const stageFile = async (file) => {
    if (!file || busy || stagingFile) return;

    setError("");

    if (!isAllowedUpload(file)) {
      setError("Only .pdf, .docx, .doc, and .txt files are supported");
      return;
    }

    setStagingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/lesson-modules/upload`, {
        method: "POST",
        headers: authHeaders(false),
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");

      setAttachment({ lessonModuleId: data.id, filename: data.originalFilename });
    } catch (err) {
      setError(err.message);
    } finally {
      setStagingFile(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) stageFile(file);
  };

  // Drag-and-drop is scoped to this panel only (handlers live on the panel's
  // root element below), so dragging files over the rest of the page is a
  // no-op. A counter (rather than a plain boolean) avoids flicker as the
  // drag enters/leaves nested children within the panel.
  const handleDragEnter = (e) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes("Files")) return;
    dragCounterRef.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) stageFile(file);
  };

  const resolveAction = async (index, confirmed) => {
    setBusy(true);
    setError("");

    setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, pendingAction: null, resolved: confirmed ? "confirmed" : "cancelled" } : msg)));

    try {
      const endpoint = confirmed ? "confirm-action" : "cancel-action";
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/${conversationId}/${endpoint}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't resolve that action");

      if (data.pendingAction) {
        setMessages((m) => [...m, { role: "model", content: data.summary, pendingAction: data.pendingAction }]);
      } else {
        setMessages((m) => [...m, { role: "model", content: data.reply }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ask the AI Assistant"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: `1.5px solid ${colors.glassBorder}`,
          background: `radial-gradient(circle at 35% 30%, ${colors.emberBright}, ${colors.ember} 70%)`,
          // filter:drop-shadow (not box-shadow) for the floating depth shadow,
          // since glowPulse below animates box-shadow directly and would
          // otherwise replace it every frame.
          filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.45))",
          color: "#FFF9EF",
          display: open ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 998,
          animation: "glowPulse 3s ease-in-out infinite",
        }}
      >
        <Sparkles size={24} />
      </button>

      {open && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "min(400px, calc(100vw - 32px))",
            height: "min(600px, calc(100vh - 48px))",
            display: "flex",
            flexDirection: "column",
            borderRadius: "18px",
            overflow: "hidden",
            border: `1px solid ${colors.glassBorder}`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.55), 0 0 40px ${colors.glassGlow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
            // Above the Spell Book modal (z-index 999), which opens this chat
            // to ask for the difficulty.
            zIndex: 1000,
          }}
        >
          {dragActive && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 5,
                pointerEvents: "none",
                margin: "8px",
                borderRadius: "14px",
                border: `2px dashed ${colors.emberBright}`,
                backgroundColor: colors.glassDark,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: fonts.display,
                  fontSize: "14px",
                  fontWeight: "600",
                  color: colors.brassBright,
                  letterSpacing: "0.02em",
                }}
              >
                Drop file to attach
              </p>
            </div>
          )}

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              background: `linear-gradient(165deg, rgba(28,20,12,0.75) 0%, ${colors.glassDark} 100%)`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderBottom: `1px solid ${colors.glassBorder}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <AssistantAvatar size={32} />
              <div>
                <p style={{ margin: 0, fontFamily: fonts.displayDecorative, fontSize: "15px", color: colors.brassBright, lineHeight: 1.2 }}>
                  AI Assistant
                </p>
                <p style={{ margin: "1px 0 0 0", fontFamily: fonts.body, fontSize: "11px", color: colors.brass }}>
                  Rooms, campaigns &amp; clues
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: colors.brass, display: "flex" }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 14px",
              display: "flex",
              flexDirection: "column",
              backgroundColor: colors.glassParchment,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            {messages.length === 0 && !attachment && (
              <div style={{ margin: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", padding: "0 20px" }}>
                {!loadingHistory && <AssistantAvatar size={44} />}
                <p style={{ fontFamily: fonts.body, fontSize: "14px", color: colors.inkMuted, textAlign: "center", lineHeight: 1.55, margin: 0 }}>
                  {loadingHistory
                    ? "Resuming your conversation..."
                    : "Ask me to create a room, generate clues from your notes, or check your campaigns."}
                </p>
              </div>
            )}

            {messages.map((m, i) => {
              // Consecutive turns from the same sender sit close together;
              // a new sender (or the first message) gets more breathing room —
              // same grouping convention as Messenger/Discord/Slack threads.
              const groupedWithPrev = i > 0 && messages[i - 1].role === m.role;
              const marginTop = i === 0 ? 0 : groupedWithPrev ? "4px" : "18px";

              // The teacher's own turns stay a bubble (right-aligned, filled) —
              // but the assistant's replies are plain, full-width text with a
              // small avatar, not squeezed into a narrow colored box. That's
              // the pattern Claude's/ChatGPT's own web chat use: an assistant
              // reply is often long, markdown-rich prose (headings, lists),
              // which reads far better at full width than cramped into an
              // 85%-wide bubble.
              if (m.role === "user") {
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "flex-end", marginTop }}>
                    <div
                      style={{
                        maxWidth: "82%",
                        minWidth: 0,
                        padding: "10px 14px",
                        borderRadius: "16px",
                        backgroundColor: colors.ember,
                        color: "#FFF9EF",
                        boxShadow: `0 2px 6px rgba(90,45,10,0.28), 0 0 10px ${colors.glassGlow}`,
                        fontFamily: fonts.body,
                        fontSize: "14px",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
                      {displayUserContent(m.content)}
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginTop }}>
                  <div style={{ width: "26px", flexShrink: 0 }}>{!groupedWithPrev && <AssistantAvatar size={26} />}</div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      paddingTop: "3px",
                      color: colors.ink,
                      fontFamily: fonts.body,
                      fontSize: "14px",
                      lineHeight: 1.6,
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                    }}
                  >
                    <AssistantMessage content={m.content} />

                    {m.pendingAction && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        <button
                          type="button"
                          onClick={() => resolveAction(i, true)}
                          disabled={busy}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            padding: "9px 10px",
                            borderRadius: "10px",
                            border: "none",
                            backgroundColor: colors.success,
                            color: "#FFF9EF",
                            boxShadow: "0 2px 6px rgba(58,107,53,0.3)",
                            fontFamily: fonts.body,
                            fontSize: "13px",
                            fontWeight: "600",
                            cursor: busy ? "default" : "pointer",
                            opacity: busy ? 0.6 : 1,
                          }}
                        >
                          <Check size={14} /> Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveAction(i, false)}
                          disabled={busy}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            padding: "9px 10px",
                            borderRadius: "10px",
                            border: `1px solid ${colors.parchmentLine}`,
                            backgroundColor: "transparent",
                            color: colors.inkMuted,
                            fontFamily: fonts.body,
                            fontSize: "13px",
                            fontWeight: "600",
                            cursor: busy ? "default" : "pointer",
                            opacity: busy ? 0.6 : 1,
                          }}
                        >
                          <Ban size={14} /> Cancel
                        </button>
                      </div>
                    )}
                    {m.resolved && (
                      <p style={{ margin: "8px 0 0 0", fontSize: "11px", fontStyle: "italic", color: colors.inkMuted }}>
                        {m.resolved === "confirmed" ? "Confirmed." : "Cancelled."}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {attachment && !stagingFile && !busy && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginTop: messages.length === 0 ? 0 : "18px" }}>
                <div style={{ width: "26px", flexShrink: 0 }}>
                  <AssistantAvatar size={26} />
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingTop: "3px",
                    color: colors.ink,
                    fontFamily: fonts.body,
                    fontSize: "14px",
                    lineHeight: 1.6,
                    overflowWrap: "anywhere",
                  }}
                >
                  <p style={{ margin: "0 0 8px 0" }}>
                    Which difficulty should the questions from <strong>{attachment.filename}</strong> be?
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => submit(option.value)}
                        disabled={busy}
                        title={option.hint}
                        style={{
                          flex: 1,
                          padding: "9px 10px",
                          borderRadius: "10px",
                          border: `1px solid ${colors.ember}`,
                          backgroundColor: "transparent",
                          color: colors.ember,
                          fontFamily: fonts.body,
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: busy ? "default" : "pointer",
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p style={{ margin: "8px 0 0 0", fontSize: "11px", color: colors.inkMuted, lineHeight: 1.45 }}>
                    Easy: direct questions in the document's own words. Medium: reworded questions. Hard: questions that describe the answer, with longer reworded hints.
                  </p>
                </div>
              </div>
            )}

            {busy && (
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: messages.length === 0 ? 0 : "18px" }}>
                <AssistantAvatar size={26} />
                <TypingIndicator />
              </div>
            )}

            {error && (
              <p style={{ fontFamily: fonts.body, fontSize: "12px", color: colors.danger, margin: "10px 0 0 0" }}>{error}</p>
            )}
          </div>

          {/* Input */}
          <div
            style={{
              padding: "12px",
              backgroundColor: colors.glassParchment,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderTop: `1px solid ${colors.glassBorder}`,
            }}
          >
            {(attachment || stagingFile) && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 8px 5px 10px",
                  marginBottom: "8px",
                  borderRadius: "999px",
                  border: `1px solid ${colors.ember}55`,
                  backgroundColor: `${colors.ember}14`,
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  fontFamily: fonts.body,
                  fontSize: "12px",
                  color: colors.ink,
                  maxWidth: "100%",
                }}
              >
                <Paperclip size={12} color={colors.ember} style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>
                  {stagingFile ? "Uploading..." : attachment.filename}
                </span>
                {attachment && !stagingFile && (
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    title="Remove attachment"
                    style={{
                      width: "16px",
                      height: "16px",
                      flexShrink: 0,
                      background: `${colors.ember}22`,
                      border: "none",
                      borderRadius: "50%",
                      cursor: "pointer",
                      color: colors.ember,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            )}

            {/* One cohesive input bar — attach, text, and send share a single
                bordered container instead of three separate boxes, matching
                the Messenger/ChatGPT-style input affordance. */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "2px",
                padding: "5px",
                borderRadius: "18px",
                border: `1px solid ${inputFocused ? colors.ember : colors.glassBorder}`,
                backgroundColor: colors.glassParchmentBright,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                boxShadow: inputFocused ? `0 0 0 3px ${colors.ember}22` : "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_UPLOAD_EXTENSIONS}
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || loadingHistory || stagingFile}
                title="Attach a lesson document"
                style={{
                  width: "34px",
                  height: "34px",
                  flexShrink: 0,
                  borderRadius: "12px",
                  border: "none",
                  backgroundColor: "transparent",
                  color: colors.ember,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: busy || loadingHistory || stagingFile ? "default" : "pointer",
                  opacity: busy || loadingHistory || stagingFile ? 0.5 : 1,
                }}
              >
                <Paperclip size={16} />
              </button>
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Ask the assistant..."
                disabled={busy || loadingHistory}
                style={{
                  flex: 1,
                  resize: "none",
                  padding: "9px 4px",
                  border: "none",
                  backgroundColor: "transparent",
                  fontFamily: fonts.body,
                  fontSize: "14px",
                  lineHeight: 1.4,
                  color: colors.ink,
                  outline: "none",
                  boxSizing: "border-box",
                  maxHeight: `${MAX_TEXTAREA_HEIGHT_PX}px`,
                  overflowY: "auto",
                }}
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={busy || loadingHistory || stagingFile || (!input.trim() && !attachment)}
                style={{
                  width: "34px",
                  height: "34px",
                  flexShrink: 0,
                  borderRadius: "12px",
                  border: "none",
                  background: `linear-gradient(160deg, ${colors.emberBright}, ${colors.ember})`,
                  color: "#FFF9EF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: busy || loadingHistory || stagingFile || (!input.trim() && !attachment) ? "default" : "pointer",
                  opacity: busy || loadingHistory || stagingFile || (!input.trim() && !attachment) ? 0.6 : 1,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TeacherChatWidget;
