// characterSets.js
//
// Admin-managed, extensible catalog of character models for the website's Customize Character
// scene (see client/src/components/CharacterCustomizer3D.jsx). Replaces what used to be a
// hardcoded SOURCES/PART_CATALOG table in that component - adding a new character is now an
// admin upload instead of a code change + deploy. See character-customization project notes for
// the full picture, including the one thing this does NOT solve: a newly-uploaded set previews
// correctly on the website, but won't appear in the real Unity gameplay build until someone also
// imports a matching FBX into the Unity project and adds it to CharacterPartRegistryAsset by hand
// - that part needs the Unity Editor and can't be automated here.
//
// UPLOAD FLOW (two requests, matching how the admin page actually works) -
//   1. POST /admin/character-sets/parse-upload - uploads the .glb to disk and reads back every
//      named node inside it (see lib/glbNodeNames.js), WITHOUT creating any CharacterSet row yet.
//      The admin page shows those names in four dropdowns (Head/Body/Arm/Leg) for the admin to
//      assign by hand - GLBs aren't guaranteed to follow any naming convention (see that file's
//      own header), so this can't be done automatically.
//   2. POST /admin/character-sets - creates the actual CharacterSet + CharacterSetSlot rows from
//      the filename returned by step 1 plus whichever mapping the admin chose. If the admin
//      cancels after step 1, the uploaded file is simply left orphaned on disk - same tradeoff
//      lessonModules.js already makes for its own uploads, not worth a cleanup job for how rarely
//      this runs.
//
// optionId (CharacterSetSlot) is the stable string hading off to CharacterLoadout/Unity - once
// created it never changes, even if the set's label/order does, since a student's saved loadout
// refers to it by this string alone.

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma.js";
import { protect, adminOnly } from "../middleware/auth.js";
import { readGlbNodeNames } from "../lib/glbNodeNames.js";
import { exportCharacterSetsSnapshot } from "../lib/characterSetsExport.js";

const router = express.Router();

const VALID_SLOTS = ["Head", "Body", "Arm", "Leg"];
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "character-sets");

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
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== ".glb") {
      return cb(new Error("Only .glb files are allowed"));
    }
    cb(null, true);
  },
});

// Everyone logged in (student, teacher, or admin) reads the catalog - the picker UI itself has no
// reason to be admin-gated, only changing it does.
router.get("/character-sets", protect, async (req, res) => {
  try {
    const sets = await prisma.characterSet.findMany({
      include: { slots: true },
      orderBy: { orderNumber: "asc" },
    });
    res.json(sets);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Step 1 of the upload flow - see file header.
router.post(
  "/admin/character-sets/parse-upload",
  protect,
  adminOnly,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const nodeNames = readGlbNodeNames(req.file.path);
      res.json({ glbFilename: req.file.filename, nodeNames });
    } catch (err) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ message: "Could not read that file", error: err.message });
    }
  }
);

// Step 2 of the upload flow - creates the real rows from an already-uploaded file.
router.post("/admin/character-sets", protect, adminOnly, async (req, res) => {
  const { label, glbFilename, slots } = req.body;

  if (!label || !label.trim()) return res.status(400).json({ message: "label is required" });
  if (!glbFilename) return res.status(400).json({ message: "glbFilename is required - upload the file first" });
  if (!fs.existsSync(path.join(UPLOAD_DIR, glbFilename)))
    return res.status(400).json({ message: "That uploaded file can't be found - try uploading again" });
  if (!Array.isArray(slots) || slots.length === 0)
    return res.status(400).json({ message: "At least one slot mapping is required" });
  if (slots.some((s) => !s || !VALID_SLOTS.includes(s.slot) || !s.meshName))
    return res.status(400).json({ message: `Each slot must have a slot in ${VALID_SLOTS.join(", ")} and a meshName` });

  try {
    const maxOrder = await prisma.characterSet.aggregate({ _max: { orderNumber: true } });

    const created = await prisma.characterSet.create({
      data: {
        label: label.trim(),
        glbFilename,
        orderNumber: (maxOrder._max.orderNumber ?? -1) + 1,
      },
    });

    await prisma.characterSetSlot.createMany({
      data: slots.map((s) => ({
        characterSetId: created.id,
        slot: s.slot,
        meshName: s.meshName,
        // Deterministic from this row's own slot + the set's own new id, so it's guaranteed
        // unique with zero risk of collision - never shown to or chosen by the admin directly.
        optionId: `${s.slot.toLowerCase()}${created.id}`,
      })),
    });

    const result = await prisma.characterSet.findUnique({ where: { id: created.id }, include: { slots: true } });

    try {
      await exportCharacterSetsSnapshot();
    } catch (exportErr) {
      console.error("[characterSets] Failed to export seed snapshot:", exportErr);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Admin: rename, reorder, or re-map an existing set's slots. Doesn't accept a new glbFilename -
// swapping the actual model file for an existing set is deliberately not supported; delete it and
// create a new one instead, so a slot's optionId (and anything already saved against it) never
// silently starts pointing at different geometry.
router.patch("/admin/character-sets/:id", protect, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { label, orderNumber, slots } = req.body;

  try {
    const existing = await prisma.characterSet.findUnique({ where: { id }, include: { slots: true } });
    if (!existing) return res.status(404).json({ message: "Character set not found" });

    await prisma.characterSet.update({
      where: { id },
      data: {
        ...(label !== undefined ? { label: label.trim() } : {}),
        ...(orderNumber !== undefined ? { orderNumber } : {}),
      },
    });

    if (Array.isArray(slots)) {
      if (slots.some((s) => !s || !VALID_SLOTS.includes(s.slot) || !s.meshName))
        return res.status(400).json({ message: `Each slot must have a slot in ${VALID_SLOTS.join(", ")} and a meshName` });

      const existingBySlot = Object.fromEntries(existing.slots.map((s) => [s.slot, s]));
      const incomingSlotNames = slots.map((s) => s.slot);

      // Remove any slot no longer present in the incoming list.
      const toRemove = existing.slots.filter((s) => !incomingSlotNames.includes(s.slot));
      if (toRemove.length > 0) {
        await prisma.characterSetSlot.deleteMany({ where: { id: { in: toRemove.map((s) => s.id) } } });
      }

      // Update meshName on slots that already exist (keeping their optionId stable - see file
      // header), create new rows (with a freshly generated optionId) for anything new.
      for (const s of slots) {
        const current = existingBySlot[s.slot];
        if (current) {
          await prisma.characterSetSlot.update({ where: { id: current.id }, data: { meshName: s.meshName } });
        } else {
          await prisma.characterSetSlot.create({
            data: { characterSetId: id, slot: s.slot, meshName: s.meshName, optionId: `${s.slot.toLowerCase()}${id}` },
          });
        }
      }
    }

    const result = await prisma.characterSet.findUnique({ where: { id }, include: { slots: true } });

    try {
      await exportCharacterSetsSnapshot();
    } catch (exportErr) {
      console.error("[characterSets] Failed to export seed snapshot:", exportErr);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/admin/character-sets/:id", protect, adminOnly, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const existing = await prisma.characterSet.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Character set not found" });

    await prisma.characterSet.delete({ where: { id } }); // cascades its CharacterSetSlot rows

    fs.unlink(path.join(UPLOAD_DIR, existing.glbFilename), () => {});

    try {
      await exportCharacterSetsSnapshot();
    } catch (exportErr) {
      console.error("[characterSets] Failed to export seed snapshot:", exportErr);
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
