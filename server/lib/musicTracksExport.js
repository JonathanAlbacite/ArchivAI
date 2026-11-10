// musicTracksExport.js
//
// Re-writes prisma/musicTracksSeed.json from whatever's currently in the database. Called
// automatically from routes/musicTracks.js every time an admin adds, edits, hides, reorders or
// deletes a track - same reasoning as lib/characterSetsExport.js: the MusicTrack rows only ever live
// in the database, so a fresh clone or a fresh database starts with none of them. Checking this file
// into git (and scripts/seedMusicTracks.js, which reads it back in) is what makes the list portable.
//
// NOTE - this only snapshots the database rows (name, file location, order, hidden). The uploaded
// .mp3 files live under server/uploads/music/ and need to be committed to git the normal way for the
// seeded rows to actually play. The first four tracks are not uploads: they are files in
// client/public/audio/ and already travel with the client.

import fs from "fs";
import path from "path";
import prisma from "./prisma.js";

const SEED_PATH = path.join(process.cwd(), "prisma", "musicTracksSeed.json");

export async function exportMusicTracksSnapshot() {
  const tracks = await prisma.musicTrack.findMany({ orderBy: { orderNumber: "asc" } });

  const snapshot = tracks.map((t) => ({
    key: t.key,
    label: t.label,
    src: t.src,
    isHidden: t.isHidden,
    orderNumber: t.orderNumber,
  }));

  fs.writeFileSync(SEED_PATH, JSON.stringify(snapshot, null, 2) + "\n");
}
