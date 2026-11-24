import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import campaignRoutes from "./routes/campaigns.js";
import lessonModuleRoutes from "./routes/lessonModules.js";
import vaultTemplateRoutes from "./routes/vaultTemplates.js";
import environmentRoutes from "./routes/environments.js";
import characterLoadoutRoutes from "./routes/characterLoadout.js";
import characterSetRoutes from "./routes/characterSets.js";
import musicTrackRoutes from "./routes/musicTracks.js";
import sceneTrophyRoutes from "./routes/sceneTrophies.js";
import studentProgressRoutes from "./routes/studentProgress.js";
import ttsRoutes from "./routes/tts.js";
import { runAllSeeds } from "./scripts/seedAll.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Admin-uploaded character models (see routes/characterSets.js) - served directly so the
// website's three.js GLTFLoader can fetch them cross-origin, same as any other static asset.
// Scoped to just this one subfolder of uploads/, not the whole directory, so lesson-module files
// (teacher-uploaded documents) stay server-side only.
app.use("/uploads/character-sets", express.static(path.join(process.cwd(), "uploads", "character-sets")));

// Admin-uploaded background music (see routes/musicTracks.js) - served directly so the website's
// <audio> element can play it, scoped to this one subfolder for the same reason as above.
app.use("/uploads/music", express.static(path.join(process.cwd(), "uploads", "music")));

// Admin-uploaded scene trophy models (see routes/sceneTrophies.js) - served directly so the website's
// three.js GLTFLoader can fetch them cross-origin, scoped to this one subfolder for the same reason as above.
app.use("/uploads/trophies", express.static(path.join(process.cwd(), "uploads", "trophies")));

app.use("/api/auth", authRoutes);

app.use("/api/rooms", roomRoutes);

app.use("/api", campaignRoutes);
app.use("/api", lessonModuleRoutes);
app.use("/api", vaultTemplateRoutes);
app.use("/api", environmentRoutes);
app.use("/api/character-loadout", characterLoadoutRoutes);
app.use("/api", characterSetRoutes);
app.use("/api", musicTrackRoutes);
app.use("/api", sceneTrophyRoutes);
app.use("/api", studentProgressRoutes);
app.use("/api", ttsRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Archivist Legacy API is running" });
});

// Seeds the admin login + admin-authored catalog data (vault templates, character sets, music tracks) before
// accepting any requests - see scripts/seedAll.js. This is what lets a fresh clone + npm install +
// database migration come up fully set up with no separate manual seed step. Safe to run on every
// boot, not just the first, since every seed upserts or skips what already exists rather than insert blindly.
async function start() {
  try {
    await runAllSeeds();
    console.log("Startup seed check complete.");
  } catch (err) {
    console.error("Startup seeding failed (server will still start):", err);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();