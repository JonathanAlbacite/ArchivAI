import { Lock } from "lucide-react";
import { Button } from "../ui";

// The Play button while a campaign's lesson file hasn't been read to the end: locked, and filled
// with water up to how far the student has scrolled through the file (level 0..1). Once the read is
// saved the caller shows the normal Play button instead.
function WaterPlayButton({ level, label = "Play", block, describedBy }) {
  const percent = Math.round(Math.min(1, Math.max(0, level)) * 100);

  return (
    <Button
      variant="secondary"
      block={block}
      icon={Lock}
      disabled
      className="btn--water"
      style={{ "--water": `${percent}%` }}
      aria-describedby={describedBy}
      title="Open the lesson and scroll to the end to unlock Play"
    >
      <span className="btn--water__fill" aria-hidden="true" />
      {label}
      <span className="btn--water__percent">{percent}%</span>
      <span className="sr-only"> read. Locked until you scroll to the end of the lesson.</span>
    </Button>
  );
}

export default WaterPlayButton;
