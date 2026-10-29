import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Check, Ban, Paperclip, Minus, SquarePen, X, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Button, IconButton } from "../ui";

// The assistant's replies are markdown (bold, headings, lists, line breaks);
// .chat-md in pages.css styles them. The teacher's own messages are shown as
// plain text - only model replies go through this.
const markdownComponents = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

const AssistantMessage = ({ content }) => (
  <div className="chat-md">
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  </div>
);

// Small circular avatar identifying the assistant - reused in the header, the
// empty state, next to each reply and in the typing indicator.
const AssistantAvatar = ({ size = 28 }) => (
  <span className="chat-avatar" style={{ width: size, height: size }} aria-hidden="true">
    <Sparkles size={Math.round(size * 0.5)} />
  </span>
);

// Three-dot "assistant is typing" indicator.
const TypingIndicator = () => (
  <span className="chat-typing" role="status" aria-label="The assistant is writing a reply">
    <span />
    <span />
    <span />
  </span>
);

// Starters shown in an empty conversation. Each one matches something the
// assistant can actually do with its tools (server/lib/teacherChatTools.js) or
// answer directly; picking one only fills the box, so the teacher can edit
// it before sending.
const SUGGESTED_PROMPTS = [
  "List my rooms and their campaigns",
  "Create a new room called ",
  "Show me the questions in my latest campaign",
  "Rewrite this question so it's clearer: ",
];

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
  const [loadingHistory, setLoadingHistory] = useState(() => !!localStorage.getItem(storageKey()));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState(null); // { lessonModuleId, filename, source? } - source "spellbook" = uploaded in the campaign editor
  const [stagingFile, setStagingFile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
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
    if (!storedId) return;

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

  // The campaign editor's "Generate with AI" uploads the file itself,
  // then asks this chat to open with that file attached so the difficulty
  // buttons below can be used (see campaignEditor/CampaignEditor.jsx).
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

    // Uploaded in the campaign editor: the editor drafts the clues itself, so
    // this chat only reports the chosen difficulty back to it.
    if (sentAttachment?.source === "spellbook") {
      setMessages((m) => [
        ...m,
        { role: "user", content: `📎 Uploaded: ${sentAttachment.filename}\n\n${text}` },
        { role: "model", content: `Drafting ${difficultyLabel} questions for the campaign editor. They will appear in its review list.` },
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

  // Starts over with an empty conversation. The old one stays on the server;
  // a new one is only created when the next message is sent (ensureConversation).
  const startNewChat = () => {
    if (busy) return;
    localStorage.removeItem(storageKey());
    setConversationId(null);
    setMessages([]);
    setError("");
    setInput("");
    textareaRef.current?.focus();
  };

  const fillPrompt = (prompt) => {
    setInput(prompt);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(prompt.length, prompt.length);
    });
  };

  // Escape minimizes the panel (its state is kept).
  const onPanelKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const canSend = !busy && !loadingHistory && !stagingFile && (input.trim() || attachment);

  return (
    <>
      {!open && (
        <button type="button" className="chat-fab" onClick={() => setOpen(true)} aria-label="Open the AI assistant">
          <Sparkles size={22} aria-hidden="true" />
          <span className="chat-fab__label">Assistant</span>
        </button>
      )}

      {open && (
        <section
          className="chat-panel"
          role="dialog"
          aria-label="AI assistant"
          aria-modal="false"
          onKeyDown={onPanelKeyDown}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragActive && (
            <div className="chat-drop" aria-hidden="true">
              <Paperclip size={22} />
              <p>Drop the lesson file to attach it</p>
            </div>
          )}

          <header className="chat-panel__header">
            <AssistantAvatar size={36} />
            <div className="grow">
              <h2 className="chat-panel__title">AI Assistant</h2>
              <p className="text-xs text-muted">Rooms, campaigns and clues</p>
            </div>
            <IconButton icon={SquarePen} label="Start a new chat" size="sm" onClick={startNewChat} disabled={busy || (messages.length === 0 && !conversationId)} />
            <IconButton icon={Minus} label="Minimize assistant" size="sm" onClick={() => setOpen(false)} />
          </header>

          <div ref={scrollRef} className="chat-panel__messages" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 && !attachment && (
              <div className="chat-welcome">
                {loadingHistory ? (
                  <TypingIndicator />
                ) : (
                  <>
                    <AssistantAvatar size={48} />
                    <p className="chat-welcome__title display">How can I help?</p>
                    <p className="text-sm text-muted">
                      I can create rooms, look up your campaigns, and draft clues from your lesson notes. Attach a .pdf, .docx, .doc or .txt with the paperclip.
                    </p>
                    <ul className="chat-suggestions" role="list" aria-label="Suggested prompts">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <li key={prompt}>
                          <button type="button" className="chat-suggestion" onClick={() => fillPrompt(prompt)}>
                            {prompt.trim()}
                            {prompt.endsWith(" ") && "..."}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {messages.map((m, i) => {
              // Consecutive turns from the same sender sit close together; a new
              // sender gets more breathing room.
              const groupedWithPrev = i > 0 && messages[i - 1].role === m.role;

              // The teacher's turns are right-aligned bubbles; the assistant's
              // replies are full-width prose with a small avatar, which reads
              // better for long markdown answers.
              if (m.role === "user") {
                return (
                  <div key={i} className="chat-msg chat-msg--user" data-grouped={groupedWithPrev || undefined}>
                    <span className="sr-only">You said:</span>
                    <div className="chat-bubble">{displayUserContent(m.content)}</div>
                  </div>
                );
              }

              return (
                <div key={i} className="chat-msg chat-msg--assistant" data-grouped={groupedWithPrev || undefined}>
                  <span className="chat-msg__avatar">{!groupedWithPrev && <AssistantAvatar size={28} />}</span>
                  <div className="grow">
                    <span className="sr-only">Assistant said:</span>
                    <AssistantMessage content={m.content} />

                    {m.pendingAction && (
                      <div className="row" style={{ marginTop: 10 }}>
                        <Button size="sm" variant="accent" icon={Check} onClick={() => resolveAction(i, true)} disabled={busy}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="secondary" icon={Ban} onClick={() => resolveAction(i, false)} disabled={busy}>
                          Cancel
                        </Button>
                      </div>
                    )}
                    {m.resolved && (
                      <p className="text-xs text-muted" style={{ marginTop: 6 }}>
                        {m.resolved === "confirmed" ? "Confirmed." : "Cancelled."}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {attachment && !stagingFile && !busy && (
              <div className="chat-msg chat-msg--assistant">
                <span className="chat-msg__avatar">
                  <AssistantAvatar size={28} />
                </span>
                <div className="grow stack stack-sm">
                  <p className="text-sm">
                    How difficult should the questions from <strong>{attachment.filename}</strong> be?
                  </p>
                  <div className="chat-difficulty" role="group" aria-label="Question difficulty">
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <button key={option.value} type="button" className="chat-difficulty__option" onClick={() => submit(option.value)} disabled={busy}>
                        <span className="font-semibold">{option.label}</span>
                        <span className="text-xs text-muted">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {busy && (
              <div className="chat-msg chat-msg--assistant">
                <span className="chat-msg__avatar">
                  <AssistantAvatar size={28} />
                </span>
                <TypingIndicator />
              </div>
            )}

            {error && (
              <p className="chat-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" /> {error}
              </p>
            )}
          </div>

          <div className="chat-panel__composer">
            {(attachment || stagingFile) && (
              <div className="chat-file">
                <Paperclip size={13} aria-hidden="true" />
                <span className="truncate">{stagingFile ? "Uploading..." : attachment.filename}</span>
                {attachment && !stagingFile && (
                  <button type="button" className="chat-file__remove" onClick={() => setAttachment(null)} aria-label={`Remove ${attachment.filename}`}>
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {/* One input bar - attach, text and send share a single bordered container. */}
            <div className="chat-input">
              <input ref={fileInputRef} type="file" accept={ALLOWED_UPLOAD_EXTENSIONS} onChange={handleFileChange} className="sr-only" tabIndex={-1} aria-hidden="true" />
              <IconButton
                icon={Paperclip}
                size="sm"
                label="Attach a lesson document"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || loadingHistory || stagingFile}
              />
              <label htmlFor="assistant-input" className="sr-only">
                Message the assistant
              </label>
              <textarea
                id="assistant-input"
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask the assistant..."
                disabled={busy || loadingHistory}
                className="chat-input__field"
                style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT_PX}px` }}
              />
              <IconButton icon={Send} size="sm" variant="accent" label="Send message" onClick={sendMessage} disabled={!canSend} />
            </div>
            <p className="chat-panel__hint text-xs text-subtle">Enter to send, Shift+Enter for a new line. AI can make mistakes.</p>
          </div>
        </section>
      )}
    </>
  );
}

export default TeacherChatWidget;
