import { useEffect, useSyncExternalStore } from "react";
import {
  FlaskConical,
  BookOpen,
  Landmark,
  Castle,
  Church,
  Building2,
  Mountain,
  Trees,
  Ship,
  Anchor,
  Rocket,
  Skull,
  Gem,
  Compass,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { api } from "./lib/api";

// The environments (scenes) a campaign can be set in. The list is NOT fixed in the code: the admin
// adds, edits and deletes environments on the Admin dashboard, the server keeps them in the
// Environment table, and this file loads them once (GET /environments) and shares them with every
// component. `key` is the value stored on Campaign.scene and used in the vault-template URLs; the
// server makes it from the name when the environment is created and it never changes.

// The icons an admin can pick, by the name the server stores. Keep the names the same as
// ENVIRONMENT_ICONS in server/lib/environments.js.
export const ENVIRONMENT_ICONS = {
  BookOpen,
  FlaskConical,
  Landmark,
  Castle,
  Church,
  Building2,
  Mountain,
  Trees,
  Ship,
  Anchor,
  Rocket,
  Skull,
  Gem,
  Compass,
  Sparkles,
};

// The three environments that have their own theme colours (--color-laboratory and so on) and
// artwork. An environment with no colour of its own uses these.
const THEME_COLORED = ["laboratory", "library", "tomb"];

// An environment with no colour set: its theme colours, or the site's main colour for a new one.
const themeColors = (key) =>
  THEME_COLORED.includes(key)
    ? { color: `var(--color-${key})`, soft: `var(--color-${key}-soft)` }
    : { color: "var(--color-primary)", soft: "var(--color-primary-soft)" };

// An environment with a colour of its own (#RRGGBB). The text colour is mixed toward the page's text
// colour so it stays readable in both the light and the dark theme; the soft colour is a tint over
// the page's surface.
const customColors = (hex) => ({
  color: `color-mix(in srgb, ${hex} 72%, var(--color-text))`,
  soft: `color-mix(in srgb, ${hex} 16%, var(--color-surface))`,
});

// Turns a row from the server into what the components use.
export function toMeta(row) {
  return {
    id: row.id ?? null,
    key: row.key,
    label: row.label,
    blurb: row.blurb || "",
    iconName: row.icon || "Sparkles",
    hex: row.color || "",
    Icon: ENVIRONMENT_ICONS[row.icon] || Sparkles,
    ...(row.color ? customColors(row.color) : themeColors(row.key)),
  };
}

// What shows until the real list has arrived (or if it can't be loaded): the environments the game
// shipped with. Replaced as soon as the server answers.
const STARTING_LIST = [
  { key: "library", label: "Library", icon: "BookOpen", blurb: "A library setting." },
  { key: "laboratory", label: "Laboratory", icon: "FlaskConical", blurb: "A science lab setting." },
  { key: "tomb", label: "Tomb", icon: "Landmark", blurb: "An ancient tomb setting." },
].map(toMeta);

let current = STARTING_LIST;
let loaded = false;
let inFlight = null;
const listeners = new Set();

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => current;

function publish(rows) {
  current = rows.map(toMeta);
  loaded = true;
  listeners.forEach((l) => l());
}

// Puts a list that was just fetched (or changed) by the admin pages into the shared list, so every
// badge and picker updates at once.
export const setEnvironments = publish;

// Loads the list from the server (again, if `force`). Safe to call many times: one request at a
// time, and once it has loaded it does nothing unless forced. A failed load (not logged in yet,
// server down) leaves the starting list in place and is tried again by the next caller.
export function loadEnvironments(force = false) {
  if (loaded && !force) return Promise.resolve(current);
  if (inFlight) return inFlight;

  inFlight = api("/environments")
    .then(({ ok, data }) => {
      if (ok && Array.isArray(data)) publish(data);
      return current;
    })
    .catch(() => current)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

// The environments, in the order the admin set up. Re-renders the component when the list loads or
// changes. Any component that shows a scene (a badge, a picker, a colour) should call this once.
export function useEnvironments() {
  const environments = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    loadEnvironments();
  }, []);

  return environments;
}

const UNKNOWN = {
  key: "",
  Icon: HelpCircle,
  blurb: "",
  color: "var(--color-text-muted)",
  soft: "var(--color-surface-muted)",
};

export function getSceneMeta(scene) {
  const key = (scene || "").toLowerCase().trim();
  return current.find((s) => s.key === key) || { ...UNKNOWN, label: scene || "No vault" };
}

// Inline style that exposes a scene's pair of colors to CSS (--scene / --scene-soft).
export const sceneStyle = (scene) => {
  const meta = getSceneMeta(scene);
  return { "--scene": meta.color, "--scene-soft": meta.soft };
};
