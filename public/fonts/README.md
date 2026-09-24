# Self-hosted fonts (T5)

These three `.woff2` files are the exact "latin" Google Fonts subset that
`next/font/google` already downloads for this project (see
`app/layout.tsx`), extracted from a local `pnpm build` run
(`.vinext/fonts/*/*.woff2`) so the static build (`bun run build:static`,
`src/build/fonts.css`) can self-host them with hand-written `@font-face`
rules instead of depending on `next/font`. No network fetch was needed —
next/font had already fetched these bytes at build time.

Only the "latin" subset is kept (not "latin-ext", "vietnamese",
"cyrillic", "cyrillic-ext", or "symbols2"): every character this
Spanish-language site actually uses (á é í ó ú ñ ü ¿ ¡, arrows, currency
signs) falls inside that subset's Unicode range, confirmed against
next/font's own generated `unicode-range` declarations. Archivo and
Newsreader are variable fonts — next/font emits one `@font-face` per
requested static weight, but every weight for a given subset points at
the *identical* file, so one `font-weight: <min> <max>` range per
family/style (see `src/build/fonts.css`) covers the same weights with a
single file, same as today.

| File | Family | Style | Weight(s) used on this site | Source |
|---|---|---|---|---|
| `archivo-latin-variable.woff2` | Archivo | normal | 400–800 | fonts.google.com/specimen/Archivo |
| `newsreader-italic-latin-variable.woff2` | Newsreader | italic | 400–500 | fonts.google.com/specimen/Newsreader |
| `geist-mono-latin.woff2` | Geist Mono | normal | 400 | github.com/vercel/geist-font |

## License

All three families are licensed under the **SIL Open Font License,
Version 1.1** (OFL-1.1) — free to embed, redistribute, and self-host,
including commercially, with no attribution requirement beyond keeping
the license notice with the font files themselves:
<https://openfontlicense.org/>.
