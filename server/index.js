import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import campaignRoutes from "./routes/campaigns.js";
import lessonModuleRoutes from "./routes/lessonModules.js";
import chatRoutes from "./routes/chat.js";
import vaultTemplateRoutes from "./routes/vaultTemplates.js";
import characterLoadoutRoutes from "./routes/characterLoadout.js";
import characterSetRoutes from "./routes/characterSets.js";
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

app.use("/api/auth", authRoutes);

app.use("/api/rooms", roomRoutes);

app.use("/api", campaignRoutes);
app.use("/api", lessonModuleRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api", vaultTemplateRoutes);
app.use("/api/character-loadout", characterLoadoutRoutes);
app.use("/api", characterSetRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Archivist Legacy API is running" });
});

// Seeds the admin login + admin-authored catalog data (vault templates, character sets) before
// accepting any requests - see scripts/seedAll.js. This is what lets a fresh clone + npm install +
// database migration come up fully set up with no separate manual seed step. Safe to run on every
// boot, not just the first, since all three seeds upsert rather than insert blindly.
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