---
name: cominorsa-design-tokens
description: "Trigger: editing app/globals.css, adding a color, spacing, font-size, radius, or CSS on cominorsa-web. Enforce the token system — no magic values, no off-palette colors, no new border-radius."
license: Apache-2.0
metadata:
  author: "dreamcoder08"
  version: "1.0"
---

## Activation Contract

Use before writing or editing any CSS in `app/globals.css`, or any inline style/className touching color, spacing, or typography in `app/*.tsx`.

## Hard Rules

- Every color is one of the tokens in `app/globals.css` `:root`. Never introduce a new hex/rgb color — if the palette is missing something, that's a token gap to raise, not a one-off value to write.
- `border-radius: 0` everywhere except `.hero::after` (a decorative radial glow, explicitly exempted and commented as such). Don't add rounded corners, pills, or circular buttons without asking first — this was a deliberate, non-negotiable call, not an oversight.
- `--copper`/`--copper-light` (gold) are borders, icons, and large accent text only — never small body text on a light surface. Small accent text on light backgrounds uses `--copper-ink` (which is a forest green, not a gold, despite the name — see the comment on that token).
- Don't invent new spacing/font-size values — use `--space-1..12` / `--text-2xs..--display-1` (see `references/design-tokens.md` for the full scale) or a `clamp()` consistent with the existing fluid-type pattern.
- Any new color pair (text on background) must be checked with `../cominorsa-run/assets/contrast-check.mjs` before shipping — don't eyeball it.

## Execution Steps

1. Read `references/design-tokens.md` for the current palette, scale, and approved contrast pairs.
2. Reuse an existing token/pair. If genuinely none fits, add a new token to `:root` (not a hardcoded value in a selector) and document why in a comment, following the existing style of comments on `--copper-ink`/`--muted`.
3. Verify contrast for any new text/background combination before committing.

## References

- `references/design-tokens.md` — current palette hex values, spacing/type scale, font stack, and the approved-vs-rejected contrast pairs this system is built on.
