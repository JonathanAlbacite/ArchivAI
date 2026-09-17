import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import campaignRoutes from "./routes/campaigns.js";
import lessonModuleRoutes from "./routes/lessonModules.js";
import chatRoutes from "./routes/chat.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/rooms", roomRoutes);

app.use("/api", campaignRoutes);
app.use("/api", lessonModuleRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Archivist Legacy API is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});