// Runs every startup seed, in order - the admin login, then vault templates, then character sets.
// Used two ways:
//   1. Automatically, every time the server boots (see index.js) - this is what lets a fresh clone
//      + npm install + a database migration come up fully set up, with no separate seed command.
//   2. By hand, via `npm run seed`, to force a re-seed without restarting the server (e.g. after
//      manually editing one of the seed JSON files under prisma/).
//
// Each of the three is independently safe to re-run - they upsert rather than blindly insert, see
// each file's own header - so running all three on every single server startup is safe, not just
// the first time.

import prisma from "../lib/prisma.js";
import { seedAdmin } from "./seedAdmin.js";
import { seedVaultTemplates } from "./seedVaultTemplates.js";
import { seedCharacterSets } from "./seedCharacterSets.js";

export async function runAllSeeds() {
  await seedAdmin();
  await seedVaultTemplates();
  await seedCharacterSets();
}

// Only runs this when the file is executed directly (`node scripts/seedAll.js` / `npm run seed`),
// not when index.js imports `runAllSeeds` from it on server startup - an import must never
// disconnect the shared Prisma client the rest of the running server is still using.
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllSeeds()
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
