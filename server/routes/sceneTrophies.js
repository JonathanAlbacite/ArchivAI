// sceneTrophies.js
//
// Admin-managed trophies for the results page: each Scene (environment) can have ONE 3D trophy model.
// The admin uploads a .glb for a Scene from the Admin dashboard > Trophies page; the website's
// three.js viewer loads it from here (see client/src/components/TrophyViewer.jsx). Adding a trophy
// is an upload, not a code change + deploy - same idea as routes/musicTracks.js.
//
// A trophy is tied to its Scene by `sceneKey`, which is the Environment key (see lib/environments.js).
// A Scene with no trophy simply has no row.
//
// A trophy's `src` is "/uploads/trophies/<file>.glb": a file stored in server/uploads/trophies/ and
// served by this server (see the static mount in index.js). The website puts the server's address in
// front of it.

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { findEnvironment } from "../lib/environments.js";
import { exportSceneTrophiesSnapshot } from "../lib/sceneTrophiesExport.js";

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "trophies");
const UPLOAD_PREFIX = "/uploads/trophies/";
const MAX_LABEL_LENGTH = 40;
const MAX_FILE_MB = 30;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}.glb`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".glb") {
      return cb(new Error("Only .glb files are allowed"));
    }
    cb(null, true);
  },
});

// Runs the upload and answers upload problems (wrong type, too big) as a normal JSON message.
const uploadGlb = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE" ? `The file is too big (the limit is ${MAX_FILE_MB} MB)` : err.message;
    res.status(400).json({ message });
  });
};

// A real .glb file starts with the four letters "glTF". Checked on the saved file, because a file
// can be renamed to .glb without being one.
const looksLikeGlb = (filePath) => {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    return buffer.toString("ascii") === "glTF";
  } catch {
    return false;
  }
};

// What the website gets for each trophy.
const toPublic = (t) => ({
  id: t.id,
  sceneKey: t.sceneKey,
  label: t.label,
  src: t.src,
});

const fileOf = (trophy) => path.join(UPLOAD_DIR, path.basename(trophy.src));

// Removes a trophy's file from disk.
export const removeTrophyFile = (trophy) => {
  if (!trophy.src.startsWith(UPLOAD_PREFIX)) return;
  fs.unlink(fileOf(trophy), () => {});
};

const exportSnapshot = async () => {
  try {
    await exportSceneTrophiesSnapshot();
  } catch (exportErr) {
    console.error("[sceneTrophies] Failed to export seed snapshot:", exportErr);
  }
};

// Any logged-in user: every Scene's trophy. The results page picks the one for the Scene that was played.
router.get("/scene-trophies", protect, async (req, res) => {
  try {
    const trophies = await prisma.sceneTrophy.findMany({ orderBy: { sceneKey: "asc" } });
    res.json(trophies.map(toPublic));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: set the trophy of a Scene - a multipart form with an optional name (label) and a .glb file.
// A Scene with no trophy needs the file. A Scene that already has one keeps its file when none is
// sent (only the name changes); a new file replaces the old one.
router.put("/admin/scene-trophies/:sceneKey", protect, adminOnly, uploadGlb, async (req, res) => {
  const discardUpload = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  try {
    const environment = await findEnvironment(req.params.sceneKey);
    if (!environment) {
      discardUpload();
      return res.status(404).json({ message: "Scene not found" });
    }

    const existing = await prisma.sceneTrophy.findUnique({ where: { sceneKey: environment.key } });

    if (!req.file && !existing) return res.status(400).json({ message: "Choose a .glb file" });

    if (req.file && !looksLikeGlb(req.file.path)) {
      discardUpload();
      return res.status(400).json({ message: "That file isn't a valid .glb model" });
    }

    const rawLabel = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    if (rawLabel.length > MAX_LABEL_LENGTH) {
      discardUpload();
      return res.status(400).json({ message: `The name can be at most ${MAX_LABEL_LENGTH} characters` });
    }
    const label = rawLabel || existing?.label || `${environment.label} trophy`;

    const data = { label };
    if (req.file) data.src = `${UPLOAD_PREFIX}${req.file.filename}`;

    const saved = existing
      ? await prisma.sceneTrophy.update({ where: { id: existing.id }, data })
      : await prisma.sceneTrophy.create({ data: { sceneKey: environment.key, ...data } });

    // The replaced model is no longer used.
    if (req.file && existing) removeTrophyFile(existing);

    await exportSnapshot();
    res.status(existing ? 200 : 201).json(toPublic(saved));
  } catch (err) {
    discardUpload();
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: remove the trophy of a Scene. The uploaded file is deleted from disk too.
router.delete("/admin/scene-trophies/:sceneKey", protect, adminOnly, async (req, res) => {
  try {
    const environment = await findEnvironment(req.params.sceneKey);
    const sceneKey = environment?.key || req.params.sceneKey;

    const existing = await prisma.sceneTrophy.findUnique({ where: { sceneKey } });
    if (!existing) return res.status(404).json({ message: "This Scene has no trophy" });

    await prisma.sceneTrophy.delete({ where: { id: existing.id } });
    removeTrophyFile(existing);

    await exportSnapshot();
    res.json({ message: "Trophy removed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
