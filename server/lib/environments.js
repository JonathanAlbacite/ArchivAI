// Environments (the scenes a campaign can be set in: Library, Laboratory, ...).
//
// The list lives in the Environment table and is managed by the admin (see routes/environments.js),
// so nothing else in the server hardcodes scene names any more. Everything that used to check a
// fixed list - the vault templates, the lesson modules, the teacher chatbot - asks this file.
//
// An environment's `key` is what Campaign.scene, VaultTemplate.scene and the vault-template URLs
// store. It is lowercase, made from the name when the environment is created, and never changes
// afterwards, even if the admin renames the environment.

import prisma from "./prisma.js";

// The icons the admin can pick from. These are lucide-react icon names; the website maps each name
// to its icon in client/src/scenes.js (ENVIRONMENT_ICONS), so keep the two lists the same.
export const ENVIRONMENT_ICONS = [
  "BookOpen",
  "FlaskConical",
  "Landmark",
  "Castle",
  "Church",
  "Building2",
  "Mountain",
  "Trees",
  "Ship",
  "Anchor",
  "Rocket",
  "Skull",
  "Gem",
  "Compass",
  "Sparkles",
];

export const DEFAULT_ICON = "Sparkles";

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// A "#RRGGBB" colour, or null for "use the default colour".
export const isValidColor = (color) => color === null || color === undefined || color === "" || COLOR_PATTERN.test(color);

export const listEnvironments = () =>
  prisma.environment.findMany({ orderBy: [{ orderNumber: "asc" }, { id: "asc" }] });

// Lowercase, trimmed, the same way Campaign.scene has always been looked up.
const clean = (value) => (value || "").toString().toLowerCase().trim();

// The environment a scene value points to, or null. Accepts the key ("library") or the name
// ("Library", in any case), because the chatbot and older rows use the capitalized name.
export const findEnvironment = async (scene) => {
  const wanted = clean(scene);
  if (!wanted) return null;

  const all = await listEnvironments();
  return all.find((e) => e.key === wanted) || all.find((e) => clean(e.label) === wanted) || null;
};

// The key to store for a scene value, or null if no environment matches.
export const resolveSceneKey = async (scene) => (await findEnvironment(scene))?.key || null;

// "Ancient Tomb!" -> "ancient-tomb". Used once, when an environment is created.
export const slugify = (label) =>
  clean(label)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

// A key that is not used yet: "tomb", then "tomb-2", "tomb-3"...
export const uniqueKey = async (label) => {
  const base = slugify(label) || "environment";
  const taken = new Set((await listEnvironments()).map((e) => e.key));

  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  return key;
};

// The names shown to the chatbot as the allowed scenes. The chatbot's tool definitions
// (lib/teacherChatTools.js) hold ONE shared array for this, so it is refilled in place, right before
// each chat request, from the current list - an environment the admin just added is available at
// once, without a restart.
export const refreshSceneNames = async (target) => {
  const all = await listEnvironments();
  // An empty list is not valid for the model's tool definitions, so a placeholder stands in until
  // the admin adds an environment (no scene name will match it).
  target.splice(0, target.length, ...(all.length ? all.map((e) => e.label) : ["(none set up yet)"]));
  return target;
};

// "Library, Laboratory" - for error messages.
export const sceneNamesText = async () => {
  try {
    return (await listEnvironments()).map((e) => e.label).join(", ") || "(none set up yet)";
  } catch {
    return "the environments set up by the admin";
  }
};
