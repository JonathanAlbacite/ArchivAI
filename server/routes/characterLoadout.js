// routes/characterLoadout.js
//
// Persists each user's current character customization selection - see the game repo's
// character-customization.md doc and the CharacterLoadout model in schema.prisma. Deliberately
// stores and returns ONLY the chosen option ID per slot, never the part catalog itself - the Unity
// project's own CharacterPartRegistryAsset stays the single source of truth for what options exist,
// and the picking UI runs inside the embedded Unity scene, not here.
//
// SAME JSON SHAPE AS UNITY, BOTH WAYS - {"parts":[{"slot":"Head","optionId":"head002"}, ...]} is
// exactly what CharacterCustomizationController.GetCurrentLoadout() produces on the Unity side and
// what CharacterCustomizationWebBridge.ApplyLoadoutJson() expects to receive - so the frontend can
// pass this route's GET response straight into the embedded Unity build via SendMessage with no
// reshaping, and PUT accepts exactly what Unity would send back after a save.

import express from "express";
import prisma from "../lib/prisma.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Maps a BodyPartSlot name (matching Unity's own enum names exactly - Head/Body/Arm/Leg) to this
// table's flat column name. Kept in one place so GET/PUT (and anything added here later) can't
// drift out of sync with each other.
const SLOT_COLUMNS = {
  Head: "headOptionId",
  Body: "bodyOptionId",
  Arm: "armOptionId",
  Leg: "legOptionId",
};

// Converts a CharacterLoadout row's 4 flat columns into the {"parts":[...]} shape - omits any slot
// whose optionId is null/not set, so ApplyLoadoutJson() on the Unity side simply leaves that slot
// showing whatever it already does, rather than being told to apply a missing option (see
// CharacterLoadout's own schema.prisma comment on why these columns are nullable). row is null for
// a user who has never saved a loadout at all - treated the same as one with nothing set.
function rowToParts(row) {
  const parts = [];
  for (const [slot, column] of Object.entries(SLOT_COLUMNS)) {
    const optionId = row?.[column];
    if (optionId) parts.push({ slot, optionId });
  }
  return { parts };
}

// Get the logged-in user's own saved loadout. Always re-derives the row from req.user.id (the
// authenticated user, from the JWT - see middleware/auth.js), never from anything the client sends,
// so one account can never read another's loadout. Returns an empty parts list (not a 404) for a
// user who hasn't customized anything yet - see rowToParts above.
router.get("/", protect, async (req, res) => {
  try {
    const row = await prisma.characterLoadout.findUnique({
      where: { userId: req.user.id },
    });

    res.json(rowToParts(row));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Saves the logged-in user's current loadout. Body shape: {"parts":[{"slot":"Head",
// "optionId":"head002"}, ...]} - the exact shape Unity's own GetCurrentLoadout() produces. An entry
// with an unrecognized slot name is skipped rather than failing the whole request (mirroring
// CharacterCustomizationWebBridge's own "don't let one bad entry ruin the rest" behavior on the
// Unity side). A slot left OUT of the request entirely is left UNCHANGED in the database - send
// optionId: null explicitly for a slot to clear it back to no selection.
router.put("/", protect, async (req, res) => {
  const parts = Array.isArray(req.body?.parts) ? req.body.parts : [];

  const data = {};
  for (const part of parts) {
    const column = SLOT_COLUMNS[part?.slot];
    if (!column) continue; // unrecognized slot name - skipped, not an error
    data[column] = part.optionId ?? null;
  }

  try {
    const row = await prisma.characterLoadout.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...data },
      update: data,
    });

    res.json(rowToParts(row));
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

export default router;
