# COMINORSA design tokens — current state

Source of truth is always `app/globals.css` `:root` — this file explains
*why* the values are what they are. If this doc and the CSS disagree, the
CSS is right; update this doc.

## Color

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#0b2318` | Primary text on light surfaces |
| `--ink-deep` | `#061410` | Darkest surface (footer, deepest gradient stop) |
| `--forest` | `#123322` | Dark surface (hero/header-cta background), WhatsApp brand color everywhere on this site — never the literal WhatsApp green `#25D366`/`#128C7E` |
| `--copper` | `#e0b84a` | Accent background (primary buttons), borders, icons — **not** small text |
| `--copper-light` | `#ebce7e` | Accent text on dark surfaces |
| `--copper-ink` | `#1d4a33` | Accent **text** on light surfaces. Despite the name this is a forest green, not gold — gold text on this site's light backgrounds (paper/cream/sand) fails contrast, so small accent text moved to green. Same value as `--muted`; kept as a separate token because it's a different *role* (accent vs. secondary body copy) that happens to resolve the same today. |
| `--sand` | `#ebd9a0` | Warm accent surface (contact section background) |
| `--cream` | `#efe8d4` | Sunken/textured light surface (method section, grid-pattern background) |
| `--paper` | `#f6f1e2` | Main light surface (body background) |
| `--white` | `#fbf8ef` | Elevated light surface + text-on-dark base color — not a pure `#fff` |
| `--line` | `rgba(23,51,45,0.18)` | Hairline dividers |
| `--muted` | `#1d4a33` | Secondary body text on light surfaces |

Never write `#25D366`, `#128C7E`, or any other literal WhatsApp-brand green —
the icon/label already communicates "WhatsApp"; the background uses this
site's own `--forest`.

## Measured contrast (this session, Node WCAG calculator — see
`../cominorsa-run/assets/contrast-check.mjs`)

| Pair | Ratio | Note |
|---|---|---|
| `--copper-ink` on `--paper` | 8.94:1 | |
| `--copper-ink` on `--cream` | 8.25:1 | |
| `--ink` (button text) on `--copper` (button bg) | ~8.77:1 | `.button-primary` |
| hero-intro text (white 72% opacity) on hero gradient | 9.68:1 | approximate — gradient varies by position, measured near the left/upper stop |
| specialties strip text (white 68% opacity, after fix) on hero gradient | 6.12:1 | was 0.56 opacity / 4.67:1 before — too close to the 4.5 floor for 11px text |

Gradient-background contrast is inherently approximate — when in doubt,
measure against the darkest stop the text can sit over, not the lightest.

## Spacing scale

`--space-1` through `--space-12`: 4, 8, 12, 20, 32, 48, 64, 80, 96, 128, 176,
240px. Non-linear on purpose — it forces a choice instead of letting every
component invent its own number. `--section-y: clamp(96px, 10vw, 176px)` is
the shared vertical rhythm between sections.

## Type scale

`--text-2xs` (11–12px) through `--text-3xl` (34–46px), then `--display-2`
(44–88px) and `--display-1` (52–128px) for the hero/section titles. All
fluid via `clamp()`. Tracking gets tighter as size increases (down to
`-0.065em` on the hero h1) — never loosen a display heading's
letter-spacing without checking the others stay consistent.

## Fonts

Loaded via `next/font/google` in `app/layout.tsx`:

- **Archivo** (`--font-display`) — body + all headings, weights 400–800.
- **Newsreader** italic (`--font-editorial`) — the one editorial accent
  (`<em>` in the hero h1 and contact/consultation h2s). Deliberately used
  sparingly — one accent per page, not a general body font.
- **Geist Mono** (`--font-mono`) — folio numbers (`.section-kicker span`,
  `.step > span`) and the footer RUC. Never for general labels.

Don't add a fourth family or reuse Newsreader outside the `<em>` accent
role without checking with the user first — it was an explicit, approved
design decision (see chat history), not a default to extend freely.

## Grid / container

- `--container-margin: clamp(20px, 6vw, 120px)`, `--container-max: 1440px`
  — shared by `.site-header`, `.hero-grid`, `.hero-footer`, `.section`,
  `.contact`, `footer`. Don't hand-roll a different margin formula for a
  new section; reuse `.container` or the same `max(var(--container-margin),
  calc((100vw - var(--container-max)) / 2))` pattern.
- `--grid-cols: 12`, `--grid-gutter: clamp(16px, 1.6vw, 28px)`, and a
  `.grid-12` utility class exist but most sections still use their own
  asymmetric `fr` splits (kept intentionally — a literal `repeat(12,1fr)`
  migration of every section was scoped out as needing more visual QA than
  was safe to do blind; see chat history if picking this back up).

## Motion

`--dur-fast/base/slow/reveal` (120/220/480/900ms), `--ease-out`,
`--ease-in-out`. A single `@media (prefers-reduced-motion: reduce)` block
in `:root` collapses all four duration tokens to `1ms` — any new animation
that reads these tokens is covered automatically. Don't add a
component-local reduced-motion branch; use the tokens.
