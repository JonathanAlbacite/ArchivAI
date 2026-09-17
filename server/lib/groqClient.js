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
export const generateText = async (prompt) => {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return completion.choices[0]?.message?.content || "";
};

// Groq's tool schema is standard JSON Schema; Gemini's SchemaType values are
// already lowercase JSON-Schema-compatible strings ("string", "object", ...),
// so the only thing to strip is Gemini's non-standard `format: "enum"` marker
// (the `enum` array alone is all standard JSON Schema needs).
const stripGeminiFormatHints = (schema) => {
  if (!schema || typeof schema !== "object") return schema;
  const { format, ...rest } = schema;
  if (rest.properties) {
    rest.properties = Object.fromEntries(
      Object.entries(rest.properties).map(([key, value]) => [key, stripGeminiFormatHints(value)])
    );
  }
  if (rest.items) rest.items = stripGeminiFormatHints(rest.items);
  return rest;
};

// Adapts the shared Gemini-shaped functionDeclarations (from
// teacherChatTools.js) into OpenAI/Groq's `tools` array — no separate copy
// of the tool definitions is kept for this provider.
const toGroqTools = (functionDeclarations) =>
  functionDeclarations.map((fd) => ({
    type: "function",
    function: {
      name: fd.name,
      description: fd.description,
      parameters: fd.parameters ? stripGeminiFormatHints(fd.parameters) : { type: "object", properties: {} },
    },
  }));

// Converts the neutral message history (the same shape stored in
// ChatMessage rows: {role: "user"|"model"|"function", content, functionCall?})
// into OpenAI-style chat messages. Mirrors toGeminiContents in geminiClient.js.
const toGroqMessages = (messages, systemInstructionText) => {
  const out = [{ role: "system", content: systemInstructionText }];

  for (const m of messages) {
    if (m.role === "function") {
      const { id, name, response } = JSON.parse(m.content);
      out.push({ role: "tool", tool_call_id: id || name, content: JSON.stringify(response) });
      continue;
    }
    if (m.functionCall) {
      const { name, args, id } = m.functionCall;
      out.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: [
          { id: id || name, type: "function", function: { name, arguments: JSON.stringify(args || {}) } },
        ],
      });
      continue;
    }
    out.push({ role: m.role === "model" ? "assistant" : "user", content: m.content });
  }

  return out;
};

// Runs one turn of the tool-calling loop against Groq. `messages` is the
// full neutral history (already including the newest turn); `functionDeclarations`
// is the same array teacherChatTools.js exports; `systemInstructionText` is
// plain text. Returns { text, functionCall: {name, args, id} | null } —
// the same normalized shape geminiClient.js returns, so chat.js's
// tool-calling loop never needs to know which provider answered.
export const generateTurn = async ({ messages, functionDeclarations, systemInstructionText }) => {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: toGroqMessages(messages, systemInstructionText),
    tools: toGroqTools(functionDeclarations),
  });

  const message = completion.choices[0]?.message;
  const text = message?.content || "";
  const toolCall = message?.tool_calls?.[0];

  if (!toolCall) return { text, functionCall: null };

  return {
    text,
    functionCall: {
      name: toolCall.function.name,
      args: JSON.parse(toolCall.function.arguments || "{}"),
      id: toolCall.id,
    },
  };
};
