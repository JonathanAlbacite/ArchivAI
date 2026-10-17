import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fssync from "fs";
import prisma from "../lib/prisma.js";
import {
  generateCluesForScene,
  generateStandaloneNotes,
  getStandaloneNoteCount,
  validateAnswersForType,
  normalizeDifficulty,
} from "../lib/clueTemplates.js";
import { ALLOWED_EXTENSIONS, extractTextFromFile } from "../lib/documentText.js";
import { protect, teacherOnly } from "../middleware/auth.js";

const router = express.Router();

const VALID_SCENES = ["Laboratory", "Library", "Tomb"];
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "lesson-modules");

fssync.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error("Only .pdf, .docx, .doc, and .txt files are allowed"));
    }
    cb(null, true);
  },
});

// Find a lesson module and confirm the requesting teacher owns it
const findOwnedLessonModule = async (id, teacherId) => {
  const lessonModule = await prisma.lessonModule.findUnique({ where: { id } });
  if (!lessonModule) return { error: 404, message: "Lesson module not found" };
  if (lessonModule.teacherId !== teacherId) return { error: 403, message: "Access denied" };
  return { lessonModule };
};

// Find a generated clue (via its lesson module) and confirm the requesting teacher owns it
const findOwnedClue = async (id, teacherId) => {
  const clue = await prisma.generatedClue.findUnique({
    where: { id },
    include: { lessonModule: { select: { teacherId: true } } },
  });
  if (!clue) return { error: 404, message: "Clue not found" };
  if (clue.lessonModule.teacherId !== teacherId) return { error: 403, message: "Access denied" };
  return { clue };
};

// Teacher: Upload a lesson document and extract its text
router.post("/lesson-modules/upload", protect, teacherOnly, (req, res) => {
  upload.single("file")(req, res, async (uploadErr) => {
    if (uploadErr instanceof multer.MulterError) {
      if (uploadErr.code === "LIMIT_FILE_SIZE")
        return res.status(400).json({ message: "File exceeds the 10MB limit" });
      return res.status(400).json({ message: uploadErr.message });
    }
    if (uploadErr) return res.status(400).json({ message: uploadErr.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const extractedText = (await extractTextFromFile(req.file)).trim();

      if (!extractedText) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(422).json({ message: "No text could be extracted from the uploaded file" });
      }

      const lessonModule = await prisma.lessonModule.create({
        data: {
          teacherId: req.user.id,
          title: req.body.title || req.file.originalname,
          originalFilename: req.file.originalname,
          filePath: req.file.path,
          mimeType: req.file.mimetype,
          extractedText,
          status: "uploaded",
        },
      });

      res.status(201).json(lessonModule);
    } catch (err) {
      await fs.unlink(req.file.path).catch(() => {});
      res.status(500).json({ message: "Failed to extract text from file", error: err.message });
    }
  });
});

// Teacher: Generate clues from a lesson module's extracted text - one per
// slot of the scene's published vault template, each of that slot's type
// (Normal, MultiChoice or Combo), so the result can fill the campaign's
// pages as they are.
router.post("/lesson-modules/:id/generate-clues", protect, teacherOnly, async (req, res) => {
  const lessonModuleId = parseInt(req.params.id);
  const scene = VALID_SCENES.find((s) => s.toLowerCase() === (req.body.scene || "").toLowerCase());

  if (!scene) return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const { lessonModule, error, message } = await findOwnedLessonModule(lessonModuleId, req.user.id);
    if (error) return res.status(error).json({ message });

    if (!lessonModule.extractedText?.trim())
      return res.status(422).json({ message: "Lesson module has no extracted text to generate clues from" });

    const generated = await generateCluesForScene(
      lessonModule.extractedText,
      scene,
      `generate-clues (lesson module ${lessonModuleId})`,
      normalizeDifficulty(req.body.difficulty)
    );

    if (generated.error === "no_template") return res.status(422).json({ message: generated.message });
    if (generated.error === "ai_failed")
      return res.status(502).json({ message: "AI request failed", error: generated.message });
    if (generated.error) return res.status(502).json({ message: generated.message });

    const clues = generated.clues;

    await prisma.$transaction([
      prisma.generatedClue.createMany({
        data: clues.map((c, i) => ({
          lessonModuleId,
          orderNumber: i + 1,
          clueText: c.clueText,
          answerText: c.answers.find((a) => a.isCorrect).text,
          clueType: c.type,
          answers: c.answers,
          note: c.note,
          scene,
          status: "pending",
        })),
      }),
      prisma.lessonModule.update({
        where: { id: lessonModuleId },
        data: { status: "generated" },
      }),
    ]);

    const generatedClues = await prisma.generatedClue.findMany({
      where: { lessonModuleId },
      orderBy: { orderNumber: "asc" },
    });

    res.status(201).json(generatedClues);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Generate the additional notes (standalone hints) for a scene from a
// lesson module's text. How many comes from the scene's published vault
// template. `clueIds` = the generated clues just made from the same lesson: the
// notes are written about other facts and never contain their answers or wrong
// options, so no note points to a question. Nothing is saved here; the campaign
// editor puts the notes on its last page and they are saved with the campaign.
router.post("/lesson-modules/:id/generate-notes", protect, teacherOnly, async (req, res) => {
  const lessonModuleId = parseInt(req.params.id);
  const scene = VALID_SCENES.find((s) => s.toLowerCase() === (req.body.scene || "").toLowerCase());

  if (!scene) return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const { lessonModule, error, message } = await findOwnedLessonModule(lessonModuleId, req.user.id);
    if (error) return res.status(error).json({ message });

    if (!lessonModule.extractedText?.trim())
      return res.status(422).json({ message: "Lesson module has no extracted text to generate notes from" });

    const count = await getStandaloneNoteCount(scene);
    if (count === 0) return res.json({ notes: [] });

    const clueIds = Array.isArray(req.body.clueIds)
      ? req.body.clueIds.map((id) => parseInt(id)).filter((id) => Number.isInteger(id))
      : [];
    const usedClues = clueIds.length
      ? await prisma.generatedClue.findMany({ where: { id: { in: clueIds }, lessonModuleId } })
      : [];

    const avoid = { texts: [], phrases: [] };
    for (const c of usedClues) {
      avoid.texts.push(c.clueText);
      if (c.note) avoid.texts.push(c.note);
      const options = Array.isArray(c.answers) && c.answers.length ? c.answers : [{ text: c.answerText }];
      for (const a of options) if (a?.text && !avoid.phrases.includes(a.text)) avoid.phrases.push(a.text);
    }

    const generated = await generateStandaloneNotes(
      lessonModule.extractedText,
      count,
      avoid,
      `generate-notes (lesson module ${lessonModuleId})`,
      normalizeDifficulty(req.body.difficulty)
    );

    if (generated.error === "ai_failed")
      return res.status(502).json({ message: "AI request failed", error: generated.message });
    if (generated.error) return res.status(502).json({ message: generated.message });

    res.json({ notes: generated.notes });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: List generated clues for a lesson module
router.get("/lesson-modules/:id/clues", protect, teacherOnly, async (req, res) => {
  const lessonModuleId = parseInt(req.params.id);

  try {
    const { error, message } = await findOwnedLessonModule(lessonModuleId, req.user.id);
    if (error) return res.status(error).json({ message });

    const clues = await prisma.generatedClue.findMany({
      where: { lessonModuleId },
      orderBy: { orderNumber: "asc" },
    });

    res.json(clues);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Edit a generated clue
router.patch("/clues/:id", protect, teacherOnly, async (req, res) => {
  const clueId = parseInt(req.params.id);
  const { clueText, answerText, answers, note, scene } = req.body;

  if (scene && !VALID_SCENES.includes(scene))
    return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const { clue, error, message } = await findOwnedClue(clueId, req.user.id);
    if (error) return res.status(error).json({ message });

    // `answers` (every option, correct ones first) replaces the whole list
    // and must fit the clue's type; answerText is kept as the first correct
    // answer. A bare answerText edit only applies to Normal clues, where it
    // is the single answer.
    let answerData = {};
    if (answers !== undefined) {
      const answersError = validateAnswersForType(clue.clueType, answers);
      if (answersError) return res.status(400).json({ message: answersError });

      const cleaned = answers.map((a) => ({ text: a.text.trim(), isCorrect: !!a.isCorrect }));
      answerData = { answers: cleaned, answerText: cleaned.find((a) => a.isCorrect).text };
    } else if (answerText !== undefined) {
      answerData = {
        answerText,
        ...(clue.clueType === "NORMAL" && { answers: [{ text: answerText, isCorrect: true }] }),
      };
    }

    const updated = await prisma.generatedClue.update({
      where: { id: clueId },
      data: {
        ...(clueText !== undefined && { clueText }),
        ...(note !== undefined && { note: note ? String(note).trim() || null : null }),
        ...answerData,
        ...(scene !== undefined && { scene }),
        status: "edited",
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Approve a generated clue
router.patch("/clues/:id/approve", protect, teacherOnly, async (req, res) => {
  const clueId = parseInt(req.params.id);

  try {
    const { error, message } = await findOwnedClue(clueId, req.user.id);
    if (error) return res.status(error).json({ message });

    const updated = await prisma.generatedClue.update({
      where: { id: clueId },
      data: { status: "approved" },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Reject a generated clue
router.patch("/clues/:id/reject", protect, teacherOnly, async (req, res) => {
  const clueId = parseInt(req.params.id);

  try {
    const { error, message } = await findOwnedClue(clueId, req.user.id);
    if (error) return res.status(error).json({ message });

    const updated = await prisma.generatedClue.update({
      where: { id: clueId },
      data: { status: "rejected" },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Teacher: Bulk-attach approved generated clues to a campaign's real Clue rows
router.post("/campaigns/:id/attach-clues", protect, teacherOnly, async (req, res) => {
  const campaignId = parseInt(req.params.id);
  const { clueIds } = req.body;

  if (!Array.isArray(clueIds) || clueIds.length === 0)
    return res.status(400).json({ message: "clueIds must be a non-empty array" });

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { room: { select: { teacherId: true } } },
    });
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    if (campaign.room.teacherId !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    const generatedClues = await prisma.generatedClue.findMany({
      where: { id: { in: clueIds.map((id) => parseInt(id)) }, status: "approved" },
      include: { lessonModule: { select: { teacherId: true } } },
    });

    if (generatedClues.length === 0)
      return res.status(400).json({ message: "No approved clues found for the given ids" });

    const notOwned = generatedClues.some((c) => c.lessonModule.teacherId !== req.user.id);
    if (notOwned) return res.status(403).json({ message: "Access denied" });

    const existingCount = await prisma.clue.count({ where: { campaignId } });

    // Each generated clue keeps the type it was drafted as (Normal,
    // MultiChoice or Combo) and its full answers list; older rows without
    // either are plain Normal clues with just answerText. createMany() can't
    // create nested relations, so each clue is created individually.
    for (let i = 0; i < generatedClues.length; i++) {
      const c = generatedClues[i];
      const answers =
        Array.isArray(c.answers) && c.answers.length > 0
          ? c.answers
          : [{ text: c.answerText, isCorrect: true }];

      await prisma.clue.create({
        data: {
          campaignId,
          orderNumber: existingCount + i + 1,
          type: c.clueType,
          question: c.clueText,
          note: c.note || null,
          answers: {
            create: answers.map((a, j) => ({ text: a.text, isCorrect: !!a.isCorrect, order: j })),
          },
        },
      });
    }

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

export default router;
