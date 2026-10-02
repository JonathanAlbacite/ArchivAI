// Recreates every character set's row (label, order, slot/meshName/optionId mappings) from
// prisma/characterSetsSeed.json - the snapshot routes/characterSets.js automatically re-writes
// every time an admin adds, edits, or deletes a set (see lib/characterSetsExport.js). That JSON
// file is checked into git, unlike the CharacterSet/CharacterSetSlot rows it's generated from, so
// it travels with the repo - this turns it back into real database rows on a fresh install/
// database, the same role seedVaultTemplates.js plays for vault templates and seedAdmin.js plays
// for the admin login.
//
// Upserts by glbFilename (the one field guaranteed unique and stable across machines), and
// re-applies each slot's optionId EXACTLY as stored in the JSON rather than regenerating it -
// important, since a fresh database's auto-incremented ids won't match the original machine's,
// and optionId is what a student's saved CharacterLoadout (and Unity's own registry) refer to.
//
// IMPORTANT - this only recreates the DATABASE rows. The actual .glb files referenced by
// glbFilename must also exist under server/uploads/character-sets/ for anything to actually load;
// those are committed to git alongside this JSON file (see server/.gitignore), so a normal git
// clone already has them.
//
// Runs automatically on every server startup (see index.js, via scripts/seedAll.js) - a fresh
// clone needs no separate manual step for this. Still runnable by hand from server/ if you ever
// need to force a re-seed without restarting the server:
//   node scripts/seedCharacterSets.js

import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";

const SEED_PATH = path.join(process.cwd(), "prisma", "characterSetsSeed.json");
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "character-sets");

export async function seedCharacterSets() {
  if (!fs.existsSync(SEED_PATH)) {
    console.log(
      "No prisma/characterSetsSeed.json yet - that file is only created once an admin adds, " +
      "edits, or deletes a character set through the Admin dashboard (it auto-exports every " +
      "time). Nothing to seed yet."
    );
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));

  for (const entry of snapshot) {
    if (!fs.existsSync(path.join(UPLOAD_DIR, entry.glbFilename))) {
      console.warn(
        `Skipping "${entry.label}" - uploads/character-sets/${entry.glbFilename} isn't on disk. ` +
        "Copy the .glb file there first, then re-run the seed."
      );
      continue;
    }

    const characterSet = await prisma.characterSet.upsert({
      where: { glbFilename: entry.glbFilename },
      update: { label: entry.label, orderNumber: entry.orderNumber },
      create: { label: entry.label, glbFilename: entry.glbFilename, orderNumber: entry.orderNumber },
    });

    await prisma.characterSetSlot.deleteMany({ where: { characterSetId: characterSet.id } });
    await prisma.characterSetSlot.createMany({
      data: entry.slots.map((s) => ({
        characterSetId: characterSet.id,
        slot: s.slot,
        meshName: s.meshName,
        optionId: s.optionId,
      })),
    });

    console.log(`Seeded "${entry.label}" - ${entry.slots.length} slot(s).`);
  }
}

// Only runs this when the file is executed directly (`node scripts/seedCharacterSets.js`), not
// when scripts/seedAll.js imports `seedCharacterSets` from it - an import must never disconnect
// the shared Prisma client the rest of the running server is still using.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCharacterSets()
    .catch((err) => {
      console.error("Failed to seed character sets:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
