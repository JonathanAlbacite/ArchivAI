import { useState, useEffect } from "react";

// A room's members (its owner and its students, each with whether they are active
// right now), loaded when the page opens and refreshed every 30 seconds and whenever
// the window gets focus. Returns null until the first load.
function useRoomMembers(roomId) {
  const [members, setMembers] = useState(null);

  useEffect(() => {
    let stopped = false;

    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/rooms/${roomId}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!stopped) setMembers(data);
      } catch {
        // keep the last list if a refresh fails
      }
    };

    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [roomId]);

  return members;
}

export default useRoomMembers;
