import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fssync from "fs";
import prisma from "../lib/prisma.js";
import { protect, teacherOnly } from "../middleware/auth.js";
import { hasPlayHistory } from "../lib/clueTemplates.js";

const router = express.Router();

// Fetch a campaign along with its room, for ownership checks
const findCampaignWithRoom = (id) =>
  prisma.campaign.findUnique({
    where: { id },
    include: { room: { select: { teacherId: true } } },
  });

// A campaign's one attached resource file (e.g. a handout) — a broader set
// than the lesson-notes upload in lessonModules.js (documentText.js's
// ALLOWED_EXTENSIONS), since this is a file for students to read/download
// as-is rather than text to extract and feed to the AI.
const ATTACHMENT_UPLOAD_DIR = path.join(process.cwd(), "uploads", "campaign-attachments");
const ALLOWED_ATTACHMENT_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".png", ".jpg", ".jpeg", ".zip",
];

fssync.mkdirSync(ATTACHMENT_UPLOAD_DIR, { recursive: true });

const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ATTACHMENT_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Only ${ALLOWED_ATTACHMENT_EXTENSIONS.join(", ")} files are allowed`));
    }
    cb(null, true);
  },
});

// Teacher: Create campaign
router.post("/campaigns", protect, teacherOnly, async (req, res) => {
  const { title, roomId, description, scene, storyPath } = req.body;

  if (!title || !roomId)
    return res.status(400).json({ message: "title and roomId are required" });

  try {
    const room = await prisma.room.findUnique({ where: { id: parseInt(roomId) } });
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    const campaign = await prisma.campaign.create({
      data: {
        title,
        roomId: room.id,
        description,
        scene: scene || "",
        storyPath,
      },
    });

    res.status(201).json(campaign);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Validates one clue's `answers` array against its own `type` - see
// ClueType in schema.prisma for what each shape requires. Returns an
// error string, or null when the clue is valid.
function validateClueAnswers(c) {
  const answers = Array.isArray(c.answers) ? c.answers : [];
  const correctCount = answers.filter((a) => a && a.isCorrect).length;

  if (answers.some((a) => !a || !a.text || !a.text.trim()))
    return "Every answer option needs text";

  switch (c.type) {
    case "MULTICHOICE":
      if (answers.length !== 4 || correctCount !== 1)
        return "MultiChoice needs exactly 4 answers with exactly 1 marked correct (3 decoys)";
      return null;
    case "COMBO":
      if (correctCount < 1)
        return "Combo needs at least 1 answer marked correct";
      return null;
    case "NORMAL":
    default:
      if (answers.length !== 1 || correctCount !== 1)
        return "Normal needs exactly 1 answer, marked correct";
      return null;
  }
}

// A campaign's clues must match its scene's published VaultTemplate
// exactly, in order - that's the whole point of the admin page: teachers
// fill in content, they don't choose the shape. Returns an error string,
// or null when `clues` lines up 1:1 with the template's slots.
async function validateAgainstTemplate(scene, clues) {
  const template = await prisma.vaultTemplate.findUnique({
    where: { scene: (scene || "").toLowerCase().trim() },
    include: { slots: { orderBy: { orderNumber: "asc" } } },
  });

  if (!template || !template.isPublished)
    return "This vault has no published question-set template yet - ask an admin to publish one first";

  if (clues.length !== template.slots.length)
    return `This vault's template has ${template.slots.length} clue(s) - got ${clues.length}`;

  for (let i = 0; i < clues.length; i++) {
    if (clues[i].type !== template.slots[i].type)
      return `Clue ${i + 1} must be type ${template.slots[i].type} (set by the vault's template)`;
  }

  return null;
}

// Additional notes (standalone hints): short facts that belong to no question.
// How many a campaign needs is the vault template's standaloneNoteCount. The
// editor sends them as `standaloneNotes` (an array of strings) together with the
// clues. Returns { error } or { notes }, where `notes` is the cleaned list to
// save, or null when the request did not send any (the saved notes then stay as
// they are). A vault that asks for none saves none.
const MAX_NOTE_CHARS = 600;
async function resolveStandaloneNotes(scene, notes) {
  if (notes === undefined) return { notes: null };

  const template = await prisma.vaultTemplate.findUnique({
    where: { scene: (scene || "").toLowerCase().trim() },
    select: { standaloneNoteCount: true },
  });
  const count = template?.standaloneNoteCount || 0;
  if (count === 0) return { notes: [] };

  if (!Array.isArray(notes) || notes.length !== count)
    return { error: `This vault's template has ${count} additional note(s) - got ${Array.isArray(notes) ? notes.length : 0}` };

  const cleaned = notes.map((n) => (typeof n === "string" ? n.trim() : ""));
  if (cleaned.some((n) => !n)) return { error: "Every additional note needs text" };
  if (cleaned.some((n) => n.length > MAX_NOTE_CHARS))
    return { error: `Each additional note can have at most ${MAX_NOTE_CHARS} characters` };

  return { notes: cleaned };
}

// Replaces a campaign's saved additional notes with `notes` (in order).
async function replaceStandaloneNotes(campaignId, notes) {
  await prisma.standaloneNote.deleteMany({ where: { campaignId } });
  if (notes.length > 0) {
    await prisma.standaloneNote.createMany({
      data: notes.map((text, i) => ({ campaignId, orderNumber: i + 1, text })),
    });
  }
}

// A campaign's saved additional notes as plain text, in order.
async function getStandaloneNoteTexts(campaignId) {
  const rows = await prisma.standaloneNote.findMany({ where: { campaignId }, orderBy: { orderNumber: "asc" } });
  return rows.map((r) => r.text);
}

// Teacher: Add the full clue set to a freshly-created campaign. Unlike a
// generic "append" endpoint, this only ever runs once per campaign - the
// clue set's size and per-page type are fixed by the scene's published
// template (see validateAgainstTemplate), so there's nothing to append to
// afterward. Editing an existing set goes through PUT below instead.
router.post("/campaigns/:id/clues", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { clues, standaloneNotes } = req.body;

  if (!Array.isArray(clues) || clues.length === 0)
    return res.status(400).json({ message: "clues must be a non-empty array" });
  if (clues.some((c) => !c.question || !c.question.trim()))
    return res.status(400).json({ message: "Each clue needs a question" });

  for (const c of clues) {
    const error = validateClueAnswers(c);
    if (error) return res.status(400).json({ message: error });
  }

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    const existingCount = await prisma.clue.count({ where: { campaignId } });
    if (existingCount > 0)
      return res.status(400).json({ message: "This campaign already has clues - use PUT to replace them" });

    const templateError = await validateAgainstTemplate(campaign.scene, clues);
    if (templateError) return res.status(400).json({ message: templateError });

    const noteResult = await resolveStandaloneNotes(campaign.scene, standaloneNotes);
    if (noteResult.error) return res.status(400).json({ message: noteResult.error });

    // createMany() can't create nested relations in one call, so each
    // clue (with its answers) is created individually instead - clue
    // counts per campaign are small (authored by hand, fixed by the
    // vault's template), so this isn't a real performance concern.
    for (let i = 0; i < clues.length; i++) {
      const c = clues[i];
      await prisma.clue.create({
        data: {
          campaignId,
          orderNumber: i + 1,
          type: c.type || "NORMAL",
          question: c.question,
          note: c.note || null,
          answers: {
            create: c.answers.map((a, j) => ({ text: a.text, isCorrect: !!a.isCorrect, order: j })),
          },
        },
      });
    }

    if (noteResult.notes) await replaceStandaloneNotes(campaignId, noteResult.notes);

    const allClues = await prisma.clue.findMany({
      where: { campaignId },
      include: { answers: { orderBy: { order: "asc" } } },
      orderBy: { orderNumber: "asc" },
    });

    res.status(201).json(allClues);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Replace a draft campaign's entire clue set in one shot (as
// opposed to POST above, which only creates the initial set). Used by the
// full campaign editor, which treats clues as a whole page list matching
// the scene's template - not something to incrementally append to. Only
// allowed while unpublished AND while nobody has played it yet: deleting
// the clues also deletes the attempts recorded against them (cascade), so a
// campaign with play history (e.g. one that was unpublished) is refused.
router.put("/campaigns/:id/clues", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { clues, standaloneNotes } = req.body;

  if (!Array.isArray(clues) || clues.length === 0)
    return res.status(400).json({ message: "clues must be a non-empty array" });
  if (clues.some((c) => !c.question || !c.question.trim()))
    return res.status(400).json({ message: "Each clue needs a question" });

  for (const c of clues) {
    const error = validateClueAnswers(c);
    if (error) return res.status(400).json({ message: error });
  }

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });
    if (campaign.isPublished)
      return res.status(400).json({ message: "Published campaigns can't be edited" });
    if (await hasPlayHistory(campaignId))
      return res.status(400).json({ message: "This campaign already has play history, so it can't be edited. Use \"Update campaign\" to make an editable copy." });

    const templateError = await validateAgainstTemplate(campaign.scene, clues);
    if (templateError) return res.status(400).json({ message: templateError });

    const noteResult = await resolveStandaloneNotes(campaign.scene, standaloneNotes);
    if (noteResult.error) return res.status(400).json({ message: noteResult.error });

    // ClueAnswer rows cascade-delete with their Clue (onDelete: Cascade
    // in schema.prisma), so clearing Clue also clears their old answers.
    await prisma.clue.deleteMany({ where: { campaignId } });

    for (let i = 0; i < clues.length; i++) {
      const c = clues[i];
      await prisma.clue.create({
        data: {
          campaignId,
          orderNumber: i + 1,
          type: c.type || "NORMAL",
          question: c.question,
          note: c.note || null,
          answers: {
            create: c.answers.map((a, j) => ({ text: a.text, isCorrect: !!a.isCorrect, order: j })),
          },
        },
      });
    }

    if (noteResult.notes) await replaceStandaloneNotes(campaignId, noteResult.notes);

    const allClues = await prisma.clue.findMany({
      where: { campaignId },
      include: { answers: { orderBy: { order: "asc" } } },
      orderBy: { orderNumber: "asc" },
    });

    res.json(allClues);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Edit a campaign's title/description/scene — only while it's
// still a draft with no play history. Once published, students may already
// be relying on it, so it's locked; unpublishing hides it again but keeps
// the history, so it stays locked once it has been played too.
router.patch("/campaigns/:id", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { title, description, scene } = req.body;

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });
    if (campaign.isPublished)
      return res.status(400).json({ message: "Published campaigns can't be edited" });
    if (await hasPlayHistory(campaignId))
      return res.status(400).json({ message: "This campaign already has play history, so it can't be edited. Use \"Update campaign\" to make an editable copy." });

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(scene !== undefined && { scene }),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Attach (or replace) a campaign's resource file. Allowed on
// published campaigns too — unlike title/description/scene, swapping the
// handout doesn't affect any clue a student may already be mid-attempt on.
router.post("/campaigns/:id/attachment", protect, teacherOnly, (req, res) => {
  uploadAttachment.single("file")(req, res, async (uploadErr) => {
    if (uploadErr instanceof multer.MulterError) {
      if (uploadErr.code === "LIMIT_FILE_SIZE")
        return res.status(400).json({ message: "File exceeds the 10MB limit" });
      return res.status(400).json({ message: uploadErr.message });
    }
    if (uploadErr) return res.status(400).json({ message: uploadErr.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const campaignId = parseInt(req.params.id);

    try {
      const campaign = await findCampaignWithRoom(campaignId);
      if (!campaign) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ message: "Campaign not found" });
      }
      if (campaign.room.teacherId !== req.user.id) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(403).json({ message: "Access denied" });
      }

      // Replacing an existing attachment — remove the old file from disk so
      // it doesn't linger as an orphan now that no row points to it.
      if (campaign.attachmentPath) {
        await fs.unlink(campaign.attachmentPath).catch(() => {});
      }

      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          attachmentFilename: req.file.originalname,
          attachmentPath: req.file.path,
          attachmentMimeType: req.file.mimetype,
        },
      });

      res.status(201).json({
        attachmentFilename: updated.attachmentFilename,
        attachmentMimeType: updated.attachmentMimeType,
      });
    } catch (err) {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(500).json({ message: "Server error", error: err.message });
    }
  });
});

// Teacher: Remove a campaign's resource file
router.delete("/campaigns/:id/attachment", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });
    if (!campaign.attachmentPath)
      return res.status(400).json({ message: "This campaign has no attachment" });

    await fs.unlink(campaign.attachmentPath).catch(() => {});

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { attachmentFilename: null, attachmentPath: null, attachmentMimeType: null },
    });

    res.json({ message: "Attachment removed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher (owner), admin, or student: Download a campaign's attached resource file.
// The owner and any admin always can; anyone else only once the campaign is
// published AND they're enrolled in its room — the file is a class handout, not public.
router.get("/campaigns/:id/attachment", protect, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const isOwner = campaign.room.teacherId === req.user.id;
    if (!isOwner && req.user.role !== "ADMIN") {
      const enrolled =
        campaign.isPublished &&
        (await prisma.roomStudent.findFirst({
          where: { roomId: campaign.roomId, studentId: req.user.id },
        }));
      if (!enrolled) return res.status(404).json({ message: "Campaign not found" });
    }
    if (!campaign.attachmentPath)
      return res.status(404).json({ message: "This campaign has no attachment" });

    res.download(campaign.attachmentPath, campaign.attachmentFilename, (err) => {
      // A response may already be partially sent by the time a stream error
      // fires — res.download only lets us react, not prevent that.
      if (err && !res.headersSent) res.status(404).json({ message: "Attachment file not found" });
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Delete a campaign, along with its clues (and their answers), play
// sessions, session attempts, and saved progress — the schema's onDelete:
// Cascade relations (see schema.prisma: Clue/CampaignSession/CampaignProgress
// -> Campaign, ClueAnswer -> Clue, SessionAttempt -> Clue/CampaignSession)
// mean a single delete here is enough; MySQL handles the rest. A room that
// had this campaign as its active campaign is cleared by the foreign key
// (Room.activeCampaignId is SET NULL). Its attachment file (if any) isn't a DB row, so it's removed
// from disk separately, after the row delete succeeds.
router.delete("/campaigns/:id", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    await prisma.campaign.delete({ where: { id: campaignId } });
    if (campaign.attachmentPath) await fs.unlink(campaign.attachmentPath).catch(() => {});

    res.json({ message: "Campaign deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Publish a campaign
router.patch("/campaigns/:id/publish", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { isPublished: true },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Unpublish a campaign - students stop seeing it, but the campaign
// itself, its clues, and every recorded session/progress row are kept (the
// teacher can still open it, and the results stay archived). If it was the
// room's active campaign, that pointer is cleared so students aren't left
// pointing at a campaign they can no longer load.
router.patch("/campaigns/:id/unpublish", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });
    if (!campaign.isPublished)
      return res.status(400).json({ message: "This campaign isn't published" });

    const [updated] = await prisma.$transaction([
      prisma.campaign.update({
        where: { id: campaignId },
        data: { isPublished: false },
      }),
      prisma.room.updateMany({
        where: { id: campaign.roomId, activeCampaignId: campaignId },
        data: { activeCampaignId: null },
      }),
    ]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: "Update campaign" - makes a new, unpublished copy of a campaign
// (same title + " (Update)", description, scene, and a copy of every clue
// with its answers) so a published or archived campaign can be revised
// without touching the original or its play history. The attachment is NOT
// copied - the new draft starts with no file, ready for a new one.
router.post("/campaigns/:id/duplicate", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const source = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        room: { select: { teacherId: true } },
        clues: {
          orderBy: { orderNumber: "asc" },
          include: { answers: { orderBy: { order: "asc" } } },
        },
        standaloneNotes: { orderBy: { orderNumber: "asc" } },
      },
    });
    if (!source) return res.status(404).json({ message: "Campaign not found" });
    if (source.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    const copy = await prisma.campaign.create({
      data: {
        roomId: source.roomId,
        title: `${source.title} (Update)`,
        description: source.description,
        scene: source.scene,
        storyPath: source.storyPath,
        isPublished: false,
        standaloneNotes: {
          create: source.standaloneNotes.map((n) => ({ orderNumber: n.orderNumber, text: n.text })),
        },
        clues: {
          create: source.clues.map((c) => ({
            orderNumber: c.orderNumber,
            type: c.type,
            question: c.question,
            note: c.note,
            answers: {
              create: c.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect, order: a.order })),
            },
          })),
        },
      },
    });

    res.status(201).json(copy);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get all published campaigns in a room
router.get("/rooms/:roomId/campaigns", protect, async (req, res) => {
  const roomId = parseInt(req.params.roomId);

  try {
    const campaigns = await prisma.campaign.findMany({
      where: { roomId, isPublished: true },
    });

    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Get a single campaign with its clues (answer TEXT/correctness is only
// for the owning teacher to see while editing - a student fetching this
// same campaign gets every other field but no answers at all).
router.get("/campaigns/:id", protect, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const isOwner = campaign.room.teacherId === req.user.id;
    if (!campaign.isPublished && !isOwner)
      return res.status(404).json({ message: "Campaign not found" });

    const clues = await prisma.clue.findMany({
      where: { campaignId },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        question: true,
        note: true,
        answers: isOwner ? { orderBy: { order: "asc" } } : false,
      },
      orderBy: { orderNumber: "asc" },
    });

    // attachmentPath is a server-local filesystem path — students/teacher
    // never need it directly, they hit GET /campaigns/:id/attachment instead.
    // The additional notes are for the owning teacher to edit; a student's copy has none.
    const standaloneNotes = isOwner ? await getStandaloneNoteTexts(campaignId) : [];

    const { room, attachmentPath, ...campaignData } = campaign;
    res.json({ ...campaignData, clues, standaloneNotes });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Unity: Load campaign + clues, answers included - each clue now carries
// its real ClueAnswer list ({text, isCorrect}) matching CampaignEntry.
// AnswerOption on the Unity side exactly, for whichever ClueType it is.
router.get("/campaigns/:id/load", protect, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const isOwner = campaign.room.teacherId === req.user.id;
    if (!campaign.isPublished && !isOwner)
      return res.status(404).json({ message: "Campaign not found" });

    const clues = await prisma.clue.findMany({
      where: { campaignId },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        question: true,
        note: true,
        answers: {
          orderBy: { order: "asc" },
          select: { text: true, isCorrect: true },
        },
      },
      orderBy: { orderNumber: "asc" },
    });

    res.json({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      scene: campaign.scene,
      storyPath: campaign.storyPath,
      clues,
      // The game reads these by position as its Standalone Notes (text000, text001, ...).
      standaloneNotes: await getStandaloneNoteTexts(campaignId),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Unity: Submit results for a campaign. Any logged-in account that plays the game (student,
// teacher or admin) can submit; the user is taken from the token.
router.post("/campaigns/:id/results", protect, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { totalTime, rank, completedAt, attempts } = req.body;

  try {
    const session = await prisma.campaignSession.create({
      data: {
        campaignId,
        studentId: req.user.id,
        completedAt: completedAt ? new Date(completedAt) : new Date(),
        totalTime,
        rank,
        attempts: {
          create: (attempts || []).map((a) => ({
            clueId: a.clueId,
            attempts: a.attempts ?? 0,
            isSolved: !!a.isSolved,
          })),
        },
      },
      include: { attempts: true },
    });

    // The run is finished, so the saved checkpoint progress is marked completed.
    await prisma.campaignProgress.updateMany({
      where: { campaignId, studentId: req.user.id },
      data: { status: "COMPLETED" },
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Unity: Load the logged-in user's saved checkpoint progress for a campaign (any role that can
// play the game: student, teacher or admin).
// Always answers 200 - hasProgress is false when nothing is saved yet, so the game does not
// have to treat "no save" as an error.
router.get("/campaigns/:id/progress", protect, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const progress = await prisma.campaignProgress.findUnique({
      where: { campaignId_studentId: { campaignId, studentId: req.user.id } },
    });

    if (!progress) return res.json({ hasProgress: false });

    res.json({
      hasProgress: true,
      status: progress.status,
      lastCheckpointId: progress.lastCheckpointId,
      reachedCheckpointIds: Array.isArray(progress.reachedCheckpointIds) ? progress.reachedCheckpointIds : [],
      updatedAt: progress.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Unity: Save the logged-in user's checkpoint progress (called each time a checkpoint is reached;
// any role that can play the game). The user is taken from the token, never from the request body. A finished run that is
// played again goes back to IN_PROGRESS with the new checkpoints.
router.put("/campaigns/:id/progress", protect, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { lastCheckpointId, reachedCheckpointIds } = req.body;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const ids = Array.isArray(reachedCheckpointIds)
      ? reachedCheckpointIds.filter((id) => typeof id === "string")
      : [];
    const last = typeof lastCheckpointId === "string" && lastCheckpointId ? lastCheckpointId : null;

    const progress = await prisma.campaignProgress.upsert({
      where: { campaignId_studentId: { campaignId, studentId: req.user.id } },
      create: {
        campaignId,
        studentId: req.user.id,
        lastCheckpointId: last,
        reachedCheckpointIds: ids,
        status: "IN_PROGRESS",
      },
      update: {
        lastCheckpointId: last,
        reachedCheckpointIds: ids,
        status: "IN_PROGRESS",
      },
    });

    res.json({
      hasProgress: true,
      status: progress.status,
      lastCheckpointId: progress.lastCheckpointId,
      reachedCheckpointIds: ids,
      updatedAt: progress.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
