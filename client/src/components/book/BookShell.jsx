import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { colors, fonts } from "../../theme";

function navBtnStyle(enabled) {
  return {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 12px",
    borderRadius: "10px",
    border: `1px solid ${colors.parchmentLine}`,
    backgroundColor: enabled ? colors.parchmentPanel : "transparent",
    color: enabled ? colors.ink : colors.inkMuted,
    fontFamily: fonts.body,
    fontSize: "12px",
    fontWeight: "600",
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.4,
  };
}

// Shared open-book chrome: two parchment pages either side of a spine,
// with a rotateY page-turn transition on the right page driven by state
// (not a keyframe, since it's tied to a discrete Prev/Next interaction).
function BookShell({ leftPage, rightPage, pageIndex = 0, pageCount = 1, onPrev, onNext, onClose, footer }) {
  const [turning, setTurning] = useState(null);

  const flip = (direction, action) => {
    if (turning) return;
    setTurning(direction);
    setTimeout(() => {
      action();
      setTurning(null);
    }, 260);
  };

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(8,5,3,0.72)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "min(920px, 96vw)",
          maxHeight: "88vh",
          display: "flex",
          borderRadius: "18px",
          background: `linear-gradient(160deg, ${colors.vaultBorder}, ${colors.obsidian})`,
          padding: "16px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: "bookOpen 0.45s ease-out",
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "-14px",
            right: "-14px",
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: `2px solid ${colors.ember}`,
            backgroundColor: colors.obsidian,
            color: colors.emberBright,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          <X size={16} />
        </button>

        {/* Left page */}
        <div
          style={{
            flex: 1,
            backgroundColor: colors.parchment,
            borderRadius: "12px 4px 4px 12px",
            padding: "28px",
            overflowY: "auto",
            boxShadow: "inset -8px 0 20px -12px rgba(0,0,0,0.35)",
          }}
        >
          {leftPage}
        </div>

        {/* Spine */}
        <div
          style={{
            width: "18px",
            flexShrink: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.05) 70%, rgba(0,0,0,0.35))",
          }}
        />

        {/* Right page */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: "4px 12px 12px 4px",
            overflow: "hidden",
            boxShadow: "inset 8px 0 20px -12px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              flex: 1,
              backgroundColor: colors.parchment,
              padding: "28px",
              overflowY: "auto",
              transform: turning ? "rotateY(-90deg)" : "rotateY(0deg)",
              opacity: turning ? 0 : 1,
              transition: "transform 0.26s ease-in, opacity 0.26s ease-in",
              transformOrigin: "left center",
            }}
          >
            {rightPage}
          </div>

          <div
            style={{
              backgroundColor: colors.parchmentDark,
              borderTop: `1px solid ${colors.parchmentLine}`,
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <button type="button" onClick={() => canPrev && flip("prev", onPrev)} disabled={!canPrev} style={navBtnStyle(canPrev)}>
              <ChevronLeft size={16} /> Prev
            </button>
            <span style={{ fontFamily: fonts.flourish, fontSize: "12px", color: colors.inkMuted }}>
              Page {pageIndex + 1} of {pageCount}
            </span>
            <button type="button" onClick={() => canNext && flip("next", onNext)} disabled={!canNext} style={navBtnStyle(canNext)}>
              Next <ChevronRight size={16} />
            </button>
          </div>

          {footer}
        </div>
      </div>
    </div>
  );
}

export default BookShell;
