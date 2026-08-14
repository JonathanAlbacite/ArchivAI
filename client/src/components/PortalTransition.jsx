import { useEffect } from "react";
import { colors, fonts } from "../theme";
import EmberField from "./EmberField";

const RING_COUNT = 3;

// Full-screen vortex overlay shown while "pulling" a student into a campaign.
// Calls onComplete once the animation has played out.
function PortalTransition({ onComplete, label = "The vault opens..." }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: colors.obsidianDeep,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        overflow: "hidden",
      }}
    >
      <EmberField variant="sparkle" count={40} />

      <div style={{ position: "relative", width: "280px", height: "280px" }}>
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: `${i * 32}px`,
              borderRadius: "50%",
              border: `2px solid ${i % 2 === 0 ? colors.magicVioletBright : colors.softGold}`,
              borderTopColor: "transparent",
              borderBottomColor: "transparent",
              boxShadow: `0 0 30px ${colors.magicVioletBright}55`,
              animation: `portalSpin ${2 + i}s linear infinite ${i % 2 === 0 ? "normal" : "reverse"}`,
            }}
          />
        ))}

        <div
          style={{
            position: "absolute",
            inset: "96px",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colors.softGold} 0%, ${colors.magicVioletBright} 55%, transparent 75%)`,
            filter: "blur(2px)",
            animation: "portalPulse 1.6s ease-in-out infinite",
          }}
        />
      </div>

      <p
        style={{
          marginTop: "32px",
          fontFamily: fonts.displayDecorative,
          fontSize: "26px",
          color: colors.softGold,
          textShadow: `0 0 20px ${colors.magicVioletBright}`,
          animation: "fadeInUp 0.6s ease-out",
          textAlign: "center",
        }}
      >
        {label}
      </p>
      <p
        style={{
          marginTop: "8px",
          fontFamily: fonts.body,
          fontSize: "13px",
          color: colors.brassBright,
          opacity: 0.85,
          animation: "fadeInUp 0.8s ease-out",
        }}
      >
        You are being drawn into the vault...
      </p>
    </div>
  );
}

export default PortalTransition;
