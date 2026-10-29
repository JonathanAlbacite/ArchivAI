# The Curious Archive: design system

The UI design system for The Archivist's Legacy: a bright, cozy-fantasy look built on a practical classroom dashboard.

## Tokens

**`src/theme.js` is the single source of truth.** At startup, `applyThemeVars(mode)` writes every token onto `<html>` as a CSS custom property, and `ThemeProvider` re-runs it whenever the mode changes.

| Token group | CSS variable | Example |
|---|---|---|
| `colors.light` / `colors.dark` | `--color-<kebab-key>` | `--color-primary`, `--color-text-on-primary`, `--color-laboratory-soft` |
| `fonts` | `--font-display`, `--font-body`, `--font-mono` | Fredoka (headings, levels, rewards); Inter (everything else) |
| `typeScale` | `--text-xs` … `--text-4xl` | |
| `spacing` | `--space-1` … `--space-16` | 4px grid |
| `radius` | `--radius-sm` … `--radius-pill` | |
| `shadows` | `--shadow-sm/md/lg/pop` | Dark mode uses its own, stronger set |
| `motion` | `--motion-fast/normal/slow/ease/bounce` | |

Inline styles should read tokens through `cssVar("primary")` or `"var(--color-primary)"`. Never hard-code hex values.

**Role accents.** `AppShell` sets `data-role` on `<html>`, which defines `--accent` / `--accent-soft`:
- Student: purple
- Teacher, and admins in Teacher Mode: orange
- Admin: blue

**Scenes.** `sceneStyle(scene)` (in `scenes.js`) exposes `--scene` / `--scene-soft`:
- Laboratory: green
- Library: gold
- Tomb: plum

### Contrast changes from the original brief

All text/background pairs are checked by `npm run check:contrast` (98 pairs across both modes; all pass WCAG AA). These values were adjusted to pass:

| Token | Brief | Now | Why |
|---|---|---|---|
| light `textSubtle` | #68758C | #5F6C83 | was 4.3:1 on `surfaceMuted` |
| light `borderStrong` | #AEBBD1 | #7D89A1 | input borders need 3:1 |
| light `teacher` | #B85E16 | #A9550F | white button text was 4.4:1 |
| light `library` | #8B6500 | #7D5A00 | was 4.4:1 on `librarySoft` |
| light `warning` | #945400 | #8A4E00 | was 4.4:1 on `warningSoft` |
| dark `textOnPrimary` | #FFFFFF | #141927 | dark accents are pastel; white on them was ~2:1 |

New tokens: `goldSoft`, `silverSoft`, `bronzeSoft`, `slate`, `slateSoft` (rank medals).

## Theme mode

Light is the default. The sun/moon button in the top bar (and on the sign-in pages) toggles dark mode. The choice is saved in `localStorage` (`archivai_theme`), per browser only.

## Components (`src/components/ui`)

| Component | Notes |
|---|---|
| `Button`, `IconButton` | Variants: primary, accent, secondary, soft, ghost, danger, danger-ghost. Sizes sm/md/lg. `loading` disables the button and shows a spinner. Pass `to` to render a router link. `IconButton` requires `label`. |
| `Card` | `hoverable`, `selected`, `disabled`, `muted`, `flush` |
| `Badge`, `StatusChip` | Tone + text. `StatusChip` has a fixed vocabulary: published, draft, completed, inProgress, notStarted. |
| `Avatar`, `OnlineIndicator` | Presence comes from `useRoomMembers` (real heartbeat data) only. |
| `TextField`, `TextAreaField`, `SelectField`, `PasswordField`, `Checkbox`, `HelpTip`, `Field` | Label, hint, error, required/optional. Hints and errors are wired with `aria-describedby` / `aria-invalid`. |
| `Modal`, `ConfirmDialog` | Portaled; Escape closes; focus trap and restore; scroll lock; stacked z-index. `busy` blocks closing. |
| `ToastProvider` + `useToast()` | success / info / warning (auto-dismiss) and error (stays until dismissed). Hover pauses the timer. Live region. |
| `Tabs` | WAI-ARIA tabs with arrow/Home/End keys |
| `XPBar`, `RankMedal`, `Confetti` | Confetti is hidden under `prefers-reduced-motion`. |
| `EmptyState`, `LoadingState`, `Spinner`, `Skeleton`, `SkeletonCards`, `Alert` | |
| `Breadcrumbs`, `PageHeader`, `Menu`, `Stat`, `Segmented` | `Menu` is an accessible menu button (arrow keys, Escape). |

Layout lives in `components/layout/AppShell.jsx`:
- **Desktop:** sticky sidebar plus top bar.
- **Mobile:** top bar plus a focus-trapped drawer.

The shell also guards routes by role. Navigation is configured per role in `navConfig.js`.

## Styles

Styles live in `src/styles/`:
- `base.css`: reset, typography, helpers, motion, reduced motion
- `components.css`
- `layout.css`
- `pages.css`

Breakpoints are mobile-first at 640 / 768 / 1024 / 1280px. Pages use a 16px side gutter on phones and 24–40px on wider screens. Data tables collapse into labelled cards below 768px.
