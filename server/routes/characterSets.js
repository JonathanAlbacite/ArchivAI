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
// optionId (CharacterSetSlot) is the string handed off to CharacterLoadout/Unity.
//
// AUTO-GENERATED, AND KEPT LIVE, TO MATCH UNITY'S OWN AUTO-ID FORMAT - <slot lowercase><3-digit
// position>, e.g. "head001", "head002" - the exact format CharacterPartRegistryEditor.cs
// auto-generates for that slot's Nth option in the Unity registry.
// The important word there is "position", not "count": Unity recomputes every option's ID from
// its CURRENT position in the list on every single Inspector redraw, so deleting or reordering an
// option there renumbers everything after it automatically. renumberOptionIds() below is the
// website's equivalent of that redraw - it walks every CharacterSet in orderNumber order and
// reassigns each slot's optionIds 000, 001, 002... from scratch, and is called after every create,
// delete, and reorder, so a deleted set's gap closes up and a reordered set's numbering shifts,
// instead of leaving stale or gapped IDs behind the way a simple "count existing rows" counter
// would.
//
// THE FIRST SET IS THE BASE LOOK, AUTOMATICALLY - the set at position 0 (lowest orderNumber) gets
// "000" (head000, body000, ...), and the rest continue 001, 002, ... so website set N lines up with
// Unity's Nth real option. Unity is 1-indexed (its first real option is "head001"), so "000" never
// matches anything in its registry - CharacterCustomizationController.SetPart() just logs a warning
// and leaves that part showing whatever mesh the character prefab already has. That is what makes
// the first set mean "the game's own default look", with no Unity-side change. Moving a different
// set to the top (the admin's up/down arrows) makes it the base, and the old one becomes 001.
// See the character-customization project notes' "Website ID sync" section for the full
// story, including the one thing this still can't fix on its own: the two sides have no other
// link between them (no shared database, no API call from Unity to here), so this only actually
// matches a given option if whoever maintains both sides also adds/removes/reorders it in the
// same order on the Unity side. PATCH /admin/character-sets/:id/slots/:slotId (near the bottom of
// this file) is the manual escape hatch for when that drifts out of sync anyway - it lets an
// admin type in the exact optionId Unity is actually using for a given option. Note that a manual
// override set there is only as stable as the catalog around it: the NEXT create, delete, or
// reorder anywhere in the catalog re-runs renumberOptionIds() and will overwrite it back to the
// position-based value unless that value happens to already match the override.

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

// Temporary, guaranteed-unique placeholder for a brand-new CharacterSetSlot row, so the INSERT
// itself never collides with optionId's own @unique constraint (schema.prisma) before
// renumberOptionIds() below gets a chance to assign the row's real, position-based id.
function placeholderOptionId(tag) {
  return `__pending_${tag}_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
}

// Recomputes EVERY CharacterSetSlot's optionId from scratch, by each CharacterSet's own
// orderNumber - see MUST LITERALLY MATCH UNITY'S OWN AUTO-ID FORMAT, AND KEEP IT LIVE above. Each
// slot (Head/Body/Arm/Leg) is numbered independently, same as Unity numbers each slot's own
// option list independently - the first set that maps Head gets head000, the next head001, and so
// on, regardless of how many Body/Arm/Leg options exist. Called after every create, delete, and
// reorder (see call sites below) so the catalog never carries a gap or a stale number - only ever
// a brief, immediately corrected placeholder from placeholderOptionId() above while a row is
// mid-insert.
async function renumberOptionIds() {
  const sets = await prisma.characterSet.findMany({
    orderBy: { orderNumber: "asc" },
    include: { slots: true },
  });

  const changes = [];
  for (const slotName of VALID_SLOTS) {
    let position = 0;
    for (const set of sets) {
      const row = set.slots.find((s) => s.slot === slotName);
      if (!row) continue;
      const expected = `${slotName.toLowerCase()}${String(position++).padStart(3, "0")}`;
      if (row.optionId !== expected) changes.push({ rowId: row.id, optionId: expected });
    }
  }

  if (changes.length === 0) return;

  // Two passes, not one - optionId is globally @unique, so e.g. swapping head001 and head002
  // between two rows in a single pass would collide the moment the first row is written into the
  // other's still-current value. Moving every changing row to a throwaway placeholder first (that
  // can't collide with any real id or with another row's placeholder, since each embeds its own
  // row id) means the second pass can land every row on its final value with nothing left to
  // collide with.
  await prisma.$transaction(
    changes.map((c) => prisma.characterSetSlot.update({ where: { id: c.rowId }, data: { optionId: `__renumbering_${c.rowId}` } }))
  );
  await prisma.$transaction(
    changes.map((c) => prisma.characterSetSlot.update({ where: { id: c.rowId }, data: { optionId: c.optionId } }))
  );
}

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

    // Real optionIds come from renumberOptionIds() right after - a brand-new set always lands at
    // the END of orderNumber (see maxOrder above), so in practice this placeholder gets replaced
    // with exactly the next position-based id for each slot (or "000" if this is the very first
    // set), but going through renumberOptionIds() either way keeps this one insert path, not two.
    const slotsData = slots.map((s) => ({
      characterSetId: created.id,
      slot: s.slot,
      meshName: s.meshName,
      optionId: placeholderOptionId(`new${created.id}`),
    }));

    await prisma.characterSetSlot.createMany({ data: slotsData });
    await renumberOptionIds();

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

      // Remove any slot no longer present in the incoming list - closes that slot's gap too,
      // once renumberOptionIds() runs below.
      const toRemove = existing.slots.filter((s) => !incomingSlotNames.includes(s.slot));
      if (toRemove.length > 0) {
        await prisma.characterSetSlot.deleteMany({ where: { id: { in: toRemove.map((s) => s.id) } } });
      }

      // Update meshName on slots that already exist (their optionId gets re-derived below, not
      // touched here), create new rows (with a placeholder optionId - see placeholderOptionId()
      // above) for anything new.
      for (const s of slots) {
        const current = existingBySlot[s.slot];
        if (current) {
          await prisma.characterSetSlot.update({ where: { id: current.id }, data: { meshName: s.meshName } });
        } else {
          await prisma.characterSetSlot.create({
            data: { characterSetId: id, slot: s.slot, meshName: s.meshName, optionId: placeholderOptionId(`set${id}`) },
          });
        }
      }
    }

    // Covers both branches above (slots changed) and a bare orderNumber change (reorder) - cheap
    // no-op (see renumberOptionIds()'s own header) when neither actually shifted anything.
    if (Array.isArray(slots) || orderNumber !== undefined) {
      await renumberOptionIds();
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

// Admin: directly overrides one slot's optionId - the string sent to Unity/CharacterLoadout for
// that slot's part (see CharacterSetSlot's own schema.prisma comment). Normally this is only ever
// auto-generated by renumberOptionIds() above to already match Unity's own auto-ID format, but
// the two sides can still drift apart if the Unity-side registry ever gets its own
// add/remove/reorder that the website has no way to observe (see the character-customization
// project notes' "Website ID sync" section) - this is the direct fix for that: look at what
// Unity's CharacterPartRegistryAsset actually has for this option and type that exact string in
// here, no re-upload or re-mapping needed.
//
// Unlike the auto-generated value, this one is NOT re-derived by renumberOptionIds() on its own -
// but it also doesn't survive forever: the next create, delete, or reorder ANYWHERE in the
// catalog re-runs renumberOptionIds() for every slot, and will overwrite this override back to
// the plain position-based id unless that happens to be the same string. Re-apply the override
// after a catalog change if it still doesn't match Unity.
//
// Changing this does NOT touch any CharacterLoadout row that already referenced the OLD optionId
// - a student who had this option selected keeps the old string in their save until they re-pick
// something, and that save simply won't match anything in Unity's registry in the meantime (same
// silent-no-op as any other optionId/registry mismatch - see CharacterCustomizationController.
// SetPart()'s own header on the Unity side).
router.patch("/admin/character-sets/:id/slots/:slotId", protect, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const slotId = Number(req.params.slotId);
  const optionId = typeof req.body?.optionId === "string" ? req.body.optionId.trim() : "";

  if (!optionId) return res.status(400).json({ message: "optionId is required" });

  try {
    const slot = await prisma.characterSetSlot.findUnique({ where: { id: slotId } });
    if (!slot || slot.characterSetId !== id) {
      return res.status(404).json({ message: "Slot not found on this character set" });
    }

    const updated = await prisma.characterSetSlot.update({ where: { id: slotId }, data: { optionId } });

    try {
      await exportCharacterSetsSnapshot();
    } catch (exportErr) {
      console.error("[characterSets] Failed to export seed snapshot:", exportErr);
    }

    res.json(updated);
  } catch (err) {
    // optionId is @unique (schema.prisma) - Prisma's own collision code, not a generic 500.
    if (err.code === "P2002") {
      return res.status(400).json({ message: `"${optionId}" is already used by another slot.` });
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/admin/character-sets/:id", protect, adminOnly, async (req, res) => {
  const id = Number(req.params.id);

  try {
    const existing = await prisma.characterSet.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Character set not found" });

    await prisma.characterSet.delete({ where: { id } }); // cascades its CharacterSetSlot rows
    await renumberOptionIds(); // closes the gap this deletion just left in every slot's numbering

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
