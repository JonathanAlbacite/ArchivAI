import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Checkbox, Field, IconButton, TextAreaField, TextField } from "../../ui";
import { CLUE_TYPES, HELP } from "./editorModel";

// The form for one clue page. Its type (and so which answer fields it has) is
// fixed by the vault template; the parent owns the state and passes setters.
function EntryForm({ clue, index, total, error, onField, onAnswer, onAddAnswer, onRemoveAnswer }) {
  const type = CLUE_TYPES[clue.type] || CLUE_TYPES.NORMAL;

  return (
    <div className="stack">
      <div className="editor-section__head">
        <div>
          <p className="eyebrow">
            Entry {index + 1} of {total}
          </p>
          <h3 className="editor-section__title">{clue.question.trim() ? clue.question : "New entry"}</h3>
        </div>
        <Badge tone="info">{type.label}</Badge>
      </div>
      <p className="text-sm text-muted">{type.description} The scene's question set decides this type.</p>

      <TextAreaField
        label="Question"
        required
        rows={3}
        value={clue.question}
        onChange={(e) => onField("question", e.target.value)}
        placeholder="Write the question for this entry."
        help={HELP.question}
        error={error && !clue.question.trim() ? "Write the question for this entry." : undefined}
      />

      <TextAreaField
        label="Hint"
        optional
        rows={2}
        value={clue.note}
        onChange={(e) => onField("note", e.target.value)}
        placeholder="A short sentence from the lesson that contains the answer"
        help={HELP.note}
      />

      {clue.type === "NORMAL" && (
        <TextField
          label="Answer"
          required
          value={clue.answers[0]?.text || ""}
          onChange={(e) => onAnswer(0, "text", e.target.value)}
          placeholder="The correct answer"
          help={HELP.answerNormal}
          error={error && !clue.answers[0]?.text.trim() ? "Add the answer." : undefined}
        />
      )}

      {clue.type === "MULTICHOICE" && (
        <div className="answer-grid">
          <TextField
            label="Correct answer"
            required
            value={clue.answers[0]?.text || ""}
            onChange={(e) => onAnswer(0, "text", e.target.value)}
            placeholder="The one correct answer"
            help={HELP.answerMulti}
            className="answer-grid__correct"
            error={error && !clue.answers[0]?.text.trim() ? "Add the correct answer." : undefined}
          />
          {[1, 2, 3].map((idx) => (
            <TextField
              key={idx}
              label={`Wrong choice ${idx}`}
              required
              value={clue.answers[idx]?.text || ""}
              onChange={(e) => onAnswer(idx, "text", e.target.value)}
              placeholder={`A believable wrong answer`}
              help={idx === 1 ? HELP.choice : undefined}
              error={error && !clue.answers[idx]?.text.trim() ? "Add this choice." : undefined}
            />
          ))}
        </div>
      )}

      {clue.type === "COMBO" && (
        <Field label="Answers and decoys" required help={HELP.answerCombo} error={error && !clue.answers.some((a) => a.isCorrect) ? "Mark at least one answer as correct." : undefined}>
          {(controlProps) => (
            <div className="stack stack-sm" role="group" aria-describedby={controlProps["aria-describedby"]}>
              {clue.answers.map((a, idx) => (
                <div key={idx} className="combo-row" data-correct={a.isCorrect}>
                  <input
                    id={idx === 0 ? controlProps.id : undefined}
                    className="input"
                    type="text"
                    value={a.text}
                    onChange={(e) => onAnswer(idx, "text", e.target.value)}
                    placeholder={a.isCorrect ? "A correct answer" : "A decoy"}
                    aria-label={`Option ${idx + 1}`}
                    aria-invalid={error && !a.text.trim() ? "true" : undefined}
                  />
                  <Checkbox label="Correct" checked={a.isCorrect} onChange={(e) => onAnswer(idx, "isCorrect", e.target.checked)} />
                  <IconButton icon={Trash2} label={`Remove option ${idx + 1}`} size="sm" variant="danger-ghost" onClick={() => onRemoveAnswer(idx)} disabled={clue.answers.length <= 1} />
                </div>
              ))}
              <div>
                <Button size="sm" variant="ghost" icon={Plus} onClick={onAddAnswer}>
                  Add answer or decoy
                </Button>
              </div>
            </div>
          )}
        </Field>
      )}
    </div>
  );
}

export default EntryForm;
