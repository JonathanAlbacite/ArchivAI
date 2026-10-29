import { Eye, Paperclip, Play, RotateCcw, StepForward } from "lucide-react";
import { SceneArt } from "../Illustrations";
import { SceneBadge } from "../SceneIcon";
import { Button, RankMedal, Skeleton, StatusChip } from "../ui";
import { sceneStyle } from "../../scenes";
import { formatDuration } from "../../lib/format";

const ACTION = {
  notStarted: { label: "Play", icon: Play },
  inProgress: { label: "Continue", icon: StepForward },
  completed: { label: "Play again", icon: RotateCcw },
};

// One published campaign. `status` comes from fetchCampaignStatus
// (null while loading). The rank shown is the game's rank from the latest
// finished run - the API keeps only the latest, so it's labelled that way.
function CampaignQuestCard({ campaign, number, status, starting, disabled, onPlay, onPreviewAttachment }) {
  const state = status?.state || "notStarted";
  const action = ACTION[state];
  const run = status?.run;

  return (
    <article className="quest-card card" style={sceneStyle(campaign.scene)} aria-labelledby={`quest-${campaign.id}-title`}>
      <div className="quest-card__art">
        <SceneArt scene={campaign.scene} />
        <span className="quest-card__number" aria-hidden="true">
          {number}
        </span>
      </div>

      <div className="quest-card__body">
        <p className="text-xs text-muted font-semibold">Campaign {number}</p>
        <h3 id={`quest-${campaign.id}-title`} className="card__title break-words">
          {campaign.title}
        </h3>
        {campaign.description && <p className="text-sm text-muted quest-card__desc">{campaign.description}</p>}

        <div className="row" style={{ "--gap": "6px" }}>
          <SceneBadge scene={campaign.scene} />
          {status ? <StatusChip status={state} /> : <Skeleton width={90} height={24} radius="999px" />}
        </div>

        {run && (
          <div className="quest-card__best">
            <RankMedal rank={run.rank} size={40} />
            <div>
              <p className="text-xs text-muted">Latest run</p>
              <p className="text-sm font-semibold">
                {run.rank ? `Rank ${run.rank}` : "No rank"} · {formatDuration(run.totalTime)}
              </p>
            </div>
          </div>
        )}

        {campaign.attachmentFilename && (
          <button type="button" className="attachment-chip" onClick={() => onPreviewAttachment(campaign)}>
            <Paperclip size={14} aria-hidden="true" />
            <span className="truncate">{campaign.attachmentFilename}</span>
            <Eye size={14} aria-hidden="true" />
            <span className="sr-only">Open attachment</span>
          </button>
        )}

        <div className="card__footer">
          <Button variant="accent" block icon={action.icon} loading={starting} disabled={disabled} onClick={() => onPlay(campaign)}>
            {starting ? "Starting..." : action.label}
            <span className="sr-only">: {campaign.title}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}

export default CampaignQuestCard;
