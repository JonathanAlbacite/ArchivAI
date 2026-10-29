// Shapes and rules for the campaign editor (CampaignEditor.jsx).
//
// Which Question/Answer/Note "pairing" shape a clue page is authored as -
// mirrors the server's own ClueType enum (see schema.prisma). A campaign's
// clue pages are not freely added/typed by the teacher - they're fixed by the
// scene's published VaultTemplate, one page per slot, in that exact order and
// type. This just controls how each page's answer fields render.
export const CLUE_TYPES = {
  NORMAL: { label: "Normal", description: "One question, one answer, an optional hint." },
  MULTICHOICE: { label: "Multiple choice", description: "One correct answer plus three believable wrong choices." },
  COMBO: { label: "Combo", description: "Several correct answers the player must pick, plus any decoys." },
};

// The answers array a clue page starts with for a given type. NORMAL and
// COMBO both start with one blank correct answer (Combo just allows adding
// more); MultiChoice starts with all four slots since that shape is fixed.
export const defaultAnswersFor = (type) => {
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

export const emptyClueForType = (type) => ({ type, question: "", note: "", answers: defaultAnswersFor(type) });

export const ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip";
const ATTACHMENT_EXTENSIONS = ATTACHMENT_ACCEPT.split(",");
const extOf = (file) => `.${(file.name.split(".").pop() || "").toLowerCase()}`;
export const isAllowedAttachment = (file) => ATTACHMENT_EXTENSIONS.includes(extOf(file));

export const LESSON_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];
export const isLessonFile = (file) => LESSON_EXTENSIONS.includes(extOf(file));

// A clue page is complete when it has a question, every answer option has
// text, and (for Combo) at least one option is marked correct - the same
// rules the server's validateClueAnswers enforces.
export const isEntryFilled = (clue) =>
  !!clue.question.trim() &&
  clue.answers.length > 0 &&
  clue.answers.every((a) => a.text.trim()) &&
  (clue.type !== "COMBO" || clue.answers.some((a) => a.isCorrect));

export const HELP = {
  title: "The name students see. Short and clear works best.",
  description: "One or two sentences on what the campaign covers and which lesson it belongs to.",
  vault: "The scene sets how many entries the campaign has and the type of each one (Normal, Multiple choice or Combo).",
  resource:
    "A handout or reference sheet students can open with this campaign. Attach a .pdf, .docx, .doc or .txt and press Generate with AI to draft the entries from it.",
  question: "The question to answer. One short, clear sentence.",
  note: "One plain sentence from the lesson that states the answer. It appears as a hint in the player's journal.",
  answerNormal: "The one correct answer. Keep it short: one or two words.",
  answerMulti: "The one correct answer. The three choices below must be wrong.",
  choice: "A wrong choice that looks believable. Don't repeat the correct answer.",
  answerCombo: "Add each option. Tick Correct on every right answer and leave wrong ones unticked.",
  extraNote: "A short fact from the lesson that doesn't answer any question. Don't reuse an answer or decoy.",
};

// A comparable snapshot of everything the teacher can change, for unsaved-change checks.
export const snapshotOf = ({ title, description, scene, pages, notes, attachmentName, removeAttachment }) =>
  JSON.stringify({ title, description, scene, pages, notes, attachmentName, removeAttachment });
