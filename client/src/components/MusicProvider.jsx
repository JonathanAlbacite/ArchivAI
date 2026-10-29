import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MusicContext,
  MUSIC_STORAGE_KEY,
  MUSIC_TRACK_STORAGE_KEY,
  MUSIC_TRACKS,
  MUSIC_VOLUME,
  readStoredMusic,
  readStoredTrack,
} from "../lib/music";

const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked - the choice just won't persist
  }
};

const trackById = (id) => MUSIC_TRACKS.find((t) => t.id === id) || MUSIC_TRACKS[0];

// One looping <audio> for the whole site, so the track keeps playing across
// page changes. Off by default; the on/off choice and the chosen track are
// remembered per browser.
//
// Browsers only allow sound after the visitor interacts with the page. If the
// music was left on last visit it is "waiting": it starts on the first click
// or key press, and the toggle shows it isn't playing yet (clicking the toggle
// then starts it rather than switching it off).
function MusicProvider({ children }) {
  const audioRef = useRef(null);
  const [enabled, setEnabled] = useState(readStoredMusic);
  const [trackId, setTrackId] = useState(readStoredTrack);
  const trackRef = useRef(trackId);
  const [suspendCount, setSuspendCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Tracks whose file couldn't be loaded or decoded (e.g. not added yet).
  const [failedTracks, setFailedTracks] = useState(() => new Set());
  // When the first-interaction listener last started the music (see toggle).
  const gestureStartRef = useRef(0);

  useEffect(() => {
    const audio = new Audio(trackById(trackRef.current).src);
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audio.preload = "none";
    // Listeners only act for the element currently in use, so a discarded one
    // (React StrictMode mounts effects twice in development) can't change state.
    const current = () => audioRef.current === audio;
    audio.addEventListener("playing", () => current() && setPlaying(true));
    audio.addEventListener("pause", () => current() && setPlaying(false));
    // Only a real load/decode failure of the file means that track is unavailable -
    // a play() that the browser blocked or interrupted is not an error with the file.
    audio.addEventListener("error", () => {
      if (!current() || !audio.error) return;
      const failed = trackRef.current;
      setFailedTracks((set) => new Set(set).add(failed));
    });
    audioRef.current = audio;
    return () => {
      audioRef.current = null;
      audio.pause();
    };
  }, []);

  // Switching tracks swaps the source on the same element. Declared before the
  // play effect below, so the new source is in place before it plays.
  useEffect(() => {
    trackRef.current = trackId;
    const audio = audioRef.current;
    if (!audio) return;
    const src = trackById(trackId).src;
    if (!audio.src.endsWith(src)) {
      audio.pause();
      audio.src = src;
    }
  }, [trackId]);

  const unavailable = failedTracks.has(trackId);
  const shouldPlay = enabled && suspendCount === 0 && !unavailable;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!shouldPlay) {
      audio.pause();
      return;
    }

    // If the browser blocks it, wait for the visitor's first interaction.
    // `active` goes false on cleanup: play()'s rejection arrives later, so without
    // it a cleaned-up run (or a discarded StrictMode element) would still attach a
    // listener and start an <audio> that nothing can pause any more.
    let active = true;
    const startOnGesture = () => {
      if (!active || audioRef.current !== audio) return;
      gestureStartRef.current = Date.now();
      audio.play().catch(() => {});
    };
    audio.play().catch(() => {
      if (!active) return;
      document.addEventListener("pointerdown", startOnGesture, { once: true, capture: true });
      document.addEventListener("keydown", startOnGesture, { once: true, capture: true });
    });

    return () => {
      active = false;
      document.removeEventListener("pointerdown", startOnGesture, { capture: true });
      document.removeEventListener("keydown", startOnGesture, { capture: true });
    };
  }, [shouldPlay, trackId]);

  const toggle = useCallback(() => {
    // Switched on but still waiting for a first interaction: this click starts it.
    // The same click may already have started it through the first-interaction
    // listener a moment ago - that must not count as "switch off".
    const justStarted = Date.now() - gestureStartRef.current < 1000;
    if (enabled && suspendCount === 0 && (!playing || justStarted)) {
      audioRef.current?.play().catch(() => {});
      return;
    }
    const next = !enabled;
    save(MUSIC_STORAGE_KEY, next ? "on" : "off");
    setEnabled(next);
  }, [enabled, playing, suspendCount]);

  // Picking a track also switches the music on - choosing one means "play this".
  const selectTrack = useCallback((id) => {
    save(MUSIC_TRACK_STORAGE_KEY, id);
    save(MUSIC_STORAGE_KEY, "on");
    setTrackId(id);
    setEnabled(true);
  }, []);

  // Returns the matching resume function (see useSuspendMusic).
  const suspend = useCallback(() => {
    setSuspendCount((n) => n + 1);
    return () => setSuspendCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({ tracks: MUSIC_TRACKS, trackId, failedTracks, enabled, playing, unavailable, toggle, selectTrack, suspend }),
    [trackId, failedTracks, enabled, playing, unavailable, toggle, selectTrack, suspend]
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export default MusicProvider;
