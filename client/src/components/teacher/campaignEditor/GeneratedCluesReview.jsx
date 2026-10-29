import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Sparkles, X } from "lucide-react";
import { useToast } from "../../../lib/toast";
import { SceneBadge } from "../../SceneIcon";
import { Alert, Badge, Button, Card } from "../../ui";
import { CLUE_TYPES } from "./editorModel";

const STATUS_TONE = { pending: "warning", edited: "info", approved: "success", rejected: "danger" };
const STATUS_LABEL = { pending: "Pending", edited: "Edited", approved: "Approved", rejected: "Rejected" };

// One reviewable clue drafted from a lesson upload. Keeps its own text buffer
// (the question and every answer option) so keystrokes don't round-trip to the
// server - edits are only PATCHed on blur, and only if they actually changed.
//
// Clicking Approve/Reject right after editing fires a native blur before the
// click handler runs, which would otherwise send the edit-PATCH and the
// approve-PATCH concurrently - whichever lands last wins and can silently drop
// the approval. pendingSave tracks any in-flight edit so approve/reject can
// await it first and guarantee the status change is always the last write.
function GeneratedClueCard({ clue, onSaveEdit, onApprove, onReject, onRegister }) {
  const clueType = clue.clueType || "NORMAL";
  // Clues generated before clueType existed only have answerText.
  const savedAnswers = clue.answers?.length
    ? clue.answers.map((a) => ({ text: a.text, isCorrect: !!a.isCorrect }))
    : [{ text: clue.answerText, isCorrect: true }];

  const [clueText, setClueText] = useState(clue.clueText);
  const [note, setNote] = useState(clue.note || "");
  const [answers, setAnswers] = useState(savedAnswers);
  const pendingSave = useRef(null);

  const setAnswerAt = (index, text) => setAnswers((list) => list.map((a, i) => (i === index ? { ...a, text } : a)));

  // A blank question or answer can't be saved or approved - the page it lands on would be incomplete.
  const isIncomplete = !clueText.trim() || answers.some((a) => !a.text.trim());

  const flushEdit = () => {
    const changed = clueText !== clue.clueText || note !== (clue.note || "") || JSON.stringify(answers) !== JSON.stringify(savedAnswers);
    if (changed && !isIncomplete) {
      pendingSave.current = onSaveEdit(clue.id, { clueText, answers, note });
    }
    return pendingSave.current || Promise.resolve();
  };

  const handleApprove = async () => {
    await flushEdit();
    return onApprove(clue.id);
  };

  // Lets "Approve all" run this card's own approve (which saves any unsaved
  // edit in its text buffer first) and skip it while a field is blank.
  useEffect(() => {
    onRegister(clue.id, { approve: handleApprove, incomplete: isIncomplete });
    return () => onRegister(clue.id, null);
  });

  const handleReject = async () => {
    await flushEdit();
    onReject(clue.id);
  };

  const isRejected = clue.status === "rejected";
  const isApproved = clue.status === "approved";
  const label = (a) => (a.isCorrect ? "Correct answer" : clueType === "MULTICHOICE" ? "Wrong choice" : "Decoy");

  return (
    <Card className="gen-card" data-status={clue.status}>
      <div className="row row-between">
        <div className="row" style={{ "--gap": "6px" }}>
          <SceneBadge scene={clue.scene} />
          <Badge tone="info">{CLUE_TYPES[clueType]?.label || clueType}</Badge>
        </div>
        <Badge tone={STATUS_TONE[clue.status] || "warning"}>{STATUS_LABEL[clue.status] || "Pending"}</Badge>
      </div>

      <label className="field">
        <span className="field__label">Question</span>
        <textarea className="input" rows={2} value={clueText} onChange={(e) => setClueText(e.target.value)} onBlur={flushEdit} />
      </label>
      <label className="field">
        <span className="field__label">Hint</span>
        <textarea
          className="input"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={flushEdit}
          placeholder="A short sentence from the lesson that contains the answer"
        />
      </label>
      {answers.map((a, i) => (
        <label key={i} className="field">
          <span className="field__label" style={a.isCorrect && clueType !== "NORMAL" ? { color: "var(--color-success)" } : undefined}>
            {clueType === "NORMAL" ? "Answer" : label(a)}
          </span>
          <input className="input" type="text" value={a.text} onChange={(e) => setAnswerAt(i, e.target.value)} onBlur={flushEdit} />
        </label>
      ))}

      <div className="row">
        <Button size="sm" variant={isApproved ? "soft" : "secondary"} icon={Check} onClick={handleApprove} disabled={isApproved || isIncomplete}>
          {isApproved ? "Approved" : "Approve"}
        </Button>
        <Button size="sm" variant="danger-ghost" icon={X} onClick={handleReject} disabled={isRejected}>
          {isRejected ? "Rejected" : "Reject"}
        </Button>
        {isIncomplete && <span className="text-xs text-danger">Fill in every field to approve.</span>}
      </div>
    </Card>
  );
}

// Takes over the editor's content area while clues drafted from an uploaded
// lesson await review. Approving/rejecting/editing persists straight to the
// GeneratedClue rows; only approved ones get inserted into this vault's empty
// pages of the same type (see insertApprovedClues in CampaignEditor).
function GeneratedCluesReview({ clues, notes, notesError, onSaveEdit, onApprove, onReject, onInsert, onCancel }) {
  const toast = useToast();
  const approvedCount = clues.filter((c) => c.status === "approved").length;
  // Drafts not yet decided. Rejected ones stay rejected - that was an explicit choice.
  const remaining = clues.filter((c) => c.status !== "approved" && c.status !== "rejected");
  const [approvingAll, setApprovingAll] = useState(false);
  const cards = useRef(new Map());
  const register = (id, entry) => (entry ? cards.current.set(id, entry) : cards.current.delete(id));

  const approveAll = async () => {
    setApprovingAll(true);
    const ready = remaining.map((c) => cards.current.get(c.id)).filter((card) => card && !card.incomplete);
    const skipped = remaining.length - ready.length;
    // One at a time, so each card's edit-then-approve order is kept.
    const updated = new Map();
    let failed = 0;
    for (const card of ready) {
      const clue = await card.approve();
      if (clue) updated.set(clue.id, clue);
      else failed += 1;
    }
    setApprovingAll(false);

    // Something still needs attention: stay on the review so nothing is lost.
    if (skipped > 0) {
      toast.warning(`${skipped} ${skipped === 1 ? "draft has" : "drafts have"} an empty field and ${skipped === 1 ? "wasn't" : "weren't"} approved. Fill ${skipped === 1 ? "it" : "them"} in, then press Approve all again.`);
      return;
    }
    if (failed > 0) return; // each failure already showed its own error

    // Everything is approved - add the entries straight away.
    onInsert(clues.map((c) => updated.get(c.id) || c));
  };

  return (
    <div className="stack">
      <div className="editor-section__head">
        <div>
          <p className="eyebrow row" style={{ "--gap": "6px" }}>
            <Sparkles size={14} aria-hidden="true" /> AI draft
          </p>
          <h3 className="editor-section__title">Review generated entries</h3>
        </div>
        <div className="row" style={{ "--gap": "8px" }}>
          <Badge tone="success">
            {approvedCount} of {clues.length} approved
          </Badge>
          <Button size="sm" variant="soft" icon={CheckCheck} onClick={approveAll} loading={approvingAll} disabled={remaining.length === 0}>
            Approve all &amp; add{remaining.length > 0 && remaining.length < clues.length ? ` (${remaining.length})` : ""}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted">
        Approve the entries you want, or use Approve all &amp; add to approve every draft and add them in one step. Each one drops into the next empty entry of its own type, in order. You can edit the question, hint and answers here
        first - AI drafts can be wrong, so check every one.
      </p>

      <div className="stack">
        {clues.map((c) => (
          <GeneratedClueCard key={c.id} clue={c} onSaveEdit={onSaveEdit} onApprove={onApprove} onReject={onReject} onRegister={register} />
        ))}
      </div>

      {(notes.length > 0 || notesError) && (
        <Card muted>
          <h4>Additional notes</h4>
          {notesError ? (
            <Alert tone="warning">The additional notes couldn't be written ({notesError}). You can type them in the Additional notes step.</Alert>
          ) : (
            <>
              <p className="text-sm text-muted" style={{ margin: "4px 0 8px" }}>
                These facts belong to no question. They're added to the Additional notes step, where you can still edit them.
              </p>
              <ol className="text-sm stack stack-sm" style={{ paddingLeft: 20 }}>
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ol>
            </>
          )}
        </Card>
      )}

      <div className="row row-between">
        <Button variant="ghost" onClick={onCancel}>
          Discard drafts
        </Button>
        <Button variant="accent" icon={Check} onClick={() => onInsert()} disabled={approvedCount === 0}>
          Add {approvedCount || ""} approved {approvedCount === 1 ? "entry" : "entries"}
        </Button>
      </div>
    </div>
  );
}

export default GeneratedCluesReview;
