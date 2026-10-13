import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fssync from "fs";
import prisma from "../lib/prisma.js";
import { protect, teacherOnly, studentOnly } from "../middleware/auth.js";

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

// Teacher: Add clues to a campaign
router.post("/campaigns/:id/clues", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { clues } = req.body;

  if (!Array.isArray(clues) || clues.length === 0)
    return res.status(400).json({ message: "clues must be a non-empty array" });

  if (clues.some((c) => !c.question || !c.answer))
    return res.status(400).json({ message: "Each clue needs a question and answer" });

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

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

    res.status(201).json(allClues);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Replace a draft campaign's entire clue set in one shot (as
// opposed to POST above, which only appends). Used by the full campaign
// editor, which treats clues as a whole page list a teacher can reorder,
// edit, or remove — not something to incrementally append to. Only allowed
// while unpublished: since publishing is one-way, an unpublished campaign
// can never have real student attempts recorded against its clues yet, so
// deleting and recreating them is always safe.
router.put("/campaigns/:id/clues", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { clues } = req.body;

  if (!Array.isArray(clues))
    return res.status(400).json({ message: "clues must be an array" });
  if (clues.some((c) => !c.question || !c.answer))
    return res.status(400).json({ message: "Each clue needs a question and answer" });

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });
    if (campaign.isPublished)
      return res.status(400).json({ message: "Published campaigns can't be edited" });

    await prisma.clue.deleteMany({ where: { campaignId } });

    if (clues.length > 0) {
      await prisma.clue.createMany({
        data: clues.map((c, i) => ({
          campaignId,
          orderNumber: i + 1,
          question: c.question,
          answer: c.answer,
        })),
      });
    }

    const allClues = await prisma.clue.findMany({
      where: { campaignId },
      orderBy: { orderNumber: "asc" },
    });

    res.json(allClues);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Edit a campaign's title/description/scene — only while it's
// still a draft. Once published, students may already be relying on it, so
// it's locked; unpublish isn't supported, so publishing is a one-way step.
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

// Teacher (owner) or student: Download a campaign's attached resource file.
// The owner always can; anyone else only once the campaign is published AND
// they're enrolled in its room — the file is a class handout, not public.
router.get("/campaigns/:id/attachment", protect, async (req, res) => {
  const campaignId = parseInt(req.params.id);

  try {
    const campaign = await findCampaignWithRoom(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const isOwner = campaign.room.teacherId === req.user.id;
    if (!isOwner) {
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

// Teacher: Delete a campaign, along with its clues, play sessions, and
// session attempts — the schema's onDelete: Cascade relations (see
// schema.prisma: Clue/CampaignSession -> Campaign, SessionAttempt ->
// Clue/CampaignSession) mean a single delete here is enough; MySQL handles
// the rest. Its attachment file (if any) isn't a DB row, so it's removed
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

// Get a single campaign with its clues (answers omitted)
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
      select: { id: true, orderNumber: true, question: true, answer: isOwner },
      orderBy: { orderNumber: "asc" },
    });

    // attachmentPath is a server-local filesystem path — students/teacher
    // never need it directly, they hit GET /campaigns/:id/attachment instead.
    const { room, attachmentPath, ...campaignData } = campaign;
    res.json({ ...campaignData, clues });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Unity: Load campaign + clues (answers omitted)
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
      select: { id: true, orderNumber: true, question: true },
      orderBy: { orderNumber: "asc" },
    });

    res.json({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      scene: campaign.scene,
      storyPath: campaign.storyPath,
      clues,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Unity: Submit student results for a campaign
router.post("/campaigns/:id/results", protect, studentOnly, async (req, res) => {
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

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
