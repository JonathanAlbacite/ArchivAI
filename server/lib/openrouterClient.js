import "dotenv/config";

const apiKey = process.env.OPENROUTER_API_KEY;

console.log(`[openrouterClient] OPENROUTER_API_KEY present: ${Boolean(apiKey)}`);

if (!apiKey) {
  throw new Error(
    "OPENROUTER_API_KEY is not set. Add it to server/.env before starting the server."
  );
}

// OpenRouter exposes a fully OpenAI-compatible Chat Completions endpoint at
// openrouter.ai/api/v1 (https://openrouter.ai/docs/api_reference/overview).
// This uses a plain fetch instead of an SDK: groq-sdk (the only
// OpenAI-compatible client already in this project — see groqClient.js)
// hardcodes its request path as `${baseURL}/openai/v1/chat/completions`,
// which only lines up with Groq's own host, not this one.
const BASE_URL = "https://openrouter.ai/api/v1";

// OpenRouter fronts 280+ models; routing across them dynamically is
// unnecessary complexity for a single fallback slot, so this is pinned to
// one specific free model rather than an open "pick anything" router.
//
// Picked nvidia/nemotron-3-ultra-550b-a55b:free, re-verified live against
// OpenRouter's current catalog (GET /api/v1/models) as of 2026-09. Notes for
// whoever revisits this pick later:
//  - There is currently no Llama or Qwen :free model in OpenRouter's lineup
//    at all (that tier has been retired) — the "pick a Llama/Qwen :free
//    variant" default suggestion doesn't apply right now.
//  - Several free models score higher on the artificial_analysis
//    agentic_index benchmark, but don't actually work here: the
//    thinkingmachines/inkling(-small):free pair returns 403 "only available
//    on agentic harnesses" for a plain API call like this one (confirmed
//    live) — it's gated to coding-agent integrations, not general apps.
//  - inclusionai/ling-3.0-flash-fin:free also works and calls tools
//    correctly, but it's a finance-domain fine-tune, a worse general fit
//    than a general-purpose model for a teaching assistant.
//  - nemotron-3-ultra is general-purpose ("open frontier-reasoning and
//    orchestration model"), $0-priced, has a 1M-token context window, and
//    was confirmed live (twice) to return correct tool_calls.
// If this id ever stops resolving, re-check GET
// https://openrouter.ai/api/v1/models for a current :free model with
// "tools" in supported_parameters — and actually call it with a tool
// definition before committing, since supported_parameters alone doesn't
// guarantee the endpoint accepts plain API traffic.
const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

// Attribution-only headers OpenRouter uses for its public rankings page —
// https://openrouter.ai/docs/api_reference/overview. Neither is required
// for requests to work; update HTTP-Referer once this app has a real
// deployed URL.
const ATTRIBUTION_HEADERS = {
  "HTTP-Referer": "https://archivai.app",
  "X-Title": "ArchivAI",
};

class OpenRouterAPIError extends Error {
  constructor(status, body) {
    super(`${status} ${body}`);
    this.name = "OpenRouterAPIError";
    this.status = status;
  }
}

const postChatCompletion = async (body) => {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...ATTRIBUTION_HEADERS,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new OpenRouterAPIError(res.status, text);
  return JSON.parse(text);
};

// Plain single-turn text generation (no tools) — used for clue generation.
export const generateText = async (prompt) => {
  const completion = await postChatCompletion({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
  });
  return completion.choices?.[0]?.message?.content || "";
};

// Mirrors groqClient.js's stripGeminiFormatHints/toGroqTools/toGroqMessages —
// OpenRouter's tool schema and chat format are the same OpenAI-compatible
// shape Groq uses, so the translation logic is identical.
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
// teacherChatTools.js) into OpenAI's `tools` array — no separate copy of the
// tool definitions is kept for this provider.
const toOpenAITools = (functionDeclarations) =>
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
// into OpenAI-style chat messages. Mirrors toGroqMessages in groqClient.js.
const toOpenAIMessages = (messages, systemInstructionText) => {
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

// Runs one turn of the tool-calling loop against OpenRouter. `messages` is
// the full neutral history (already including the newest turn);
// `functionDeclarations` is the same array teacherChatTools.js exports;
// `systemInstructionText` is plain text. Returns
// { text, functionCall: {name, args, id} | null } — the same normalized
// shape every other provider client returns, so aiProviderChain.js never
// needs to know which provider answered.
export const generateTurn = async ({ messages, functionDeclarations, systemInstructionText }) => {
  const completion = await postChatCompletion({
    model: MODEL,
    messages: toOpenAIMessages(messages, systemInstructionText),
    tools: toOpenAITools(functionDeclarations),
  });

  const message = completion.choices?.[0]?.message;
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
