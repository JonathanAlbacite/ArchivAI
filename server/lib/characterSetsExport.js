// characterSetsExport.js
//
// Re-writes prisma/characterSetsSeed.json from whatever's currently in the database. Called
// automatically from routes/characterSets.js every time an admin creates, edits, or deletes a
// character set - same reasoning as lib/vaultTemplatesExport.js: CharacterSet/CharacterSetSlot
// rows only ever live in the database, so a fresh clone or a fresh database starts with none of
// them. Checking this file into git (and scripts/seedCharacterSets.js, which reads it back in) is
// what makes that catalog portable.
//
// NOTE - this only snapshots the database rows (label, orderNumber, slot/meshName/optionId
// mappings), not the actual .glb files themselves. Those live under
// server/uploads/character-sets/ and need to be committed to git the normal way (or restaged on
// a fresh machine) for the seeded rows to actually resolve to real models.

import fs from "fs";
import path from "path";
import prisma from "./prisma.js";

const SEED_PATH = path.join(process.cwd(), "prisma", "characterSetsSeed.json");

export async function exportCharacterSetsSnapshot() {
  const sets = await prisma.characterSet.findMany({
    include: { slots: true },
    orderBy: { orderNumber: "asc" },
  });

  const snapshot = sets.map((s) => ({
    label: s.label,
    glbFilename: s.glbFilename,
    orderNumber: s.orderNumber,
    slots: s.slots.map((slot) => ({ slot: slot.slot, meshName: slot.meshName, optionId: slot.optionId })),
  }));

  fs.writeFileSync(SEED_PATH, JSON.stringify(snapshot, null, 2) + "\n");
}
