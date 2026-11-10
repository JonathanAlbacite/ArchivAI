// Creates the background music tracks listed in prisma/musicTracksSeed.json - the snapshot
// routes/musicTracks.js automatically re-writes every time an admin changes the list (see
// lib/musicTracksExport.js). That JSON file is checked into git, unlike the MusicTrack rows it's
// generated from, so it travels with the repo - this turns it back into real database rows on a fresh
// install/database, the same role seedCharacterSets.js plays for character sets.
//
// It only CREATES tracks that don't exist yet (matched by key). A track that is already in the
// database is left exactly as it is, so a rename, reorder or hide made by the admin is never put back
// by a restart.
//
// IMPORTANT - this only recreates the DATABASE rows. A track whose src starts with /uploads/music/
// is an uploaded file and must also exist under server/uploads/music/ (those files are committed to
// git, see server/.gitignore). The first four tracks (src starting with /audio/) are files in
// client/public/audio/ and are not checked here.
//
// Runs automatically on every server startup (see index.js, via scripts/seedAll.js). Still runnable
// by hand from server/ if you ever need to force it without restarting the server:
//   node scripts/seedMusicTracks.js

import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";

const SEED_PATH = path.join(process.cwd(), "prisma", "musicTracksSeed.json");
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "music");
const UPLOAD_PREFIX = "/uploads/music/";

export async function seedMusicTracks() {
  if (!fs.existsSync(SEED_PATH)) {
    console.log("No prisma/musicTracksSeed.json - nothing to seed for the music tracks.");
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));

  for (const entry of snapshot) {
    if (entry.src.startsWith(UPLOAD_PREFIX) && !fs.existsSync(path.join(UPLOAD_DIR, path.basename(entry.src)))) {
      console.warn(
        `Skipping "${entry.label}" - uploads/music/${path.basename(entry.src)} isn't on disk. ` +
        "Copy the .mp3 file there first, then re-run the seed."
      );
      continue;
    }

    const existing = await prisma.musicTrack.findUnique({ where: { key: entry.key } });
    if (existing) continue;

    await prisma.musicTrack.create({
      data: {
        key: entry.key,
        label: entry.label,
        src: entry.src,
        isHidden: Boolean(entry.isHidden),
        orderNumber: entry.orderNumber,
      },
    });

    console.log(`Seeded music track "${entry.label}".`);
  }
}

// Only runs this when the file is executed directly (`node scripts/seedMusicTracks.js`), not when
// scripts/seedAll.js imports `seedMusicTracks` from it - an import must never disconnect the shared
// Prisma client the rest of the running server is still using.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedMusicTracks()
    .catch((err) => {
      console.error("Failed to seed music tracks:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
