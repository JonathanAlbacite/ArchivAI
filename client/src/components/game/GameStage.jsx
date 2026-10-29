import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import UnityGame from "../UnityGame";
import { SceneBadge } from "../SceneIcon";
import { Badge, Button, ConfirmDialog } from "../ui";
import { getToken } from "../../lib/session";
import { sceneStyle } from "../../scenes";
import { useSuspendMusic } from "../../lib/music";

// Full-window game view shared by the student room (play) and the teacher
// room (preview). It only frames UnityGame - the Unity contract (build URLs,
// SetAuthContext handoff, the archivai:run-finished event) lives entirely in
// UnityGame.jsx and is untouched here. The room's active campaign must
// already be set server-side before this mounts (see handlePlay on each page).
function GameStage({ campaign, roomId, preview = false, onExit, onError, onRunFinished }) {
  const [status, setStatus] = useState("loading");
  const [confirmLeave, setConfirmLeave] = useState(false);
  // The game has its own sound, so the site music pauses while it is open.
  useSuspendMusic();

  // The page behind the game must not scroll while it's open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Leaving a running game drops anything since the last checkpoint, so ask
  // first; while it's still loading (or failed) just leave.
  const requestExit = () => (status === "ready" ? setConfirmLeave(true) : onExit());

  return (
    <div className="game-stage" style={sceneStyle(campaign.scene)} role="region" aria-label={`${campaign.title} game`}>
      <header className="game-stage__bar">
        <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={requestExit}>
          Return to room
        </Button>
        <div className="game-stage__title grow">
          <h1 className="truncate">{campaign.title}</h1>
          <div className="row" style={{ "--gap": "6px" }}>
            <SceneBadge scene={campaign.scene} />
            {preview && <Badge tone="teacher">Teacher preview</Badge>}
          </div>
        </div>
      </header>

      <div className="game-stage__body">
        <UnityGame token={getToken()} roomId={roomId} onError={onError} onRunFinished={onRunFinished} onStatusChange={setStatus} />
        {status === "ready" && (
          <p className="game-stage__hint text-xs">
            Your progress is saved at every checkpoint. Press Esc to leave fullscreen.
          </p>
        )}
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title="Leave this campaign?"
          confirmLabel="Leave"
          cancelLabel="Keep playing"
          tone="primary"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={onExit}
        >
          <p>Anything since your last checkpoint won't be saved. You can pick up from your last checkpoint next time.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default GameStage;
