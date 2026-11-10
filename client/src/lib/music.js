import { createContext, useContext, useEffect } from "react";
import { API_URL } from "./api";

// The background music tracks people can choose from are managed by the admin (Admin dashboard >
// Background music) and loaded from the server by MusicProvider (GET /api/music-tracks). This list
// is what plays until that answer arrives, and what is kept if the server can't be reached. It is
// the four files in client/public/audio/, served by Vite. The `id` is what each browser remembers.
export const DEFAULT_MUSIC_TRACKS = [
  { id: "track-1", label: "Track 1", src: "/audio/background-music.mp3" },
  { id: "track-2", label: "Track 2", src: "/audio/track-2.mp3" },
  { id: "track-3", label: "Track 3", src: "/audio/track-3.mp3" },
  { id: "track-4", label: "Track 4", src: "/audio/track-4.mp3" },
];

// Turns a track from the server into what the player uses. An uploaded track's file is on the
// server, so its address needs the server's address in front; a file in client/public/audio/ is
// served by the website itself.
export const toPlayerTrack = (track) => ({
  id: track.key,
  label: track.label,
  src: track.src.startsWith("/uploads/") ? `${API_URL}${track.src}` : track.src,
});

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

// The track id this browser picked last (empty if none). It may no longer be in the list, so the
// player falls back to the first track when it can't find it.
export const readStoredTrack = () => read(MUSIC_TRACK_STORAGE_KEY) || "";

export const MusicContext = createContext({
  tracks: DEFAULT_MUSIC_TRACKS,
  trackId: DEFAULT_MUSIC_TRACKS[0].id,
  failedTracks: new Set(),
  enabled: false,
  playing: false,
  unavailable: false,
  toggle: () => {},
  selectTrack: () => {},
  suspend: () => () => {},
  refreshTracks: async () => {},
});

export const useMusic = () => useContext(MusicContext);

// Pauses the background music for as long as the calling component is
// mounted (e.g. the game screen, which has its own sound), then resumes it.
export function useSuspendMusic() {
  const { suspend } = useMusic();
  useEffect(() => suspend(), [suspend]);
}
