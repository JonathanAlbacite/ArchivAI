import { createContext, useContext, useEffect } from "react";

// The background music tracks people can choose from. Files are served by Vite
// from client/public/audio/. To add, rename or swap a track, edit this list
// (the `id` is what each browser remembers, so keep it stable).
export const MUSIC_TRACKS = [
  { id: "track-1", label: "Track 1", src: "/audio/background-music.mp3" },
  { id: "track-2", label: "Track 2", src: "/audio/track-2.mp3" },
  { id: "track-3", label: "Track 3", src: "/audio/track-3.mp3" },
  { id: "track-4", label: "Track 4", src: "/audio/track-4.mp3" },
];

export const MUSIC_VOLUME = 0.35;
export const MUSIC_STORAGE_KEY = "archivai_music";
export const MUSIC_TRACK_STORAGE_KEY = "archivai_music_track";

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// Off unless this browser turned it on before.
export const readStoredMusic = () => read(MUSIC_STORAGE_KEY) === "on";

// The track this browser picked last, or the first one.
export const readStoredTrack = () => {
  const id = read(MUSIC_TRACK_STORAGE_KEY);
  return MUSIC_TRACKS.some((t) => t.id === id) ? id : MUSIC_TRACKS[0].id;
};

export const MusicContext = createContext({
  tracks: MUSIC_TRACKS,
  trackId: MUSIC_TRACKS[0].id,
  failedTracks: new Set(),
  enabled: false,
  playing: false,
  unavailable: false,
  toggle: () => {},
  selectTrack: () => {},
  suspend: () => () => {},
});

export const useMusic = () => useContext(MusicContext);

// Pauses the background music for as long as the calling component is
// mounted (e.g. the game screen, which has its own sound), then resumes it.
export function useSuspendMusic() {
  const { suspend } = useMusic();
  useEffect(() => suspend(), [suspend]);
}
