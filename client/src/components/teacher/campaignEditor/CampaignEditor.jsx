import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Paperclip, Rocket, Save, Sparkles, X } from "lucide-react";
import { SceneArt } from "../../Illustrations";
import { Alert, Badge, Button, ConfirmDialog, Modal, Spinner, TextAreaField, TextField, HelpTip } from "../../ui";
import { SCENE_LIST, getSceneMeta, sceneStyle } from "../../../scenes";
import { api, errorMessage } from "../../../lib/api";
import { useToast } from "../../../lib/toast";
import EntryForm from "./EntryForm";
import GeneratedCluesReview from "./GeneratedCluesReview";
import {
  ATTACHMENT_ACCEPT,
  CLUE_TYPES,
  HELP,
  LESSON_EXTENSIONS,
  emptyClueForType,
  isAllowedAttachment,
  isEntryFilled,
  isLessonFile,
  snapshotOf,
} from "./editorModel";

const SAVE_PHASES = {
  details: "Saving details...",
  entries: "Saving entries...",
  upload: "Uploading the attachment...",
  removeFile: "Removing the old attachment...",
  publish: "Publishing...",
};

// The campaign editor: a large dialog with a step list (Details, one step per
// entry, Additional notes, Review) beside the current step's form.
//
// Entry steps are NOT added or removed by the teacher - their count, order and
// type come from the vault's admin-authored template (loadTemplate). A vault
// with no published template blocks creation (templateStatus "none").
//
// Pass an existing `campaign` (as returned by GET /api/campaigns/:id, with its
// typed clues) to edit it: every field is pre-filled and saving switches from
// create to update. Only reachable for drafts with no play history (RoomPage
// only offers Edit then) - the server enforces that too.
function CampaignEditor({ roomId, campaign, onClose, onSaved }) {
  const isEditing = !!campaign;
  const toast = useToast();
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
  // Additional notes (standalone hints): facts from the lesson that belong to
  // no question. How many comes from the vault's template (noteCount).
  const [noteCount, setNoteCount] = useState(campaign?.standaloneNotes?.length || 0);
  const [notes, setNotes] = useState(campaign?.standaloneNotes || []);
  const noteCountRef = useRef(noteCount);
  // idle (no scene picked yet) -> loading -> ready | none (no published template) | error.
  // Editing starts "ready" since its pages came from the template published when it was created.
  const [templateStatus, setTemplateStatus] = useState(isEditing ? "ready" : "idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const [detailErrors, setDetailErrors] = useState({});
  const [stepError, setStepError] = useState("");
  const [showErrorsFor, setShowErrorsFor] = useState(() => new Set());
  const [pendingScene, setPendingScene] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const [savePhase, setSavePhase] = useState(null);
  const [saveError, setSaveError] = useState("");
  const submitting = savePhase !== null;
  // A brand-new campaign that was created but whose later save steps failed:
  // retries update this one instead of creating a duplicate.
  const createdIdRef = useRef(null);
  const [partialDraft, setPartialDraft] = useState(false);
  const cluesSavedRef = useRef(false);

  // "Draft entries from a lesson" flow: idle -> uploading -> waiting (the AI
  // assistant chat opens with the uploaded file and asks Easy / Medium / Hard)
  // -> generating -> review (drafts awaiting approve/reject) -> idle once inserted.
  const [lessonStep, setLessonStep] = useState("idle");
  const [lessonError, setLessonError] = useState("");
  const [generatedClues, setGeneratedClues] = useState([]);
  const [generatedNotes, setGeneratedNotes] = useState([]);
  const [notesError, setNotesError] = useState("");
  const reviewing = lessonStep === "review";
  // The uploaded lesson the chat is asking a difficulty for, and the vault
  // picked right now, kept in refs so the chat's reply (an event) sees the latest values.
  const pendingLessonRef = useRef(null);
  const sceneRef = useRef(scene);

  // Campaign resource file - a plain file for students to view/download
  // (unrelated to AI generation, though the same file can feed it). No campaign
  // row exists yet on create, so the chosen file is staged locally and only
  // uploaded once save has a real campaignId to attach it to.
  const existingAttachment = campaign?.attachmentFilename ? { filename: campaign.attachmentFilename } : null;
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const attachmentInputRef = useRef(null);

  useEffect(() => {
    noteCountRef.current = noteCount;
    sceneRef.current = scene;
  });

  const currentSnapshot = snapshotOf({ title, description, scene, pages, notes, attachmentName: attachmentFile?.name || null, removeAttachment });
  const [initialSnapshot, setInitialSnapshot] = useState(currentSnapshot);
  const dirty = currentSnapshot !== initialSnapshot;

  // Leaving the page with unsaved edits asks the browser to confirm.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // An existing campaign opens with its saved pages; only the vault's current
  // note count has to be fetched, so the notes step matches the template.
  useEffect(() => {
    if (!isEditing || !campaign?.scene) return;
    let cancelled = false;
    api(`/vault-templates/${campaign.scene}/published`)
      .then(({ ok, data }) => {
        if (!ok || cancelled) return;
        const count = data.standaloneNoteCount || 0;
        const saved = campaign.standaloneNotes || [];
        const next = Array.from({ length: count }, (_, i) => saved[i] || "");
        setNoteCount(count);
        setNotes(next);
        // Padding the notes to the template's count isn't a teacher edit.
        setInitialSnapshot((snap) => JSON.stringify({ ...JSON.parse(snap), notes: next }));
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loads the published template for a scene and resets `pages` to match it
  // exactly - one blank page per slot, in order, each locked to that slot's
  // type. A 404 means the vault has no published template yet.
  const loadTemplate = async (nextScene) => {
    setTemplateStatus("loading");
    setPages([]);
    setNoteCount(0);
    setNotes([]);
    setActiveIndex(0);

    try {
      const { ok, status, data } = await api(`/vault-templates/${nextScene}/published`);
      if (status === 404) {
        setTemplateStatus("none");
        return;
      }
      if (!ok) {
        setTemplateStatus("error");
        return;
      }
      setPages(data.slots.map((s) => emptyClueForType(s.type)));
      setNoteCount(data.standaloneNoteCount || 0);
      setNotes(Array.from({ length: data.standaloneNoteCount || 0 }, () => ""));
      setTemplateStatus("ready");
    } catch (err) {
      console.error(err);
      setTemplateStatus("error");
    }
  };

  const hasEntryContent = () => pages.some((p) => p.question.trim() || p.answers.some((a) => a.text.trim())) || notes.some((n) => n.trim());

  // Picking a scene resets the entries to that scene's template - if there's
  // already content, confirm first since it discards what's been filled in.
  const handleSceneChange = (nextScene) => {
    if (nextScene === scene || submitting || reviewing) return;
    if (isEditing) return; // an existing campaign's vault is fixed by its saved entries
    if (hasEntryContent()) {
      setPendingScene(nextScene);
      return;
    }
    setScene(nextScene);
    setDetailErrors((e) => ({ ...e, scene: undefined }));
    loadTemplate(nextScene);
  };

  const confirmSceneChange = () => {
    const next = pendingScene;
    setPendingScene(null);
    setScene(next);
    loadTemplate(next);
  };

  const updateClue = (pageIdx, field, value) => setPages((list) => list.map((p, i) => (i === pageIdx ? { ...p, [field]: value } : p)));

  const updateAnswerField = (pageIdx, answerIndex, field, value) =>
    setPages((list) =>
      list.map((p, i) => (i === pageIdx ? { ...p, answers: p.answers.map((a, j) => (j === answerIndex ? { ...a, [field]: value } : a)) } : p))
    );

  // Combo-only - Normal has exactly 1 answer and MultiChoice's 4 slots are fixed.
  const addAnswerRow = (pageIdx) =>
    setPages((list) => list.map((p, i) => (i === pageIdx ? { ...p, answers: [...p.answers, { text: "", isCorrect: false }] } : p)));

  const removeAnswerRow = (pageIdx, answerIndex) =>
    setPages((list) => list.map((p, i) => (i === pageIdx ? { ...p, answers: p.answers.filter((_, j) => j !== answerIndex) } : p)));

  const updateNote = (index, value) => setNotes((list) => list.map((n, i) => (i === index ? value : n)));

  // ---------- Attachment ----------
  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isAllowedAttachment(file)) {
      setAttachmentError(`That file type isn't supported. Use one of: ${ATTACHMENT_ACCEPT.replaceAll(",", ", ")}`);
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

  // ---------- AI generation ----------
  // Uploads the attached file and extracts its text, then opens the AI
  // assistant chat with that file so the teacher picks Easy, Medium or Hard
  // there (see TeacherChatWidget). Entries are drafted once the chat reports
  // the difficulty (handleDifficultyChosen below) - one per template slot.
  const handleAutoGenerate = async () => {
    const file = attachmentFile;
    if (!file) return;

    if (!isLessonFile(file)) {
      setLessonError(`AI drafting reads ${LESSON_EXTENSIONS.join(", ")} files only.`);
      setLessonStep("error");
      return;
    }
    if (!scene || templateStatus !== "ready") {
      setLessonError("Choose a scene with a published question set first.");
      setLessonStep("error");
      return;
    }

    setLessonError("");
    setLessonStep("uploading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { ok, data } = await api("/lesson-modules/upload", { method: "POST", body: formData });
      if (!ok) throw new Error(errorMessage(data, "Upload failed"));

      pendingLessonRef.current = data.id;
      setLessonStep("waiting");
      window.dispatchEvent(
        new CustomEvent("archivai:open-chat", {
          detail: { lessonModuleId: data.id, filename: data.originalFilename || file.name },
        })
      );
    } catch (err) {
      setLessonError(err.message === "Failed to fetch" ? "Couldn't reach the server." : err.message);
      setLessonStep("error");
    }
  };

  const cancelGeneration = () => {
    pendingLessonRef.current = null;
    setLessonStep("idle");
  };

  // Asks the AI to draft the clues (GeneratedClue rows) at the chosen difficulty.
  const generateClues = async (lessonModuleId, difficulty) => {
    setLessonError("");
    setNotesError("");
    setGeneratedNotes([]);
    setLessonStep("generating");

    try {
      const gen = await api(`/lesson-modules/${lessonModuleId}/generate-clues`, {
        method: "POST",
        body: { scene: sceneRef.current, difficulty },
      });
      if (!gen.ok) throw new Error(errorMessage(gen.data, "Entry generation failed"));

      // The vault's additional notes are written from the same lesson, about
      // facts none of these clues use. If they fail, the clues are still reviewed.
      if (noteCountRef.current > 0) {
        try {
          const notesRes = await api(`/lesson-modules/${lessonModuleId}/generate-notes`, {
            method: "POST",
            body: { scene: sceneRef.current, difficulty, clueIds: gen.data.map((c) => c.id) },
          });
          if (!notesRes.ok) throw new Error(errorMessage(notesRes.data, "Additional notes generation failed"));
          setGeneratedNotes(notesRes.data.notes || []);
        } catch (notesErr) {
          setNotesError(notesErr.message);
        }
      }

      setGeneratedClues(gen.data);
      setLessonStep("review");
    } catch (err) {
      setLessonError(err.message === "Failed to fetch" ? "Couldn't reach the server." : err.message);
      setLessonStep("error");
    }
  };

  // The chat tells us which difficulty the teacher picked for the file this
  // editor uploaded (ignored for any other file).
  useEffect(() => {
    const handleDifficultyChosen = (e) => {
      const { lessonModuleId, difficulty } = e.detail || {};
      if (!lessonModuleId || lessonModuleId !== pendingLessonRef.current) return;
      pendingLessonRef.current = null;
      generateClues(lessonModuleId, difficulty);
    };
    window.addEventListener("archivai:difficulty-chosen", handleDifficultyChosen);
    return () => window.removeEventListener("archivai:difficulty-chosen", handleDifficultyChosen);
  }, []);

  const saveClueEdit = async (id, { clueText, answers, note }) => {
    try {
      const { ok, data } = await api(`/clues/${id}`, { method: "PATCH", body: { clueText, answers, note } });
      if (!ok) throw new Error(errorMessage(data, "Failed to save edit"));
      setGeneratedClues((cs) => cs.map((c) => (c.id === id ? data : c)));
    } catch (err) {
      toast.error(err.message, { title: "Edit not saved" });
    }
  };

  const setClueStatus = async (id, action) => {
    try {
      const { ok, data } = await api(`/clues/${id}/${action}`, { method: "PATCH" });
      if (!ok) throw new Error(errorMessage(data, "Failed to update entry"));
      setGeneratedClues((cs) => cs.map((c) => (c.id === id ? data : c)));
      return data;
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  };

  // Only approved clues get used, and each goes into the first page that is
  // the same type and still blank. An approved clue with no empty page of its
  // type left is not added. `list` lets "Approve all" pass the clues it just
  // approved, since state from this render doesn't have those statuses yet.
  const insertApprovedClues = (list = generatedClues) => {
    const approved = list.filter((c) => c.status === "approved");
    if (approved.length === 0) return;

    const nextPages = [...pages];
    const filled = new Set();
    let used = 0;

    for (const c of approved) {
      const type = c.clueType || "NORMAL";
      const index = nextPages.findIndex((p, i) => !filled.has(i) && p.type === type && !p.question.trim());
      if (index === -1) continue;

      const answers = c.answers?.length ? c.answers : [{ text: c.answerText, isCorrect: true }];
      nextPages[index] = {
        ...nextPages[index],
        question: c.clueText,
        note: c.note || "",
        answers: answers.map((a) => ({ text: a.text, isCorrect: !!a.isCorrect })),
      };
      filled.add(index);
      used += 1;
    }

    setPages(nextPages);

    // The written additional notes go into the blank note fields, in order.
    if (generatedNotes.length > 0) {
      const nextNotes = [...notes];
      let at = 0;
      for (let i = 0; i < nextNotes.length && at < generatedNotes.length; i++) {
        if (!nextNotes[i].trim()) nextNotes[i] = generatedNotes[at++];
      }
      setNotes(nextNotes);
    }

    if (used < approved.length) {
      toast.warning(`Only ${used} of ${approved.length} approved entries fit into this campaign's empty entries - the rest weren't added.`);
    } else {
      toast.success(`${used} ${used === 1 ? "entry" : "entries"} added. Review them before saving.`);
    }

    setLessonStep("idle");
    setGeneratedClues([]);
    setGeneratedNotes([]);
    setNotesError("");
  };

  const cancelReview = () => {
    setLessonStep("idle");
    setGeneratedClues([]);
    setGeneratedNotes([]);
    setNotesError("");
  };

  // ---------- Steps ----------
  const detailsReady = !!title.trim() && !!scene && templateStatus === "ready";
  const notesFilled = noteCount === 0 || notes.every((n) => n.trim());
  const steps = [
    { key: "details", label: "Details", sub: scene ? getSceneMeta(scene).label : "Title & scene", filled: detailsReady },
    ...pages.map((p, i) => ({ key: `entry-${i}`, label: `Entry ${i + 1}`, sub: CLUE_TYPES[p.type]?.label, filled: isEntryFilled(p), entry: i })),
    ...(noteCount > 0 ? [{ key: "notes", label: "Additional notes", sub: `${noteCount} ${noteCount === 1 ? "note" : "notes"}`, filled: notesFilled }] : []),
    { key: "review", label: "Review & publish", review: true },
  ];
  const step = steps[Math.min(activeIndex, steps.length - 1)];
  const filledEntries = pages.filter(isEntryFilled).length;

  const validateDetails = () => {
    const next = {};
    if (!title.trim()) next.title = "Give the campaign a title.";
    if (!scene) next.scene = "Choose a scene.";
    else if (templateStatus !== "ready") next.scene = "This scene needs a published question set first.";
    setDetailErrors(next);
    return Object.keys(next).length === 0;
  };

  const goTo = (index) => {
    if (submitting || reviewing) return;
    if (index > 0 && !validateDetails()) {
      setActiveIndex(0);
      return;
    }
    setStepError("");
    setActiveIndex(index);
  };

  // Every entry is required - the vault's template is a fixed contract, so
  // a partially-filled clue set never goes to the server. Returns the step
  // index of the first problem, or -1 when ready.
  const findProblem = () => {
    if (!validateDetails()) return { index: 0, message: "Add a title and choose a scene." };
    const entry = pages.findIndex((p) => !isEntryFilled(p));
    if (entry !== -1) return { index: entry + 1, message: `Entry ${entry + 1} isn't finished - fill in its question and every answer.`, entry };
    const blankNote = noteCount > 0 ? notes.findIndex((n) => !n.trim()) : -1;
    if (blankNote !== -1) return { index: pages.length + 1, message: `Additional note ${blankNote + 1} is empty - fill in every note.` };
    return null;
  };

  // Runs the create/update -> clues -> attachment -> publish sequence.
  // Returns whether it succeeded.
  const seal = async (publish) => {
    setSaveError("");
    try {
      const existingId = isEditing ? campaign.id : createdIdRef.current;

      setSavePhase("details");
      const meta = existingId
        ? await api(`/campaigns/${existingId}`, { method: "PATCH", body: { title, description, scene } })
        : await api("/campaigns", { method: "POST", body: { title, description, roomId, scene } });
      if (!meta.ok) throw new Error(errorMessage(meta.data));

      const campaignId = existingId || meta.data.id;
      if (!isEditing && !createdIdRef.current) {
        createdIdRef.current = campaignId;
        setPartialDraft(true);
      }

      setSavePhase("entries");
      const clues = pages.map((p) => ({ type: p.type, question: p.question, note: p.note || null, answers: p.answers }));
      const replace = isEditing || cluesSavedRef.current;
      const cluesRes = await api(`/campaigns/${campaignId}/clues`, {
        method: replace ? "PUT" : "POST",
        body: { clues, standaloneNotes: noteCount > 0 ? notes : [] },
      });
      if (!cluesRes.ok) throw new Error(errorMessage(cluesRes.data));
      cluesSavedRef.current = true;

      if (attachmentFile) {
        setSavePhase("upload");
        const form = new FormData();
        form.append("file", attachmentFile);
        const up = await api(`/campaigns/${campaignId}/attachment`, { method: "POST", body: form });
        if (!up.ok) throw new Error(`The campaign was saved, but the attachment didn't upload: ${errorMessage(up.data)}`);
      } else if (removeAttachment && isEditing) {
        setSavePhase("removeFile");
        const del = await api(`/campaigns/${campaignId}/attachment`, { method: "DELETE" });
        if (!del.ok) throw new Error(errorMessage(del.data));
      }

      if (publish) {
        setSavePhase("publish");
        const pub = await api(`/campaigns/${campaignId}/publish`, { method: "PATCH" });
        if (!pub.ok) throw new Error(`The campaign was saved as a draft, but publishing failed: ${errorMessage(pub.data)}`);
      }

      return true;
    } catch (err) {
      setSaveError(err.message === "Failed to fetch" ? "Couldn't reach the server. Your changes aren't saved yet." : err.message);
      return false;
    } finally {
      setSavePhase(null);
    }
  };

  const handleSave = async (publish) => {
    if (submitting) return;
    if (reviewing) {
      setStepError("Finish reviewing the AI drafts first.");
      return;
    }
    const problem = findProblem();
    if (problem) {
      setActiveIndex(problem.index);
      setStepError(problem.message);
      if (problem.entry !== undefined) setShowErrorsFor((s) => new Set(s).add(problem.entry));
      return;
    }
    const ok = await seal(publish);
    if (!ok) return;
    onSaved({ published: publish, title: title.trim(), created: !isEditing });
    onClose();
  };

  const requestClose = () => {
    if (submitting) return;
    if (dirty || partialDraft) setConfirmDiscard(true);
    else onClose();
  };

  const discard = () => {
    // A partially saved new campaign already exists as a draft - make sure the list shows it.
    if (partialDraft) onSaved({ partial: true });
    onClose();
  };

  // ---------- Rendering ----------
  const renderDetails = () => (
    <div className="stack stack-lg">
      <div className="editor-section__head">
        <div>
          <p className="eyebrow">Step 1</p>
          <h3 className="editor-section__title">Campaign details</h3>
        </div>
      </div>

      <TextField
        label="Title"
        required
        value={title}
        maxLength={120}
        onChange={(e) => {
          setTitle(e.target.value);
          if (detailErrors.title) setDetailErrors((d) => ({ ...d, title: undefined }));
        }}
        error={detailErrors.title}
        help={HELP.title}
        data-autofocus
      />
      <TextAreaField label="Description" optional rows={3} value={description} onChange={(e) => setDescription(e.target.value)} help={HELP.description} />

      <fieldset className="scene-picker" disabled={submitting || reviewing}>
        <legend className="field__label row" style={{ "--gap": "6px" }}>
          Scene <span className="field__required" aria-hidden="true">*</span>
          <HelpTip text={HELP.vault} label="About scenes" />
        </legend>
        {isEditing && <p className="field__hint">A saved campaign keeps its scene. To use another scene, create a new campaign.</p>}
        <div className="scene-picker__grid">
          {SCENE_LIST.map((s) => {
            const selected = scene === s.key;
            return (
              <label key={s.key} className="scene-option" data-selected={selected} data-disabled={isEditing && !selected} style={sceneStyle(s.key)}>
                <input
                  type="radio"
                  name="campaign-scene"
                  className="sr-only"
                  value={s.key}
                  checked={selected}
                  disabled={isEditing && !selected}
                  onChange={() => handleSceneChange(s.key)}
                  aria-describedby={detailErrors.scene ? "scene-error" : undefined}
                />
                <span className="scene-option__art" aria-hidden="true">
                  <SceneArt scene={s.key} />
                </span>
                <span className="scene-option__text">
                  <span className="scene-option__name">
                    <s.Icon size={16} aria-hidden="true" /> {s.label}
                  </span>
                  <span className="scene-option__blurb">{s.blurb}</span>
                </span>
                {selected && (
                  <span className="scene-option__check" aria-hidden="true">
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
              </label>
            );
          })}
        </div>
        {detailErrors.scene && (
          <p id="scene-error" className="field__error" role="alert">
            <AlertCircle size={14} aria-hidden="true" /> {detailErrors.scene}
          </p>
        )}
        <div aria-live="polite">
          {scene && templateStatus === "loading" && (
            <p className="text-sm text-muted row" style={{ "--gap": "8px" }}>
              <Spinner size={16} /> Loading this scene's question set...
            </p>
          )}
          {scene && templateStatus === "none" && (
            <Alert tone="warning" title="This scene isn't ready yet">
              It has no published question set. Ask an administrator to publish one before creating a campaign here.
            </Alert>
          )}
          {scene && templateStatus === "error" && (
            <Alert tone="danger" action={<Button size="sm" onClick={() => loadTemplate(scene)}>Retry</Button>}>
              Couldn't load this scene's question set.
            </Alert>
          )}
          {scene && templateStatus === "ready" && !isEditing && (
            <p className="text-sm text-success row" style={{ "--gap": "6px" }}>
              <CheckCircle2 size={16} aria-hidden="true" /> {pages.length} {pages.length === 1 ? "entry" : "entries"}
              {noteCount > 0 ? ` and ${noteCount} additional ${noteCount === 1 ? "note" : "notes"}` : ""} to fill in.
            </p>
          )}
        </div>
      </fieldset>

      <section className="editor-subsection" aria-labelledby="resource-heading">
        <div className="row" style={{ "--gap": "6px" }}>
          <h4 id="resource-heading">Resource file</h4>
          <span className="field__optional">(optional)</span>
          <HelpTip text={HELP.resource} label="About the resource file" />
        </div>
        <p className="text-sm text-muted">A handout or reference sheet students can open alongside this campaign.</p>

        <input ref={attachmentInputRef} type="file" accept={ATTACHMENT_ACCEPT} onChange={handleAttachmentChange} className="sr-only" tabIndex={-1} aria-hidden="true" />

        {attachmentFile || (existingAttachment && !removeAttachment) ? (
          <div className="file-chip">
            <FileText size={18} aria-hidden="true" />
            <span className="grow truncate">{attachmentFile ? attachmentFile.name : existingAttachment.filename}</span>
            {attachmentFile && <Badge tone="info">Uploads on save</Badge>}
            <Button size="sm" variant="ghost" onClick={() => attachmentInputRef.current?.click()} disabled={submitting}>
              Replace
            </Button>
            <Button size="sm" variant="danger-ghost" icon={X} onClick={clearAttachment} disabled={submitting} aria-label="Remove attachment">
              Remove
            </Button>
          </div>
        ) : (
          <div>
            <Button icon={Paperclip} onClick={() => attachmentInputRef.current?.click()} disabled={submitting}>
              Attach a file
            </Button>
            {removeAttachment && <p className="field__hint" style={{ marginTop: 6 }}>The current file will be removed when you save.</p>}
          </div>
        )}
        {attachmentError && (
          <p className="field__error" role="alert">
            <AlertCircle size={14} aria-hidden="true" /> {attachmentError}
          </p>
        )}

        <div className="ai-box" aria-live="polite">
          <div className="row row-nowrap" style={{ alignItems: "flex-start" }}>
            <span className="ai-box__icon" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <div className="grow stack stack-sm">
              <p className="font-semibold">Draft the entries with AI</p>
              <p className="text-sm text-muted">
                Reads the attached {LESSON_EXTENSIONS.join(", ")} file and drafts one entry per slot. You pick the difficulty in the assistant panel, then approve
                each draft.
              </p>
              {lessonStep === "uploading" && (
                <p className="text-sm row" style={{ "--gap": "8px" }}>
                  <Spinner size={16} /> Uploading and reading the lesson...
                </p>
              )}
              {lessonStep === "waiting" && (
                <div className="row">
                  <p className="text-sm font-semibold">Choose Easy, Medium or Hard in the assistant panel.</p>
                  <Button size="sm" variant="ghost" onClick={cancelGeneration}>
                    Cancel
                  </Button>
                </div>
              )}
              {lessonStep === "generating" && (
                <p className="text-sm row" style={{ "--gap": "8px" }}>
                  <Spinner size={16} /> Drafting entries - this can take up to a minute...
                </p>
              )}
              {lessonStep === "error" && <Alert tone="danger">{lessonError}</Alert>}
              <div className="row">
                <Button
                  size="sm"
                  variant="soft"
                  icon={Sparkles}
                  onClick={handleAutoGenerate}
                  disabled={!attachmentFile || !detailsReady || ["uploading", "waiting", "generating"].includes(lessonStep) || submitting}
                  loading={lessonStep === "uploading" || lessonStep === "generating"}
                >
                  Generate with AI
                </Button>
                {!attachmentFile && <span className="text-xs text-muted">Attach a new lesson file first.</span>}
                {attachmentFile && !isLessonFile(attachmentFile) && <span className="text-xs text-muted">This file type can't be read by the AI.</span>}
                {attachmentFile && !detailsReady && <span className="text-xs text-muted">Add a title and pick a scene first.</span>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderNotes = () => (
    <div className="stack">
      <div className="editor-section__head">
        <div>
          <p className="eyebrow">Extra hints</p>
          <h3 className="editor-section__title">Additional notes</h3>
        </div>
        <Badge tone={notesFilled ? "success" : "warning"}>{notes.filter((n) => n.trim()).length} of {noteCount} written</Badge>
      </div>
      <p className="text-sm text-muted">
        This scene asks for {noteCount} short {noteCount === 1 ? "fact" : "facts"} from the lesson that belong to no question. They're mixed in with the hints, so
        players can't tell which hint goes with which answer.
      </p>
      {notes.map((n, i) => (
        <TextAreaField
          key={i}
          label={`Note ${i + 1}`}
          required
          rows={2}
          value={n}
          onChange={(e) => updateNote(i, e.target.value)}
          placeholder="A short fact from the lesson that is not the answer to any question"
          help={i === 0 ? HELP.extraNote : undefined}
          error={stepError && !n.trim() ? "Write this note." : undefined}
        />
      ))}
    </div>
  );

  const renderReview = () => {
    const fileLabel = attachmentFile ? attachmentFile.name : existingAttachment && !removeAttachment ? existingAttachment.filename : "None";
    const problems = [
      !detailsReady && { label: "Add a title and choose a scene", index: 0 },
      ...pages.map((p, i) => !isEntryFilled(p) && { label: `Finish entry ${i + 1}`, index: i + 1 }),
      !notesFilled && { label: "Write every additional note", index: pages.length + 1 },
    ].filter(Boolean);

    return (
      <div className="stack stack-lg">
        <div className="editor-section__head">
          <div>
            <p className="eyebrow">Last step</p>
            <h3 className="editor-section__title">Review & publish</h3>
          </div>
        </div>

        <dl className="summary-list">
          <div>
            <dt>Title</dt>
            <dd>{title.trim() || "—"}</dd>
          </div>
          <div>
            <dt>Scene</dt>
            <dd>{scene ? getSceneMeta(scene).label : "—"}</dd>
          </div>
          <div>
            <dt>Entries</dt>
            <dd>
              {filledEntries} of {pages.length} complete
            </dd>
          </div>
          {noteCount > 0 && (
            <div>
              <dt>Additional notes</dt>
              <dd>
                {notes.filter((n) => n.trim()).length} of {noteCount} written
              </dd>
            </div>
          )}
          <div>
            <dt>Resource file</dt>
            <dd className="break-words">{fileLabel}</dd>
          </div>
        </dl>

        {problems.length > 0 ? (
          <Alert tone="warning" title="A few things left before saving">
            <ul className="stack stack-sm" style={{ marginTop: 6, listStyle: "none" }}>
              {problems.map((p) => (
                <li key={p.label}>
                  <button type="button" className="link-button" onClick={() => goTo(p.index)}>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </Alert>
        ) : (
          <Alert tone="success" title="Everything's filled in">
            <strong>Save draft</strong> keeps it hidden from students so you can keep editing. <strong>Publish</strong> makes it playable right away.
          </Alert>
        )}
      </div>
    );
  };

  const renderStep = () => {
    if (reviewing) {
      return (
        <GeneratedCluesReview
          clues={generatedClues}
          notes={generatedNotes}
          notesError={notesError}
          onSaveEdit={saveClueEdit}
          onApprove={(id) => setClueStatus(id, "approve")}
          onReject={(id) => setClueStatus(id, "reject")}
          onInsert={insertApprovedClues}
          onCancel={cancelReview}
        />
      );
    }
    if (step.key === "details") return renderDetails();
    if (step.key === "notes") return renderNotes();
    if (step.review) return renderReview();
    const i = step.entry;
    return (
      <EntryForm
        key={i}
        clue={pages[i]}
        index={i}
        total={pages.length}
        error={showErrorsFor.has(i)}
        onField={(field, value) => updateClue(i, field, value)}
        onAnswer={(answerIndex, field, value) => updateAnswerField(i, answerIndex, field, value)}
        onAddAnswer={() => addAnswerRow(i)}
        onRemoveAnswer={(answerIndex) => removeAnswerRow(i, answerIndex)}
      />
    );
  };

  const isLast = activeIndex >= steps.length - 1;

  return (
    <>
      <Modal
        title={isEditing ? "Edit campaign" : "New campaign"}
        description={isEditing ? campaign.title : "Create an escape-room game from your lesson."}
        size="xl"
        onClose={requestClose}
        busy={submitting}
        className="editor"
        bodyClassName="editor__body"
        footer={
          <div className="editor__footer">
            <p className="editor__status text-sm text-muted" role="status" aria-live="polite">
              {submitting ? SAVE_PHASES[savePhase] : dirty ? "Unsaved changes" : isEditing ? "No changes yet" : ""}
            </p>
            <div className="row">
              {activeIndex > 0 && !reviewing && (
                <Button variant="ghost" icon={ArrowLeft} onClick={() => goTo(activeIndex - 1)} disabled={submitting}>
                  Back
                </Button>
              )}
              {!isLast ? (
                <Button variant="accent" iconRight={ArrowRight} onClick={() => goTo(activeIndex + 1)} disabled={submitting || reviewing}>
                  Next
                </Button>
              ) : (
                <>
                  <Button variant="secondary" icon={Save} onClick={() => handleSave(false)} loading={submitting && savePhase !== "publish"} disabled={submitting || reviewing}>
                    Save draft
                  </Button>
                  <Button variant="accent" icon={Rocket} onClick={() => handleSave(true)} loading={savePhase === "publish"} disabled={submitting || reviewing}>
                    Publish campaign
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        <div className="editor__layout">
          <nav className="editor__nav" aria-label="Campaign steps">
            <label className="editor__nav-select field">
              <span className="field__label">Step</span>
              <select className="input" value={activeIndex} onChange={(e) => goTo(Number(e.target.value))} disabled={submitting || reviewing}>
                {steps.map((s, i) => (
                  <option key={s.key} value={i}>
                    {i + 1}. {s.label}
                    {s.filled ? " ✓" : ""}
                  </option>
                ))}
              </select>
            </label>
            <ol className="editor__steps" role="list">
              {steps.map((s, i) => (
                <li key={s.key}>
                  <button
                    type="button"
                    className="editor-step"
                    aria-current={i === activeIndex ? "step" : undefined}
                    data-filled={s.filled || undefined}
                    onClick={() => goTo(i)}
                    disabled={submitting || reviewing}
                  >
                    <span className="editor-step__dot" aria-hidden="true">
                      {s.review ? <Rocket size={13} /> : s.filled ? <Check size={13} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="grow">
                      <span className="editor-step__label">{s.label}</span>
                      {s.sub && <span className="editor-step__sub">{s.sub}</span>}
                    </span>
                    {!s.review && <span className="sr-only">{s.filled ? "complete" : "not complete"}</span>}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="editor__content">
            {saveError && (
              <Alert tone="danger" title="Not saved" className="section__alert">
                {saveError}
              </Alert>
            )}
            {stepError && !saveError && (
              <Alert tone="warning" className="section__alert">
                {stepError}
              </Alert>
            )}
            {renderStep()}
          </div>
        </div>
      </Modal>

      {pendingScene && (
        <ConfirmDialog
          title="Switch scenes?"
          confirmLabel="Switch and clear entries"
          cancelLabel="Keep this scene"
          onCancel={() => setPendingScene(null)}
          onConfirm={confirmSceneChange}
        >
          <p>Each scene has its own question set, so switching clears the entries and notes you've written so far.</p>
        </ConfirmDialog>
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title={isEditing ? "Discard your changes?" : "Discard this campaign?"}
          confirmLabel="Discard"
          cancelLabel="Keep editing"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={discard}
        >
          <p>{dirty ? "Your unsaved changes will be lost." : "Nothing more will be saved."}</p>
          {partialDraft && <p>A draft of this campaign was already created before the save stopped. You'll find it in the campaign list.</p>}
        </ConfirmDialog>
      )}
    </>
  );
}

export default CampaignEditor;
