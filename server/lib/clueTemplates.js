import prisma from "./prisma.js";
import { generateText } from "./aiProviderChain.js";

// Shared by routes/lessonModules.js (the campaign editor's "Generate Clues
// from a Lesson") and teacherChatTools.js (the chat assistant): a campaign's
// clues follow its scene's published VaultTemplate - a fixed list of pages,
// each Normal, MultiChoice or Combo (see ClueType in schema.prisma) - so
// both generate and check clues against that same set-up.

// What the model must return for each kind of clue page - see ClueType in
// schema.prisma. Both the prompt and parseClueResponse below follow these.
const CLUE_TYPE_INSTRUCTIONS = {
  NORMAL:
    'an Identification (Normal) clue: {"clueText": "...", "answerText": "...", "hint": "..."} - ONE correct answer that is a short term only (see the Identification rule), no decoys',
  MULTICHOICE:
    'a MultiChoice clue: {"clueText": "...", "correctAnswer": "...", "decoys": ["...", "...", "..."], "hint": "..."} - exactly one correct answer and exactly 3 plausible but wrong decoys; options may be short or descriptive',
  COMBO:
    'a Combo clue: {"clueText": "...", "correctAnswers": ["...", "..."], "decoys": ["...", "..."], "hint": "..."} - at least 2 correct answers (the player must pick every one) and at least 2 plausible but wrong decoys; options may be short or descriptive',
};

// An Identification (Normal) answer is typed onto the in-game Dial, which
// shows 4 letters per page and only keeps letters and digits (spaces and
// punctuation are dropped - see ResolveWordAndGroups in DialController.cs).
// So it has to be a short term. This counts the characters the Dial keeps.
export const MAX_IDENTIFICATION_CHARS = 12;
export const dialLength = (text) => (String(text).match(/[\p{L}\p{N}]/gu) || []).length;

// Each question comes with a hint: a short, readable note that states the
// fact the answer comes from, in a plain sentence that contains the answer
// (it is saved as the clue's Note, which the game shows in the Journal's Note
// panel). The prompt asks for less than these limits (15 words for a question,
// 30 for a hint) so a reply that is a little over still passes;
// parseClueResponse rejects anything past them.
export const MAX_QUESTION_WORDS = 20;
export const MAX_HINT_WORDS = 45;
export const MIN_HINT_WORDS = 4;

// How much of a hint's content must come from the document. Short common
// words are ignored; every other word of the hint (and every number) is looked
// up among the document's words, ignoring plural and tense endings. The hint
// may restate a fact in its own sentence - for a document written as
// questions and answers, "Manila is the capital city of the Philippines." from
// "What is the capital city of the Philippines? Manila" - but a hint that
// brings in words the document never uses (a new fact) is rejected.
const HINT_SOURCE_MATCH = 0.85;

// Difficulty levels. The teacher picks one when the lesson is uploaded (the
// chat assistant's Easy / Medium / Hard buttons). The level changes how the
// question and the hint are worded and how long they may be; every level keeps
// the same base rules (document only, one fact per question, the hint contains
// the correct answer exactly as written, no decoy in the hint).
//   easy   - direct question in the document's words; one-sentence hint in the
//            document's wording.
//   medium - question reworded with a synonym or another sentence shape; hint of
//            one or two sentences with the answer among a related fact.
//   hard   - question that describes the answer (or gives a term's meaning)
//            with synonyms; hint of two or three sentences, answer not first,
//            reworded, may join two connected facts; near-miss decoys.
// Only length, the hint's source match and the retry wording can be checked in
// code. Wording style is asked for in the prompt only.
export const DIFFICULTIES = ["easy", "medium", "hard"];
export const normalizeDifficulty = (value) => {
  const level = String(value || "").toLowerCase().trim();
  return DIFFICULTIES.includes(level) ? level : "easy";
};

const HINT_TAIL = (aim) =>
  `Never copy the question into the note, never write the note as a question, never write it as the question followed by the answer, and never add facts, explanations or details of your own. The "hint" part must contain the correct answer exactly as it is written in the answer field (for a Combo question, every correct answer). Neither part may contain a wrong option (decoy). Both parts must be real facts about the subject itself, never sentences about the text, such as "the topic is mentioned", "the section lists" or "this part explains" (do not use the words mention, section, chapter, passage, paragraph, lesson or module). Neither part may mention a question, a player, a clue, a hint or the document (never write the word "document" or "text" in the note). Change the order and the structure of the sentence first (for example "The highest mountain in the Philippines is Mount Apo." instead of "Mount Apo is the highest mountain in the Philippines." - style only); use a simple synonym only for one or two words, never for a key term of the topic, and keep every other word from the document. "hintIntro" and "hint" together have at most ${aim} words.`;

const DIFFICULTY_SETTINGS = {
  easy: {
    label: "EASY",
    questionAim: 15,
    questionMax: MAX_QUESTION_WORDS,
    hintAim: 30,
    hintMax: MAX_HINT_WORDS,
    sourceMatch: HINT_SOURCE_MATCH,
    intro: false,
    copyRun: 0,
    questionRule: `Question style: each question is ONE short sentence of at most 15 words, in plain everyday words, that asks for one fact only. Start simply, for example with "What", "Who", "Which", "Where", "When", "How many" or "What does". Do not join several ideas with "and", "which" or "that", do not write "which of the following", and do not copy long phrases from the document - use only the key term the answer depends on.`,
    hintRule: `Hint: every question also has a "hint", a short note that the player reads to find the answer. Write it as ONE plain statement of the fact (a normal sentence, or at most two short ones), the way a textbook states it. Example of the style only (never use its content): for the question "What is the largest planet in the Solar System?" the hint is "Jupiter is the largest planet in the Solar System." Use only facts and words from the document: if the document states the fact in a sentence, keep that sentence's wording; if the document is a list of questions and answers, turn each question and its answer into a statement like the example. Never copy the question into the hint, never write the hint as a question, never write it as the question followed by the answer, and never add facts, explanations or details of your own. The hint must contain the correct answer exactly as it is written in the answer field (for a Combo question, every correct answer). It must not contain any wrong option (decoy). It must not mention a question, a player, a clue or a hint. At most 30 words.`,
    decoyExtra: "",
  },
  medium: {
    label: "MEDIUM",
    questionAim: 18,
    questionMax: 24,
    hintAim: 40,
    hintMax: 55,
    sourceMatch: 0.7,
    intro: true,
    copyRun: 6,
    questionRule:
      'Question style: each question is ONE sentence of at most 18 words that asks for one fact only. Do not copy the document\'s wording: ask for the same fact with a synonym or a different sentence shape, but keep the exact meaning and the same subject, and do not use any fact or idea that the document does not contain. Example of the style only (never use its content): the document says "The elephant is the largest land animal" and the question is "Which animal is bigger than every other animal on land?" Do not join several ideas with "and", "which" or "that", and do not write "which of the following".',
    hintRule: `Hint: every question also has a short note that the player reads to find the answer. The note has two parts, written as two JSON fields. "hintIntro" is ONE plain sentence with a related fact about the same topic, taken from the document; it must NOT contain the answer and must not mention any answer option, correct or wrong. "hint" is ONE plain sentence that states the fact the question asks about and contains the answer. The player reads hintIntro first and then hint, so the answer always comes in the second part. Say the fact in "hint" in simple words that differ from the question: use a different sentence structure or a simple synonym, with exactly the same meaning, and never repeat six or more words in a row from the question. Keep most of the words from the document and change only a few of them; keep the words simple and everyday. If the document is a list of questions and answers, turn each question and its answer into statements. Example of the style only (never use its content): for the question "What is the largest land animal?" and the answer "Elephant", hintIntro is "Many animals live on land and eat plants." and hint is "The elephant is the biggest of them all, and it lives in groups called herds." ${HINT_TAIL(40)}`,
    decoyExtra:
      " Decoys should be items of the same kind as the correct answer, taken from the same section of the document where possible. Choose the related facts of the hint so that none of them mentions a decoy.",
  },
  hard: {
    label: "HARD",
    questionAim: 20,
    questionMax: 26,
    hintAim: 55,
    hintMax: 70,
    sourceMatch: 0.55,
    intro: true,
    copyRun: 6,
    questionRule:
      'Question style: each question is ONE sentence of at most 20 words that asks for one fact only. Do not name the topic in the document\'s own words: describe it instead, through a feature the document states (for example "the only", "the first", "the largest of", what it does, or the meaning of a term and ask for the term itself), and use synonyms or a different sentence shape. Keep the exact meaning and the same subject, and do not use any fact or idea that the document does not contain. Example of the style only (never use its content): the document says "The elephant is the largest land animal" and the question is "Which creature is heavier than every other animal that lives on land?" Do not join several ideas with "and", "which" or "that", and do not write "which of the following".',
    hintRule: `Hint: every question also has a short note that the player reads to find the answer. The note has two parts, written as two JSON fields. "hintIntro" is one or two plain sentences with related facts about the same topic, taken from the document (it may join two connected facts); it must NOT contain the answer and must not mention any answer option, correct or wrong. "hint" is one or two plain sentences that state the fact the question asks about and contain the answer. The player reads hintIntro first and then hint, so the answer is never at the start and the player has to read the whole note to pick it out. Say the fact in "hint" in a different sentence structure from the question (use the passive voice, reorder the clauses, or use a simple synonym for a few words) but keep the exact meaning, and never repeat six or more words in a row from the question. Keep most of the words from the document and change only about one word in four. Every sentence must be true according to the document. If the document is a list of questions and answers, turn each question and its answer into statements. Example of the style only (never use its content): for the answer "Elephant", hintIntro is "Plants are the only food of the heaviest animal living on land." and hint is "That animal, the elephant, lives in family groups called herds." ${HINT_TAIL(55)}`,
    decoyExtra:
      " Decoys must be near-misses: items of the same kind as the correct answer, from the same list or section of the document, believable and similar in length and style. Choose the related facts of the hint so that none of them mentions a decoy.",
  },
};

// The questions come only from the uploaded document: the prompt gives the
// model no scene, realm or game context, so nothing but the document's own
// content can end up in a question, answer, decoy or hint.
//
// One clue is requested per slot of the scene's published VaultTemplate, in
// the template's order and with its type, since a campaign's clue pages are
// fixed by that template (a Normal page can't hold a MultiChoice clue). The
// scene only picks which template to follow; it is not part of the prompt.
//
// Every clue has two readable parts: a short, plain QUESTION (what the lock
// asks) and a HINT (a plain statement of the fact, from the document, that
// contains the answer - never the question followed by the answer - which the
// player reads in the Journal to work the answer out). The prompt states both
// styles; parseClueResponse enforces what code can check (question length,
// hint is a statement that contains the answer and does not repeat the
// question, hint uses only the document's words).
// Tells the model exactly how the program judges its reply, so it can check its
// own hints before answering. The numbers come from the level's settings, so
// this text and parseClueResponse always agree. The example is style only.
const checkingNote = (level) => {
  const lines = [
    `- Length: a question has at most ${level.questionMax} words; ${level.intro ? 'the note ("hintIntro" and "hint" together)' : "the hint"} has at most ${level.hintMax} words.`,
    `- The answer: the "hint" contains the correct answer exactly as written${level.intro ? '; "hintIntro" never contains it' : ""}; no wrong option (decoy) appears in ${level.intro ? "either part" : "the hint"}.`,
    `- Document check: the program takes every meaningful word of the hint (words of four or more letters, and numbers) and looks it up in the document, ignoring only plural and tense endings. At least ${Math.round(level.sourceMatch * 100)} out of every 100 of those words must be found in the document. A word the document never uses counts as missing, even when it is a correct synonym: for example "tallest" is missing when the document says "highest", and so are words such as "major", "famous", "notable", "serves" or "among" unless the document contains them. When you are unsure, use the document's own word.`,
    `- Subject check: the hint fails if it talks about the text itself instead of stating a fact about the subject: the words mention (mentioned, mentions), section, chapter, passage, paragraph, lesson and module are not allowed unless the document itself uses them as part of the topic. Write what is true about the subject, for example "Asia has the most people of all the continents", never "the section lists the continents".`,
  ];
  if (level.copyRun > 0) {
    lines.push(
      `- Copy check: the program compares the hint with your question. If ${level.copyRun} or more words in a row from the question appear in the same order in the hint, the hint fails. Example of the check only (never use its content): for the question "What is the largest ocean on Earth?", the hint "The Pacific is the largest ocean on Earth." fails, because "is the largest ocean on Earth" is repeated; the hint "On Earth, the largest ocean is the Pacific." passes, because it uses the same words in a different order and no ${level.copyRun} words stay together. Fix a hint that fails this check by moving its parts around (start with the place or the description, or put the answer in the middle), never by inventing new words, because the document check above would then fail.`
    );
  }
  return `How your answer is checked: a program checks every question, and a question that fails is sent back to you with the reason.
${lines.join("\n")}
Before you answer, check each hint yourself against these points.`;
};

export const buildCluePrompt = (extractedText, slotTypes, difficulty = "easy") => {
  const level = DIFFICULTY_SETTINGS[normalizeDifficulty(difficulty)];

  return `You are writing quiz questions for a classroom activity. The document below is your ONLY source.

Rules:
- Every question, answer and hint must come directly from what the document states. Do not use outside knowledge, and do not add facts, definitions, examples or explanations that the document does not contain. If the document does not say it, do not ask it.
- Write plain, direct questions in the document's own terms. Do not add any story, setting, theme, character, riddle or role-play, and do not mention a game, a scene, a realm or a vault.
- Cover different parts of the document. Do not ask about the same fact twice.
- Choose the central points of the document. Ask about the facts that the document itself stresses: its title and main topic, its summary or conclusion, its review or "check your understanding" questions, and facts that are stated in more than one place. Do not ask about side details that are mentioned only once in passing. Take the most important fact of each main section, so the questions are spread over the main sections of the document and none of them is about a minor detail.
- Difficulty level: ${level.label}. Follow the question style and the hint rule below for this level; every other rule stays the same.
- ${level.questionRule}
- ${level.hintRule}
- Identification rule (for the Identification/Normal questions only): the answer must be a short term from the document, such as a name, a key term, a number or an acronym - at most 2 words and at most ${MAX_IDENTIFICATION_CHARS} letters and digits in total (spaces do not count), preferably 4 to 8. It must not be a sentence, a phrase or a description, and it must not contain punctuation. Write the question so that this one term is the answer. If the natural answer is longer, choose a shorter term from the document or ask about a different fact.
- MultiChoice and Combo options may be short terms or short descriptive phrases taken from the document. Keep each option brief enough to read on one line, and keep the options in a question similar in length and style.
- A wrong option (decoy) must be wrong according to the document but still believable. Where possible, take decoys from other terms or facts in the document. If the document has no suitable alternative, use a short wrong option of the same kind as the correct answer. A decoy must never repeat or contain a correct answer, and it must not appear in the hint.${level.decoyExtra}
- If the document is short, still return the required number of questions, but every question must still be answered by the document. Ask about the same section from a different angle instead of inventing content.

${checkingNote(level)}

Return ONLY a valid JSON array (no markdown, no code fences, no commentary) of exactly ${slotTypes.length} question objects, in this exact order. Each object must have exactly the fields shown for its type:
${slotTypes.map((type, i) => `${i + 1}. ${level.intro ? CLUE_TYPE_INSTRUCTIONS[type].replace('"hint": "..."', '"hintIntro": "...", "hint": "..."') : CLUE_TYPE_INSTRUCTIONS[type]}`).join("\n")}

"clueText" is the question. "hint" is the statement of the fact, taken from the document (with "hintIntro" before it when the shape shows it). Answers and decoys are short strings.

Document:
"""
${extractedText}
"""`;
};

const stripMarkdownFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

// Models sometimes put a sentence before or after the array, break a long hint
// over several lines (a raw line break inside a JSON string is invalid JSON),
// or leave a comma before a closing bracket. This keeps only the array and
// fixes those two small things before parsing; the content is not changed.
const cleanJson = (text) => {
  let t = stripMarkdownFences(text);
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end > start) t = t.slice(start, end + 1);
  return t.replace(/[\r\n\t]+/g, " ").replace(/,\s*([\]}])/g, "$1");
};

const isFilled = (v) => typeof v === "string" && v.trim().length > 0;
const filledStrings = (list) => (Array.isArray(list) ? list.filter(isFilled).map((s) => s.trim()) : null);

// Text helpers for the checks below. Everything is compared in a "plain"
// form: lower case, with every run of anything that is not a letter or digit
// turned into one space, so punctuation, line breaks and capitals never make
// a match fail.
const plain = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const wordsOf = (text) => {
  const p = plain(text);
  return p ? p.split(" ") : [];
};
const countWords = (text) => (String(text).trim().match(/\S+/g) || []).length;

// True when `phrase` appears in `plainText` as whole words.
const hasPhrase = (plainText, phrase) => {
  const p = plain(phrase);
  return p.length > 0 && ` ${plainText} `.includes(` ${p} `);
};

// Short common words that carry no fact, ignored when checking a hint against
// the document.
const FILLER_WORDS = new Set([
  "that", "this", "these", "those", "with", "from", "into", "onto", "over", "under", "between", "about", "above",
  "below", "after", "before", "during", "through", "while", "where", "when", "what", "which", "whom", "whose",
  "were", "been", "being", "have", "has", "had", "does", "did", "will", "would", "could", "should", "may", "might",
  "also", "than", "then", "such", "each", "every", "some", "any", "most", "more", "much", "many", "other", "only",
  "their", "there", "them", "they", "your", "ours", "very", "just", "because", "called", "known",
]);

// Cuts a common plural/tense ending so "produces" and "produce" compare equal.
// Rough on purpose - it only has to make both sides of the comparison agree.
const stem = (word) => {
  if (word.length >= 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  for (const suffix of ["ing", "ies", "ed", "es", "s", "e"]) {
    if (word.length - suffix.length >= 4 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
};

// The words of `text` that carry its facts: numbers, and words of four or more
// letters that are not filler, each cut to its stem.
const isContentWord = (w) => /^\d+$/.test(w) || (w.length >= 4 && !FILLER_WORDS.has(w));
const wordKey = (w) => (/^\d+$/.test(w) ? w : stem(w));
const contentWordsOf = (text) => wordsOf(text).filter(isContentWord).map(wordKey);

// What the checks compare against: the set of content words in the document.
// Built once per response.
const prepareSource = (sourceText) => {
  if (!sourceText) return null;
  return { words: new Set(contentWordsOf(sourceText)) };
};

// Checks that the hint brings in no facts of its own: at least `threshold` (the
// level's source match) of its content words are words of the document.
// Returns { ok, missing }, where `missing` lists the hint's words that the
// document does not use (shown to the model on a retry).
const checkHintSource = (hint, source, threshold) => {
  const words = wordsOf(hint).filter(isContentWord);
  if (words.length === 0) return { ok: false, missing: [] };

  const missing = words.filter((w) => !source.words.has(wordKey(w)));
  return { ok: (words.length - missing.length) / words.length >= threshold, missing: [...new Set(missing)] };
};

// Returns the first run of `run` words in a row that the hint repeats from the
// question, or null.
const copiesQuestionRun = (plainHint, question, run) => {
  const words = wordsOf(question);
  for (let i = 0; i + run <= words.length; i++) {
    if (` ${plainHint} `.includes(` ${words.slice(i, i + run).join(" ")} `)) return words.slice(i, i + run).join(" ");
  }
  return null;
};

// True when the hint states `answer`. A short answer (one or two words) must
// appear exactly; a longer descriptive one may miss a word or two (80% of its
// words must be in the hint).
const hintHasAnswer = (plainHint, answer) => {
  if (hasPhrase(plainHint, answer)) return true;

  const answerWords = wordsOf(answer);
  if (answerWords.length < 3) return false;

  const hintWords = new Set(plainHint.split(" "));
  return answerWords.filter((w) => hintWords.has(w)).length / answerWords.length >= 0.8;
};

// Words that show a sentence is about the text itself ("is mentioned among its
// facts", "the section lists ...") and not about the subject. A word is allowed
// when the document uses it itself (a document about book chapters, say).
const TEXT_TALK = /\b(mention|mentions|mentioned|mentioning|section|sections|chapter|chapters|passage|passages|paragraph|paragraphs|lesson|lessons|module|modules)\b/gi;
const aboutTheText = (text, source) => {
  const found = (String(text).match(TEXT_TALK) || []).map((w) => w.toLowerCase());
  return [...new Set(found)].filter((w) => !source || !source.words.has(wordKey(w)));
};

// Parses and validates the AI response against the template's slot types and
// the document it was written from. Returns { clues, slots } when every
// question passes, otherwise { problems, slots } (`slots` holds the clue of
// each question that did pass, null for the others, so a retry only has to fix
// the failed ones) - `problems` is a list of plain sentences saying what is
// wrong, which the caller sends back to the model for a retry. Each
// item's type comes from its slot (not from the model), and it's turned into
// { type, clueText, note, answers: [{ text, isCorrect }] } with the correct
// answer(s) first - the same shape the campaign editor's pages use. `note` is
// the hint.
export const parseClueResponse = (rawText, slotTypes, sourceText, difficulty = "easy") => {
  const level = DIFFICULTY_SETTINGS[normalizeDifficulty(difficulty)];
  let parsed;
  try {
    parsed = JSON.parse(cleanJson(rawText));
  } catch {
    const cutOff = !/\]\s*$/.test(stripMarkdownFences(rawText));
    return {
      invalidJson: true,
      problems: [
        !String(rawText).trim()
          ? "The response was empty. Return the JSON array."
          : cutOff
          ? "The response was not valid JSON: it stopped before the closing ]. Write shorter questions and hints so the whole array fits."
          : "The response was not valid JSON. Return only the JSON array, and put every double quote inside a text as \\\" or leave it out.",
      ],
    };
  }

  if (!Array.isArray(parsed) || parsed.length !== slotTypes.length) {
    return { problems: [`The response must be a JSON array of exactly ${slotTypes.length} question objects.`] };
  }

  const source = prepareSource(sourceText);
  const clues = [];
  const slots = new Array(slotTypes.length).fill(null); // the accepted clue of each question, or null
  const problems = [];

  for (let i = 0; i < slotTypes.length; i++) {
    const c = parsed[i];
    const type = slotTypes[i];
    const label = `Question ${i + 1}`;

    if (!c || !isFilled(c.clueText)) {
      problems.push(`${label}: "clueText" is missing.`);
      continue;
    }
    if (!isFilled(c.hint)) {
      problems.push(`${label}: "hint" is missing.`);
      continue;
    }
    if (level.intro && !isFilled(c.hintIntro)) {
      problems.push(`${label}: "hintIntro" is missing. Add a related fact (without the answer) before the hint.`);
      continue;
    }

    let correct;
    let decoys;

    if (type === "MULTICHOICE") {
      if (!isFilled(c.correctAnswer)) {
        problems.push(`${label}: "correctAnswer" is missing.`);
        continue;
      }
      correct = [c.correctAnswer.trim()];
      decoys = filledStrings(c.decoys);
      if (!decoys || decoys.length < 3) {
        problems.push(`${label}: it needs exactly 3 decoys.`);
        continue;
      }
      decoys = decoys.slice(0, 3);
    } else if (type === "COMBO") {
      correct = filledStrings(c.correctAnswers);
      decoys = filledStrings(c.decoys);
      if (!correct || correct.length < 1 || !decoys || decoys.length < 1) {
        problems.push(`${label}: it needs "correctAnswers" and "decoys".`);
        continue;
      }
    } else {
      if (!isFilled(c.answerText)) {
        problems.push(`${label}: "answerText" is missing.`);
        continue;
      }
      correct = [c.answerText.trim()];
      decoys = [];
    }

    const question = c.clueText.trim();
    // Medium and Hard: the note is the related fact ("hintIntro") followed by
    // the sentence with the answer ("hint"), so the answer's place is fixed by
    // the code, not left to the model.
    const intro = level.intro ? c.hintIntro.trim() : "";
    const hint = intro ? `${/[.!?]$/.test(intro) ? intro : `${intro}.`} ${c.hint.trim()}` : c.hint.trim();
    const plainHint = plain(hint);
    let ok = true;
    const fail = (message) => {
      problems.push(`${label}: ${message}`);
      ok = false;
    };

    // Too long for the Dial - the retry restates the limit.
    if (type === "NORMAL" && dialLength(correct[0]) > MAX_IDENTIFICATION_CHARS) {
      fail(`the Identification answer "${correct[0]}" has ${dialLength(correct[0])} letters and digits; the limit is ${MAX_IDENTIFICATION_CHARS}. Use a shorter term from the document.`);
    }

    const questionWords = countWords(question);
    if (questionWords > level.questionMax) {
      fail(`the question has ${questionWords} words; the limit is ${level.questionMax} (aim for ${level.questionAim} or fewer). Make it one short sentence.`);
    }
    if ((question.match(/\?/g) || []).length > 1) {
      fail("the question asks more than one thing. Ask for one fact only.");
    }

    const hintWords = countWords(hint);
    if (hintWords < MIN_HINT_WORDS) {
      fail(`the hint has only ${hintWords} word(s). Write it as a full sentence that states the fact.`);
    }
    if (hint.includes("?")) {
      fail('the hint is written as a question. State the fact as a normal sentence, for example "Jupiter is the largest planet in the Solar System."');
    } else if (hasPhrase(plainHint, question)) {
      fail("the hint repeats the question. Do not copy the question into the hint; state the fact as a normal sentence that contains the answer.");
    }
    if (intro) {
      const plainIntro = plain(intro);
      for (const answer of correct) {
        if (hasPhrase(plainIntro, answer)) {
          fail(`the answer "${answer}" is in "hintIntro". "hintIntro" must give a related fact without the answer; the answer goes only in "hint".`);
        }
      }
    }
    const textTalk = aboutTheText(hint, source);
    if (textTalk.length > 0) {
      fail(`the hint talks about the text itself (${textTalk.map((w) => `"${w}"`).join(", ")}) instead of stating a fact about the subject. ${intro ? 'Make "hintIntro" a real related fact about the subject, for example a property or a detail of the same topic, and never a sentence about what the text mentions or lists.' : "State the fact itself."}`);
    }
    if (level.copyRun > 0) {
      const copied = copiesQuestionRun(plainHint, question, level.copyRun);
      if (copied) {
        fail(`the hint repeats "${copied}" from the question. Change the order of the sentence instead of adding new words: begin it with a different part (for example the place or the description) and keep the document's own words, with the same meaning.`);
      }
    }
    if (hintWords > level.hintMax) {
      fail(`the hint has ${hintWords} words; the limit is ${level.hintMax} (aim for ${level.hintAim} or fewer). Shorten it and keep only what is needed.`);
    }

    for (const answer of correct) {
      if (!hintHasAnswer(plainHint, answer)) {
        fail(`the hint does not contain the correct answer "${answer}" as written. Write the fact as a sentence that includes it.`);
      }
    }

    for (const decoy of decoys) {
      if (hasPhrase(plainHint, decoy)) {
        fail(`the decoy "${decoy}" appears in the hint. Choose another decoy or another sentence for the hint.`);
      }
    }

    if (source) {
      const sourceCheck = checkHintSource(hint, source, level.sourceMatch);
      if (!sourceCheck.ok) {
        const examples = sourceCheck.missing.slice(0, 5).map((w) => `"${w}"`).join(", ");
        fail(`the hint uses words or facts that are not in the document${examples ? ` (for example ${examples})` : ""}. State only what the document says: replace those words with the document's own words. Do not swap a word for a synonym; change the order of the sentence instead.`);
      }
    }

    if (!ok) continue;

    const clue = {
      type,
      clueText: question,
      note: hint,
      answers: [
        ...correct.map((text) => ({ text, isCorrect: true })),
        ...decoys.map((text) => ({ text, isCorrect: false })),
      ],
    };
    slots[i] = clue;
    clues.push(clue);
  }

  return problems.length > 0 ? { problems, slots } : { clues, slots };
};

// Same per-type answer rules as validateClueAnswers in routes/campaigns.js
// (kept local - it isn't exported from there). Returns an error string, or
// null when `answers` is a valid option list for `type`.
export const validateAnswersForType = (type, answers) => {
  if (!Array.isArray(answers)) return "answers must be an array";
  if (answers.some((a) => !a || !isFilled(a.text))) return "Every answer option needs text";

  const correctCount = answers.filter((a) => a.isCorrect).length;

  if (type === "MULTICHOICE") {
    if (answers.length !== 4 || correctCount !== 1)
      return "MultiChoice needs exactly 4 answers with exactly 1 marked correct (3 decoys)";
  } else if (type === "COMBO") {
    if (correctCount < 1) return "Combo needs at least 1 answer marked correct";
  } else if (answers.length !== 1 || correctCount !== 1) {
    return "Normal needs exactly 1 answer, marked correct";
  }

  return null;
};

// The page types of a scene's published question set, in order. Returns
// { slotTypes } or { error }.
export const getPublishedSlotTypes = async (scene) => {
  const template = await prisma.vaultTemplate.findUnique({
    where: { scene: (scene || "").toLowerCase().trim() },
    include: { slots: { orderBy: { orderNumber: "asc" } } },
  });

  if (!template || !template.isPublished || template.slots.length === 0)
    return { error: "This vault has no published question-set template yet - ask an admin to publish one first" };

  return { slotTypes: template.slots.map((s) => s.type) };
};

// Checks a complete clue set ([{ type, question, answers }]) against the
// scene's question set: same count, same type on every page, a question on
// each, and answers that fit the type. Returns an error string, or null.
export const validateCluesAgainstTemplate = async (scene, clues) => {
  const { slotTypes, error } = await getPublishedSlotTypes(scene);
  if (error) return error;

  if (clues.length !== slotTypes.length)
    return `This vault's question set has ${slotTypes.length} clue(s) - got ${clues.length}`;

  for (let i = 0; i < clues.length; i++) {
    const c = clues[i];
    if (!isFilled(c.question)) return `Clue ${i + 1} needs a question`;
    if (c.type !== slotTypes[i])
      return `Clue ${i + 1} must be type ${slotTypes[i]} (set by the vault's question set)`;

    const answersError = validateAnswersForType(c.type, c.answers);
    if (answersError) return `Clue ${i + 1}: ${answersError}`;
  }

  return null;
};

// Drafts one clue per page of the scene's question set from lesson text,
// retrying (up to MAX_RETRIES times) if the reply breaks a rule - the retry lists exactly which
// questions broke which rule. Returns
// { clues: [{ type, clueText, note, answers }], slotTypes, provider } or
// { error: "no_template" | "ai_failed" | "malformed", message }. `note` is the
// question's hint. `difficulty` is "easy", "medium" or "hard" (anything else
// counts as easy).
// How many times a rejected reply is sent back to the model with its list of
// problems before the request gives up.
const MAX_RETRIES = 3;

export const generateCluesForScene = async (lessonText, scene, logLabel, difficulty = "easy") => {
  const { slotTypes, error } = await getPublishedSlotTypes(scene);
  if (error) return { error: "no_template", message: error };

  const level = normalizeDifficulty(difficulty);
  const prompt = buildCluePrompt(lessonText, slotTypes, level);

  try {
    const { text: rawText, provider } = await generateText(prompt);
    console.log(`[clueTemplates] ${logLabel} (${level}) answered via ${provider}`);
    let result = parseClueResponse(rawText, slotTypes, lessonText, level);
    let lastRaw = rawText;

    // A question that passes every rule is kept, even when another question in
    // the same reply fails; a retry only has to fix the questions that are
    // still missing, so a long set (Hard) can be completed over several tries.
    const kept = new Array(slotTypes.length).fill(null);
    const keepAccepted = (r) => (r.slots || []).forEach((clue, i) => { if (clue && !kept[i]) kept[i] = clue; });
    keepAccepted(result);

    // A reply that leaves questions unfixed gets up to MAX_RETRIES more tries;
    // each retry lists exactly which questions broke which rule.
    for (let retry = 1; kept.some((c) => !c) && retry <= MAX_RETRIES; retry++) {
      const open = result.problems.filter((p) => {
        const m = p.match(/^Question (\d+):/);
        return !m || !kept[Number(m[1]) - 1];
      });
      console.warn(`[clueTemplates] ${logLabel} answer ${retry} rejected: ${open.join(" | ")}`);
      if (result.invalidJson) console.warn(`[clueTemplates] ${logLabel} raw reply (${lastRaw.length} chars) starts: ${JSON.stringify(lastRaw.slice(0, 200))} ends: ${JSON.stringify(lastRaw.slice(-200))}`);

      const acceptedList = kept
        .map((c, i) => (c ? `${i + 1}. ${c.clueText}` : null))
        .filter(Boolean);
      const acceptedNote = acceptedList.length
        ? `\n\nThese questions were already accepted and are kept as they are (write them again in their place, and make the other questions about different facts):\n${acceptedList.join("\n")}`
        : "";
      const correctivePrompt = `${prompt}\n\nYour previous response had these problems:\n${open.map((p) => `- ${p}`).join("\n")}${acceptedNote}\n\nRespond again with ONLY a valid JSON array (no markdown, no commentary) of exactly ${slotTypes.length} question objects, in the same order, that fixes every problem and follows all the rules above.`;
      const { text: retryText } = await generateText(correctivePrompt);
      lastRaw = retryText;
      result = parseClueResponse(retryText, slotTypes, lessonText, level);
      keepAccepted(result);
    }

    if (kept.some((c) => !c)) {
      const open = (result.problems || []).filter((p) => {
        const m = p.match(/^Question (\d+):/);
        return !m || !kept[Number(m[1]) - 1];
      });
      console.warn(`[clueTemplates] ${logLabel} final answer rejected: ${open.join(" | ")}`);
      if (result.invalidJson) console.warn(`[clueTemplates] ${logLabel} raw reply (${lastRaw.length} chars) starts: ${JSON.stringify(lastRaw.slice(0, 200))} ends: ${JSON.stringify(lastRaw.slice(-200))}`);
      return {
        error: "malformed",
        message: `The AI's questions did not meet the rules after ${MAX_RETRIES} retries: ${open.slice(0, 3).join(" ")}`,
      };
    }

    result = { clues: kept };

    return { clues: result.clues, slotTypes, provider, difficulty: level };
  } catch (err) {
    return { error: "ai_failed", message: err.message };
  }
};

// ── Additional notes (standalone hints) ────────────────────────────────
//
// Each vault's template says how many additional notes a campaign needs
// (VaultTemplate.standaloneNoteCount). They are short facts from the same
// document that belong to NO question: they are shown with the hints in the
// game, so a player cannot tell which hint belongs to which answer. For that
// reason a note is written in the same style and length as a hint of the
// chosen difficulty, takes its fact from a part of the document that no
// question uses, and never contains an answer or a wrong option of any
// question (parseNoteResponse checks this).

// The number of additional notes a scene's published template asks for (0 when
// the vault has no published template).
export const getStandaloneNoteCount = async (scene) => {
  const template = await prisma.vaultTemplate.findUnique({
    where: { scene: (scene || "").toLowerCase().trim() },
    select: { isPublished: true, standaloneNoteCount: true },
  });
  return template?.isPublished ? template.standaloneNoteCount : 0;
};

// A note may not repeat this many words in a row from a question, a hint or
// another note.
const NOTE_COPY_RUN = 6;
const NOTE_FORBIDDEN_WORDS = /\b(question|questions|player|players|clue|clues|hint|hints)\b/i;

// `avoid` = { texts: [the questions and hints already written], phrases: [every
// answer and wrong option of those questions] }.
export const buildNotePrompt = (extractedText, count, avoid, difficulty = "easy") => {
  const level = DIFFICULTY_SETTINGS[normalizeDifficulty(difficulty)];
  const shape = level.intro
    ? `Each note is one or two plain sentences with at most ${level.hintAim} words, in simple everyday words, in the same style and length as a short textbook explanation. Keep most of the words from the document and change only a few of them.`
    : `Each note is ONE plain sentence of at most ${level.hintAim} words (a second short sentence is allowed), in the document's own wording.`;

  const used = [
    ...avoid.texts.map((x) => `- ${x}`),
    ...(avoid.phrases.length ? [`- Answers and wrong options (never write these in a note): ${avoid.phrases.join("; ")}`] : []),
  ];

  return `You are writing short extra notes for a classroom activity. The document below is your ONLY source.

Rules:
- Every note must be a fact that the document states. Do not use outside knowledge, and do not add facts, definitions, examples or explanations that the document does not contain.
- A note gives additional learning: an interesting or useful fact from the document. It must have NO connection to the facts already used below: it must not repeat, rephrase or point to any of them, and it must not contain any answer or wrong option listed there. Choose a different fact, from a part of the document that those facts do not use.
- Each note is a plain statement of a fact, never a question. ${shape}
- Each note is about a different part of the document. Do not write two notes about the same fact.
- Never write the words "question", "player", "clue" or "hint" in a note, and do not mention a game.

Facts already used:
${used.length ? used.join("\n") : "- (none)"}

How your answer is checked: a program checks every note, and a note that fails is sent back to you with the reason.
- A note is a statement, not a question, with ${MIN_HINT_WORDS} to ${level.hintMax} words.
- Document check: the program takes every meaningful word of the note (words of four or more letters, and numbers) and looks it up in the document, ignoring only plural and tense endings. At least ${Math.round(level.sourceMatch * 100)} out of every 100 of those words must be found in the document. A word the document never uses counts as missing, even when it is a correct synonym, so use the document's own words.
- Connection check: the note fails if it contains any answer or wrong option listed above, or if ${NOTE_COPY_RUN} or more words in a row are the same as a fact listed above or as another note.
Before you answer, check each note yourself against these points.

Return ONLY a valid JSON array (no markdown, no code fences, no commentary) of exactly ${count} strings, one string per note.

Document:
"""
${extractedText}
"""`;
};

// Returns { notes } when every note passes, otherwise { problems, slots } (like
// parseClueResponse: `slots` holds the accepted note of each position, null for
// the others). `kept` = notes accepted in earlier tries, used to reject a
// repeated fact.
export const parseNoteResponse = (rawText, count, sourceText, avoid, difficulty = "easy", kept = []) => {
  const level = DIFFICULTY_SETTINGS[normalizeDifficulty(difficulty)];
  let parsed;
  try {
    parsed = JSON.parse(cleanJson(rawText));
  } catch {
    return {
      invalidJson: true,
      problems: [
        !String(rawText).trim()
          ? "The response was empty. Return the JSON array."
          : "The response was not valid JSON. Return only the JSON array of strings, and put every double quote inside a text as \\\" or leave it out.",
      ],
    };
  }

  if (!Array.isArray(parsed) || parsed.length !== count) {
    return { problems: [`The response must be a JSON array of exactly ${count} strings.`] };
  }

  const source = prepareSource(sourceText);
  const slots = new Array(count).fill(null);
  const problems = [];
  const accepted = kept.filter(Boolean);

  for (let i = 0; i < count; i++) {
    const label = `Note ${i + 1}`;

    // A note accepted in an earlier try stays as it is, whatever this reply says.
    if (kept[i]) {
      slots[i] = kept[i];
      continue;
    }

    const item = parsed[i];
    const note = typeof item === "string" ? item.trim() : isFilled(item?.note) ? item.note.trim() : "";

    if (!note) {
      problems.push(`${label}: the text is missing.`);
      continue;
    }
    if (note.includes("?")) {
      problems.push(`${label}: a note is a statement of a fact, not a question.`);
      continue;
    }
    const words = countWords(note);
    if (words < MIN_HINT_WORDS || words > level.hintMax) {
      problems.push(`${label}: it has ${words} words; a note needs ${MIN_HINT_WORDS} to ${level.hintAim} words.`);
      continue;
    }
    if (NOTE_FORBIDDEN_WORDS.test(note)) {
      problems.push(`${label}: do not use the words "question", "player", "clue" or "hint" in a note.`);
      continue;
    }

    const textTalk = aboutTheText(note, source);
    if (textTalk.length > 0) {
      problems.push(`${label}: it talks about the text itself (${textTalk.map((w) => `"${w}"`).join(", ")}). State a fact about the subject instead.`);
      continue;
    }

    const plainNote = plain(note);
    const clash = avoid.phrases.find((ph) => hasPhrase(plainNote, ph));
    if (clash) {
      problems.push(`${label}: it contains "${clash}", which is an answer or wrong option of a question. Write about a different fact.`);
      continue;
    }
    if (avoid.texts.some((x) => copiesQuestionRun(plainNote, x, NOTE_COPY_RUN))) {
      problems.push(`${label}: it repeats words of a fact that is already used. Write about a different fact.`);
      continue;
    }
    if (accepted.some((x) => plain(x) === plainNote || copiesQuestionRun(plainNote, x, NOTE_COPY_RUN))) {
      problems.push(`${label}: it repeats another note. Write about a different fact.`);
      continue;
    }
    if (source) {
      const check = checkHintSource(note, source, level.sourceMatch);
      if (!check.ok) {
        problems.push(`${label}: it uses words the document does not contain${check.missing.length ? ` (${check.missing.slice(0, 6).join(", ")})` : ""}. Use only the document's own facts and words.`);
        continue;
      }
    }

    slots[i] = note;
    accepted.push(note);
  }

  return problems.length ? { problems, slots } : { notes: slots, slots };
};

// Drafts `count` additional notes from lesson text, retrying (up to MAX_RETRIES
// times) with the list of problems, and keeping the notes that already passed
// - the same way generateCluesForScene does. Returns { notes, provider,
// difficulty } or { error: "ai_failed" | "malformed", message }.
export const generateStandaloneNotes = async (lessonText, count, avoid, logLabel, difficulty = "easy") => {
  if (!count) return { notes: [], difficulty: normalizeDifficulty(difficulty) };

  const level = normalizeDifficulty(difficulty);
  const prompt = buildNotePrompt(lessonText, count, avoid, level);

  try {
    const { text: rawText, provider } = await generateText(prompt);
    console.log(`[clueTemplates] ${logLabel} notes (${level}) answered via ${provider}`);

    const kept = new Array(count).fill(null);
    let result = parseNoteResponse(rawText, count, lessonText, avoid, level, kept);
    let lastRaw = rawText;
    const keepAccepted = (r) => (r.slots || []).forEach((n, i) => { if (n && !kept[i]) kept[i] = n; });
    keepAccepted(result);

    for (let retry = 1; kept.some((n) => !n) && retry <= MAX_RETRIES; retry++) {
      const open = result.problems.filter((p) => {
        const m = p.match(/^Note (\d+):/);
        return !m || !kept[Number(m[1]) - 1];
      });
      console.warn(`[clueTemplates] ${logLabel} notes answer ${retry} rejected: ${open.join(" | ")}`);

      const acceptedList = kept.map((n, i) => (n ? `${i + 1}. ${n}` : null)).filter(Boolean);
      const acceptedNote = acceptedList.length
        ? `\n\nThese notes were already accepted and are kept as they are (write them again in their place, and make the other notes about different facts):\n${acceptedList.join("\n")}`
        : "";
      const correctivePrompt = `${prompt}\n\nYour previous response had these problems:\n${open.map((p) => `- ${p}`).join("\n")}${acceptedNote}\n\nRespond again with ONLY a valid JSON array (no markdown, no commentary) of exactly ${count} strings that fixes every problem and follows all the rules above.`;
      const { text: retryText } = await generateText(correctivePrompt);
      lastRaw = retryText;
      result = parseNoteResponse(retryText, count, lessonText, avoid, level, kept);
      keepAccepted(result);
    }

    if (kept.some((n) => !n)) {
      const open = (result.problems || []).filter((p) => {
        const m = p.match(/^Note (\d+):/);
        return !m || !kept[Number(m[1]) - 1];
      });
      console.warn(`[clueTemplates] ${logLabel} notes final answer rejected: ${open.join(" | ")}`);
      if (result.invalidJson) console.warn(`[clueTemplates] ${logLabel} notes raw reply (${lastRaw.length} chars) starts: ${JSON.stringify(lastRaw.slice(0, 200))}`);
      return {
        error: "malformed",
        message: `The AI's notes did not meet the rules after ${MAX_RETRIES} retries: ${open.slice(0, 3).join(" ")}`,
      };
    }

    return { notes: kept, provider, difficulty: level };
  } catch (err) {
    return { error: "ai_failed", message: err.message };
  }
};

// True once anyone has played the campaign (a play session or saved
// progress exists). Such a campaign is kept as an archive: even when it is
// unpublished again, its title/scene/clues stay fixed so the recorded
// results keep matching what was actually played. "Update campaign"
// (POST /campaigns/:id/duplicate) makes an editable copy instead.
export const hasPlayHistory = async (campaignId) => {
  const [sessions, progress] = await Promise.all([
    prisma.campaignSession.count({ where: { campaignId } }),
    prisma.campaignProgress.count({ where: { campaignId } }),
  ]);
  return sessions + progress > 0;
};
