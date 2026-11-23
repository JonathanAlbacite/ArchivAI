import { useEffect, useState } from "react";

const POINTS = 10;
const FILL_MS = 1600;

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// The progress slider of a run in progress: a rail with 10 circles, one for every 10% (10, 20 ... 100).
// `percent` is 0-100, or null when the game's checkpoint total is not known yet (the rail then stays empty).
// When the page opens (for example after coming back from the game) the rail starts empty, then fills up
// to the percent while the circles light up one by one as the fill passes them, and the number counts up.
// With reduced motion it shows the final state at once. Styles: .cp-track* in pages.css.
function CheckpointTrack({ percent }) {
  const known = percent !== null && percent !== undefined;
  const target = known ? percent : 0;
  const [shown, setShown] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!known) {
      setShown(false);
      setCount(0);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setShown(true);
      setCount(target);
      return undefined;
    }
    setShown(false);
    setCount(0);
    let frame = 0;
    const start = setTimeout(() => {
      setShown(true);
      const begin = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - begin) / FILL_MS);
        setCount(Math.round(target * t));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, 350);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(frame);
    };
  }, [known, target]);

  const litCount = shown ? Math.floor(target / 10) : 0;

  return (
    <div
      className="cp-track"
      data-known={known || undefined}
      data-shown={shown || undefined}
      role={known ? "progressbar" : undefined}
      aria-label={known ? "Checkpoints reached" : undefined}
      aria-valuemin={known ? 0 : undefined}
      aria-valuemax={known ? 100 : undefined}
      aria-valuenow={known ? target : undefined}
      aria-hidden={known ? undefined : "true"}
    >
      {known && (
        <p className="cp-track__percent" aria-hidden="true">
          {count}
          <span>%</span>
        </p>
      )}
      <div className="cp-track__rail">
        <div className="cp-track__fill" style={{ width: shown ? `${target}%` : "0%", transitionDuration: `${FILL_MS}ms` }} />
        {Array.from({ length: POINTS }, (_, i) => {
          const point = (i + 1) * 10;
          const lit = shown && point <= target;
          // Each circle lights when the fill reaches it.
          const delay = target > 0 ? Math.round((point / target) * FILL_MS) : 0;
          return (
            <span
              key={point}
              className="cp-track__dot"
              style={{ left: `${point}%`, "--cp-delay": `${delay}ms` }}
              data-lit={lit || undefined}
              data-current={lit && i + 1 === litCount ? "" : undefined}
            />
          );
        })}
      </div>
      <div className="cp-track__scale" aria-hidden="true">
        <span>Start</span>
        <span>50%</span>
        <span>Finish</span>
      </div>
    </div>
  );
}

export default CheckpointTrack;
