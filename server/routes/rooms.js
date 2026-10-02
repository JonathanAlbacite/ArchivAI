import express from "express";
import prisma from "../lib/prisma.js";
import { createRoomForTeacher } from "../lib/rooms.js";
import { protect, teacherOnly, studentOnly } from "../middleware/auth.js";

const router = express.Router();

// Admin, in "Teacher Mode" (see client's AdminDashboard), is treated exactly like a TEACHER for
// every ownership check below - whatever an admin creates here is owned by their own account id,
// same as a real teacher's would be, so this never leaks another teacher's rooms to them.
const actsAsTeacher = (role) => role === "TEACHER" || role === "ADMIN";

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
        campaigns: true,
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