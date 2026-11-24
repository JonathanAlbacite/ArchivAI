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
