# Gamification: preview rules (not yet approved)

**Status: proposed.** The backend has no XP, level or streak system. Everything below is computed in the browser from existing API data. Nothing is stored or awarded server-side, and the UI labels these numbers **Preview**. To change the rules, edit `src/lib/gamification.js`. To sign them off, flip `RULES_STATUS` there.

## Data source

For each published campaign in each joined room, the app reads that student's **latest** finished run: `GET /campaigns/:id/results/latest`.

## XP

| Rule | XP |
|---|---|
| Finish a campaign | 100 |
| Rank bonus on the latest run | A +50, B +30, C +15, D +5 |

- Each campaign counts **once**, so replays never duplicate XP.
- There is no speed-only bonus. Time only matters through the game's own rank.

**Known limitation:** the API returns only the *latest* run. If a student replays a campaign and gets a lower rank, their XP drops slightly. A backend endpoint for each student's best run per campaign would fix this.

## Levels

| Level | Total XP needed |
|---|---|
| 1 | 0 |
| 2 | 100 |
| 3 | 250 |
| 4 | 450 |
| 5 | 700 (max) |

- The progress bar shows progress through the *current* level's range.
- Total XP keeps counting; it never resets at a new level.
- The first time a student's browser sees a new level, it shows a toast and confetti. The last seen level is stored in `localStorage`, per browser.

## Not implemented, and why

- **Badges / achievements:** on hold until the rules are proposed and agreed. The code is commented out, not deleted:
  `components/student/BadgeShelf.jsx`, `BADGES` in `src/lib/gamification.js`, the badge styles at the end of
  `src/styles/pages.css`, and the lines marked `BADGES` in `src/pages/student/StudentDashboard.jsx`.
  The drafted badges: First Steps (finish 1 campaign), Campaign Collector (5 campaigns), Room Explorer
  (join 3 rooms), A Rank (an A on any campaign), Persistent Solver (finish with 3+ wrong attempts).
- **Streaks:** the API has no dated activity history.
- **Leaderboards:** deliberately left out, to avoid public comparison.

## Backend support needed to make this real

1. Persist awards, ideally an XP table written when `POST /campaigns/:id/results` is saved, so awards are idempotent and permanent.
2. An endpoint for a student's best run per campaign.
3. For teachers: per-student results per room (e.g. `GET /rooms/:id/results`). The teacher Students tab says this endpoint doesn't exist yet.
