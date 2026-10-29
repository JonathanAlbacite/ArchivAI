import fs from "fs/promises";
import { SchemaType } from "@google/generative-ai";
import prisma from "./prisma.js";
import {
  generateCluesForScene,
  normalizeDifficulty,
  DIFFICULTIES,
  getPublishedSlotTypes,
  validateCluesAgainstTemplate,
  hasPlayHistory,
} from "./clueTemplates.js";
import { createRoomForTeacher } from "./rooms.js";

const VALID_SCENES = ["Laboratory", "Library", "Tomb"];

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
    name: "get_question_set",
    description:
      "Get the question set a scene's campaigns must follow: the published vault template's fixed list of clue pages, each a type (NORMAL, MULTICHOICE or COMBO), in order. Use this before writing or fitting clues by hand, so each clue matches its page.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        scene: {
          type: SchemaType.STRING,
          format: "enum",
          enum: VALID_SCENES,
          description: "The scene whose question set to look up",
        },
      },
      required: ["scene"],
    },
  },
  {
    name: "generate_clues_from_notes",
    description:
      "Generate candidate questions from lesson notes for the teacher to preview, following the scene's question set (one per page, each with the right type, including decoys for MultiChoice/Combo pages). The questions are based only on the notes; nothing is added from the game or the scene. Normal (Identification) answers are short terms that fit the Dial. Each question is one short, plain sentence and comes with a hint (the note field): a short statement of the fact, using only the notes, that contains the answer (never the question followed by the answer). Does NOT save anything — it only returns candidates for the teacher to review before they're applied to a campaign.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        notes: { type: SchemaType.STRING, description: "The lesson notes/content to base clues on" },
        scene: {
          type: SchemaType.STRING,
          format: "enum",
          enum: VALID_SCENES,
          description: "The scene whose question set to follow (it sets the number and types of questions, not their content)",
        },
        difficulty: {
          type: SchemaType.STRING,
          format: "enum",
          enum: DIFFICULTIES,
          description:
            "How hard the questions and hints are: easy (direct, in the document's words), medium (question reworded with synonyms, hint of one or two sentences) or hard (question that describes the answer, hint of two or three reworded sentences, near-miss decoys). Use the level the teacher chose; if none was chosen, use easy.",
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
      "Save a campaign's COMPLETE clue set (typically the clues previewed via generate_clues_from_notes). This writes to the database. The set must match the campaign's scene's question set exactly: one clue per page, in the same order and type (see get_question_set). The campaign needs a scene. It sets the campaign's first clues, or replaces the clues of a draft nobody has played yet; a published campaign that already has clues can't be changed.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        campaignId: { type: SchemaType.INTEGER, description: "The campaign to attach clues to" },
        clues: {
          type: SchemaType.ARRAY,
          description: "The whole clue set, one entry per page of the question set, in the question set's order",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              type: {
                type: SchemaType.STRING,
                format: "enum",
                enum: ["NORMAL", "MULTICHOICE", "COMBO"],
                description: "Must equal that page's type in the question set",
              },
              question: { type: SchemaType.STRING },
              note: {
                type: SchemaType.STRING,
                description:
                  "The question's hint: a short sentence from the lesson notes that contains the answer, exactly as returned by generate_clues_from_notes. Optional.",
              },
              answers: {
                type: SchemaType.ARRAY,
                description:
                  "Every answer option, correct ones first. NORMAL: exactly 1, correct. MULTICHOICE: exactly 4 - 1 correct and 3 decoys. COMBO: 1 or more correct plus any decoys.",
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    text: { type: SchemaType.STRING },
                    isCorrect: { type: SchemaType.BOOLEAN, description: "true for a correct answer, false for a decoy" },
                  },
                  required: ["text", "isCorrect"],
                },
              },
            },
            required: ["type", "question", "answers"],
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
  "get_question_set",
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
        clues: { orderBy: { orderNumber: "asc" }, include: { answers: { orderBy: { order: "asc" } } } },
      },
    });

    if (!campaign || campaign.room.teacherId !== teacherId) return { error: "Campaign not found" };

    // attachmentPath is a server-local filesystem path, so it is left out of what the model sees.
    const { room, attachmentPath, ...rest } = campaign;
    return { ...rest, roomName: room.name };
  },

  get_question_set: async (args) => {
    const scene = VALID_SCENES.find((s) => s.toLowerCase() === (args.scene || "").toLowerCase());
    if (!scene) return { error: `scene must be one of ${VALID_SCENES.join(", ")}` };

    const { slotTypes, error } = await getPublishedSlotTypes(scene);
    if (error) return { error };

    return {
      scene,
      pages: slotTypes.map((type, i) => ({ page: i + 1, type })),
      rules: {
        NORMAL: "1 answer, marked correct",
        MULTICHOICE: "4 answers: 1 correct + 3 decoys",
        COMBO: "1 or more correct answers + any number of decoys",
      },
    };
  },

  // Drafts one clue per page of the scene's question set, each in that
  // page's type (see lib/clueTemplates.js) - the same generator the campaign
  // editor's "Generate Clues from a Lesson" uses.
  generate_clues_from_notes: async (args) => {
    const scene = VALID_SCENES.find((s) => s.toLowerCase() === (args.scene || "").toLowerCase());
    if (!scene) return { error: `scene must be one of ${VALID_SCENES.join(", ")}` };
    if (!args.notes || !args.notes.trim()) return { error: "notes is required" };

    const generated = await generateCluesForScene(
      args.notes,
      scene,
      "generate_clues_from_notes",
      normalizeDifficulty(args.difficulty)
    );
    if (generated.error) return { error: generated.message };

    return {
      scene,
      difficulty: generated.difficulty,
      clues: generated.clues.map((c) => ({ type: c.type, question: c.clueText, note: c.note, answers: c.answers })),
    };
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

    if (!Number.isInteger(campaignId) || !Array.isArray(args.clues) || args.clues.length === 0)
      return { error: "campaignId and a non-empty clues array are required" };

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { room: { select: { teacherId: true } } },
    });
    if (!campaign || campaign.room.teacherId !== teacherId) return { error: "Campaign not found" };
    if (!campaign.scene)
      return { error: "This campaign has no scene yet, so its question set can't be determined" };

    // A bare {question, answer} pair is still accepted as a Normal clue.
    const clues = args.clues.map((c) => ({
      type: c.type || "NORMAL",
      question: c.question,
      note: typeof c.note === "string" && c.note.trim() ? c.note.trim() : null,
      answers: Array.isArray(c.answers) ? c.answers : c.answer ? [{ text: c.answer, isCorrect: true }] : [],
    }));

    // The clue set is fixed by the scene's question set - same checks as the
    // campaign editor (routes/campaigns.js).
    const templateError = await validateCluesAgainstTemplate(campaign.scene, clues);
    if (templateError) return { error: templateError };

    // The set is saved whole, so any clues already there are replaced - only
    // allowed on a draft nobody has played, since deleting clues also deletes
    // the attempts recorded against them.
    const existingCount = await prisma.clue.count({ where: { campaignId } });
    if (existingCount > 0) {
      if (campaign.isPublished)
        return { error: "This published campaign already has clues and can't be changed" };
      if (await hasPlayHistory(campaignId))
        return { error: "This campaign already has play history, so its clues can't be replaced" };
      await prisma.clue.deleteMany({ where: { campaignId } });
    }

    // A clue's answers live in their own ClueAnswer rows (see schema.prisma),
    // which createMany can't create, hence one create per clue.
    for (let i = 0; i < clues.length; i++) {
      await prisma.clue.create({
        data: {
          campaignId,
          orderNumber: i + 1,
          type: clues[i].type,
          question: clues[i].question,
          note: clues[i].note,
          answers: {
            create: clues[i].answers.map((a, j) => ({ text: a.text, isCorrect: !!a.isCorrect, order: j })),
          },
        },
      });
    }

    const allClues = await prisma.clue.findMany({
      where: { campaignId },
      include: { answers: { orderBy: { order: "asc" } } },
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

    // Cleared first - see the same step in routes/rooms.js (DELETE /:id).
    await prisma.room.update({ where: { id: roomId }, data: { activeCampaignId: null } });

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
