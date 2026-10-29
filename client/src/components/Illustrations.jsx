// Small flat illustrations drawn inline so they follow the theme (every fill
// is a CSS variable). All are decorative: aria-hidden, no text content.
// Scene art reads --scene / --scene-soft from its container (see scenes.js).

const s = (v) => ({ fill: v });

export function SceneArt({ scene, className }) {
  const common = { viewBox: "0 0 240 140", className, "aria-hidden": true, focusable: "false", preserveAspectRatio: "xMidYMid slice" };
  if (scene === "laboratory") {
    return (
      <svg {...common}>
        <rect width="240" height="140" style={s("var(--scene-soft)")} />
        <circle cx="196" cy="30" r="40" style={s("var(--color-surface)")} opacity="0.55" />
        <rect x="18" y="104" width="204" height="10" rx="5" style={s("var(--scene)")} opacity="0.35" />
        <path d="M78 40h22v26l22 34a8 8 0 0 1-7 12H63a8 8 0 0 1-7-12l22-34z" style={s("var(--color-surface)")} />
        <path d="M66 88h46l9 14a5 5 0 0 1-4 8H61a5 5 0 0 1-4-8z" style={s("var(--scene)")} opacity="0.75" />
        <rect x="74" y="34" width="30" height="8" rx="3" style={s("var(--scene)")} />
        <circle cx="86" cy="24" r="5" style={s("var(--scene)")} opacity="0.5" />
        <circle cx="98" cy="12" r="3.5" style={s("var(--scene)")} opacity="0.35" />
        <rect x="140" y="58" width="18" height="46" rx="9" style={s("var(--color-surface)")} />
        <rect x="140" y="78" width="18" height="26" rx="9" style={s("var(--color-gold)")} opacity="0.8" />
        <rect x="168" y="70" width="14" height="34" rx="7" style={s("var(--color-surface)")} />
        <rect x="168" y="86" width="14" height="18" rx="7" style={s("var(--color-secondary)")} opacity="0.7" />
        <path d="M196 54l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" style={s("var(--color-gold)")} />
      </svg>
    );
  }
  if (scene === "library") {
    return (
      <svg {...common}>
        <rect width="240" height="140" style={s("var(--scene-soft)")} />
        <rect x="30" y="20" width="180" height="100" rx="10" style={s("var(--scene)")} opacity="0.25" />
        <rect x="40" y="62" width="160" height="6" rx="3" style={s("var(--scene)")} opacity="0.55" />
        <rect x="40" y="108" width="160" height="6" rx="3" style={s("var(--scene)")} opacity="0.55" />
        {[48, 62, 74, 90, 102, 118].map((x, i) => (
          <rect key={x} x={x} y={i % 2 ? 30 : 36} width={i % 3 === 0 ? 12 : 10} height={i % 2 ? 32 : 26} rx="2" style={s(i % 3 === 0 ? "var(--color-primary)" : i % 3 === 1 ? "var(--color-surface)" : "var(--color-secondary)")} opacity="0.9" />
        ))}
        <rect x="136" y="44" width="40" height="10" rx="2" style={s("var(--color-surface)")} transform="rotate(-18 156 49)" />
        {[50, 66, 80, 96, 150, 164, 178].map((x, i) => (
          <rect key={x} x={x} y={i % 2 ? 76 : 80} width="11" height={i % 2 ? 32 : 28} rx="2" style={s(i % 2 ? "var(--scene)" : "var(--color-surface)")} opacity="0.85" />
        ))}
        <path d="M120 80c6-10 18-10 24 0v28h-24z" style={s("var(--color-gold)")} opacity="0.8" />
        <circle cx="212" cy="26" r="4" style={s("var(--color-gold)")} />
        <circle cx="24" cy="112" r="3" style={s("var(--color-gold)")} opacity="0.7" />
      </svg>
    );
  }
  if (scene === "tomb") {
    return (
      <svg {...common}>
        <rect width="240" height="140" style={s("var(--scene-soft)")} />
        <path d="M0 118h240v22H0z" style={s("var(--scene)")} opacity="0.3" />
        <path d="M76 118V64a44 44 0 0 1 88 0v54z" style={s("var(--scene)")} opacity="0.35" />
        <path d="M92 118V68a28 28 0 0 1 56 0v50z" style={s("var(--color-surface)")} opacity="0.9" />
        <path d="M120 74l12 14-12 16-12-16z" style={s("var(--scene)")} />
        <path d="M120 74l12 14h-24z" style={s("var(--color-surface)")} opacity="0.35" />
        <rect x="40" y="88" width="16" height="30" rx="3" style={s("var(--scene)")} opacity="0.55" />
        <rect x="184" y="88" width="16" height="30" rx="3" style={s("var(--scene)")} opacity="0.55" />
        <path d="M48 76c4 4 4 8 0 12-4-4-4-8 0-12z" style={s("var(--color-gold)")} />
        <path d="M192 76c4 4 4 8 0 12-4-4-4-8 0-12z" style={s("var(--color-gold)")} />
        <circle cx="30" cy="30" r="3" style={s("var(--color-gold)")} opacity="0.8" />
        <circle cx="210" cy="22" r="4" style={s("var(--color-gold)")} opacity="0.8" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect width="240" height="140" style={s("var(--color-surface-muted)")} />
      <circle cx="120" cy="70" r="26" style={s("var(--color-border)")} />
    </svg>
  );
}

// Open storybook with a key and stars - used on sign-in.
export function StorybookArt({ className }) {
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true" focusable="false">
      <circle cx="200" cy="160" r="140" style={s("var(--color-primary-soft)")} />
      <circle cx="318" cy="70" r="30" style={s("var(--color-gold-soft)")} />
      <path d="M300 60l5 12 13 2-10 9 3 13-11-7-11 7 3-13-10-9 13-2z" style={s("var(--color-gold)")} />
      <path d="M84 96l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" style={s("var(--color-secondary)")} />
      <path d="M330 196l2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z" style={s("var(--color-teacher)")} opacity="0.8" />
      <ellipse cx="200" cy="262" rx="130" ry="14" style={s("var(--color-text)")} opacity="0.08" />
      <path d="M70 120c40-14 90-12 130 10v128c-40-22-90-24-130-10z" style={s("var(--color-surface)")} />
      <path d="M330 120c-40-14-90-12-130 10v128c40-22 90-24 130-10z" style={s("var(--color-surface)")} />
      <path d="M70 120c40-14 90-12 130 10v128c-40-22-90-24-130-10z" fill="none" style={{ stroke: "var(--color-border-strong)" }} strokeWidth="3" />
      <path d="M330 120c-40-14-90-12-130 10v128c40-22 90-24 130-10z" fill="none" style={{ stroke: "var(--color-border-strong)" }} strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={`l${i}`} x="92" y={150 + i * 20} width={i === 3 ? 50 : 84} height="6" rx="3" style={s("var(--color-border)")} />
      ))}
      <rect x="222" y="148" width="86" height="52" rx="8" style={s("var(--color-laboratory-soft)")} />
      <path d="M236 192l18-22 14 14 10-8 18 16z" style={s("var(--color-laboratory)")} opacity="0.6" />
      <rect x="222" y="212" width="70" height="6" rx="3" style={s("var(--color-border)")} />
      <g transform="rotate(-24 200 92)">
        <circle cx="168" cy="92" r="18" fill="none" style={{ stroke: "var(--color-gold)" }} strokeWidth="9" />
        <rect x="184" y="88" width="66" height="9" rx="4" style={s("var(--color-gold)")} />
        <rect x="232" y="96" width="8" height="14" rx="2" style={s("var(--color-gold)")} />
        <rect x="216" y="96" width="8" height="10" rx="2" style={s("var(--color-gold)")} />
      </g>
    </svg>
  );
}

// A little stack of books with a sparkle - generic empty state.
export function BooksArt({ className }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="90" rx="44" ry="6" style={s("var(--color-text)")} opacity="0.08" />
      <rect x="22" y="70" width="76" height="16" rx="4" style={s("var(--color-primary)")} opacity="0.85" />
      <rect x="28" y="54" width="64" height="16" rx="4" style={s("var(--color-secondary)")} opacity="0.85" />
      <rect x="20" y="38" width="70" height="16" rx="4" style={s("var(--color-teacher)")} opacity="0.85" />
      <rect x="30" y="74" width="40" height="3" rx="1.5" style={s("var(--color-surface)")} opacity="0.7" />
      <rect x="36" y="58" width="30" height="3" rx="1.5" style={s("var(--color-surface)")} opacity="0.7" />
      <rect x="28" y="42" width="36" height="3" rx="1.5" style={s("var(--color-surface)")} opacity="0.7" />
      <path d="M96 14l3 8 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" style={s("var(--color-gold)")} />
      <circle cx="80" cy="24" r="2.5" style={s("var(--color-gold)")} opacity="0.7" />
    </svg>
  );
}

// A treasure chest with stars - results reward header.
export function ChestArt({ className }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="80" cy="108" rx="56" ry="7" style={s("var(--color-text)")} opacity="0.08" />
      <path d="M34 58h92v42a6 6 0 0 1-6 6H40a6 6 0 0 1-6-6z" style={s("var(--color-teacher)")} />
      <path d="M34 58a46 26 0 0 1 92 0z" style={s("var(--color-teacher)")} opacity="0.75" />
      <rect x="34" y="56" width="92" height="10" style={s("var(--color-gold)")} />
      <rect x="72" y="60" width="16" height="20" rx="3" style={s("var(--color-gold)")} />
      <circle cx="80" cy="70" r="3" style={s("var(--color-teacher)")} />
      <path d="M80 8l5 11 12 2-9 8 2 12-10-6-10 6 2-12-9-8 12-2z" style={s("var(--color-gold)")} />
      <path d="M128 22l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" style={s("var(--color-secondary)")} />
      <path d="M30 26l2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z" style={s("var(--color-primary)")} />
    </svg>
  );
}
