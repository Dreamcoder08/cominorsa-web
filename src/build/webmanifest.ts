// src/build/webmanifest.ts
//
// T8: builds `manifest.webmanifest` at build time. Byte-for-byte
// equivalent to the live production output (verified 2026-09-22: `curl
// -s https://cominorsa.com/manifest.webmanifest`), replacing
// `app/manifest.ts`'s per-request `MetadataRoute.Manifest` generation
// with a static file. `document.tsx` already links
// `<link rel="manifest" href="/manifest.webmanifest">` on every page
// (T4) — this is the file that link resolves to.
const WEB_MANIFEST = {
  name: "COMINORSA | Consultoría minera y ambiental",
  short_name: "COMINORSA",
  description: "Consultoría minera y soluciones ambientales desde Piura, Perú.",
  start_url: "/",
  display: "standalone",
  background_color: "#f4eed9",
  theme_color: "#001713",
  lang: "es-PE",
  icons: [
    {
      src: "/favicon-32x32.png",
      sizes: "32x32",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
      purpose: "any",
    },
  ],
};

// No trailing newline: matches production's own JSON.stringify(obj,
// null, 2) output exactly (verified byte-for-byte against the live
// response, which ends in "}" with no final "\n").
export function buildWebManifest(): string {
  return JSON.stringify(WEB_MANIFEST, null, 2);
}
