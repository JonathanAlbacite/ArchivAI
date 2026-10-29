import { useMemo } from "react";


// Level + XP progress toward the next level. `progress` is the 0..1 share of
// the CURRENT level's XP range (see levelInfo in lib/gamification.js), so the
// bar restarts each level while the total XP shown keeps counting up.
export function XPBar({ level, xp, levelStartXp, nextLevelXp, progress, compact }) {
  const atMax = nextLevelXp === null || nextLevelXp === undefined;
  const pct = Math.round(Math.min(1, Math.max(0, atMax ? 1 : progress)) * 100);
  const toGo = atMax ? 0 : nextLevelXp - xp;
  const label = atMax
    ? `Level ${level}, ${xp} XP. Highest level reached.`
    : `Level ${level}: ${xp - levelStartXp} of ${nextLevelXp - levelStartXp} XP toward level ${level + 1}`;

  return (
    <div className="xpbar">
      <div className="xpbar__meta">
        <span className="xpbar__level">Level {level}</span>
        <span className="text-muted text-sm">
          <strong style={{ color: "var(--color-text)" }}>{xp} XP</strong>
          {!compact && (atMax ? " · max level" : ` · ${toGo} to level ${level + 1}`)}
        </span>
      </div>
      <div
        className="xpbar__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={label}
      >
        <div className="xpbar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const RANK_LABELS = { A: "Gold rank", B: "Silver rank", C: "Bronze rank", D: "Slate rank" };

// The game's own A-D rank (never computed here). Missing rank -> "No rank".
export function RankMedal({ rank, size = 56, showLabel = false }) {
  const key = ["A", "B", "C", "D"].includes(rank) ? rank : "none";
  const text = key === "none" ? "No rank recorded" : `Rank ${rank} (${RANK_LABELS[rank]})`;
  const medal = (
    <span className="medal" data-rank={key} style={{ "--size": `${size}px` }} role="img" aria-label={text}>
      {key === "none" ? "—" : rank}
    </span>
  );
  if (!showLabel) return medal;
  return (
    <span className="medal-label">
      {medal}
      <span className="text-sm font-semibold">{key === "none" ? "No rank" : `Rank ${rank}`}</span>
    </span>
  );
}

// Deterministic pseudo-random so the burst looks the same on every render.
const seeded = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const CONFETTI_COLORS = ["var(--color-primary)", "var(--color-secondary)", "var(--color-gold)", "var(--color-success)", "var(--color-teacher)"];

// One short burst of paper and stars for reward moments. Hidden entirely
// under prefers-reduced-motion (see .confetti in components.css).
export function Confetti({ pieces = 28 }) {
  const items = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const angle = seeded(i + 1) * Math.PI * 2;
        const dist = 120 + seeded(i + 7) * 220;
        return {
          id: i,
          star: i % 4 === 0,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          dx: `${Math.round(Math.cos(angle) * dist)}px`,
          dy: `${Math.round(Math.sin(angle) * dist * 0.7 + 120)}px`,
          rot: `${Math.round(seeded(i + 13) * 720 - 360)}deg`,
          delay: `${Math.round(seeded(i + 21) * 180)}ms`,
        };
      }),
    [pieces]
  );
  return (
    <div className="confetti" aria-hidden="true">
      {items.map((p) => (
        <span
          key={p.id}
          className="confetti__piece"
          data-shape={p.star ? "star" : undefined}
          style={{ background: p.color, "--dx": p.dx, "--dy": p.dy, "--rot": p.rot, "--delay": p.delay }}
        />
      ))}
    </div>
  );
}

