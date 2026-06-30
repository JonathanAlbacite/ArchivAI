import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/rooms", roomRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Archivist Legacy API is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});