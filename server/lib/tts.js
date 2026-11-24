// Text-to-speech for the kid-friendly lesson reader. Three server voices, matching the reader's
// choices: American (Kristin) and British male (Alan), made on this server by Piper (a small
// offline speech program), and Filipino (Blessica), made by Microsoft Azure's Speech service
// because Piper has no Filipino voice. The website uses a browser voice for each choice when the
// device has a good one, and these server voices otherwise.
//
// Piper: the program and voices live in server/tts/ (downloaded by `npm run setup-tts`, see
// scripts/setupPiper.js) - nothing is sent anywhere.
// Azure: needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in server/.env (a free "Speech" resource
// in the Azure portal). The sentence text is sent to Microsoft to be spoken. Without the key the
// Filipino voice is simply not offered.
//
// Each sentence is spoken once and saved in uploads/tts-cache/, named by a hash of the voice and
// text, so a lesson read by a whole class is only made the first time.

import "dotenv/config";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";

export const TTS_DIR = path.join(process.cwd(), "tts");
export const PIPER_DIR = path.join(TTS_DIR, "piper");
export const VOICE_DIR = path.join(TTS_DIR, "voices");
const CACHE_DIR = path.join(process.cwd(), "uploads", "tts-cache");

// The server voices, by the id the website asks for.
//   piper: `model` is the voice file, `catalogPath` its folder in
//          https://huggingface.co/rhasspy/piper-voices. Only voices whose .onnx.json says
//          "piper_version" 1.0.0 or lower work with this Piper program.
//   azure: `azureVoice` is the Azure neural voice name, `lang` its language.
export const VOICES = {
  us: { engine: "piper", model: "en_US-kristin-medium", label: "Kristin", catalogPath: "en/en_US/kristin/medium" }, // public domain
  uk: { engine: "piper", model: "en_GB-alan-medium", label: "Alan", catalogPath: "en/en_GB/alan/medium" }, // Mycroft mimic3 "apope" voice
  fil: { engine: "azure", azureVoice: "fil-PH-BlessicaNeural", lang: "fil-PH", label: "Blessica" },
};
export const DEFAULT_VOICE = "us";
export const PIPER_VOICE_IDS = Object.keys(VOICES).filter((id) => VOICES[id].engine === "piper");

// Longest text spoken in one request - the reader sends one sentence or bullet at a time.
export const MAX_TTS_CHARS = 600;
// Piper uses a few CPU cores per sentence; more than this at once just queues.
const MAX_PARALLEL = 2;
const PIPER_TIMEOUT_MS = 30000;
const AZURE_TIMEOUT_MS = 15000;
// A little slower than normal speech, for young readers.
const LENGTH_SCALE = "1.1"; // Piper: 1 = normal, bigger = slower
const AZURE_RATE = "-10%"; // Azure: the same, as a speaking-rate change

export const piperBinaryPath = () => path.join(PIPER_DIR, process.platform === "win32" ? "piper.exe" : "piper");
export const voiceModelPath = (voiceId) => path.join(VOICE_DIR, `${VOICES[voiceId].model}.onnx`);

const azureKey = () => process.env.AZURE_SPEECH_KEY?.trim();
const azureRegion = () => process.env.AZURE_SPEECH_REGION?.trim();

export const isVoiceAvailable = (voiceId) => {
  const voice = VOICES[voiceId];
  if (!voice) return false;
  if (voice.engine === "azure") return !!(azureKey() && azureRegion());
  return fs.existsSync(piperBinaryPath()) && fs.existsSync(voiceModelPath(voiceId));
};
// The ids of the server voices that are ready to use.
export const availableVoices = () => Object.keys(VOICES).filter(isVoiceAvailable);

// One line of plain text: Piper treats each line as a separate utterance.
export const cleanTtsText = (text) =>
  String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();

// ---------- Piper ----------
// A tiny queue so only MAX_PARALLEL Piper processes run at once.
let running = 0;
const waiting = [];
const withSlot = async (job) => {
  if (running >= MAX_PARALLEL) await new Promise((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await job();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
};

const runPiper = (voiceId, text, outFile) =>
  new Promise((resolve, reject) => {
    const child = spawn(piperBinaryPath(), ["--model", voiceModelPath(voiceId), "--length_scale", LENGTH_SCALE, "--output_file", outFile], {
      cwd: PIPER_DIR,
      windowsHide: true,
    });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Piper took too long"));
    }, PIPER_TIMEOUT_MS);
    child.stderr.on("data", (d) => {
      stderr = (stderr + d).slice(-2000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Piper exited with code ${code}: ${stderr.trim().split("\n").pop() || "no details"}`));
    });
    child.stdin.end(`${text}\n`);
  });

// ---------- Azure ----------
const escapeXml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Speaks `text` with an Azure neural voice and writes the MP3 to outFile.
// https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech
const runAzure = async (voiceId, text, outFile) => {
  const voice = VOICES[voiceId];
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.lang}">` +
    `<voice name="${voice.azureVoice}"><prosody rate="${AZURE_RATE}">${escapeXml(text)}</prosody></voice></speak>`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AZURE_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${azureRegion()}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": azureKey(),
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "archivai-reader",
      },
      body: ssml,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      const hint = res.status === 401 ? " (check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION)" : res.status === 429 ? " (Azure's free limit was reached for now)" : "";
      throw new Error(`Azure Speech answered ${res.status}${hint}${detail ? `: ${detail}` : ""}`);
    }
    await fsp.writeFile(outFile, Buffer.from(await res.arrayBuffer()));
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Azure Speech took too long");
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

// The same sentence asked for twice at once is only spoken once.
const inFlight = new Map();

// Returns the path of an audio file (.wav from Piper, .mp3 from Azure) of `text` in the given
// server voice, making it if it isn't cached yet.
export const synthesizeSpeech = async (rawText, voiceId = DEFAULT_VOICE) => {
  const text = cleanTtsText(rawText);
  if (!text) throw new Error("Nothing to say");
  if (text.length > MAX_TTS_CHARS) throw new Error(`Text is longer than ${MAX_TTS_CHARS} characters`);
  const voice = VOICES[voiceId];
  if (!voice) throw new Error(`Unknown voice "${voiceId}"`);
  if (!isVoiceAvailable(voiceId)) throw new Error("This voice is not set up on this server");

  const isAzure = voice.engine === "azure";
  const settings = isAzure ? `azure:${voice.azureVoice}:${AZURE_RATE}` : `${voice.model}\n${LENGTH_SCALE}`;
  const hash = crypto.createHash("sha1").update(`${settings}\n${text}`).digest("hex");
  const file = path.join(CACHE_DIR, `${hash}.${isAzure ? "mp3" : "wav"}`);
  if (fs.existsSync(file)) return file;
  if (inFlight.has(hash)) return inFlight.get(hash);

  const make = async () => {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    try {
      if (isAzure) await runAzure(voiceId, text, tmp);
      else await runPiper(voiceId, text, tmp);
      await fsp.rename(tmp, file);
      return file;
    } finally {
      await fsp.rm(tmp, { force: true }).catch(() => {});
    }
  };

  const job = (isAzure ? make() : withSlot(make)).finally(() => inFlight.delete(hash));
  inFlight.set(hash, job);
  return job;
};
