// Downloads the Piper text-to-speech program and the reader's voices (lib/tts.js VOICES: Kristin,
// American, and Alan, British male) into server/tts/, for the kid-friendly lesson reader
// (see lib/tts.js and routes/tts.js).
//
//   npm run setup-tts
//
// Run it once per machine (your PC, the deployed server). It picks the Piper build for this
// operating system - Windows x64, Linux x64 or Linux ARM64 (Oracle's free Ampere servers) - and
// skips anything already downloaded. server/tts/ is not committed: the files are about 150 MB.
//
// Piper: https://github.com/rhasspy/piper (MIT). Voices from https://huggingface.co/rhasspy/piper-voices -
// each one's license is in tts/voices/<voice>.MODEL_CARD.
// Newer catalog voices say "Requires Piper 1.5 or higher" in their MODEL_CARD and do not work with
// this Piper program (the last standalone release) - pick a voice whose .onnx.json has
// "piper_version" 1.0.0 or lower if you change it.

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { PIPER_DIR, PIPER_VOICE_IDS, VOICE_DIR, VOICES, piperBinaryPath, voiceModelPath } from "../lib/tts.js";

const PIPER_RELEASE = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2";
const PIPER_BUILDS = {
  "win32-x64": "piper_windows_amd64.zip",
  "linux-x64": "piper_linux_x86_64.tar.gz",
  "linux-arm64": "piper_linux_aarch64.tar.gz",
};
const VOICE_CATALOG = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

const download = async (url, dest) => {
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${url}`);
  const tmp = `${dest}.part`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  await fsp.rename(tmp, dest);
};

async function setupPiper() {
  const build = PIPER_BUILDS[`${process.platform}-${process.arch}`];
  if (!build) throw new Error(`No Piper build for ${process.platform}-${process.arch}. Supported: ${Object.keys(PIPER_BUILDS).join(", ")}`);

  if (fs.existsSync(piperBinaryPath())) {
    console.log("Piper is already installed.");
  } else {
    await fsp.mkdir(PIPER_DIR, { recursive: true });
    const archive = path.join(os.tmpdir(), build);
    await download(`${PIPER_RELEASE}/${build}`, archive);
    // The archive holds a "piper/" folder; extract it into tts/ so the program lands in tts/piper/.
    // Windows 10+ ships a tar that also reads .zip files.
    // On Windows, call the system tar by path - a GNU tar from Git Bash may come first on PATH and
    // can't read .zip files or "C:\" paths.
    const tar = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "tar";
    execFileSync(tar, ["-xf", archive, "-C", path.dirname(PIPER_DIR)], { stdio: "inherit" });
    await fsp.rm(archive, { force: true });
    if (process.platform !== "win32") await fsp.chmod(piperBinaryPath(), 0o755);
    console.log(`Piper installed in ${PIPER_DIR}`);
  }

  await fsp.mkdir(VOICE_DIR, { recursive: true });
  // Only the Piper voices are downloaded - the Filipino voice comes from Azure (see lib/tts.js).
  for (const id of PIPER_VOICE_IDS) {
    const voice = VOICES[id];
    const base = `${VOICE_CATALOG}/${voice.catalogPath}`;
    // [file in the catalog, name saved as] - every voice's model card is called MODEL_CARD there.
    const files = [
      [`${voice.model}.onnx`, `${voice.model}.onnx`],
      [`${voice.model}.onnx.json`, `${voice.model}.onnx.json`],
      ["MODEL_CARD", `${voice.model}.MODEL_CARD`],
    ];
    for (const [remote, local] of files) {
      const dest = path.join(VOICE_DIR, local);
      if (fs.existsSync(dest)) continue;
      await download(`${base}/${remote}`, dest);
    }
    if (!fs.existsSync(voiceModelPath(id))) throw new Error(`The ${voice.label} voice is missing after download.`);
    console.log(`Voice ready: ${voice.label} (${voice.model})`);
  }

  // The single MODEL_CARD left by an earlier version of this script.
  await fsp.rm(path.join(VOICE_DIR, "MODEL_CARD"), { force: true });
}

setupPiper().catch((err) => {
  console.error("Text-to-speech setup failed:", err.message);
  process.exitCode = 1;
});
