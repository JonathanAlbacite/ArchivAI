import { useEffect, useState } from "react";
import { api, errorMessage } from "./api";

// A student's standing on one campaign, from two existing endpoints:
//   run      - the latest finished run (GET /campaigns/:id/results/latest), or null
//              when there is none yet (that endpoint answers 404)
//   progress - saved checkpoint progress (GET /campaigns/:id/progress)
// state is "completed" (a finished run exists), "inProgress" (checkpoints saved
// but no finished run since) or "notStarted".
export async function fetchCampaignStatus(campaignId) {
  const [runRes, progressRes] = await Promise.all([
    api(`/campaigns/${campaignId}/results/latest`).catch(() => null),
    api(`/campaigns/${campaignId}/progress`).catch(() => null),
  ]);
  const run = runRes?.ok ? runRes.data : null;
  const progress = progressRes?.ok ? progressRes.data : null;
  const inProgress = progress?.hasProgress && progress.status === "IN_PROGRESS";
  return {
    run,
    progress,
    state: inProgress ? "inProgress" : run ? "completed" : "notStarted",
  };
}

// Every joined room with its published campaigns and the student's status on
// each - the data behind the student dashboard and its preview XP. Requests
// run in parallel; one failing campaign only loses that campaign's status.
// `reloadKey` re-runs the load when it changes (e.g. after joining a room).
export function useStudentOverview(reloadKey = 0) {
  const [state, setState] = useState({ status: "loading", rooms: [], error: "", unauthorized: false });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const roomsRes = await api("/rooms");
        if (!roomsRes.ok) {
          if (!cancelled)
            setState({ status: "error", rooms: [], error: errorMessage(roomsRes.data, "Couldn't load your rooms."), unauthorized: roomsRes.status === 401 });
          return;
        }

        const rooms = await Promise.all(
          (roomsRes.data || []).map(async (room) => {
            const detail = await api(`/rooms/${room.id}`).catch(() => null);
            const campaigns = detail?.ok ? detail.data.campaigns || [] : null;
            const withStatus = campaigns
              ? await Promise.all(campaigns.map(async (c) => ({ ...c, ...(await fetchCampaignStatus(c.id)) })))
              : null;
            return { ...room, campaigns: withStatus };
          })
        );

        if (!cancelled) setState({ status: "ready", rooms, error: "", unauthorized: false });
      } catch {
        if (!cancelled) setState({ status: "error", rooms: [], error: "Couldn't reach the server. Check your connection.", unauthorized: false });
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return state;
}
