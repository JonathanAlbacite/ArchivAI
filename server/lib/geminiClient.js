import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

console.log(`[geminiClient] GEMINI_API_KEY present: ${Boolean(apiKey)}`);

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY is not set. Add it to server/.env before starting the server."
  );
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

// Plain single-turn text generation (no tools) — used for clue generation.
export const generateText = async (prompt) => {
  const result = await model.generateContent(prompt);
  return result.response.text();
};

// Converts the neutral message history (the same shape stored in
// ChatMessage rows: {role: "user"|"model"|"function", content, functionCall?})
// into Gemini's `contents` format.
//
// Gemini 3.6 rejects a "function" role outright (valid roles are USER/MODEL/
// SYSTEM/...), so function results are replayed as a "user" turn even though
// they're stored under role "function" in the DB for bookkeeping.
//
// It also 400s a multi-turn request if a prior functionCall part doesn't
// carry back the same thoughtSignature it was issued with, so that's bundled
// into the stored functionCall JSON alongside {name, args, id} and split back
// out here.
//
// A functionCall that Gemini did NOT issue - one made by Groq or OpenRouter
// earlier in the same conversation, since the fallback chain can switch
// provider between turns - has no signature to send back, and Gemini would
// 400 it ("Function call is missing a thought_signature"). Google's
// documented placeholder for exactly that case (history from another model)
// is used instead, which turns the check off for that part.
const FOREIGN_THOUGHT_SIGNATURE = "skip_thought_signature_validator";

const toGeminiContents = (messages) =>
  messages.map((m) => {
    if (m.role === "function") {
      const { name, id, response } = JSON.parse(m.content);
      return { role: "user", parts: [{ functionResponse: { name, ...(id ? { id } : {}), response } }] };
    }
    if (m.functionCall) {
      const { thoughtSignature, ...functionCall } = m.functionCall;
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      parts.push({ functionCall, thoughtSignature: thoughtSignature || FOREIGN_THOUGHT_SIGNATURE });
      return { role: "model", parts };
    }
    return { role: m.role, parts: [{ text: m.content }] };
  });

const extractText = (response) =>
  (response.candidates?.[0]?.content?.parts || [])
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("\n");

const extractFunctionCallPart = (response) =>
  (response.candidates?.[0]?.content?.parts || []).find((p) => p.functionCall);

// Runs one turn of the tool-calling loop against Gemini. `messages` is the
// full neutral history (already including the newest turn); `functionDeclarations`
// is the same array teacherChatTools.js exports; `systemInstructionText` is
// plain text. Returns { text, functionCall: {name, args, id?, thoughtSignature?} | null } —
// the same normalized shape groqClient.js returns, so chat.js's tool-calling
// loop never needs to know which provider answered.
export const generateTurn = async ({ messages, functionDeclarations, systemInstructionText }) => {
  const result = await model.generateContent({
    contents: toGeminiContents(messages),
    tools: [{ functionDeclarations }],
    systemInstruction: { role: "system", parts: [{ text: systemInstructionText }] },
  });

  const response = result.response;
  const text = extractText(response);
  const functionCallPart = extractFunctionCallPart(response);

  if (!functionCallPart) return { text, functionCall: null };

  const { name, args, id } = functionCallPart.functionCall;
  return {
    text,
    functionCall: {
      name,
      args,
      ...(id ? { id } : {}),
      ...(functionCallPart.thoughtSignature ? { thoughtSignature: functionCallPart.thoughtSignature } : {}),
    },
  };
};
