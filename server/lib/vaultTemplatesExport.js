// vaultTemplatesExport.js
//
// Re-writes prisma/vaultTemplatesSeed.json from whatever's currently in the database. Called
// automatically from vaultTemplates.js every time an admin saves a draft, publishes, or
// unpublishes a vault template - see that file's calls into exportVaultTemplatesSnapshot().
//
// WHY THIS EXISTS - VaultTemplate/TemplateSlot rows only ever live in the database; nothing about
// an admin's vault presets is checked into the repo. That means a fresh clone on another machine,
// or a fresh database, starts with none of them - `npm install` and `prisma migrate` don't recreate
// this data, the same way they don't recreate the one hardcoded admin login (see seedAdmin.js for
// that). Auto-exporting a snapshot to this JSON file every time the admin changes anything means
// the file is always up to date with no extra step - once it's committed to git, it travels with
// the repo, and scripts/seedVaultTemplates.js is what turns it back into real rows on whichever
// database a fresh install is pointed at.

import fs from "fs";
import path from "path";
import prisma from "./prisma.js";

const SEED_PATH = path.join(process.cwd(), "prisma", "vaultTemplatesSeed.json");

export async function exportVaultTemplatesSnapshot() {
  const templates = await prisma.vaultTemplate.findMany({
    include: { slots: { orderBy: { orderNumber: "asc" } } },
    orderBy: { scene: "asc" },
  });

  const snapshot = templates.map((t) => ({
    scene: t.scene,
    isPublished: t.isPublished,
    slots: t.slots.map((s) => s.type),
  }));

  fs.writeFileSync(SEED_PATH, JSON.stringify(snapshot, null, 2) + "\n");
}
