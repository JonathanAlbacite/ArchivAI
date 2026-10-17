import "dotenv/config";

// Fallback order: Groq first — its free tier is fast and generous. Gemini
// second as the backstop, despite its much tighter free-tier cap (5
// requests/minute, 20/day). OpenRouter last — routed to one fixed free model
// (see openrouterClient.js), it's the final safety net once both dedicated
// providers above have failed.
//
// Cerebras was evaluated for this chain but deliberately left out: as of
// mid-2026 it no longer offers a no-card free tier (a payment method is
// required even for trial credits), which doesn't fit a chain meant to lean
// on free-tier capacity.
//
// Every call in this file walks the chain top to bottom, so a teacher's
// request only ever fails once every provider in the chain has failed.
const PROVIDER_CHAIN = ["groq", "gemini", "openrouter"];

const PROVIDER_MODULES = {
  groq: () => import("./groqClient.js"),
  gemini: () => import("./geminiClient.js"),
  openrouter: () => import("./openrouterClient.js"),
};

// Each client module throws at import time if its own API key is missing, so
// providers are loaded individually and failures are caught here rather than
// left to blow up the whole module graph — a misconfigured/missing key for
// one provider should degrade the chain, not crash the server or silently
// hang every request that needs it.
const clients = {};
const initErrors = {};

for (const provider of PROVIDER_CHAIN) {
  try {
    clients[provider] = await PROVIDER_MODULES[provider]();
  } catch (err) {
    clients[provider] = null;
    initErrors[provider] = err.message;
  }
}

// The order the chain actually runs in for a given request — PROVIDER_CHAIN
// filtered down to providers that initialized successfully.
const availableProviders = PROVIDER_CHAIN.filter((provider) => clients[provider]);

// Startup log: makes a misconfigured .env (missing/invalid key) obvious
// immediately in server logs, instead of surfacing only much later as every
// request to that provider silently failing.
for (const provider of PROVIDER_CHAIN) {
  if (clients[provider]) {
    console.log(`[aiProviderChain] ${provider} client initialized OK`);
  } else {
    console.warn(
      `[aiProviderChain] ${provider} client NOT initialized (${initErrors[provider]}) — this provider will be skipped in the fallback chain`
    );
  }
}

if (availableProviders.length === 0) {
  throw new Error(
    `No AI provider could be initialized — every provider in the chain failed to start. ` +
      PROVIDER_CHAIN.map((provider) => `${provider}: ${initErrors[provider]}`).join("; ")
  );
}

console.log(
  `[aiProviderChain] fallback chain: ${availableProviders.join(" -> ")}` +
    (availableProviders.length < PROVIDER_CHAIN.length ? " (degraded — see warnings above)" : "")
);

// Hard ceiling on a single attempt against a single provider. This is what
// guarantees a stalled/unresponsive provider can never leave an Express
// request (and the chat widget's loading spinner) hanging indefinitely —
// every attempt either resolves, or times out and moves the chain on to the
// next provider, within a bounded amount of time.
const REQUEST_TIMEOUT_MS = 20000;

// Clue generation asks for a long answer (a whole array of questions and
// hints), which the models take longer to write than a chat turn, so it gets
// a longer ceiling per provider. A real Medium run timed out on two providers
// at 20 s during a retry and failed the whole request.
const GENERATION_TIMEOUT_MS = 40000;

class ProviderTimeoutError extends Error {
  constructor(provider, ms) {
    super(`AI provider (${provider}) did not respond within ${ms}ms`);
    this.name = "ProviderTimeoutError";
    this.isTimeout = true;
  }
}

const withTimeout = (promise, provider, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProviderTimeoutError(provider, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });

// A timeout, a 429, a 401/403 (bad/expired/missing key for this provider), a
// 402 (payment/quota exhausted — some OpenAI-compatible providers return
// this once a free quota runs out), or a 5xx/network blip all mean the same
// thing: THIS provider can't serve the request right now, but the same
// request would plausibly succeed against a different provider with its own
// credentials/quota — worth immediately trying the next one in the chain. A
// 400 (malformed request) or other client-side 4xx is different: that's a
// bug in what we're sending, which would fail identically against every
// provider, so it's surfaced immediately instead of being masked by a
// fallback that can't actually help.
//
// One 400 is treated as retryable despite that: Groq's tool-calling models
// occasionally emit invalid JSON (or stray text) as a function call's
// arguments and respond 400 with error.code "tool_use_failed" (groq-sdk's
// BadRequestError — see node_modules/groq-sdk/core/error.js). That's a
// per-generation glitch in what THIS provider's model produced, not a
// malformed request on our end, so — unlike other 400s — the same request
// plausibly succeeds against the next provider in the chain.
//
// A 413 is retryable for the same reason: Groq's free tier caps a request at
// 8000 tokens per minute (TPM) and answers a bigger one with 413 /
// error.code "rate_limit_exceeded" ("Request too large"). The teacher chat
// is what hits it - its history, system prompt and tool definitions together
// can pass that cap - and a provider with a larger limit can still serve it.
const isRetryableFailure = (err) => {
  if (err?.isTimeout) return true;
  const status = err?.status;
  const message = err?.message?.toLowerCase() || "";
  if (status === 402 || status === 429 || status === 401 || status === 403 || (status >= 500 && status < 600))
    return true;
  if (err?.error?.code === "tool_use_failed") return true;
  if (status === 413 || err?.error?.code === "rate_limit_exceeded" || err?.error?.error?.code === "rate_limit_exceeded")
    return true;
  if (/\b(402|429|401|403|500|502|503|504)\b/.test(message)) return true;
  if (/tool_use_failed|failed to parse tool call|rate_limit_exceeded|request too large/.test(message)) return true;
  return /rate limit|too many requests|invalid api key|api key not valid|unauthorized|payment required|quota|fetch failed|econnreset|etimedout|network/.test(
    message
  );
};

// Core fallback loop shared by generateText/callAIWithFallback below.
// `attempt(client)` must return a promise resolving to whatever that
// client's method returns; on success the result is annotated with which
// provider actually answered (for server-side logging only — this is never
// shown to the teacher). Throws a single, clear error only once every
// provider in the chain has been tried and failed.
const runChain = async (attempt, timeoutMs = REQUEST_TIMEOUT_MS) => {
  let lastErr;

  for (const provider of availableProviders) {
    const client = clients[provider];
    try {
      const result = await withTimeout(attempt(client), provider, timeoutMs);
      return { ...result, provider };
    } catch (err) {
      lastErr = err;
      if (!isRetryableFailure(err)) {
        console.error(`[aiProviderChain] ${provider} failed with a non-retryable error — not falling back:`, err.message);
        throw err;
      }
      console.log(
        `[aiProviderChain] ${provider} failed (${err.isTimeout ? "timeout" : err.status || "error"}: ${err.message}) — falling back to next provider`
      );
    }
  }

  throw new Error(
    `All AI providers in the fallback chain (${availableProviders.join(", ")}) failed. Last error: ${lastErr?.message}`
  );
};

// Plain single-turn text generation (no tools) — used for clue generation
// (teacherChatTools.js's generate_clues_from_notes tool, and the standalone
// /lesson-modules/:id/generate-clues route). Returns { text, provider }.
//
// A provider that answers with an empty reply counts as failed, so the chain
// moves on to the next provider instead of returning nothing (an empty reply was
// seen from OpenRouter after two timeouts).
export const generateText = (prompt) =>
  runChain(
    (client) =>
      client.generateText(prompt).then((text) => {
        if (!String(text ?? "").trim()) {
          const err = new Error("empty reply");
          err.status = 502;
          throw err;
        }
        return { text };
      }),
    GENERATION_TIMEOUT_MS
  );

// One turn of the teacher chatbot's tool-calling loop (see routes/chat.js).
// `messages` is the neutral message history ({role, content, functionCall?}),
// `tools` is the shared functionDeclarations array from teacherChatTools.js,
// `systemInstructionText` is plain text.
//
// Gemini's function-calling format and the OpenAI-compatible format shared
// by Groq/OpenRouter differ, but that translation already lives once per
// client (toGeminiContents/toGroqMessages+toGroqTools and their
// near-identical counterpart in openrouterClient.js, extractFunctionCallPart,
// etc.) — every client already normalizes its own SDK/HTTP response into the
// same { text, functionCall } shape. This just adds which provider produced
// it, so callers never need to know which one answered.
// Returns { text, functionCall: {name, args, id?} | null, provider }.
export const callAIWithFallback = ({ messages, tools, systemInstructionText }) =>
  runChain((client) => client.generateTurn({ messages, functionDeclarations: tools, systemInstructionText }));
