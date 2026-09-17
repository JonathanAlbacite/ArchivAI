import { SchemaType } from "@google/generative-ai";
import prisma from "./prisma.js";
import { generateText } from "./aiProviderChain.js";
import { createRoomForTeacher } from "./rooms.js";

const VALID_SCENES = ["Laboratory", "Library", "Tomb"];

const buildCluePrompt = (notes, scene) => `You are generating escape-room style clues for a classroom activity set entirely in the "${scene}" realm, based on the lesson notes below. Every clue must fit that single realm's theme — do not mix in other settings.

Return ONLY a valid JSON array (no markdown, no code fences, no commentary) of 5 to 8 clue objects. Each object must have exactly these fields:
- "clueText": a string presenting a riddle or question derived from the lesson notes, themed to the "${scene}" realm
- "answerText": a string with the correct answer

Lesson notes:
"""
${notes}
"""`;

const stripMarkdownFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

const parseClueResponse = (rawText) => {
  try {
    const parsed = JSON.parse(stripMarkdownFences(rawText));

    if (!Array.isArray(parsed) || parsed.length < 5 || parsed.length > 8) return null;

    const isValid = parsed.every(
      (c) =>
        typeof c.clueText === "string" &&
        c.clueText.trim() &&
        typeof c.answerText === "string" &&
        c.answerText.trim()
    );

    return isValid ? parsed : null;
  } catch {
    return null;
  }
};

// Tool definitions exposed to the teacher chatbot, in Gemini's SchemaType
// shape (SchemaType's values are already lowercase JSON-Schema-compatible
// strings). This is the single copy of these definitions — geminiClient.js
// uses it as-is, groqClient.js adapts it into OpenAI's `tools` format — so
// switching AI_PROVIDER never requires keeping two sets of tool definitions
// in sync.
export const functionDeclarations = [
  {
    name: "list_rooms_and_campaigns",
    description:
      "List all rooms owned by the current teacher, each with its campaigns (title, scene, published status). Use this to help the teacher find a room or campaign by name.",
  },
  {
    name: "get_campaign_details",
    description:
      "Get full details of one campaign the teacher owns, including its clues and answers.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        campaignId: { type: SchemaType.INTEGER, description: "The campaign's id" },
      },
      required: ["campaignId"],
    },
  },
  {
    name: "generate_clues_from_notes",
    description:
      "Generate candidate escape-room clues from lesson notes for the teacher to preview. Does NOT save anything — it only returns candidates for the teacher to review before they're applied to a campaign.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        notes: { type: SchemaType.STRING, description: "The lesson notes/content to base clues on" },
        scene: {
          type: SchemaType.STRING,
          format: "enum",
          enum: VALID_SCENES,
          description: "The scene theme every generated clue should fit",
        },
      },
      required: ["notes", "scene"],
    },
  },
  {
    name: "create_room",
    description:
      "Create a new Room for the teacher, with a freshly generated unique room code. This writes to the database. A campaign always belongs to a room — if the teacher wants a new campaign in a room that doesn't exist yet, call create_room first (and wait for it to be confirmed) before calling create_campaign with the new room's id.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "The room's name" },
        description: { type: SchemaType.STRING, description: "Optional room description" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_campaign",
    description:
      "Create a new campaign in one of the teacher's EXISTING rooms. This writes to the database. Requires a roomId — if the teacher hasn't specified an existing room (check via list_rooms_and_campaigns) or wants a brand-new room, use create_room first to create it, then call create_campaign with the resulting room's id.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        roomId: { type: SchemaType.INTEGER, description: "The id of the room to create the campaign in" },
        title: { type: SchemaType.STRING, description: "The campaign's title" },
        description: { type: SchemaType.STRING, description: "Optional campaign description" },
        scene: {
          type: SchemaType.STRING,
          format: "enum",
          enum: VALID_SCENES,
          description: "Optional scene theme for the campaign",
        },
        publish: {
          type: SchemaType.BOOLEAN,
          description:
            "Whether to publish the campaign immediately so students can see it (default true). Pass false to save it as a draft instead — drafts can still be edited later, but published campaigns are locked.",
        },
      },
      required: ["roomId", "title"],
    },
  },
  {
    name: "apply_generated_clues",
    description:
      "Save a set of clues (question/answer pairs, typically ones previously previewed via generate_clues_from_notes) onto a campaign the teacher owns. This writes to the database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        campaignId: { type: SchemaType.INTEGER, description: "The campaign to attach clues to" },
        clues: {
          type: SchemaType.ARRAY,
          description: "The clues to save, in order",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question: { type: SchemaType.STRING },
              answer: { type: SchemaType.STRING },
            },
            required: ["question", "answer"],
          },
        },
      },
      required: ["campaignId", "clues"],
    },
  },
];

export const READ_TOOL_NAMES = new Set([
  "list_rooms_and_campaigns",
  "get_campaign_details",
  "generate_clues_from_notes",
]);

export const WRITE_TOOL_NAMES = new Set(["create_room", "create_campaign", "apply_generated_clues"]);

// Every tool is scoped to the authenticated teacher's own data — args never
// carry a teacherId, and each implementation re-derives ownership from the DB.
export const toolImplementations = {
  list_rooms_and_campaigns: async (_args, teacherId) => {
    const rooms = await prisma.room.findMany({
      where: { teacherId },
      include: {
        campaigns: {
          select: { id: true, title: true, description: true, scene: true, isPublished: true },
        },
      },
    });
    return { rooms };
  },

  get_campaign_details: async (args, teacherId) => {
    const campaignId = parseInt(args.campaignId);
    if (!Number.isInteger(campaignId)) return { error: "campaignId must be an integer" };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        room: { select: { teacherId: true, name: true } },
        clues: { orderBy: { orderNumber: "asc" } },
      },
    });

    if (!campaign || campaign.room.teacherId !== teacherId) return { error: "Campaign not found" };

    const { room, ...rest } = campaign;
    return { ...rest, roomName: room.name };
  },

  generate_clues_from_notes: async (args) => {
    const scene = VALID_SCENES.find((s) => s.toLowerCase() === (args.scene || "").toLowerCase());
    if (!scene) return { error: `scene must be one of ${VALID_SCENES.join(", ")}` };
    if (!args.notes || !args.notes.trim()) return { error: "notes is required" };

    const prompt = buildCluePrompt(args.notes, scene);

    try {
      const { text: rawText, provider } = await generateText(prompt);
      console.log(`[teacherChatTools] generate_clues_from_notes answered via ${provider}`);
      let clues = parseClueResponse(rawText);

      if (!clues) {
        const correctivePrompt = `${prompt}\n\nYour previous response was not a valid JSON array matching the required shape. Respond again with ONLY a valid JSON array, no markdown, no commentary.`;
        const { text: retryText } = await generateText(correctivePrompt);
        clues = parseClueResponse(retryText);
      }

      if (!clues) return { error: "The AI returned malformed JSON after retry" };

      return { scene, clues };
    } catch (err) {
      return { error: `AI request failed: ${err.message}` };
    }
  },

  create_room: async (args, teacherId) => {
    if (!args.name || !args.name.trim()) return { error: "name is required" };

    const room = await createRoomForTeacher(teacherId, {
      name: args.name,
      description: args.description,
    });

    return { room };
  },

  create_campaign: async (args, teacherId) => {
    const roomId = parseInt(args.roomId);
    if (!Number.isInteger(roomId) || !args.title) return { error: "roomId and title are required" };

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.teacherId !== teacherId) return { error: "Room not found" };

    // Defaults to published, matching the manual "Create Campaign" flow
    // (SpellBookModal.jsx)'s default — a campaign the teacher just finished
    // setting up isn't meant to sit invisible as an unpublished draft unless
    // they actually ask for a draft (publish: false).
    const campaign = await prisma.campaign.create({
      data: {
        title: args.title,
        roomId,
        description: args.description,
        scene: args.scene || "",
        isPublished: args.publish !== false,
      },
    });

    return { campaign };
  },

  apply_generated_clues: async (args, teacherId) => {
    const campaignId = parseInt(args.campaignId);
    const clues = args.clues;

    if (!Number.isInteger(campaignId) || !Array.isArray(clues) || clues.length === 0)
      return { error: "campaignId and a non-empty clues array are required" };
    if (clues.some((c) => !c.question || !c.answer))
      return { error: "Each clue needs a question and answer" };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { room: { select: { teacherId: true } } },
    });
    if (!campaign || campaign.room.teacherId !== teacherId) return { error: "Campaign not found" };

    const existingCount = await prisma.clue.count({ where: { campaignId } });

    await prisma.clue.createMany({
      data: clues.map((c, i) => ({
        campaignId,
        orderNumber: existingCount + i + 1,
        question: c.question,
        answer: c.answer,
      })),
    });

    const allClues = await prisma.clue.findMany({
      where: { campaignId },
      orderBy: { orderNumber: "asc" },
    });

    return { clues: allClues };
  },
};
