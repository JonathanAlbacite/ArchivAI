import { BookOpen, ChevronRight, Play, RotateCcw, StepForward } from "lucide-react";
import { SceneArt } from "../Illustrations";
import { SceneBadge } from "../SceneIcon";
import { Button, RankMedal, Skeleton, StatusChip } from "../ui";
import { sceneStyle, useEnvironments } from "../../scenes";
import { formatDuration } from "../../lib/format";
import WaterPlayButton from "./WaterPlayButton";

const ACTION = {
  notStarted: { label: "Play", icon: Play },
  inProgress: { label: "Continue", icon: StepForward },
  completed: { label: "Play again", icon: RotateCcw },
};

// One published campaign. `status` comes from fetchCampaignStatus
// (null while loading). The rank shown is the game's rank from the latest
// finished run - the API keeps only the latest, so it's labelled that way.
// The whole card is clickable: the title is a button whose click area is stretched over the card
// (.quest-card__open), and onOpen(campaign) opens the campaign's own page (StudentCampaignPage). The buttons
// inside the card (Latest run, View Lesson, Play) sit above it and do their own thing.
// The Latest run box is a button: onViewRun(campaign) opens that run's results page.
// A campaign with an attached lesson file stays locked until the student has scrolled to the end of
// it (onPreviewAttachment opens the file); until then Play fills with water as they scroll
// (readLevel, 0..1 - see lib/readingProgress.js).
function CampaignQuestCard({ campaign, number, status, starting, disabled, readLevel = 0, onPlay, onPreviewAttachment, onViewRun, onOpen }) {
  useEnvironments();
  const state = status?.state || "notStarted";
  const action = ACTION[state];
  const run = status?.run;
  const needsReading = !!campaign.attachmentFilename && !campaign.readByMe;

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
          <button type="button" className="quest-card__open" onClick={() => onOpen(campaign)}>
            {campaign.title}
            <span className="sr-only"> - view details</span>
          </button>
        </h3>
        {campaign.description && <p className="text-sm text-muted quest-card__desc">{campaign.description}</p>}

        <div className="row" style={{ "--gap": "6px" }}>
          <SceneBadge scene={campaign.scene} />
          {status ? <StatusChip status={state} /> : <Skeleton width={90} height={24} radius="999px" />}
        </div>

        {run && (
          <button
            type="button"
            className="quest-card__best quest-card__best--link"
            onClick={() => onViewRun(campaign)}
            aria-label={`View the results of your latest run of ${campaign.title}: ${run.rank ? `Rank ${run.rank}` : "no rank"}, ${formatDuration(run.totalTime)}`}
          >
            <RankMedal rank={run.rank} size={40} />
            <div className="grow">
              <p className="text-xs text-muted">Latest run</p>
              <p className="text-sm font-semibold">
                {run.rank ? `Rank ${run.rank}` : "No rank"} · {formatDuration(run.totalTime)}
              </p>
            </div>
            <ChevronRight size={18} aria-hidden="true" className="quest-card__best-arrow" />
          </button>
        )}

        {campaign.attachmentFilename && (
          <Button variant="secondary" block icon={BookOpen} className="quest-card__lesson" onClick={() => onPreviewAttachment(campaign)}>
            View Lesson
            <span className="sr-only">: {campaign.attachmentFilename}</span>
          </Button>
        )}

        <div className="card__footer">
          {needsReading ? (
            <>
              <WaterPlayButton level={readLevel} label={action.label} block describedBy={`quest-${campaign.id}-locked`} />
              <p id={`quest-${campaign.id}-locked`} className="quest-card__locked text-xs text-muted">
                Open the lesson and scroll to the end to unlock Play.
              </p>
            </>
          ) : (
            <Button variant="accent" block icon={action.icon} loading={starting} disabled={disabled} onClick={() => onPlay(campaign)}>
              {starting ? "Starting..." : action.label}
              <span className="sr-only">: {campaign.title}</span>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export default CampaignQuestCard;
