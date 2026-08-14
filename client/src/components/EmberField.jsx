import { useMemo } from "react";
import { colors } from "../theme";

// Deterministic pseudo-random in [0, 1) - keeps particle layout stable across
// re-renders without calling an impure source like Math.random/Date.now.
function seeded(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Atmospheric floating-particle backdrop. Render inside a positioned
// (relative/absolute/fixed) parent - it fills it and ignores pointer events.
function EmberField({ variant = "ember", count = 24 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const r1 = seeded(i * 3.1 + 1);
      const r2 = seeded(i * 5.7 + 2);
      const r3 = seeded(i * 7.3 + 3);
      const r4 = seeded(i * 9.1 + 4);
      const r5 = seeded(i * 11.3 + 5);

      return {
        id: i,
        left: r1 * 100,
        bottom: r2 * 15,
        size: variant === "ember" ? 2 + r3 * 3 : 2 + r3 * 2.5,
        delay: r4 * 8,
        duration: variant === "ember" ? 5 + r4 * 5 : 2.5 + r4 * 3,
        drift: `${Math.round(r5 * 60 - 30)}px`,
      };
    });
  }, [variant, count]);

  const color = variant === "ember" ? colors.emberBright : colors.softGold;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: color,
            boxShadow: `0 0 ${p.size * 3}px ${color}`,
            animation:
              variant === "ember"
                ? `emberRise ${p.duration}s ease-in ${p.delay}s infinite`
                : `sparkleTwinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
            "--drift": p.drift,
          }}
        />
      ))}
    </div>
  );
}

export default EmberField;
