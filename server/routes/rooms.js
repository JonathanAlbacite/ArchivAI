import express from "express";
import fs from "fs/promises";
import prisma from "../lib/prisma.js";
import { createRoomForTeacher } from "../lib/rooms.js";
import { protect, teacherOnly, studentOnly } from "../middleware/auth.js";

const router = express.Router();

// Admin, in "Teacher Mode" (see client's AdminDashboard), is treated exactly like a TEACHER for
// every ownership check below - whatever an admin creates here is owned by their own account id,
// same as a real teacher's would be, so this never leaks another teacher's rooms to them.
const actsAsTeacher = (role) => role === "TEACHER" || role === "ADMIN";

// A member is "active" when the website has reported them within this window. The website sends
// a heartbeat every 30 seconds (see POST /auth/heartbeat), so 75 seconds allows two missed beats
// before someone drops to inactive.
const ACTIVE_WINDOW_MS = 75 * 1000;
const isActive = (lastActiveAt) => !!lastActiveAt && Date.now() - new Date(lastActiveAt).getTime() < ACTIVE_WINDOW_MS;

// Teacher: Create room
router.post("/", protect, teacherOnly, async (req, res) => {
  const { name, description } = req.body;

  try {
    const room = await createRoomForTeacher(req.user.id, { name, description });
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Get all their rooms
// Student: Get all enrolled rooms
router.get("/", protect, async (req, res) => {
  try {
    if (actsAsTeacher(req.user.role)) {
      const rooms = await prisma.room.findMany({
        where: { teacherId: req.user.id },
        include: {
          _count: { select: { students: true, campaigns: true } },
        },
      });
      return res.json(rooms);
    }

    if (req.user.role === "STUDENT") {
      const rooms = await prisma.roomStudent.findMany({
        where: { studentId: req.user.id },
        include: {
          room: {
            include: {
              teacher: { select: { name: true } },
              _count: { select: { campaigns: true } },
            },
          },
        },
      });
      return res.json(rooms.map((r) => r.room));
    }
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Get single room with students and campaigns
// Student: Get single room if enrolled
router.get("/:id", protect, async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        students: {
          include: {
            student: { select: { id: true, name: true, email: true } },
          },
        },
        // attachmentPath is a server-local filesystem path, left out here —
        // it's not needed client-side, which hits GET /campaigns/:id/attachment
        // to actually download the file.
        // Students only ever see published campaigns — drafts stay with the teacher.
        campaigns: {
          where: req.user.role === "STUDENT" ? { isPublished: true } : undefined,
          select: {
            id: true,
            roomId: true,
            title: true,
            description: true,
            scene: true,
            storyPath: true,
            isPublished: true,
            createdAt: true,
            attachmentFilename: true,
            attachmentMimeType: true,
            // How many plays/saves exist - the teacher UI hides "Edit" for a
            // campaign that has any (see hasPlayHistory in routes/campaigns.js).
            _count: { select: { sessions: true, progress: true } },
          },
        },
      },
    });

    if (!room) return res.status(404).json({ message: "Room not found" });

    if (actsAsTeacher(req.user.role)) {
      if (room.teacherId !== req.user.id)
        return res.status(403).json({ message: "Access denied" });
    } else if (req.user.role === "STUDENT") {
      const enrolled = await prisma.roomStudent.findFirst({
        where: { roomId: room.id, studentId: req.user.id },
      });
      if (!enrolled) return res.status(403).json({ message: "Access denied" });
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(room);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher or enrolled Student: Get the room's members - its owner (the teacher) first, then the
// students - each with whether they are active right now
router.get("/:id/members", protect, async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        teacher: { select: { id: true, name: true, lastActiveAt: true } },
        students: {
          orderBy: { joinedAt: "asc" },
          include: { student: { select: { id: true, name: true, lastActiveAt: true } } },
        },
      },
    });

    if (!room) return res.status(404).json({ message: "Room not found" });

    if (actsAsTeacher(req.user.role)) {
      if (room.teacherId !== req.user.id)
        return res.status(403).json({ message: "Access denied" });
    } else if (req.user.role === "STUDENT") {
      const enrolled = room.students.some((s) => s.studentId === req.user.id);
      if (!enrolled) return res.status(403).json({ message: "Access denied" });
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({
      owner: { id: room.teacher.id, name: room.teacher.name, active: isActive(room.teacher.lastActiveAt) },
      students: room.students.map((s) => ({
        id: s.student.id,
        name: s.student.name,
        active: isActive(s.student.lastActiveAt),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Rename a room or change its description
router.patch("/:id", protect, teacherOnly, async (req, res) => {
  const roomId = parseInt(req.params.id);
  const { name, description } = req.body;

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Delete a room, along with its campaigns, clues, students, and
// play history — the schema's onDelete: Cascade relations (see
// schema.prisma: RoomStudent/Campaign -> Room, Clue -> Campaign,
// CampaignSession -> Campaign, SessionAttempt -> Clue/CampaignSession) mean
// a single delete here is enough; MySQL handles the rest. Its campaigns'
// attachment files (if any) aren't DB rows, so they're removed from disk
// separately, after the cascade delete succeeds.
router.delete("/:id", protect, teacherOnly, async (req, res) => {
  const roomId = parseInt(req.params.id);

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { campaigns: { select: { attachmentPath: true } } },
    });
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    // Room.activeCampaignId points at one of this room's own campaigns, so it is cleared first -
    // otherwise the room and the campaign it points at would each be waiting on the other when
    // the cascade runs.
    await prisma.room.update({ where: { id: roomId }, data: { activeCampaignId: null } });

    await prisma.room.delete({ where: { id: roomId } });

    await Promise.all(
      room.campaigns.filter((c) => c.attachmentPath).map((c) => fs.unlink(c.attachmentPath).catch(() => {}))
    );

    res.json({ message: "Room deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Add student manually by email
router.post("/:id/students", protect, teacherOnly, async (req, res) => {
  const { email } = req.body;

  try {
    const student = await prisma.user.findUnique({ where: { email } });
    if (!student || student.role !== "STUDENT")
      return res.status(404).json({ message: "Student not found" });

    const existing = await prisma.roomStudent.findFirst({
      where: {
        roomId: parseInt(req.params.id),
        studentId: student.id,
      },
    });

    if (existing)
      return res.status(400).json({ message: "Student already in room" });

    await prisma.roomStudent.create({
      data: {
        roomId: parseInt(req.params.id),
        studentId: student.id,
      },
    });

    res.json({ message: "Student added" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Remove student
router.delete("/:id/students/:studentId", protect, teacherOnly, async (req, res) => {
  try {
    await prisma.roomStudent.deleteMany({
      where: {
        roomId: parseInt(req.params.id),
        studentId: parseInt(req.params.studentId),
      },
    });

    res.json({ message: "Student removed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Student: Join room using room code
router.post("/join", protect, studentOnly, async (req, res) => {
  const { roomCode } = req.body;

  try {
    const room = await prisma.room.findUnique({ where: { roomCode } });
    if (!room) return res.status(404).json({ message: "Room not found" });

    const existing = await prisma.roomStudent.findFirst({
      where: {
        roomId: room.id,
        studentId: req.user.id,
      },
    });

    if (existing)
      return res.status(400).json({ message: "Already enrolled in this room" });

    await prisma.roomStudent.create({
      data: {
        roomId: room.id,
        studentId: req.user.id,
      },
    });

    res.json({ message: "Joined room successfully", room });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher or enrolled Student: Get the room's currently active campaign
router.get("/:id/active-campaign", protect, async (req, res) => {
  const roomId = parseInt(req.params.id);

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { activeCampaign: true },
    });

    if (!room) return res.status(404).json({ message: "Room not found" });

    if (actsAsTeacher(req.user.role)) {
      if (room.teacherId !== req.user.id)
        return res.status(403).json({ message: "Access denied" });
    } else if (req.user.role === "STUDENT") {
      const enrolled = await prisma.roomStudent.findFirst({
        where: { roomId: room.id, studentId: req.user.id },
      });
      if (!enrolled) return res.status(403).json({ message: "Access denied" });
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!room.activeCampaign) {
      return res.status(404).json({ message: "No active campaign set for this room" });
    }

    res.json(room.activeCampaign);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher or enrolled Student: Set the room's active campaign (this is what
// the "Play" buttons on both sides call)
router.patch("/:id/active-campaign", protect, async (req, res) => {
  const roomId = parseInt(req.params.id);
  const { campaignId } = req.body;

  if (!campaignId) {
    return res.status(400).json({ message: "campaignId is required" });
  }

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ message: "Room not found" });

    if (actsAsTeacher(req.user.role)) {
      if (room.teacherId !== req.user.id)
        return res.status(403).json({ message: "Access denied" });
    } else if (req.user.role === "STUDENT") {
      const enrolled = await prisma.roomStudent.findFirst({
        where: { roomId: room.id, studentId: req.user.id },
      });
      if (!enrolled) return res.status(403).json({ message: "Access denied" });
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // Confirm the campaign actually belongs to this room, so a room
    // can't accidentally get pointed at another room's campaign.
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
    });

    if (!campaign || campaign.roomId !== roomId) {
      return res.status(404).json({ message: "Campaign not found in this room" });
    }

    const updated = await prisma.room.update({
      where: { id: roomId },
      data: { activeCampaignId: campaign.id },
      include: { activeCampaign: true },
    });

    res.json(updated.activeCampaign);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;