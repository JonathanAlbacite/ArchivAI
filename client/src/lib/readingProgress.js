import { useCallback, useRef, useState } from "react";
import { api } from "./api";
import { getUserId } from "./session";

// How far a student has scrolled through a campaign's attached lesson file (0..1), kept in this
// browser per account so the Play button's water level survives a reload. Only the furthest point
// counts - scrolling back up never drains it. Reaching the end is saved on the server
// (POST /campaigns/:id/reading/done), which is what actually unlocks Play.

// Counts as "the end" - the last few pixels of a page are often a margin the reader can't reach.
export const READ_DONE_AT = 0.98;

const key = (campaignId) => `readProgress:${getUserId() ?? "anon"}:${campaignId}`;

export const getReadProgress = (campaignId) => {
  const value = Number(localStorage.getItem(key(campaignId)));
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
};

const saveReadProgress = (campaignId, fraction) => {
  try {
    localStorage.setItem(key(campaignId), String(fraction));
  } catch {
    // Storage full or blocked - the water level just won't survive a reload.
  }
};

// The water level for each campaign, plus `report(campaign, fraction)` for the file viewer to call
// while the student scrolls. onUnlocked(campaign) runs once the server has saved the read.
export function useReadingProgress(onUnlocked) {
  const [levels, setLevels] = useState({});
  // Campaigns whose read is being saved / has been saved, so it's sent once.
  const saving = useRef(new Set());
  const unlocked = useRef(new Set());

  const levelOf = (campaign) =>
    campaign.readByMe || unlocked.current.has(campaign.id) ? 1 : levels[campaign.id] ?? getReadProgress(campaign.id);

  const report = useCallback(
    async (campaign, fraction) => {
      const id = campaign.id;
      if (campaign.readByMe || unlocked.current.has(id)) return;
      const best = Math.max(fraction, getReadProgress(id));
      if (fraction > getReadProgress(id)) {
        saveReadProgress(id, fraction);
        setLevels((l) => ({ ...l, [id]: fraction }));
      }
      // At the end (now, or on an earlier visit whose save failed): save the read, once.
      if (best < READ_DONE_AT || saving.current.has(id)) return;
      saving.current.add(id);
      const { ok } = await api(`/campaigns/${id}/reading/done`, { method: "POST" }).catch(() => ({ ok: false }));
      saving.current.delete(id);
      if (!ok) return; // the next scroll event tries again
      unlocked.current.add(id);
      setLevels((l) => ({ ...l, [id]: 1 }));
      onUnlocked(campaign);
    },
    [onUnlocked]
  );

  return { levelOf, report };
}
