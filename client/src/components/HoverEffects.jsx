import { useEffect } from "react";

// 3D tilt + glow that follows the mouse - mounted once in App.jsx.
//
// While the mouse is over a button (every page) or a card (student side only), this writes
// where the pointer is onto that element as CSS variables, and styles/fun.css does the rest:
//   --tilt-x / --tilt-y   how far to lean it (degrees), towards the pointer
//   --glow-x / --glow-y   where the soft light spot sits (percent)
// and marks it data-tilt="on". Leaving the element resets it so it springs back flat.
//
// Mouse and pen only (no tilt on touch screens), and no tilt when the device asks for reduced
// motion - the glow still shows on hover then.

const BUTTONS = ".btn";
const CARDS = ".quest-card, .card--hoverable";
// Biggest lean in degrees.
const MAX_TILT = { button: 8, card: 6 };

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const isStudent = () => document.documentElement.dataset.role === "STUDENT";

const findTarget = (node) => {
  if (!(node instanceof Element)) return null;
  const button = node.closest(BUTTONS);
  if (button) return button.disabled || button.getAttribute("aria-disabled") === "true" ? null : button;
  return isStudent() ? node.closest(CARDS) : null;
};

const reset = (el) => {
  delete el.dataset.tilt;
  for (const name of ["--tilt-x", "--tilt-y", "--glow-x", "--glow-y"]) el.style.removeProperty(name);
};

function HoverEffects() {
  useEffect(() => {
    let current = null;
    let frame = 0;
    let last = null;

    const apply = () => {
      frame = 0;
      if (!last) return;
      const { target, x, y } = last;
      if (target !== current) {
        if (current) reset(current);
        current = target;
      }
      if (!target) return;

      const r = target.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // -0.5 .. 0.5 across the element.
      const px = Math.min(1, Math.max(0, (x - r.left) / r.width)) - 0.5;
      const py = Math.min(1, Math.max(0, (y - r.top) / r.height)) - 0.5;
      const max = target.matches(BUTTONS) ? MAX_TILT.button : MAX_TILT.card;

      target.dataset.tilt = "on";
      target.style.setProperty("--glow-x", `${Math.round((px + 0.5) * 100)}%`);
      target.style.setProperty("--glow-y", `${Math.round((py + 0.5) * 100)}%`);
      if (!reducedMotion()) {
        target.style.setProperty("--tilt-x", `${(-py * max).toFixed(2)}deg`);
        target.style.setProperty("--tilt-y", `${(px * max).toFixed(2)}deg`);
      }
    };

    const onMove = (e) => {
      if (e.pointerType === "touch") return;
      last = { target: findTarget(e.target), x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onLeaveWindow = () => {
      if (current) reset(current);
      current = null;
      last = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeaveWindow);
    window.addEventListener("blur", onLeaveWindow);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeaveWindow);
      window.removeEventListener("blur", onLeaveWindow);
      if (current) reset(current);
    };
  }, []);

  return null;
}

export default HoverEffects;
