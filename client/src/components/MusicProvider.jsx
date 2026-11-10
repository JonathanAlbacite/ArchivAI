import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MUSIC_TRACKS,
  MusicContext,
  MUSIC_STORAGE_KEY,
  MUSIC_TRACK_STORAGE_KEY,
  MUSIC_VOLUME,
  readStoredMusic,
  readStoredTrack,
  toPlayerTrack,
} from "../lib/music";
import { api } from "../lib/api";

const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked - the choice just won't persist
  }
};

// One looping <audio> for the whole site, so the track keeps playing across
// page changes. Off by default; the on/off choice and the chosen track are
// remembered per browser.
//
// The list of tracks is managed by the admin and loaded from the server (see
// refreshTracks). Until it arrives, or if the server can't be reached, the
// four built-in tracks are used. If this browser's remembered track is no longer
// in the list (deleted or hidden by the admin), the first track plays instead.
//
// Browsers only allow sound after the visitor interacts with the page. If the
// music was left on last visit it is "waiting": it starts on the first click
// or key press, and the toggle shows it isn't playing yet (clicking the toggle
// then starts it rather than switching it off).
function MusicProvider({ children }) {
  const audioRef = useRef(null);
  const [enabled, setEnabled] = useState(readStoredMusic);
  const [tracks, setTracks] = useState(DEFAULT_MUSIC_TRACKS);
  // What this browser chose last. It may not be in `tracks` any more - see currentTrack below.
  const [chosenId, setChosenId] = useState(readStoredTrack);
  // False until the first attempt to load the track list has finished, so a remembered track that
  // is not one of the built-in four doesn't start Track 1 for a moment first.
  const [listReady, setListReady] = useState(false);
  const [suspendCount, setSuspendCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Tracks whose file couldn't be loaded or decoded (e.g. not added yet).
  const [failedTracks, setFailedTracks] = useState(() => new Set());
  // When the first-interaction listener last started the music (see toggle).
  const gestureStartRef = useRef(0);

  // The track that actually plays: the chosen one, or the first if it isn't in the list.
  const currentTrack = tracks.find((t) => t.id === chosenId) || tracks[0] || null;
  const trackId = currentTrack ? currentTrack.id : "";
  const currentSrc = currentTrack ? currentTrack.src : "";
  const trackRef = useRef(trackId);

  // Loads the admin's track list. Also called by the admin page after it changes the list. On a
  // failure the list stays as it was.
  const refreshTracks = useCallback(async () => {
    try {
      const { ok, data } = await api("/music-tracks");
      if (!ok || !Array.isArray(data)) return;
      setTracks(data.map(toPlayerTrack));
      setFailedTracks(new Set());
    } catch {
      // can't reach the server - keep the list we have
    } finally {
      setListReady(true);
    }
  }, []);

  useEffect(() => {
    refreshTracks();
  }, [refreshTracks]);

  useEffect(() => {
    const audio = new Audio();
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
    if (!currentSrc) {
      audio.pause();
      return;
    }
    if (!audio.src.endsWith(currentSrc)) {
      audio.pause();
      audio.src = currentSrc;
    }
  }, [trackId, currentSrc]);

  // No track to play (the admin hid or deleted them all) counts as unavailable.
  const unavailable = !currentTrack || failedTracks.has(trackId);
  const shouldPlay = enabled && listReady && suspendCount === 0 && !unavailable;

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
    setChosenId(id);
    setEnabled(true);
  }, []);

  // Returns the matching resume function (see useSuspendMusic).
  const suspend = useCallback(() => {
    setSuspendCount((n) => n + 1);
    return () => setSuspendCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo(
    () => ({ tracks, trackId, failedTracks, enabled, playing, unavailable, toggle, selectTrack, suspend, refreshTracks }),
    [tracks, trackId, failedTracks, enabled, playing, unavailable, toggle, selectTrack, suspend, refreshTracks]
  );

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export default MusicProvider;
