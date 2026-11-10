// musicTracks.js
//
// Admin-managed list of the website's background music (see client/src/components/MusicProvider.jsx).
// Replaces what used to be a fixed list of four files in client/src/lib/music.js - adding a track is
// now an upload from the Admin dashboard instead of a code change + deploy.
//
// A track's `src` says where its file is:
//   - "/audio/<file>.mp3"        - a file in client/public/audio/ (the original four tracks). The
//                                   website serves it itself.
//   - "/uploads/music/<file>.mp3" - a file the admin uploaded, stored in server/uploads/music/ and
//                                   served by this server (see the static mount in index.js).
// The website puts the server's address in front of the second kind (see client/src/lib/music.js).
//
// `key` is what each browser remembers as its chosen track. It is made when the track is created and
// never changes, even if the admin renames the track.
//
// A hidden track stays in the database (and on disk) but is left out of the list everyone else gets.

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { exportMusicTracksSnapshot } from "../lib/musicTracksExport.js";

const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "music");
const UPLOAD_PREFIX = "/uploads/music/";
const MAX_LABEL_LENGTH = 40;
const MAX_FILE_MB = 15;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}.mp3`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".mp3") {
      return cb(new Error("Only .mp3 files are allowed"));
    }
    cb(null, true);
  },
});

// Runs the upload and answers upload problems (wrong type, too big) as a normal JSON message.
const uploadMp3 = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE" ? `The file is too big (the limit is ${MAX_FILE_MB} MB)` : err.message;
    res.status(400).json({ message });
  });
};

// What the website gets for each track.
const toPublic = (t) => ({
  id: t.id,
  key: t.key,
  label: t.label,
  src: t.src,
  isHidden: t.isHidden,
  orderNumber: t.orderNumber,
});

// Removes an uploaded file from disk. Tracks that point at client/public/audio/ have no file here.
const removeUploadedFile = (track) => {
  if (!track.src.startsWith(UPLOAD_PREFIX)) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(track.src)), () => {});
};

const exportSnapshot = async () => {
  try {
    await exportMusicTracksSnapshot();
  } catch (exportErr) {
    console.error("[musicTracks] Failed to export seed snapshot:", exportErr);
  }
};

// Reads a track name from the request. Returns { error } or { label }.
const readLabel = (value) => {
  const label = typeof value === "string" ? value.trim() : "";
  if (!label) return { error: "Give the track a name" };
  if (label.length > MAX_LABEL_LENGTH) return { error: `The name can be at most ${MAX_LABEL_LENGTH} characters` };
  return { label };
};

// Anyone, even before logging in (the music plays on the sign-in pages too): the tracks people can
// choose from, in display order. Hidden tracks are left out.
router.get("/music-tracks", async (req, res) => {
  try {
    const tracks = await prisma.musicTrack.findMany({ where: { isHidden: false }, orderBy: { orderNumber: "asc" } });
    res.json(tracks.map(toPublic));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: every track, including hidden ones.
router.get("/admin/music-tracks", protect, adminOnly, async (req, res) => {
  try {
    const tracks = await prisma.musicTrack.findMany({ orderBy: { orderNumber: "asc" } });
    res.json(tracks.map(toPublic));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: add a track - the name and the .mp3 file in one request (multipart form: label + file).
router.post("/admin/music-tracks", protect, adminOnly, uploadMp3, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Choose an .mp3 file" });

  const { label, error } = readLabel(req.body?.label);
  if (error) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: error });
  }

  try {
    const maxOrder = await prisma.musicTrack.aggregate({ _max: { orderNumber: true } });

    const created = await prisma.musicTrack.create({
      data: {
        key: `track-${Date.now().toString(36)}`,
        label,
        src: `${UPLOAD_PREFIX}${req.file.filename}`,
        orderNumber: (maxOrder._max.orderNumber ?? -1) + 1,
      },
    });

    await exportSnapshot();
    res.status(201).json(toPublic(created));
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: rename a track, hide / show it, or change its position. Swapping the audio file itself is
// not supported - delete the track and add a new one instead.
router.patch("/admin/music-tracks/:id", protect, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { label, isHidden, orderNumber } = req.body || {};
  const data = {};

  if (label !== undefined) {
    const read = readLabel(label);
    if (read.error) return res.status(400).json({ message: read.error });
    data.label = read.label;
  }
  if (isHidden !== undefined) {
    if (typeof isHidden !== "boolean") return res.status(400).json({ message: "isHidden must be true or false" });
    data.isHidden = isHidden;
  }
  if (orderNumber !== undefined) {
    if (!Number.isInteger(orderNumber)) return res.status(400).json({ message: "orderNumber must be a whole number" });
    data.orderNumber = orderNumber;
  }

  try {
    const existing = await prisma.musicTrack.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Track not found" });

    const updated = await prisma.musicTrack.update({ where: { id }, data });

    await exportSnapshot();
    res.json(toPublic(updated));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: delete a track. An uploaded file is removed from disk too; the original four files in
// client/public/audio/ are not touched. A browser that had the track chosen falls back to the first one.
router.delete("/admin/music-tracks/:id", protect, adminOnly, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const existing = await prisma.musicTrack.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Track not found" });

    await prisma.musicTrack.delete({ where: { id } });
    removeUploadedFile(existing);

    await exportSnapshot();
    res.json({ message: "Track deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
