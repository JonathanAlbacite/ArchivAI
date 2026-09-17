import express from "express";
import prisma from "../lib/prisma.js";
import { callAIWithFallback } from "../lib/aiProviderChain.js";
import { protect, teacherOnly } from "../middleware/auth.js";
import {
  functionDeclarations,
  READ_TOOL_NAMES,
  WRITE_TOOL_NAMES,
  toolImplementations,
} from "../lib/teacherChatTools.js";

const router = express.Router();

const MAX_TOOL_CALLS_PER_TURN = 4;
const TOO_MANY_STEPS_MESSAGE =
  "That's a lot to do in one go — let's break this into smaller steps. Could you ask for the next part separately?";

// Plain text — each provider client (geminiClient.js/groqClient.js) wraps
// this in whatever shape its own API expects (Gemini's systemInstruction
// object vs a leading "system" chat message for Groq).
const SYSTEM_INSTRUCTION_TEXT = `You are the ArchivAI teaching assistant, helping a teacher manage their rooms, campaigns, and clues through conversation.

Keep your own tone plain, direct, and professional — you are a normal helpful assistant, not a character in the escape-room game's story. That in-game theming (realms, clues, etc.) is content you help the teacher build for their students, not a persona for you to adopt.

You are the assistant for ArchivAI, part of the capstone project "The Archivist's Legacy: Keepers of the Forgotten Vaults" — a web-based 3D puzzle-exploration educational game that lets teachers configure lesson content (Story, Clues, Passwords) for students to explore and solve inside a Unity-based 3D game. This was built by a BSIT team at the College of Computing and Informatics, Iloilo Science and Technology University (La Paz, Iloilo City): Jonathan C. Albacite, Fergus Jerome O. Amado, Joshua E. Buencuchillo, Irvin Charles D. Flores, Jovet T. Quiñones, and Jose Marco C. Umayao. ArchivAI adds AI-assisted clue generation and an AI assistant on top of that base system. Only mention this background when the teacher actually asks about the project, the team, or who built this — don't volunteer it unprompted in unrelated conversations.

Use the read-only tools (list_rooms_and_campaigns, get_campaign_details, generate_clues_from_notes) freely to look things up or preview generated content.

Rooms and campaigns are separate steps: a campaign always belongs to an existing room. If the teacher wants a campaign in a room that doesn't exist yet, first call create_room to create that room, wait for the teacher to confirm it, and only then call create_campaign with the new room's id. Never guess a roomId — look it up with list_rooms_and_campaigns or create it first.

create_room, create_campaign, and apply_generated_clues make real changes, so before calling any of them, always include a short natural-language sentence explaining exactly what you're about to do (e.g. "I'll create a new room called X", "I'll create a new campaign called X in room Y", or "I'll save these 6 clues to campaign Z"), alongside the function call. The teacher will be asked to confirm before it actually happens.

create_campaign publishes the campaign immediately by default (students can see it right away). If the teacher wants to keep working on it first, pass publish: false to save it as a draft instead — drafts can still be edited (title/description/scene) later via the app, but published campaigns are locked. If it's not clear which the teacher wants, ask.

A teacher can also upload a lesson document. When you see a message starting with [Uploaded lesson notes: "<filename>"], the text between the triple quotes is that document's extracted content. If the teacher hasn't already told you which scene (Laboratory, Library, or Tomb) to theme the clues to, ask before calling generate_clues_from_notes with that content as the notes argument.`;

// A teacher attaches a lesson document via the widget's "+" button or drag-
// and-drop, which uploads it through POST /api/lesson-modules/upload (its
// text extracted immediately) and stages it in the input as a removable
// chip. Nothing reaches the model until the teacher hits send, at which
// point the attached LessonModule's extracted text is folded into that
// turn's message using this same tagged format, optionally followed by
// whatever the teacher typed alongside it.
const buildNotesUploadMessage = (filename, text, userMessage) => {
  const base = `[Uploaded lesson notes: "${filename}"]\n\n"""\n${text}\n"""`;
  return userMessage ? `${base}\n\n${userMessage}` : base;
};

// Find a lesson module and confirm the requesting teacher owns it
const findOwnedLessonModule = async (id, teacherId) => {
  const lessonModule = await prisma.lessonModule.findUnique({ where: { id } });
  if (!lessonModule) return { error: 404, message: "Lesson module not found" };
  if (lessonModule.teacherId !== teacherId) return { error: 403, message: "Access denied" };
  return { lessonModule };
};

// Find a chat conversation and confirm the requesting teacher owns it
const findOwnedConversation = async (id, teacherId) => {
  const conversation = await prisma.chatConversation.findUnique({ where: { id } });
  if (!conversation) return { error: 404, message: "Conversation not found" };
  if (conversation.teacherId !== teacherId) return { error: 403, message: "Access denied" };
  return { conversation };
};

// ChatMessage rows already are the neutral message shape both provider
// clients expect ({role, content, functionCall?}) — this just drops the
// extra DB columns (id, conversationId, createdAt) before handing rows to
// aiProvider.generateTurn.
const dbRowToMessage = (m) => ({ role: m.role, content: m.content, functionCall: m.functionCall });

// Collapses stored ChatMessage rows into the same shape the widget builds up
// live during a session: one bubble per user turn, one bubble per model turn
// (its final text reply, or a still-open pendingAction). Intermediate
// read-tool call/response rows are plumbing, not a separate bubble — the
// widget never showed those live either, only the turn's eventual outcome.
const buildDisplayMessages = (messages) => {
  const display = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];

    if (m.role === "user") {
      display.push({ role: "user", content: m.content });
      continue;
    }

    if (m.role === "function") continue;

    if (!m.functionCall) {
      display.push({ role: "model", content: m.content });
      continue;
    }

    if (!WRITE_TOOL_NAMES.has(m.functionCall.name)) continue;

    const next = messages[i + 1];
    if (next?.role === "function") {
      let cancelled = false;
      try {
        cancelled = !!JSON.parse(next.content)?.response?.cancelled;
      } catch {
        // malformed stored payload — treat as resolved/confirmed rather than blocking history load
      }
      display.push({ role: "model", content: m.content, resolved: cancelled ? "cancelled" : "confirmed" });
    } else {
      display.push({
        role: "model",
        content: m.content,
        pendingAction: { name: m.functionCall.name, args: m.functionCall.args },
      });
    }
  }

  return display;
};

// Teacher: Reload a conversation's full history (used to resume a chat after
// a page refresh or when reopening the widget in a new session)
router.get("/:conversationId/messages", protect, teacherOnly, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);

  try {
    const { error, message: errMessage } = await findOwnedConversation(conversationId, req.user.id);
    if (error) return res.status(error).json({ message: errMessage });

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { id: "asc" },
    });

    res.json({ messages: buildDisplayMessages(messages) });
  } catch (err) {
    console.error("[chat] unhandled route error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Start a new chat conversation
router.post("/start", protect, teacherOnly, async (req, res) => {
  try {
    const conversation = await prisma.chatConversation.create({ data: { teacherId: req.user.id } });
    res.status(201).json({ conversationId: conversation.id });
  } catch (err) {
    console.error("[chat] unhandled route error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Drives the tool-calling loop from a given neutral `messages` array (already
// carrying full history plus whatever new turn triggered this call): executes
// read tools inline, saving each intermediate turn, and stops on a write tool
// (returned as a pendingAction for teacher confirmation) or plain text
// (returned as a reply). Shared by processTurn (a fresh user message) and
// resolvePendingAction (continuing after a confirmed/declined write call) so
// a chained write — e.g. create_room followed immediately by create_campaign —
// surfaces as a new pendingAction instead of being silently dropped.
//
// callAIWithFallback (aiProviderChain.js) hides which model actually
// answers — Groq or Gemini, falling back automatically if the first one hits
// a rate limit or times out — behind this same neutral {text, functionCall}
// shape, so nothing below needs to branch on the provider.
const runToolLoop = async (conversationId, teacherId, messages) => {
  let callCount = 0;

  while (true) {
    let result;
    const startedAt = Date.now();
    try {
      result = await callAIWithFallback({ messages, tools: functionDeclarations, systemInstructionText: SYSTEM_INSTRUCTION_TEXT });
      console.log(
        `[chat] callAIWithFallback resolved via ${result.provider} in ${Date.now() - startedAt}ms (conversation ${conversationId})`
      );
    } catch (err) {
      console.error(`[chat] callAIWithFallback failed after ${Date.now() - startedAt}ms (conversation ${conversationId}):`, err);
      return { error: 502, message: "AI request failed", detail: err.message };
    }

    const { text, functionCall } = result;

    if (!functionCall) {
      await prisma.chatMessage.create({ data: { conversationId, role: "model", content: text } });
      return { reply: text };
    }

    callCount += 1;
    if (callCount > MAX_TOOL_CALLS_PER_TURN) {
      await prisma.chatMessage.create({
        data: { conversationId, role: "model", content: TOO_MANY_STEPS_MESSAGE },
      });
      return { reply: TOO_MANY_STEPS_MESSAGE };
    }

    const { name, args, id: callId } = functionCall;

    if (WRITE_TOOL_NAMES.has(name)) {
      await prisma.chatMessage.create({
        data: { conversationId, role: "model", content: text, functionCall },
      });
      return {
        pendingAction: { name, args },
        summary: text || `I'd like to run ${name} with ${JSON.stringify(args)}.`,
      };
    }

    if (!READ_TOOL_NAMES.has(name)) {
      return { error: 502, message: `The AI requested an unknown tool "${name}"` };
    }

    await prisma.chatMessage.create({
      data: { conversationId, role: "model", content: text, functionCall },
    });

    const toolResult = await toolImplementations[name](args || {}, teacherId);

    const functionMessageContent = JSON.stringify({ name, ...(callId ? { id: callId } : {}), response: toolResult });
    await prisma.chatMessage.create({
      data: { conversationId, role: "function", content: functionMessageContent },
    });

    messages = [
      ...messages,
      { role: "model", content: text, functionCall },
      { role: "function", content: functionMessageContent },
    ];
  }
};

// Saves the given text as the user's turn and runs it through the tool-calling loop.
const processTurn = async (conversationId, teacherId, userMessageText) => {
  const history = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { id: "asc" },
  });

  await prisma.chatMessage.create({ data: { conversationId, role: "user", content: userMessageText } });

  const messages = [...history.map(dbRowToMessage), { role: "user", content: userMessageText }];

  return runToolLoop(conversationId, teacherId, messages);
};

// Teacher: Send a message in a conversation, optionally with a lesson
// document staged beforehand (via POST /api/lesson-modules/upload) attached
// by its lessonModuleId — its extracted text is folded into this turn's
// message alongside whatever the teacher typed. Executes read tool calls
// inline; pauses on write tool calls for confirmation via /confirm-action.
router.post("/:conversationId/message", protect, teacherOnly, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);
  const { message, lessonModuleId } = req.body;
  const trimmedMessage = (message || "").trim();

  if (!trimmedMessage && !lessonModuleId)
    return res.status(400).json({ message: "message or lessonModuleId is required" });

  try {
    const { error, message: errMessage } = await findOwnedConversation(conversationId, req.user.id);
    if (error) return res.status(error).json({ message: errMessage });

    let userMessageText = trimmedMessage;

    if (lessonModuleId) {
      const parsedId = parseInt(lessonModuleId);
      const { lessonModule, error: lmError, message: lmMessage } = await findOwnedLessonModule(parsedId, req.user.id);
      if (lmError) return res.status(lmError).json({ message: lmMessage });

      if (!lessonModule.extractedText?.trim())
        return res.status(422).json({ message: "That lesson module has no extracted text" });

      userMessageText = buildNotesUploadMessage(
        lessonModule.originalFilename,
        lessonModule.extractedText,
        trimmedMessage || undefined
      );
    }

    const outcome = await processTurn(conversationId, req.user.id, userMessageText);
    if (outcome.error) return res.status(outcome.error).json({ message: outcome.message, error: outcome.detail });

    res.json(outcome);
  } catch (err) {
    console.error("[chat] unhandled route error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Shared by confirm-action and cancel-action: finds the pending write call at
// the end of the conversation, resolves it (by actually running the tool, or
// by recording a decline), feeds the result back to the AI, and saves both turns.
const resolvePendingAction = async (conversationId, teacherId, { execute }) => {
  const history = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { id: "asc" },
  });

  const lastMessage = history[history.length - 1];
  if (!lastMessage?.functionCall || !WRITE_TOOL_NAMES.has(lastMessage.functionCall.name))
    return { error: 400, message: "No pending action to resolve" };

  const { name, args, id } = lastMessage.functionCall;
  const toolResult = execute
    ? await toolImplementations[name](args || {}, teacherId)
    : { cancelled: true, message: "The teacher declined this action." };

  const functionMessageContent = JSON.stringify({ name, ...(id ? { id } : {}), response: toolResult });
  await prisma.chatMessage.create({
    data: { conversationId, role: "function", content: functionMessageContent },
  });

  const messages = [...history.map(dbRowToMessage), { role: "function", content: functionMessageContent }];

  const outcome = await runToolLoop(conversationId, teacherId, messages);
  return { ...outcome, result: toolResult };
};

// Teacher: Confirm and actually execute a pending write action from the last message
router.post("/:conversationId/confirm-action", protect, teacherOnly, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);

  try {
    const { error, message: errMessage } = await findOwnedConversation(conversationId, req.user.id);
    if (error) return res.status(error).json({ message: errMessage });

    const outcome = await resolvePendingAction(conversationId, req.user.id, { execute: true });
    if (outcome.error) return res.status(outcome.error).json({ message: outcome.message, error: outcome.detail });

    res.json(
      outcome.pendingAction
        ? { pendingAction: outcome.pendingAction, summary: outcome.summary, result: outcome.result }
        : { reply: outcome.reply, result: outcome.result }
    );
  } catch (err) {
    console.error("[chat] unhandled route error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Decline a pending write action from the last message (no DB write happens)
router.post("/:conversationId/cancel-action", protect, teacherOnly, async (req, res) => {
  const conversationId = parseInt(req.params.conversationId);

  try {
    const { error, message: errMessage } = await findOwnedConversation(conversationId, req.user.id);
    if (error) return res.status(error).json({ message: errMessage });

    const outcome = await resolvePendingAction(conversationId, req.user.id, { execute: false });
    if (outcome.error) return res.status(outcome.error).json({ message: outcome.message, error: outcome.detail });

    res.json(
      outcome.pendingAction
        ? { pendingAction: outcome.pendingAction, summary: outcome.summary }
        : { reply: outcome.reply }
    );
  } catch (err) {
    console.error("[chat] unhandled route error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
