import express from "express";
import { protect } from "../middleware/auth.js";
import { DEFAULT_VOICE, MAX_TTS_CHARS, VOICES, availableVoices, synthesizeSpeech } from "../lib/tts.js";

// Read-aloud audio for the kid-friendly lesson reader (client: components/student/LessonReader.jsx).
// The voices are made by Piper on this server (American, British) or by Azure Speech (Filipino) - see lib/tts.js.
const router = express.Router();

// Which server voices are set up, so the reader only falls back to ones that work.
// Response: { voices: [{ id: "us" | "uk" | "fil", label }], maxChars }
router.get("/tts/status", protect, (req, res) => {
  res.json({
    voices: availableVoices().map((id) => ({ id, label: VOICES[id].label })),
    maxChars: MAX_TTS_CHARS,
  });
});

// One sentence of speech as audio. POST so the text isn't stuck in URLs and server logs.
// Body: { text, voice?: "us" | "uk" | "fil" }. Piper voices answer with a .wav, Azure with an .mp3.
router.post("/tts", protect, async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  const voice = typeof req.body?.voice === "string" ? req.body.voice : DEFAULT_VOICE;
  if (!text.trim()) return res.status(400).json({ message: "Send the text to read" });
  if (text.length > MAX_TTS_CHARS * 2) return res.status(413).json({ message: `Send at most ${MAX_TTS_CHARS} characters at a time` });
  if (!VOICES[voice]) return res.status(400).json({ message: `Unknown voice. Use one of: ${Object.keys(VOICES).join(", ")}` });
  if (!availableVoices().includes(voice))
    return res.status(503).json({
      message: VOICES[voice].engine === "azure"
        ? "The Filipino reading voice needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the server's .env."
        : "That reading voice isn't set up on this server. Run npm run setup-tts.",
    });

  try {
    const file = await synthesizeSpeech(text, voice);
    res.set("Cache-Control", "private, max-age=86400");
    res.type(file.endsWith(".mp3") ? "audio/mpeg" : "audio/wav").sendFile(file);
  } catch (err) {
    if (/longer than/.test(err.message)) return res.status(413).json({ message: err.message });
    console.error("[tts]", err.message);
    res.status(500).json({ message: "Couldn't make the reading voice", error: err.message });
  }
});

export default router;
