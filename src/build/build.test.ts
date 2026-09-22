// src/build/build.test.ts
//
// End-to-end coverage for the static build pipeline: renders
// `seguridad-minera.html` with the T2 runtime, links a content-hashed
// CSS file built from `app/globals.css`, and copies `public/` assets
// alongside it. Output goes to a throwaway temp dir so this test never
// touches the real `dist-static/`.
//
// `seguridad-minera.html` (a FILE, not `seguridad-minera/index.html`)
// is deliberate: Cloudflare Workers Static Assets' default
// `html_handling: "auto-trailing-slash"` serves a file like
// `foo.html` directly at `/foo` (200, zero redirects), but a folder
// index like `foo/index.html` only at `/foo/`, 307-redirecting the
// no-slash form (verified against Cloudflare's own docs,
// developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling).
// Production's real URL shape has no trailing slash (confirmed against
// the live site's own canonical tag), so the output must be a flat
// `<slug>.html` file to get that shape with zero redirects.

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { runStaticBuild } from "./build";

async function withTempOutDir<T>(fn: (outDir: string) => Promise<T>): Promise<T> {
  // Under the repo, not /tmp: the CSS entry (`app/globals.css`) imports
  // the bare specifier "tailwindcss", which only resolves against this
  // project's node_modules — the output dir itself can still be
  // anywhere, but keeping it here too avoids surprises.
  const outDir = await mkdtemp(join(process.cwd(), ".build-fixture-"));
  try {
    return await fn(outDir);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

describe("runStaticBuild", () => {
  test("emits seguridad-minera.html (a flat file, not a folder index) with the expected key content", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      expect(await Bun.file(join(outDir, "seguridad-minera", "index.html")).exists()).toBe(
        false,
      );
      const html = await Bun.file(join(outDir, "seguridad-minera.html")).text();

      expect(html).toContain("<!doctype html>");
      expect(html).toContain(
        "<title>Seguridad minera y consultoría mensual | COMINORSA</title>",
      );
      expect(html).toContain("<h1>Seguridad minera y consultoría mensual</h1>");
      expect(html).toContain('<a href="/#servicios">Servicios</a>');
      expect(html).toContain('data-event-context="seguridad-minera"');
      expect(html).toContain("hablar por WhatsApp".replace("hablar", "Hablar"));
      expect(html).toContain("RUC 20614147131");
      expect(html).toContain(
        '<link rel="canonical" href="https://cominorsa.com/seguridad-minera">',
      );
    }));

  test("never emits a URL on the stale, non-resolving .com.pe domain", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "seguridad-minera.html")).text();
      expect(html).not.toContain(".com.pe");
    }));

  test("links a hashed CSS file that actually exists in the output", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "seguridad-minera.html")).text();

      const match = html.match(/<link rel="stylesheet" href="([^"]+)">/);
      expect(match).not.toBeNull();
      const cssHref = match![1]!;
      expect(cssHref).toMatch(/^\/assets\/globals-[a-z0-9]+\.css$/);

      const cssPath = join(outDir, cssHref.replace(/^\//, ""));
      expect(await Bun.file(cssPath).exists()).toBe(true);
    }));

  test("links a hashed fonts stylesheet that actually exists in the output", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "seguridad-minera.html")).text();

      const matches = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];
      const fontsHref = matches.map((m) => m[1]!).find((href) => href.includes("fonts-"));
      expect(fontsHref).toBeDefined();
      expect(fontsHref).toMatch(/^\/assets\/fonts-[a-z0-9]+\.css$/);

      const fontsCssPath = join(outDir, fontsHref!.replace(/^\//, ""));
      expect(await Bun.file(fontsCssPath).exists()).toBe(true);
    }));

  test("preloads the critical font, and the woff2 files ship in the output", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "seguridad-minera.html")).text();

      expect(html).toContain(
        '<link rel="preload" href="/fonts/archivo-latin-variable.woff2" as="font" type="font/woff2" crossorigin>',
      );
      for (const fontFile of [
        "archivo-latin-variable.woff2",
        "newsreader-italic-latin-variable.woff2",
        "geist-mono-latin.woff2",
      ]) {
        expect(await Bun.file(join(outDir, "fonts", fontFile)).exists()).toBe(true);
      }
    }));

  test("is deterministic across repeated builds of the same source", () =>
    withTempOutDir(async (outDirA) => {
      await runStaticBuild(outDirA);
      const htmlA = await Bun.file(join(outDirA, "seguridad-minera.html")).text();

      await withTempOutDir(async (outDirB) => {
        await runStaticBuild(outDirB);
        const htmlB = await Bun.file(join(outDirB, "seguridad-minera.html")).text();
        expect(htmlB).toBe(htmlA);
      });
    }));

  test("copies public assets alongside the built pages", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      expect(await Bun.file(join(outDir, "logo-44.png")).exists()).toBe(true);
    }));
});
