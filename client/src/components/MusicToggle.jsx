import { Music, Pause, Play, VolumeX } from "lucide-react";
import { IconButton, Menu } from "./ui";
import { useMusic } from "../lib/music";

// Background music button (top bar and sign-in pages). It opens a small menu:
// switch the music on/off and pick one of the tracks. The icon shows whether
// music is actually playing, not just whether it's switched on.
function MusicToggle() {
  const { tracks, trackId, failedTracks, enabled, playing, unavailable, toggle, selectTrack } = useMusic();
  const waiting = enabled && !playing && !unavailable;
  const current = tracks.find((t) => t.id === trackId);

  const status = unavailable
    ? `${current?.label} is unavailable`
    : playing
      ? `Playing ${current?.label}`
      : waiting
        ? "Click anywhere to start"
        : "Off";

  return (
    <Menu
      label="Background music"
      items={[
        {
          label: playing ? "Turn music off" : waiting ? "Start music" : "Turn music on",
          icon: playing ? Pause : Play,
          onSelect: toggle,
          disabled: unavailable,
        },
        ...tracks.map((t, i) => ({
          label: failedTracks.has(t.id) ? `${t.label} (unavailable)` : t.label,
          icon: Music,
          checked: t.id === trackId,
          separatorBefore: i === 0,
          onSelect: () => selectTrack(t.id),
          disabled: failedTracks.has(t.id),
        })),
      ]}
      renderTrigger={(props) => <IconButton icon={playing ? Music : VolumeX} label={`Background music: ${status}`} {...props} />}
    />
  );
}

export default MusicToggle;
