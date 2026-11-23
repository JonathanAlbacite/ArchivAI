// progressStats.js
//
// The numbers behind the "Student progress" page (teacher) and the "Previous attempts" card (student):
// completion percentage, best rank, trend, and reading the game's saved world state. Plain functions
// with no database calls, so they are easy to check on their own. Used by routes/studentProgress.js.

// Best first. The game's top tier is S (see CampaignProgressTracker in the Unity project); D is its
// fallback when no tier is met.
export const RANK_ORDER = ["S", "A", "B", "C", "D"];

// A higher number is a better rank (S = 5 ... D = 1). A missing or unknown rank has no score.
export const rankScore = (rank) => {
  const index = RANK_ORDER.indexOf(rank);
  return index === -1 ? null : RANK_ORDER.length - index;
};

// part / total as a whole percent from 0 to 100, or null when the total is not known.
export const percentOf = (part, total) => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
};

// The completion percentage of one run: the average of the locks solved and the checkpoints reached.
// A part that is not known (for example the checkpoint total, before anyone has finished the campaign)
// is left out, so the number is then just the other part. null when neither is known.
export const completionPercent = ({ locksSolved, locksTotal, checkpointsReached, checkpointsTotal }) => {
  const parts = [percentOf(locksSolved, locksTotal), percentOf(checkpointsReached, checkpointsTotal)].filter((p) => p !== null);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((sum, p) => sum + p, 0) / parts.length);
};

// The game's world state is a JSON text saved at each checkpoint (see WorldStateSnapshot.cs). Only
// the run time and the locks are read here. Returns null for anything that is missing or unreadable.
export const readWorldState = (text) => {
  if (typeof text !== "string" || !text) return null;
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return null;
    const locks = Array.isArray(data.locks)
      ? data.locks.map((l) => ({
          id: String(l?.id ?? ""),
          isSolved: !!l?.solved,
          attempts: Number.isInteger(l?.attempts) && l.attempts >= 0 ? l.attempts : 0,
        }))
      : [];
    const elapsed = Number(data.elapsedSeconds);
    return { elapsedSeconds: Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed) : null, locks };
  } catch {
    return null;
  }
};

// The locks of a finished run (CampaignSession.lockResults), cleaned up. Always a list.
export const readLockResults = (value) =>
  Array.isArray(value)
    ? value.map((l) => ({
        id: String(l?.id ?? ""),
        order: Number.isInteger(l?.order) ? l.order : 0,
        type: String(l?.type ?? ""),
        isSolved: !!l?.isSolved,
        attempts: Number.isInteger(l?.attempts) && l.attempts >= 0 ? l.attempts : 0,
      }))
    : [];

// One finished run (a CampaignSession row) as the pages show it.
export const summarizeSession = (session, number) => {
  const locks = readLockResults(session.lockResults);
  const locksSolved = locks.filter((l) => l.isSolved).length;
  const locksTotal = locks.length;
  return {
    id: session.id,
    number,
    completedAt: session.completedAt,
    totalTime: session.totalTime ?? null,
    rank: session.rank ?? null,
    mistakes: session.mistakes ?? null,
    locksSolved: locksTotal > 0 ? locksSolved : null,
    locksTotal: locksTotal > 0 ? locksTotal : null,
    checkpointsReached: session.checkpointsReached ?? null,
    checkpointsTotal: session.checkpointsTotal ?? null,
    completionPercent: completionPercent({
      locksSolved,
      locksTotal,
      checkpointsReached: session.checkpointsReached,
      checkpointsTotal: session.checkpointsTotal,
    }),
  };
};

// The best of a list of runs: the best rank, and the fastest time.
export const bestOf = (attempts) => {
  let bestRank = null;
  let bestTime = null;
  for (const a of attempts) {
    const score = rankScore(a.rank);
    if (score !== null && (bestRank === null || score > rankScore(bestRank))) bestRank = a.rank;
    if (typeof a.totalTime === "number" && (bestTime === null || a.totalTime < bestTime)) bestTime = a.totalTime;
  }
  return { bestRank, bestTime };
};

// Time differences smaller than this many seconds do not count as faster or slower.
const SAME_TIME_SECONDS = 5;

// How the newest run compares with the first one: "improved", "same" or "lower". null with fewer than
// two runs, or when the ranks cannot be compared. The rank decides; when the ranks are equal, the time does.
export const trendOf = (attemptsOldestFirst) => {
  if (attemptsOldestFirst.length < 2) return null;
  const first = attemptsOldestFirst[0];
  const last = attemptsOldestFirst[attemptsOldestFirst.length - 1];
  const a = rankScore(first.rank);
  const b = rankScore(last.rank);
  if (a === null || b === null) return null;
  if (b > a) return "improved";
  if (b < a) return "lower";
  if (typeof first.totalTime === "number" && typeof last.totalTime === "number") {
    if (last.totalTime < first.totalTime - SAME_TIME_SECONDS) return "improved";
    if (last.totalTime > first.totalTime + SAME_TIME_SECONDS) return "lower";
  }
  return "same";
};
