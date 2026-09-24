// src/build/webmanifest.test.ts
//
// T8: `buildWebManifest` matches the live production
// manifest.webmanifest byte-for-byte (verified 2026-09-22: `curl -s
// https://cominorsa.com/manifest.webmanifest`) — 2-space-indented JSON,
// no trailing newline. Replaces `app/manifest.ts`'s per-request
// `MetadataRoute.Manifest` generation with a static file.

import { describe, expect, test } from "bun:test";
import { buildWebManifest } from "./webmanifest";

describe("buildWebManifest", () => {
  test("matches the live production manifest byte-for-byte", () => {
    expect(buildWebManifest()).toBe(
      [
        "{",
        '  "name": "COMINORSA | Consultoría minera y ambiental",',
        '  "short_name": "COMINORSA",',
        '  "description": "Consultoría minera y soluciones ambientales desde Piura, Perú.",',
        '  "start_url": "/",',
        '  "display": "standalone",',
        '  "background_color": "#f4eed9",',
        '  "theme_color": "#001713",',
        '  "lang": "es-PE",',
        '  "icons": [',
        "    {",
        '      "src": "/favicon-32x32.png",',
        '      "sizes": "32x32",',
        '      "type": "image/png",',
        '      "purpose": "any"',
        "    },",
        "    {",
        '      "src": "/apple-touch-icon.png",',
        '      "sizes": "180x180",',
        '      "type": "image/png",',
        '      "purpose": "any"',
        "    }",
        "  ]",
        "}",
      ].join("\n"),
    );
  });

  test("has no trailing newline (matches production exactly)", () => {
    expect(buildWebManifest().endsWith("\n")).toBe(false);
  });
});
