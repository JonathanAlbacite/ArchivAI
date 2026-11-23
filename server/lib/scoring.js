// scoring.js
//
// The score and rank of a finished run. The game (CampaignProgressTracker) sends only the facts of
// the run - the time, every lock's wrong attempts, and how many clues and notes were found out of how
// many there are. This file turns them into points and a rank, so the rules can be changed here
// without a new game build, and an old run can be worked out again from the facts that were saved.
// Plain functions with no database calls. Used by routes/campaigns.js (POST /campaigns/:id/results).
//
// THE FORMULA (1000 points at most)
//
//   Speed points   = 600 x how close the time is to the fast time (full points at the fast time or
//                    quicker, none at the slow time or slower, a straight line between them).
//                    The fast and slow times are seconds per lock multiplied by the number of locks
//                    in the Scene, so a bigger campaign gets more time. ALL locks are counted, not
//                    only the solved ones: skipping a lock you already know is allowed.
//   Wrong attempts = points taken away from the speed points: each wrong attempt on a Dial,
//                    Conversation or Magic lock costs its own amount (PENALTY_PER_ATTEMPT). Item
//                    locks cost nothing. The speed points can drop to 0 but never below it.
//   Clue points    = 150 x (clues found / clues in the Scene)
//   Note points    = 250 x (notes found / notes in the Scene). Standalone notes (the trivia facts
//                    that are not tied to a question) are counted together with the notes.
//   Score          = speed points - wrong attempts + clue points + note points
//
// A category with nothing in the Scene (no clues, for example) gives no points and is also left out
// of the maximum, so it does not hold the rank back.
//
// RANK - the share of the maximum score: S 90% and up, A 75%, B 60%, C 45%, otherwise D.
//
// All the numbers below are a starting point and have not been tested against real play times.

export const SCORING = {
  timePoints: 600,
  cluePoints: 150,
  notePoints: 250,
  // Seconds per lock. Full speed points at or under fast, none at or over slow.
  fastSecondsPerLock: 30,
  slowSecondsPerLock: 180,
  // Points lost for one wrong attempt, by the lock's class name (what the game sends as its type).
  // A lock type that is not listed here costs nothing (Item locks, for example).
  penaltyPerAttempt: {
    DialLockInteractable: 10,
    DialogueQAInteractable: 20,
    MagicLock: 30,
  },
  // Read from the top down. The first tier whose minPercent is reached gives the rank.
  rankTiers: [
    { rank: "S", minPercent: 90 },
    { rank: "A", minPercent: 75 },
    { rank: "B", minPercent: 60 },
    { rank: "C", minPercent: 45 },
  ],
  fallbackRank: "D",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// { found, total } from whatever the game sent. Whole numbers of 0 or more; found never above total.
export const readCount = (value) => {
  const total = Number.isInteger(value?.total) && value.total >= 0 ? value.total : 0;
  const found = Number.isInteger(value?.found) && value.found >= 0 ? Math.min(value.found, total) : 0;
  return { found, total };
};

// The points of one bonus category (clues or notes). Nothing in the Scene gives no points.
const bonusOf = (count, max) => ({
  found: count.found,
  total: count.total,
  max: count.total > 0 ? max : 0,
  points: count.total > 0 ? Math.round((max * count.found) / count.total) : 0,
});

// The rank for a score out of a maximum.
export const rankFor = (score, maxScore) => {
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const tier = SCORING.rankTiers.find((t) => percent >= t.minPercent);
  return tier ? tier.rank : SCORING.fallbackRank;
};

// Works out everything for one run. Input: totalTime (seconds), locks (the list the game sent, each
// with type and attempts), clues and notes ({ found, total }). Returns the breakdown that is saved
// with the run (CampaignSession.scoreDetails) and shown on the results page.
export function computeScore({ totalTime, locks, clues, notes }) {
  const seconds = Number.isFinite(totalTime) && totalTime >= 0 ? Math.round(totalTime) : 0;
  const lockList = Array.isArray(locks) ? locks : [];
  const lockCount = Math.max(1, lockList.length);

  // Speed.
  const fast = SCORING.fastSecondsPerLock * lockCount;
  const slow = SCORING.slowSecondsPerLock * lockCount;
  const timeShare = clamp((slow - seconds) / (slow - fast), 0, 1);
  const timePoints = Math.round(SCORING.timePoints * timeShare);

  // Wrong attempts, added up by lock type.
  const byType = new Map();
  for (const lock of lockList) {
    const each = SCORING.penaltyPerAttempt[lock?.type];
    const attempts = Number.isInteger(lock?.attempts) && lock.attempts > 0 ? lock.attempts : 0;
    if (!each || attempts === 0) continue;
    byType.set(lock.type, (byType.get(lock.type) || 0) + attempts);
  }
  const items = [...byType.entries()].map(([type, wrongAttempts]) => ({
    type,
    wrongAttempts,
    pointsEach: SCORING.penaltyPerAttempt[type],
    points: wrongAttempts * SCORING.penaltyPerAttempt[type],
  }));
  const penaltyTotal = items.reduce((sum, item) => sum + item.points, 0);
  // The speed points cannot go below 0, so only what can really be taken away is taken.
  const penaltyApplied = Math.min(penaltyTotal, timePoints);
  const basePoints = timePoints - penaltyApplied;

  // Bonuses.
  const clueBonus = bonusOf(readCount(clues), SCORING.cluePoints);
  const noteBonus = bonusOf(readCount(notes), SCORING.notePoints);

  const score = basePoints + clueBonus.points + noteBonus.points;
  const maxScore = SCORING.timePoints + clueBonus.max + noteBonus.max;
  const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    version: 1,
    lockCount,
    time: { seconds, fast, slow, max: SCORING.timePoints, points: timePoints },
    penalty: { total: penaltyTotal, applied: penaltyApplied, items },
    clues: clueBonus,
    notes: noteBonus,
    base: basePoints,
    score,
    maxScore,
    percent,
    rank: rankFor(score, maxScore),
    // The rank tiers used for this run (lowest last), so the results page can show the rank climbing
    // while the points are added up, with the same limits as the server.
    rankTiers: [...SCORING.rankTiers, { rank: SCORING.fallbackRank, minPercent: 0 }],
  };
}
