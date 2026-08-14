import express from "express";
import prisma from "../lib/prisma.js";
import { protect, teacherOnly, studentOnly } from "../middleware/auth.js";

const router = express.Router();

// Fetch a campaign along with its room, for ownership checks
const findCampaignWithRoom = (id) =>
  prisma.campaign.findUnique({
    where: { id },
    include: { room: { select: { teacherId: true } } },
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

    const { room, ...campaignData } = campaign;
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
