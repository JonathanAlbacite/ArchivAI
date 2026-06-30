import express from "express";
import prisma from "../lib/prisma.js";
import { protect, teacherOnly, studentOnly } from "../middleware/auth.js";

const router = express.Router();

// Generate random room code
const generateRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Teacher: Create room
router.post("/", protect, teacherOnly, async (req, res) => {
  const { name, description } = req.body;

  try {
    let roomCode;
    let exists = true;

    while (exists) {
      roomCode = generateRoomCode();
      const found = await prisma.room.findUnique({ where: { roomCode } });
      exists = !!found;
    }

    const room = await prisma.room.create({
      data: {
        name,
        description,
        roomCode,
        teacherId: req.user.id,
      },
    });

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
router.get("/:id", protect, teacherOnly, async (req, res) => {
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
    if (room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

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

export default router;