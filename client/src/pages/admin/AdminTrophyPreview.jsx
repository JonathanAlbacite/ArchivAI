import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Breadcrumbs, Card, LoadingState, Segmented } from "../../components/ui";
import { ResultsView } from "../RunResults";
import { loadEnvironments, useEnvironments } from "../../scenes";
import { api, errorMessage } from "../../lib/api";

// The ranks a run can get (worked out by the server, see server/lib/scoring.js), best first.
const PREVIEW_RANKS = ["S", "A", "B", "C", "D"];

// A made-up score breakdown for each rank, so the preview can show the score card and its animation.
// The points are picked by hand to land in each rank's band; the real ones come from the server.
const SAMPLE_POINTS = {
  S: { time: 600, penalty: 0, cluesFound: 6, notesFound: 14 },
  A: { time: 520, penalty: 30, cluesFound: 5, notesFound: 12 },
  B: { time: 430, penalty: 60, cluesFound: 4, notesFound: 9 },
  C: { time: 380, penalty: 60, cluesFound: 3, notesFound: 7 },
  D: { time: 150, penalty: 60, cluesFound: 2, notesFound: 3 },
};

// A made-up journal list (clues and notes in reel order); the first `foundCount` entries are marked as found.
const SAMPLE_JOURNAL = [
  ["Torn Page", "Clue"],
  ["Brass Key Note", "Note"],
  ["Dusty Ledger", "Clue"],
  ["Scribbled Margin", "Note"],
  ["Old Fact Card", "Note"],
  ["Faded Map", "Clue"],
  ["Librarian's Memo", "Note"],
  ["Ink-stained Sheet", "Note"],
];
const sampleJournal = (foundCount) =>
  SAMPLE_JOURNAL.map(([name, type], index) => ({
    order: index + 1,
    id: `sample${index + 1}`,
    name,
    type,
    standalone: false,
    found: index < foundCount,
  }));

const sampleScoreDetails = (rank) => {
  const p = SAMPLE_POINTS[rank];
  const clues = { found: p.cluesFound, total: 6, max: 150, points: Math.round((150 * p.cluesFound) / 6) };
  const notes = { found: p.notesFound, total: 14, max: 250, points: Math.round((250 * p.notesFound) / 14) };
  const score = p.time - p.penalty + clues.points + notes.points;
  return {
    version: 1,
    lockCount: 4,
    time: { seconds: 487, fast: 120, slow: 720, max: 600, points: p.time },
    penalty: {
      total: p.penalty,
      applied: p.penalty,
      items: p.penalty > 0 ? [{ type: "MagicLock", wrongAttempts: p.penalty / 30, pointsEach: 30, points: p.penalty }] : [],
    },
    clues,
    notes,
    base: p.time - p.penalty,
    score,
    maxScore: 1000,
    percent: Math.round(score / 10),
    rank,
    journal: sampleJournal(p.cluesFound + Math.round(p.notesFound / 2)),
  };
};

// A made-up finished run, so the results page has something to show.
const sampleResult = (scene, rank) => ({
  scene,
  campaignTitle: "Sample campaign",
  rank,
  score: sampleScoreDetails(rank).score,
  scoreDetails: sampleScoreDetails(rank),
  completedAt: new Date().toISOString(),
  totalTime: 487,
  mistakes: 3,
  checkpointsReached: 7,
  checkpointsTotal: 7,
  locks: [
    { id: "lock001", order: 1, type: "DialLockInteractable", isSolved: true, attempts: 1 },
    { id: "lock002", order: 2, type: "ItemLockInteractable", isSolved: true, attempts: 0 },
    { id: "lock003", order: 3, type: "DialogueQAInteractable", isSolved: true, attempts: 2 },
    { id: "lock004", order: 4, type: "MagicLock", isSolved: true, attempts: 0 },
  ],
});

// Admin: "Preview results page" for one Scene's trophy. Shows the same results page a student sees at
// the end of a campaign (ResultsView, shared with RunResults.jsx), with a sample run, the Scene's
// trophy, and the rank picked here. Nothing is saved, and the page is only reachable by the admin.
function AdminTrophyPreview() {
  const { sceneKey } = useParams();
  const scenes = useEnvironments();
  const scene = scenes.find((s) => s.key === sceneKey);

  const [rank, setRank] = useState("A");
  const [trophy, setTrophy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await loadEnvironments(true);
        const { ok, data } = await api("/scene-trophies");
        if (cancelled) return;
        if (!ok) {
          setLoadError(errorMessage(data, "Failed to load the trophy."));
          return;
        }
        setTrophy((Array.isArray(data) ? data : []).find((t) => t.sceneKey === sceneKey) || null);
      } catch {
        if (!cancelled) setLoadError("Couldn't reach the server. Check your connection.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sceneKey]);

  const result = useMemo(() => sampleResult(sceneKey, rank), [sceneKey, rank]);

  return (
    <>
      <div className="page page--narrow">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/admin/dashboard" }, { label: "Trophies", to: "/admin/trophies" }, { label: "Preview results page" }]} />
        <Card muted>
          <div className="row row-between">
            <div>
              <p className="font-semibold">Preview: results page{scene ? ` for ${scene.label}` : ""}</p>
              <p className="text-xs text-muted">This is what a student sees when a campaign ends. The run is made up, and nothing is saved. Changing the rank plays the score animation again.</p>
            </div>
            <Segmented label="Rank to preview" value={rank} onChange={setRank} options={PREVIEW_RANKS.map((r) => ({ value: r, label: r }))} />
          </div>
        </Card>
        {loadError && <Alert tone="danger">{loadError}</Alert>}
        {!loading && !loadError && !scene && <Alert tone="danger">This Scene doesn't exist.</Alert>}
        {!loading && !loadError && scene && !trophy && (
          <Alert tone="info">This Scene has no trophy yet, so the page below shows no trophy. Add one on the Trophies page.</Alert>
        )}
      </div>

      {loading ? (
        <div className="page page--narrow">
          <LoadingState label="Loading the preview..." />
        </div>
      ) : (
        scene && <ResultsView key={rank} result={result} trophy={trophy} showXp roomPath={null} preview animate />
      )}
    </>
  );
}

export default AdminTrophyPreview;
