// Recreates every vault's question-set structure (draft or published) from
// prisma/vaultTemplatesSeed.json - the snapshot vaultTemplates.js automatically re-writes every
// time an admin saves a draft, publishes, or unpublishes a vault (see lib/vaultTemplatesExport.js).
// That JSON file is checked into git, unlike the VaultTemplate/TemplateSlot rows it's generated
// from, so it travels with the repo - this is what turns it back into real database rows on a
// fresh install/database, which is otherwise the ONE thing `npm install` + `prisma migrate`
// doesn't recreate (see seedAdmin.js for the same idea applied to the admin login).
//
// Runs automatically on every server startup (see index.js, via scripts/seedAll.js) - a fresh
// clone needs no separate manual step for this. Still runnable by hand from server/ if you ever
// need to force a re-seed without restarting the server (e.g. after hand-editing the JSON file):
//   node scripts/seedVaultTemplates.js
//
// Safe to re-run: it upserts on scene, replacing that vault's whole slot list each time - running
// it again just re-applies whatever's currently in the JSON file.

import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";

const SEED_PATH = path.join(process.cwd(), "prisma", "vaultTemplatesSeed.json");

export async function seedVaultTemplates() {
  if (!fs.existsSync(SEED_PATH)) {
    console.log(
      "No prisma/vaultTemplatesSeed.json yet - that file is only created once an admin saves a " +
      "draft or publishes/unpublishes a vault through the Admin dashboard (it auto-exports every " +
      "time). Nothing to seed yet."
    );
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));

  for (const entry of snapshot) {
    // An older snapshot has no standaloneNoteCount: that means no additional notes for a new
    // vault, and an existing vault keeps the count it already has.
    const standaloneNoteCount = entry.standaloneNoteCount ?? 0;

    const template = await prisma.vaultTemplate.upsert({
      where: { scene: entry.scene },
      update: {
        isPublished: entry.isPublished,
        ...(entry.standaloneNoteCount !== undefined && { standaloneNoteCount }),
      },
      create: { scene: entry.scene, isPublished: entry.isPublished, standaloneNoteCount },
    });

    await prisma.templateSlot.deleteMany({ where: { templateId: template.id } });
    await prisma.templateSlot.createMany({
      data: entry.slots.map((type, i) => ({ templateId: template.id, orderNumber: i + 1, type })),
    });

    console.log(
      `Seeded "${entry.scene}" - ${entry.slots.length} slot(s), ${standaloneNoteCount} additional note(s), ${entry.isPublished ? "published" : "draft"}.`
    );
  }
}

// Only runs this when the file is executed directly (`node scripts/seedVaultTemplates.js`), not
// when scripts/seedAll.js imports `seedVaultTemplates` from it - an import must never disconnect
// the shared Prisma client the rest of the running server is still using.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedVaultTemplates()
    .catch((err) => {
      console.error("Failed to seed vault templates:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
