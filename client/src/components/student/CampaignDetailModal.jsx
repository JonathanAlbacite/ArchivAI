import { useEffect, useState } from "react";
import { ChevronRight, Clock, Flag, Medal, Play, RotateCcw, Repeat, StepForward } from "lucide-react";
import { SceneBadge } from "../SceneIcon";
import { Alert, Button, Modal, RankMedal, Skeleton, Stat, StatusChip } from "../ui";
import { api } from "../../lib/api";
import { formatDate, formatDuration, plural } from "../../lib/format";

const ACTION = {
  notStarted: { label: "Play", icon: Play },
  inProgress: { label: "Continue", icon: StepForward },
  completed: { label: "Play again", icon: RotateCcw },
};

// The detailed look at one campaign, opened by selecting its card on the room page: how many times
// the student finished it, the best rank and time, the progress of a run that is still going, every
// finished attempt (select one to see its results again), and the Play / Continue / Play again button.
// `status` comes from fetchCampaignStatus (lib/studentProgress.js). The attempts come from
// GET /api/campaigns/:id/results/history, loaded when the dialog opens. onViewAttempt(attempt, isLatest)
// opens that attempt's results page (RunResults.jsx).
function CampaignDetailModal({ campaign, number, status, starting, disabled, onClose, onPlay, onViewAttempt }) {
  const [history, setHistory] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/campaigns/${campaign.id}/results/history`)
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data && Array.isArray(data.attempts)) setHistory(data);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  const state = status?.state || "notStarted";
  const action = ACTION[state];
  const attempts = history?.attempts || [];
  const loading = !history && !failed;

  // The run in progress: the checkpoints it has saved. How many checkpoints the campaign has is only
  // known from a finished run (the game reports it with each one), so the bar needs one.
  const progress = state === "inProgress" ? status?.progress : null;
  const reached = progress?.reachedCheckpointIds?.length ?? 0;
  const total = attempts.find((a) => Number.isInteger(a.checkpointsTotal) && a.checkpointsTotal > 0)?.checkpointsTotal ?? status?.run?.checkpointsTotal ?? null;
  const percent = total ? Math.min(100, Math.round((reached / total) * 100)) : null;

  const handlePlay = () => {
    onClose();
    onPlay(campaign);
  };

  return (
    <Modal
      title={campaign.title}
      description={`Campaign ${number}`}
      size="lg"
      onClose={onClose}
      closeOnBackdrop
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="accent" icon={action.icon} loading={starting} disabled={disabled} onClick={handlePlay}>
            {starting ? "Starting..." : action.label}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="row" style={{ "--gap": "6px" }}>
          <SceneBadge scene={campaign.scene} />
          <StatusChip status={state} />
        </div>

        {campaign.description && <p className="text-sm text-muted">{campaign.description}</p>}

        <div className="stat-grid" style={{ "--cols": 3 }}>
          <Stat icon={Repeat} tone="primary" label="Tries" value={loading ? "–" : attempts.length} />
          <Stat icon={Medal} tone="secondary" label="Best rank" value={loading ? "–" : history?.bestRank || "None"} />
          <Stat icon={Clock} tone="info" label="Best time" value={loading ? "–" : history?.bestTime == null ? "None" : formatDuration(history.bestTime)} />
        </div>

        {state === "inProgress" && (
          <section className="detail-progress" aria-labelledby={`detail-${campaign.id}-progress`}>
            <h3 id={`detail-${campaign.id}-progress`} className="detail-section-title row" style={{ "--gap": "6px" }}>
              <Flag size={16} aria-hidden="true" /> Your run in progress
            </h3>
            <p className="text-sm">
              {reached === 0
                ? "You have started, but have not reached a checkpoint yet."
                : total
                  ? `${reached} of ${total} checkpoints reached`
                  : `${plural(reached, "checkpoint")} reached`}
              {progress?.updatedAt && <span className="text-muted"> · saved {formatDate(progress.updatedAt)}</span>}
            </p>
            {percent !== null && (
              <div className="detail-progress__track" role="progressbar" aria-label="Checkpoints reached" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="detail-progress__fill" style={{ width: `${percent}%` }} />
              </div>
            )}
            <p className="text-xs text-muted">Continue picks up from your last checkpoint.</p>
          </section>
        )}

        <section aria-labelledby={`detail-${campaign.id}-attempts`}>
          <h3 id={`detail-${campaign.id}-attempts`} className="detail-section-title">
            Your attempts
          </h3>
          {loading ? (
            <Skeleton height={64} />
          ) : failed ? (
            <Alert tone="warning">Couldn't load your attempts. Close this and open the campaign again to retry.</Alert>
          ) : attempts.length === 0 ? (
            <p className="text-sm text-muted">No finished runs yet. Finish the campaign and each attempt will be listed here.</p>
          ) : (
            <>
              <p className="text-xs text-muted">Select an attempt to see its results again.</p>
              <ul className="detail-attempts" role="list">
                {attempts.map((a, index) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="detail-attempt"
                      onClick={() => onViewAttempt(a, index === 0)}
                      aria-label={`View the results of attempt ${a.number}${a.rank ? `, Rank ${a.rank}` : ""}`}
                    >
                      <RankMedal rank={a.rank} size={36} />
                      <span className="grow">
                        <span className="font-semibold">Attempt #{a.number}</span>
                        {index === 0 && <span className="text-xs text-muted"> · Latest</span>}
                        <span className="detail-attempt__meta text-xs text-muted">
                          {formatDate(a.completedAt)} · {formatDuration(a.totalTime)} · {a.mistakes == null ? "wrong attempts not recorded" : plural(a.mistakes, "wrong attempt")}
                        </span>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" className="detail-attempt__arrow" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}

export default CampaignDetailModal;
