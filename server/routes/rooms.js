import express from "express";
import fs from "fs/promises";
import prisma from "../lib/prisma.js";
import { createRoomForTeacher } from "../lib/rooms.js";
import { protect, teacherOnly, studentOnly } from "../middleware/auth.js";

const router = express.Router();

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
    if (req.user.role === "TEACHER") {
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
          },
        },
      },
    });

    if (!room) return res.status(404).json({ message: "Room not found" });

    if (req.user.role === "TEACHER") {
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

export default router;