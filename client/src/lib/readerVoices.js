import { useEffect, useState } from "react";
import { API_URL, api } from "./api";
import { getToken } from "./session";

// Read-aloud voices for the kid-friendly lesson reader (components/student/LessonReader.jsx).
//
// The reader offers American and British (male) for every lesson, plus Filipino for lessons
// written in Filipino (detectLessonLanguage below) - and then Filipino comes first and is the
// default. Each choice uses the best matching voice built into the student's browser (the Web
// Speech API) when there is one - e.g. Chrome's "Google US English" / "Google UK English Male",
// Edge's natural voices (Blessica / Angelo for Filipino), Apple's Samantha / Daniel - and otherwise
// the matching voice made by our server (POST /api/tts, see server/lib/tts.js: Kristin, Alan, and
// Azure's Blessica for Filipino). A choice with neither is left out.
// The student's choice is remembered on this device, separately for English and Filipino lessons.

const STORAGE_KEY = "archivai:readerVoice";

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

const langOf = (voice) => voice.lang?.replace("_", "-").toLowerCase() || "";
const isLang = (voice, lang) => langOf(voice) === lang;

// The choices. `device` lists browser voices to use, best first; `server` is the server voice to
// use when the browser has none of them; `filipinoOnly` choices appear only for Filipino lessons.
const CHOICES = [
  {
    id: "fil",
    label: "Filipino",
    tag: "FIL",
    server: "fil",
    filipinoOnly: true,
    device: [
      (v) => /^(fil|tl)\b/.test(langOf(v)) && /blessica.*natural/i.test(v.name),
      (v) => /^(fil|tl)\b/.test(langOf(v)) && /natural/i.test(v.name),
      (v) => /^(fil|tl)\b/.test(langOf(v)),
    ],
  },
  {
    id: "us",
    label: "American",
    tag: "US",
    server: "us",
    device: [
      (v) => /^google us english$/i.test(v.name),
      (v) => isLang(v, "en-us") && /(jenny|aria|ana|michelle|ava|emma).*natural/i.test(v.name),
      (v) => isLang(v, "en-us") && /samantha/i.test(v.name),
    ],
  },
  {
    id: "uk-male",
    label: "British",
    tag: "UK",
    server: "uk",
    device: [
      (v) => /^google uk english male$/i.test(v.name),
      (v) => isLang(v, "en-gb") && /(ryan|thomas|alfie|elliot|ethan|noah|oliver).*natural/i.test(v.name),
      (v) => isLang(v, "en-gb") && /\b(daniel|arthur|george|oliver)\b/i.test(v.name),
    ],
  },
];

const findDeviceVoice = (choice, voices) => {
  for (const matches of choice.device) {
    const found = voices.find(matches);
    if (found) return found;
  }
  return null;
};

// ---------- Lesson language ----------
// The same idea as the server's check for generated questions (server/lib/clueTemplates.js):
// count very common Filipino and English words. Returns "fil" or "en".
const FILIPINO_MARKERS = new Set([
  "ang", "ng", "mga", "sa", "ay", "na", "nang", "si", "ni", "kay", "sina", "nina", "ito", "iyan", "iyon", "dito", "doon",
  "ano", "anong", "sino", "saan", "kailan", "ilan", "ilang", "alin", "paano", "bakit", "hindi", "mayroon", "wala",
  "ba", "po", "rin", "din", "lamang", "lang", "isang", "kung", "upang", "para", "kanyang", "nito", "niya", "tinatawag",
]);
const ENGLISH_MARKERS = new Set([
  "the", "is", "are", "was", "were", "what", "which", "who", "where", "when", "how", "why", "of", "and", "in", "on",
  "to", "a", "an", "does", "do", "did", "this", "that", "for", "with", "from", "by", "its", "their", "called",
]);

export const detectLessonLanguage = (text) => {
  let fil = 0;
  let en = 0;
  for (const w of String(text || "").toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (FILIPINO_MARKERS.has(w)) fil += 1;
    else if (ENGLISH_MARKERS.has(w)) en += 1;
  }
  return fil >= 5 && fil >= en ? "fil" : "en";
};

// ---------- The choices for one lesson ----------
// The server voices that are set up, asked for once per page load.
let serverStatus = null;
const loadServerVoices = () => {
  if (!serverStatus) {
    serverStatus = api("/tts/status")
      .then(({ ok, data }) => (ok && Array.isArray(data.voices) ? data.voices.map((v) => v.id) : []))
      .catch(() => []);
  }
  return serverStatus;
};

const savedKey = (language) => `${STORAGE_KEY}:${language}`;
const readSaved = (language) => {
  try {
    return localStorage.getItem(savedKey(language));
  } catch {
    return null;
  }
};

// The voice options for a lesson in `language` ("fil" | "en"), best first, and the chosen one.
// Each option is { id, label, tag, kind: "device" | "server", voice?, serverVoice? } - `voice` is
// the SpeechSynthesisVoice for device voices, `serverVoice` the server voice id ("us" / "uk" / "fil").
// Browsers fill the device voice list in late (Chrome fires "voiceschanged" after the first call),
// so the list is re-read when it changes.
export function useReaderVoices(language = "en") {
  const [deviceVoices, setDeviceVoices] = useState(() => (canSpeak() ? window.speechSynthesis.getVoices() : []));
  const [serverVoices, setServerVoices] = useState([]);
  const [saved, setSaved] = useState({});

  useEffect(() => {
    let cancelled = false;
    loadServerVoices().then((ids) => !cancelled && setServerVoices(ids));
    if (!canSpeak()) return () => (cancelled = true);
    const load = () => setDeviceVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      cancelled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);

  const options = CHOICES.filter((choice) => language === "fil" || !choice.filipinoOnly)
    .map((choice) => {
      const base = { id: choice.id, label: choice.label, tag: choice.tag };
      const voice = findDeviceVoice(choice, deviceVoices);
      if (voice) return { ...base, kind: "device", voice };
      if (serverVoices.includes(choice.server)) return { ...base, kind: "server", serverVoice: choice.server };
      return null;
    })
    .filter(Boolean);

  // The choice saved for this language when it's still offered, otherwise the first one
  // (Filipino for a Filipino lesson, American for an English one).
  const savedId = saved[language] ?? readSaved(language);
  const selected = options.find((o) => o.id === savedId) || options[0] || null;

  const chooseVoice = (id) => {
    setSaved((s) => ({ ...s, [language]: id }));
    try {
      localStorage.setItem(savedKey(language), id);
    } catch {
      // Private mode etc. - the choice just isn't remembered.
    }
  };

  return { options, selected, chooseVoice };
}

// ---------- The server voices ----------
// Audio already fetched this visit, by voice and text, so re-reading a page doesn't ask the server again.
const audioCache = new Map();

// An object URL of `text` spoken by the server voice `voice` ("us", "uk" or "fil").
export const fetchServerSpeech = (text, voice) => {
  const key = `${voice}\n${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  const job = fetch(`${API_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ text, voice }),
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Couldn't load the reading voice");
    }
    return URL.createObjectURL(await res.blob());
  });
  audioCache.set(key, job);
  job.catch(() => audioCache.delete(key));
  return job;
};
