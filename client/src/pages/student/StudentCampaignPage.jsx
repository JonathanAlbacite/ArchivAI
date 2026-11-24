import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, ChevronRight, Clock, DoorOpen, Eye, Flag, GraduationCap, Lock, Medal, Paperclip, Play, Repeat, RotateCcw, StepForward } from "lucide-react";
import { SceneBadge } from "../../components/SceneIcon";
import LessonReader from "../../components/student/LessonReader";
import CheckpointTrack from "../../components/student/CheckpointTrack";
import { Alert, Breadcrumbs, Button, Card, PageHeader, RankMedal, Skeleton, Stat, StatusChip } from "../../components/ui";
import useRoomMembers from "../../lib/useRoomMembers";
import { api, errorMessage } from "../../lib/api";
import { fetchCampaignStatus } from "../../lib/studentProgress";
import { clearSession } from "../../lib/session";
import { sceneStyle, useEnvironments } from "../../scenes";
import { formatDate, formatDuration, plural } from "../../lib/format";

const ACTION = {
  notStarted: { label: "Play", icon: Play },
  inProgress: { label: "Continue", icon: StepForward },
  completed: { label: "Play again", icon: RotateCcw },
};

// The whole page for one campaign, opened by selecting its card on the room page
// (/student/room/:id/campaign/:campaignId). It shows how many times the student finished it, the best
// rank and time, the progress of a run that is still going, every finished attempt (select one to see
// its results again), what the campaign is (scene, room, teacher, attachment), and the Play / Continue /
// Play again button. Play does not start the game here: it goes back to the room page asking it to play
// this campaign (the same way "Retry" on the results page does), because the room page owns the game.
// Data: the room (GET /rooms/:id, for the campaign itself), fetchCampaignStatus (lib/studentProgress.js)
// and GET /api/campaigns/:id/results/history (the attempts).
function StudentCampaignPage() {
  const { id, campaignId } = useParams();
  const navigate = useNavigate();
  const members = useRoomMembers(id);
  useEnvironments();

  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [historyFailed, setHistoryFailed] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRoom(null);
    setStatus(null);
    setHistory(null);
    setLoadError("");
    setHistoryFailed(false);

    const load = async () => {
      try {
        const { ok, status: code, data } = await api(`/rooms/${id}`);
        if (cancelled) return;
        if (!ok) {
          if (code === 401) {
            clearSession();
            navigate("/");
            return;
          }
          setLoadError(code === 403 ? "You're not a member of this room." : code === 404 ? "This room doesn't exist anymore." : errorMessage(data));
          return;
        }
        if (!(data.campaigns || []).some((c) => String(c.id) === String(campaignId))) {
          setLoadError("This campaign isn't in this room anymore.");
          return;
        }
        setRoom(data);

        const [state, hist] = await Promise.all([
          fetchCampaignStatus(campaignId),
          api(`/campaigns/${campaignId}/results/history`).catch(() => null),
        ]);
        if (cancelled) return;
        setStatus(state);
        if (hist?.ok && hist.data && Array.isArray(hist.data.attempts)) setHistory(hist.data);
        else setHistoryFailed(true);
      } catch {
        if (!cancelled) setLoadError("Couldn't reach the server. Check your connection and try again.");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, campaignId, navigate]);

  const campaigns = room?.campaigns || [];
  const index = campaigns.findIndex((c) => String(c.id) === String(campaignId));
  const campaign = index >= 0 ? campaigns[index] : null;

  const state = status?.state || "notStarted";
  const action = ACTION[state];
  const attempts = history?.attempts || [];
  const loadingAttempts = !history && !historyFailed;

  // The run in progress: the checkpoints it has saved. How many checkpoints the campaign has is only
  // known from a finished run (the game reports it with each one), so the bar needs one.
  const progress = state === "inProgress" ? status?.progress : null;
  const reached = progress?.reachedCheckpointIds?.length ?? 0;
  const total = attempts.find((a) => Number.isInteger(a.checkpointsTotal) && a.checkpointsTotal > 0)?.checkpointsTotal ?? status?.run?.checkpointsTotal ?? null;
  const percent = total ? Math.min(100, Math.round((reached / total) * 100)) : null;

  // A lesson file has to be read (in the kid-friendly reader) before Play unlocks.
  const needsReading = !!campaign?.attachmentFilename && !campaign.readByMe;

  const handlePlay = () => navigate(`/student/room/${id}`, { state: { playCampaignId: campaign.id, fromCampaign: true } });

  const handleLessonRead = () =>
    setRoom((r) => r && { ...r, campaigns: r.campaigns.map((c) => (String(c.id) === String(campaignId) ? { ...c, readByMe: true } : c)) });

  // The newest attempt opens the plain results address, an earlier one opens it with ?attempt=<run id>
  // (see RunResults.jsx). The score animation plays again.
  const handleViewAttempt = (attempt, isLatest) =>
    navigate(isLatest ? `/results/${campaign.id}` : `/results/${campaign.id}?attempt=${attempt.id}`, { state: { roomId: id, replay: true } });

  const crumbs = [
    { label: "Dashboard", to: "/student/dashboard" },
    { label: room?.name || "Room", to: `/student/room/${id}` },
    { label: campaign?.title || "Campaign" },
  ];

  return (
    <div className="page" style={campaign ? sceneStyle(campaign.scene) : undefined}>
      <PageHeader
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        eyebrow={campaign ? `Campaign ${index + 1}` : "Campaign"}
        title={campaign ? campaign.title : loadError ? "Campaign unavailable" : <Skeleton width={280} height={34} />}
        description={campaign?.description}
        actions={
          campaign && (
            <div className="row" style={{ "--gap": "8px" }}>
              {campaign.attachmentFilename && (
                <Button variant={needsReading ? "accent" : "secondary"} icon={BookOpen} onClick={() => setShowAttachment(true)}>
                  {needsReading ? "Read the lesson first" : "Read again"}
                </Button>
              )}
              <Button
                variant={needsReading ? "secondary" : "accent"}
                icon={needsReading ? Lock : action.icon}
                onClick={handlePlay}
                disabled={needsReading}
                title={needsReading ? "Read the lesson to unlock Play" : undefined}
              >
                {action.label}
              </Button>
            </div>
          )
        }
      >
        {campaign && (
          <div className="row" style={{ "--gap": "6px", marginTop: 12 }}>
            <SceneBadge scene={campaign.scene} />
            {status ? <StatusChip status={state} /> : <Skeleton width={90} height={24} radius="999px" />}
          </div>
        )}
      </PageHeader>

      {loadError && (
        <Alert tone="danger" title="We couldn't open this campaign" action={<Button size="sm" to={`/student/room/${id}`}>Back to the room</Button>}>
          {loadError}
        </Alert>
      )}

      {!loadError && (
        <div className="stack" style={{ "--gap": "24px" }}>
          <div className="stat-grid" style={{ "--cols": 3 }}>
            <Stat icon={Repeat} tone="primary" label="Tries" value={loadingAttempts ? "–" : attempts.length} />
            <Stat icon={Medal} tone="secondary" label="Best rank" value={loadingAttempts ? "–" : history?.bestRank || "None"} />
            <Stat icon={Clock} tone="info" label="Best time" value={loadingAttempts ? "–" : history?.bestTime == null ? "None" : formatDuration(history.bestTime)} />
          </div>

          {state === "inProgress" && (
            <section className="detail-progress" aria-labelledby="campaign-progress-heading">
              <h2 id="campaign-progress-heading" className="detail-section-title row" style={{ "--gap": "6px", justifyContent: "center" }}>
                <Flag size={16} aria-hidden="true" /> Your run in progress
              </h2>
              <p className="text-sm">
                {reached === 0
                  ? "You have started, but have not reached a checkpoint yet."
                  : total
                    ? `${reached} of ${total} checkpoints reached`
                    : `${plural(reached, "checkpoint")} reached`}
                {progress?.updatedAt && <span className="text-muted"> · saved {formatDate(progress.updatedAt)}</span>}
              </p>
              <CheckpointTrack percent={percent} />
              <p className="text-xs text-muted">
                {percent === null
                  ? "The bar fills in once you finish this campaign once, because only then does the game report how many checkpoints it has."
                  : "Continue picks up from your last checkpoint."}
              </p>
            </section>
          )}

          <div className="split">
            <div className="stack">
              <section aria-labelledby="campaign-attempts-heading">
                <h2 id="campaign-attempts-heading" className="detail-section-title">
                  Your attempts
                </h2>
                {loadingAttempts ? (
                  <Skeleton height={64} />
                ) : historyFailed ? (
                  <Alert tone="warning">Couldn't load your attempts. Refresh the page to try again.</Alert>
                ) : attempts.length === 0 ? (
                  <p className="text-sm text-muted">No finished runs yet. Finish the campaign and each attempt will be listed here.</p>
                ) : (
                  <>
                    <p className="text-xs text-muted">Select an attempt to see its results again.</p>
                    <ul className="detail-attempts" role="list">
                      {attempts.map((a, i) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            className="detail-attempt"
                            onClick={() => handleViewAttempt(a, i === 0)}
                            aria-label={`View the results of attempt ${a.number}${a.rank ? `, Rank ${a.rank}` : ""}`}
                          >
                            <RankMedal rank={a.rank} size={36} />
                            <span className="grow">
                              <span className="font-semibold">Attempt #{a.number}</span>
                              {i === 0 && <span className="text-xs text-muted"> · Latest</span>}
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

            <aside aria-labelledby="campaign-about-heading">
              <Card>
                <h2 id="campaign-about-heading" className="detail-section-title">
                  About this campaign
                </h2>
                {!campaign ? (
                  <Skeleton height={120} />
                ) : (
                  <dl className="detail-facts">
                    <div>
                      <dt className="text-xs text-muted">Scene</dt>
                      <dd><SceneBadge scene={campaign.scene} /></dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Room</dt>
                      <dd className="row" style={{ "--gap": "6px" }}>
                        <DoorOpen size={16} aria-hidden="true" /> {room.name}
                      </dd>
                    </div>
                    {members?.owner?.name && (
                      <div>
                        <dt className="text-xs text-muted">Teacher</dt>
                        <dd className="row" style={{ "--gap": "6px" }}>
                          <GraduationCap size={16} aria-hidden="true" /> {members.owner.name}
                        </dd>
                      </div>
                    )}
                    {attempts[0] && (
                      <div>
                        <dt className="text-xs text-muted">Last finished</dt>
                        <dd>{formatDate(attempts[0].completedAt)}</dd>
                      </div>
                    )}
                    {campaign.attachmentFilename && (
                      <div>
                        <dt className="text-xs text-muted">Attachment</dt>
                        <dd>
                          <button type="button" className="attachment-chip attachment-chip--lead" onClick={() => setShowAttachment(true)}>
                            <Paperclip size={14} aria-hidden="true" />
                            <span className="truncate">{campaign.attachmentFilename}</span>
                            <Eye size={14} aria-hidden="true" />
                            <span className="sr-only">Open attachment</span>
                          </button>
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </Card>
            </aside>
          </div>

          <div>
            <Button variant="secondary" to={`/student/room/${id}`}>
              Back to the room
            </Button>
          </div>
        </div>
      )}

      {showAttachment && campaign && (
        <LessonReader campaign={campaign} onClose={() => setShowAttachment(false)} onFinished={handleLessonRead} onPlay={handlePlay} />
      )}
    </div>
  );
}

export default StudentCampaignPage;
