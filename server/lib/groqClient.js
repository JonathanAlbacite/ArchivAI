import "dotenv/config";
import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

console.log(`[groqClient] GROQ_API_KEY present: ${Boolean(apiKey)}`);

if (!apiKey) {
  throw new Error(
    "GROQ_API_KEY is not set. Add it to server/.env before starting the server with AI_PROVIDER=groq."
  );
}

const groq = new Groq({ apiKey });

// llama-3.3-70b-versatile (Groq's free/developer tier) was shut down
// 2026-08-16 — Groq's own deprecation notice points to this model as the
// replacement (see console.groq.com/docs/deprecations). Confirmed to
// support the standard `tools` function-calling parameter used below.
const MODEL = "openai/gpt-oss-120b";

// Plain single-turn text generation (no tools) — used for clue generation.
//
// This model "thinks" before it answers, and the thinking counts against the
// reply's token limit, so a long answer (the Medium/Hard clue sets) was being
// cut off before its closing "]". Low reasoning effort keeps the thinking
// short, and an explicit limit leaves room for the whole JSON array (the
// free tier's per-minute cap counts this limit too, so it stays moderate).
const CLUE_REPLY_MAX_TOKENS = 4096;

export const generateText = async (prompt) => {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    reasoning_effort: "low",
    max_completion_tokens: CLUE_REPLY_MAX_TOKENS,
  });

  const choice = completion.choices[0];
  if (choice?.finish_reason === "length") {
    console.warn(`[groqClient] generateText hit the ${CLUE_REPLY_MAX_TOKENS}-token reply limit - the answer is cut off`);
  }
  return choice?.message?.content || "";
};
