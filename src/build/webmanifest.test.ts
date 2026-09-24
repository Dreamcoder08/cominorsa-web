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
  // P9 (audit P2-13): background_color/theme_color were #f4eed9/#001713,
  // neither of which the site renders; both now equal --paper, the
  // colour the header and body actually paint.
  test("matches the expected manifest byte-for-byte", () => {
    expect(buildWebManifest()).toBe(
      [
        "{",
        '  "name": "COMINORSA | Consultoría minera y ambiental",',
        '  "short_name": "COMINORSA",',
        '  "description": "Consultoría minera y soluciones ambientales desde Piura, Perú.",',
        '  "start_url": "/",',
        '  "display": "standalone",',
        '  "background_color": "#f6f1e2",',
        '  "theme_color": "#f6f1e2",',
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

test("theme_color and background_color equal the --paper token", async () => {
  const css = await Bun.file("app/globals.css").text();
  const paper = css.match(/--paper:\s*(#[0-9a-f]{6});/i)![1];
  const manifest = JSON.parse(buildWebManifest());
  expect(manifest.theme_color).toBe(paper);
  expect(manifest.background_color).toBe(paper);
});
