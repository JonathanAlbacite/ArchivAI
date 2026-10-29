// Gamification rules - ONE place to change them. See GAMIFICATION.md.
//
// STATUS: PROPOSED PREVIEW RULES. The backend has no XP or level
// system, so nothing here is stored or awarded server-side. Everything is
// derived on the fly, in the browser, from data the API already returns:
// each campaign's latest finished run (GET /campaigns/:id/results/latest) and
// the rooms the student has joined. The UI labels these numbers "Preview"
// until the project owner approves the rules and the backend persists them.
//
// Badges/achievements are written but commented out (see BADGES below) - not agreed yet.
// Fairness rules followed here: no speed-only bonus, no streaks (the API has
// no dated activity history to base them on), no leaderboards, and nothing
// is ever taken away for a slow or messy run beyond the rank bonus itself.

export const RULES_STATUS = "preview"; // flip to "approved" once signed off

export const SCORING = {
  campaignComplete: 100,
  rankBonus: { A: 50, B: 30, C: 15, D: 5 },
};

// Total XP needed to REACH each level. Level 1 starts at 0.
export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700];

// XP one finished campaign is worth. Only the latest run of each campaign
// counts and each campaign counts once, so replaying never duplicates XP.
export const xpForRun = (run) => (run ? SCORING.campaignComplete + (SCORING.rankBonus[run.rank] || 0) : 0);

// runs: the latest finished run per campaign (one entry per campaign).
export const totalXp = (runs) => runs.reduce((sum, run) => sum + xpForRun(run), 0);

// Level details for a total. progress is the share (0..1) of the current
// level's XP range; at the top level nextLevelXp is null.
export function levelInfo(xp) {
  let index = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) if (xp >= LEVEL_THRESHOLDS[i]) index = i;
  const levelStartXp = LEVEL_THRESHOLDS[index];
  const nextLevelXp = LEVEL_THRESHOLDS[index + 1] ?? null;
  const progress = nextLevelXp === null ? 1 : (xp - levelStartXp) / (nextLevelXp - levelStartXp);
  return { level: index + 1, xp, levelStartXp, nextLevelXp, progress };
}

// BADGES - ON HOLD until the badge system is proposed and agreed. Uncomment
// together with components/student/BadgeShelf.jsx, the badge styles in
// styles/pages.css and the marked lines in pages/student/StudentDashboard.jsx.
//
// Each `earned(stats)` is a pure check over derived stats, so a badge can't
// be awarded twice - it's simply earned or not.
// stats: { completed, roomsJoined, aRanks, persistentRuns }
/*
export const BADGES = [
  { id: "first-steps", name: "First Steps", description: "Finish your first campaign.", icon: "Footprints", earned: (s) => s.completed >= 1 },
  { id: "campaign-collector", name: "Campaign Collector", description: "Finish five different campaigns.", icon: "Library", earned: (s) => s.completed >= 5 },
  { id: "room-explorer", name: "Room Explorer", description: "Join three rooms.", icon: "DoorOpen", earned: (s) => s.roomsJoined >= 3 },
  { id: "a-rank", name: "A Rank", description: "Earn an A rank on any campaign.", icon: "Crown", earned: (s) => s.aRanks >= 1 },
  {
    id: "persistent",
    name: "Persistent Solver",
    description: "Finish a campaign after 3 or more wrong tries.",
    icon: "Sprout",
    earned: (s) => s.persistentRuns >= 1,
  },
];

export const PERSISTENT_MISTAKES = 3;

export function deriveStats(runs, roomsJoined) {
  return {
    completed: runs.length,
    roomsJoined,
    aRanks: runs.filter((r) => r.rank === "A").length,
    persistentRuns: runs.filter((r) => (r.mistakes ?? 0) >= PERSISTENT_MISTAKES).length,
  };
}

export const earnedBadges = (stats) => BADGES.filter((b) => b.earned(stats));
*/
