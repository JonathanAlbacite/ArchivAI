import { useEffect } from "react";

// A little burst of particles wherever a button, link or other control is clicked - mounted once
// in App.jsx and works on every page.
//
// Students (html[data-role="STUDENT"], set by AppShell) get a big colourful burst of stars,
// circles and confetti; everyone else (teachers, admins, the login page) gets a small, subtle
// sparkle in the page's accent colour. Nothing is shown when the device asks for reduced motion,
// on disabled controls, or inside anything marked data-no-fx.
//
// The particles are plain DOM elements on <body> animated by CSS (.click-fx in
// styles/components.css), so they keep playing when a click changes the page.

const TARGETS = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], summary, input[type="checkbox"], input[type="radio"], select';

const KID_COLORS = ["#FF5D8F", "#FFB703", "#3BCEAC", "#4CC9F0", "#8E6CEF", "#FB8500", "#06D6A0"];
const SHAPES = ["star", "circle", "square", "star", "heart"];

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const isDisabled = (el) => el.disabled || el.getAttribute("aria-disabled") === "true" || !!el.closest("[data-no-fx], fieldset:disabled");
const isKid = () => document.documentElement.dataset.role === "STUDENT";

const MAX_BURSTS = 6;
let liveBursts = 0;

function burst(x, y) {
  if (liveBursts >= MAX_BURSTS) return;
  liveBursts += 1;

  const kid = isKid();
  const count = kid ? 14 : 7;
  const root = document.createElement("div");
  root.className = kid ? "click-fx click-fx--kid" : "click-fx";
  root.setAttribute("aria-hidden", "true");
  root.style.left = `${x}px`;
  root.style.top = `${y}px`;

  const ring = document.createElement("span");
  ring.className = "click-fx__ring";
  root.appendChild(ring);

  for (let i = 0; i < count; i += 1) {
    const p = document.createElement("span");
    p.className = "click-fx__p";
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const dist = (kid ? 46 : 22) + Math.random() * (kid ? 44 : 16);
    p.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--dy", `${Math.sin(angle) * dist + (kid ? 18 : 0)}px`);
    p.style.setProperty("--rot", `${Math.round(Math.random() * 540 - 270)}deg`);
    p.style.setProperty("--size", `${kid ? 7 + Math.random() * 7 : 4 + Math.random() * 3}px`);
    if (kid) {
      p.dataset.shape = SHAPES[i % SHAPES.length];
      p.style.setProperty("--c", KID_COLORS[(i + Math.floor(Math.random() * KID_COLORS.length)) % KID_COLORS.length]);
    }
    root.appendChild(p);
  }

  document.body.appendChild(root);
  setTimeout(() => {
    root.remove();
    liveBursts -= 1;
  }, kid ? 900 : 650);
}

function ClickEffects() {
  useEffect(() => {
    const onClick = (e) => {
      if (reducedMotion()) return;
      const el = e.target instanceof Element ? e.target.closest(TARGETS) : null;
      if (!el || isDisabled(el)) return;
      // A keyboard "click" (Enter/Space) has no pointer position - burst from the control's middle.
      if (e.detail === 0 || (e.clientX === 0 && e.clientY === 0)) {
        const r = el.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2);
      } else {
        burst(e.clientX, e.clientY);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

export default ClickEffects;
