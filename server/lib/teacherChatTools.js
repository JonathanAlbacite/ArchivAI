import fs from "fs/promises";
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
  {
    name: "update_room",
    description:
      "Rename an EXISTING room and/or change its description. This writes to the database. Use this — never create_room — whenever the teacher says 'rename', 'edit', 'update', or 'change the name/description of' a room that already exists. Look up its id first with list_rooms_and_campaigns if you don't already have it.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        roomId: { type: SchemaType.INTEGER, description: "The id of the existing room to update" },
        name: { type: SchemaType.STRING, description: "The room's new name" },
        description: { type: SchemaType.STRING, description: "The room's new description" },
      },
      required: ["roomId"],
    },
  },
  {
    name: "update_campaign",
    description:
      "Edit an EXISTING, still-unpublished campaign's title, description, and/or scene. This writes to the database. Use this — never create_campaign — whenever the teacher says 'rename', 'edit', 'update', or 'change' about a campaign that already exists. Published campaigns can't be edited this way (check isPublished via list_rooms_and_campaigns or get_campaign_details first); tell the teacher it's locked instead of calling this. Look up the campaign's id first if you don't already have it.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        campaignId: { type: SchemaType.INTEGER, description: "The id of the existing campaign to update" },
        title: { type: SchemaType.STRING, description: "The campaign's new title" },
        description: { type: SchemaType.STRING, description: "The campaign's new description" },
        scene: {
          type: SchemaType.STRING,
          format: "enum",
          enum: VALID_SCENES,
          description: "The campaign's new scene theme",
        },
      },
      required: ["campaignId"],
    },
  },
  {
    name: "delete_room",
    description:
      "Permanently delete a room the teacher owns, along with ALL of its campaigns, clues, students, and play history. This writes to the database and CANNOT be undone. Use this whenever the teacher says 'delete' or 'remove' a room. Look up its id first with list_rooms_and_campaigns if you don't already have it.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        roomId: { type: SchemaType.INTEGER, description: "The id of the room to delete" },
      },
      required: ["roomId"],
    },
  },
  {
    name: "delete_campaign",
    description:
      "Permanently delete a campaign the teacher owns, along with all of its clues and play history. This writes to the database and CANNOT be undone. Use this whenever the teacher says 'delete' or 'remove' a campaign. Look up its id first with list_rooms_and_campaigns if you don't already have it.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        campaignId: { type: SchemaType.INTEGER, description: "The id of the campaign to delete" },
      },
      required: ["campaignId"],
    },
  },
];

export const READ_TOOL_NAMES = new Set([
  "list_rooms_and_campaigns",
  "get_campaign_details",
  "generate_clues_from_notes",
]);

export const WRITE_TOOL_NAMES = new Set([
  "create_room",
  "create_campaign",
  "apply_generated_clues",
  "update_room",
  "update_campaign",
  "delete_room",
  "delete_campaign",
]);

// delete_room/delete_campaign are irreversible, so their teacher-facing
// confirmation summary is computed here from the DB rather than left to the
// model's own explanatory text (chat.js's SYSTEM_INSTRUCTION_TEXT asks the
// model to explain itself before any write call, but that's still just
// prose it generates — for a destructive action, what gets deleted needs to
// be stated correctly every time, not just usually). Returns null for every
// other tool, so chat.js falls back to the model's own text unchanged.
export const buildDeleteConfirmationSummary = async (name, args, teacherId) => {
  if (name === "delete_room") {
    const roomId = parseInt(args?.roomId);
    if (!Number.isInteger(roomId)) return null;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { _count: { select: { campaigns: true } } },
    });
    if (!room || room.teacherId !== teacherId) return null;

    const count = room._count.campaigns;
    return `This will permanently delete room "${room.name}" and its ${count} ${count === 1 ? "campaign" : "campaigns"} — this cannot be undone.`;
  }

  if (name === "delete_campaign") {
    const campaignId = parseInt(args?.campaignId);
    if (!Number.isInteger(campaignId)) return null;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { room: { select: { teacherId: true } }, _count: { select: { clues: true } } },
    });
    if (!campaign || campaign.room.teacherId !== teacherId) return null;

    const count = campaign._count.clues;
    return `This will permanently delete campaign "${campaign.title}" and its ${count} ${count === 1 ? "clue" : "clues"} — this cannot be undone.`;
  }

  return null;
};

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

  update_room: async (args, teacherId) => {
    const roomId = parseInt(args.roomId);
    if (!Number.isInteger(roomId)) return { error: "roomId must be an integer" };
    if (args.name !== undefined && !args.name.trim()) return { error: "name cannot be empty" };

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.teacherId !== teacherId) return { error: "Room not found" };

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(args.name !== undefined && { name: args.name }),
        ...(args.description !== undefined && { description: args.description }),
      },
    });

    return { room: updated };
  },

  update_campaign: async (args, teacherId) => {
    const campaignId = parseInt(args.campaignId);
    if (!Number.isInteger(campaignId)) return { error: "campaignId must be an integer" };
    if (args.title !== undefined && !args.title.trim()) return { error: "title cannot be empty" };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { room: { select: { teacherId: true } } },
    });
    if (!campaign || campaign.room.teacherId !== teacherId) return { error: "Campaign not found" };
    if (campaign.isPublished) return { error: "Published campaigns can't be edited" };

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(args.title !== undefined && { title: args.title }),
        ...(args.description !== undefined && { description: args.description }),
        ...(args.scene !== undefined && { scene: args.scene }),
      },
    });

    return { campaign: updated };
  },

  // The room's dependents (campaigns, clues, students, sessions) are cleaned
  // up by the schema's onDelete: Cascade relations (see schema.prisma) —
  // this only needs to delete the Room row itself.
  delete_room: async (args, teacherId) => {
    const roomId = parseInt(args.roomId);
    if (!Number.isInteger(roomId)) return { error: "roomId must be an integer" };

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { campaigns: { select: { attachmentPath: true } } },
    });
    if (!room || room.teacherId !== teacherId) return { error: "Room not found" };

    await prisma.room.delete({ where: { id: roomId } });

    // Its campaigns' attachment files (if any) aren't DB rows, so they're
    // removed from disk separately, after the cascade delete succeeds.
    await Promise.all(
      room.campaigns.filter((c) => c.attachmentPath).map((c) => fs.unlink(c.attachmentPath).catch(() => {}))
    );

    return { deletedRoomId: roomId, name: room.name };
  },

  // The campaign's dependents (clues, sessions, attempts) are cleaned up by
  // the schema's onDelete: Cascade relations (see schema.prisma) — this
  // only needs to delete the Campaign row itself.
  delete_campaign: async (args, teacherId) => {
    const campaignId = parseInt(args.campaignId);
    if (!Number.isInteger(campaignId)) return { error: "campaignId must be an integer" };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { room: { select: { teacherId: true } } },
    });
    if (!campaign || campaign.room.teacherId !== teacherId) return { error: "Campaign not found" };

    await prisma.campaign.delete({ where: { id: campaignId } });
    if (campaign.attachmentPath) await fs.unlink(campaign.attachmentPath).catch(() => {});

    return { deletedCampaignId: campaignId, title: campaign.title };
  },
};
