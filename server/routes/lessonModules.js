import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import fssync from "fs";
import prisma from "../lib/prisma.js";
import { generateText } from "../lib/aiProviderChain.js";
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

// A campaign has exactly one realm (chosen by the teacher before conjuring),
// so every clue in a batch shares that same scene — the model isn't asked
// to invent it per clue, which is what was scattering clues across realms.
const buildCluePrompt = (extractedText, scene) => `You are generating escape-room style clues for a classroom activity set entirely in the "${scene}" realm, based on the lesson content below. Every clue must fit that single realm's theme — do not mix in other settings.

Return ONLY a valid JSON array (no markdown, no code fences, no commentary) of 5 to 8 clue objects. Each object must have exactly these fields:
- "clueText": a string presenting a riddle or question derived from the lesson content, themed to the "${scene}" realm
- "answerText": a string with the correct answer

Lesson content:
"""
${extractedText}
"""`;

const stripMarkdownFences = (text) =>
  text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

// Parses and validates the Gemini response; returns null if it isn't usable so the caller can retry
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

// Teacher: Generate clues from a lesson module's extracted text
router.post("/lesson-modules/:id/generate-clues", protect, teacherOnly, async (req, res) => {
  const lessonModuleId = parseInt(req.params.id);
  const scene = VALID_SCENES.find((s) => s.toLowerCase() === (req.body.scene || "").toLowerCase());

  if (!scene) return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const { lessonModule, error, message } = await findOwnedLessonModule(lessonModuleId, req.user.id);
    if (error) return res.status(error).json({ message });

    if (!lessonModule.extractedText?.trim())
      return res.status(422).json({ message: "Lesson module has no extracted text to generate clues from" });

    const prompt = buildCluePrompt(lessonModule.extractedText, scene);

    let clues;
    try {
      const { text: rawText, provider } = await generateText(prompt);
      console.log(`[lessonModules] generate-clues (lesson module ${lessonModuleId}) answered via ${provider}`);
      clues = parseClueResponse(rawText);

      if (!clues) {
        const correctivePrompt = `${prompt}\n\nYour previous response was not a valid JSON array matching the required shape. Respond again with ONLY a valid JSON array, no markdown, no commentary.`;
        const { text: retryText } = await generateText(correctivePrompt);
        clues = parseClueResponse(retryText);
      }
    } catch (err) {
      return res.status(502).json({ message: "AI request failed", error: err.message });
    }

    if (!clues) {
      return res.status(502).json({ message: "The AI returned malformed JSON after retry" });
    }

    await prisma.$transaction([
      prisma.generatedClue.createMany({
        data: clues.map((c, i) => ({
          lessonModuleId,
          orderNumber: i + 1,
          clueText: c.clueText,
          answerText: c.answerText,
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
  const { clueText, answerText, scene } = req.body;

  if (scene && !VALID_SCENES.includes(scene))
    return res.status(400).json({ message: `scene must be one of ${VALID_SCENES.join(", ")}` });

  try {
    const { error, message } = await findOwnedClue(clueId, req.user.id);
    if (error) return res.status(error).json({ message });

    const updated = await prisma.generatedClue.update({
      where: { id: clueId },
      data: {
        ...(clueText !== undefined && { clueText }),
        ...(answerText !== undefined && { answerText }),
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

    // AI-generated clues are always plain NORMAL clues (single correct
    // answer, no decoys) - see buildCluePrompt above, which only ever asks
    // for {clueText, answerText} pairs. createMany() can't create nested
    // relations, so each clue (with its one-item answers list) is created
    // individually.
    for (let i = 0; i < generatedClues.length; i++) {
      const c = generatedClues[i];
      await prisma.clue.create({
        data: {
          campaignId,
          orderNumber: existingCount + i + 1,
          type: "NORMAL",
          question: c.clueText,
          answers: { create: [{ text: c.answerText, isCorrect: true, order: 0 }] },
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
