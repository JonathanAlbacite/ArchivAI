// Creates the scene trophies listed in prisma/sceneTrophiesSeed.json - the snapshot
// routes/sceneTrophies.js automatically re-writes every time an admin changes a trophy (see
// lib/sceneTrophiesExport.js). That JSON file is checked into git, unlike the SceneTrophy rows it's
// generated from, so it travels with the repo - this turns it back into real database rows on a fresh
// install/database, the same role seedMusicTracks.js plays for the music tracks.
//
// It only CREATES trophies for scenes that have none yet (matched by sceneKey). A trophy that is
// already in the database is left exactly as it is, so a replace or rename made by the admin is never
// put back by a restart.
//
// IMPORTANT - this only recreates the DATABASE rows. The trophy's .glb file must also exist under
// server/uploads/trophies/ (those files are committed to git, see server/.gitignore). A trophy whose
// file is missing is skipped with a warning.
//
// Runs automatically on every server startup (see index.js, via scripts/seedAll.js). Still runnable
// by hand from server/ if you ever need to force it without restarting the server:
//   node scripts/seedSceneTrophies.js

import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";

const SEED_PATH = path.join(process.cwd(), "prisma", "sceneTrophiesSeed.json");
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "trophies");

export async function seedSceneTrophies() {
  if (!fs.existsSync(SEED_PATH)) {
    console.log("No prisma/sceneTrophiesSeed.json - nothing to seed for the scene trophies.");
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));

  for (const entry of snapshot) {
    if (!fs.existsSync(path.join(UPLOAD_DIR, path.basename(entry.src)))) {
      console.warn(
        `Skipping the trophy for "${entry.sceneKey}" - uploads/trophies/${path.basename(entry.src)} isn't on disk. ` +
        "Copy the .glb file there first, then re-run the seed."
      );
      continue;
    }

    const existing = await prisma.sceneTrophy.findUnique({ where: { sceneKey: entry.sceneKey } });
    if (existing) continue;

    await prisma.sceneTrophy.create({
      data: { sceneKey: entry.sceneKey, label: entry.label, src: entry.src },
    });

    console.log(`Seeded the trophy for "${entry.sceneKey}".`);
  }
}

// Only runs this when the file is executed directly (`node scripts/seedSceneTrophies.js`), not when
// scripts/seedAll.js imports `seedSceneTrophies` from it - an import must never disconnect the shared
// Prisma client the rest of the running server is still using.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSceneTrophies()
    .catch((err) => {
      console.error("Failed to seed scene trophies:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
