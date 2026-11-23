// sceneTrophiesExport.js
//
// Re-writes prisma/sceneTrophiesSeed.json from whatever's currently in the database. Called
// automatically from routes/sceneTrophies.js every time an admin adds, replaces, renames or removes a
// trophy - same reasoning as lib/musicTracksExport.js: the SceneTrophy rows only ever live in the
// database, so a fresh clone or a fresh database starts with none of them. Checking this file into
// git (and scripts/seedSceneTrophies.js, which reads it back in) is what makes the trophies portable.
//
// NOTE - this only snapshots the database rows (scene, name, file location). The uploaded .glb files
// live under server/uploads/trophies/ and need to be committed to git the normal way for the seeded
// rows to actually show.

import fs from "fs";
import path from "path";
import prisma from "./prisma.js";

const SEED_PATH = path.join(process.cwd(), "prisma", "sceneTrophiesSeed.json");

export async function exportSceneTrophiesSnapshot() {
  const trophies = await prisma.sceneTrophy.findMany({ orderBy: { sceneKey: "asc" } });

  const snapshot = trophies.map((t) => ({
    sceneKey: t.sceneKey,
    label: t.label,
    src: t.src,
  }));

  fs.writeFileSync(SEED_PATH, JSON.stringify(snapshot, null, 2) + "\n");
}
