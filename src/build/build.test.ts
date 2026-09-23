// src/build/build.test.ts
//
// End-to-end coverage for the static build pipeline: renders every
// route in `routes.ts`'s `PAGE_ROUTES` table (T6a — all 6 service
// pages, preguntas-frecuentes, privacidad, terminos, 404) with the T2
// runtime, links one shared content-hashed CSS/fonts pair built from
// `app/globals.css`/`fonts.css`, and copies `public/` assets alongside
// them. Output goes to a throwaway temp dir so this test never touches
// the real `dist-static/`.
//
// Pages are flat `<slug>.html` files (e.g. `seguridad-minera.html`),
// NOT `<slug>/index.html` folders: Cloudflare Workers Static Assets'
// default `html_handling: "auto-trailing-slash"` serves a file like
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
import { PAGE_ROUTES } from "./routes";
import { runStaticBuild } from "./build";

/** Mirrors build.ts's writePage: slug "" (the homepage) is index.html. */
function fileNameFor(slug: string): string {
  return slug === "" ? "index.html" : `${slug}.html`;
}

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
  test("emits one flat <slug>.html file per route, not a folder index", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      for (const route of PAGE_ROUTES) {
        if (route.slug === "") continue; // the homepage is index.html itself
        expect(await Bun.file(join(outDir, route.slug, "index.html")).exists()).toBe(false);
        expect(await Bun.file(join(outDir, `${route.slug}.html`)).exists()).toBe(true);
      }
      expect(await Bun.file(join(outDir, "index.html")).exists()).toBe(true);
    }));

  test("emits the homepage as index.html with its brand-first title, no canonical, and the consultation form", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "index.html")).text();

      expect(html).toContain("<!doctype html>");
      expect(html).toContain(
        "<title>COMINORSA | Consultoría minera y ambiental</title>",
      );
      expect(html).not.toContain('rel="canonical"');
      expect(html).not.toContain('property="og:url"');
      expect(html).toContain('<span class="reveal-line">Técnica que impulsa.</span>');
      expect(html).toContain('<form class="consultation-form" id="consultation-form">');
      expect(html).toContain('href="/seguridad-minera"');
    }));

  test("emits seguridad-minera.html with the expected key content (parity with the pre-route-table build)", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
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

  test("emits every other service page with its own title and canonical", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const cases: Array<[slug: string, title: string]> = [
        ["igafom-reinfo", "IGAFOM y REINFO — Formalización minera"],
        ["gestion-ambiental-minera", "Gestión ambiental minera — DIA y PAMA"],
        ["declaraciones-dac-estamin", "Declaraciones DAC y ESTAMIN"],
        ["ingenieria-y-planes-de-minado", "Planes de minado e ingeniería técnica"],
        ["tramites-minem-ingemmet-drem", "Trámites ante MINEM, INGEMMET y DREM"],
      ];
      for (const [slug, title] of cases) {
        const html = await Bun.file(join(outDir, `${slug}.html`)).text();
        expect(html).toContain(`<title>${title} | COMINORSA</title>`);
        expect(html).toContain(`<link rel="canonical" href="https://cominorsa.com/${slug}">`);
      }
    }));

  test("emits preguntas-frecuentes.html with its FAQ content and canonical", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "preguntas-frecuentes.html")).text();
      expect(html).toContain(
        "<title>Preguntas frecuentes sobre minería | COMINORSA</title>",
      );
      expect(html).toContain(
        '<link rel="canonical" href="https://cominorsa.com/preguntas-frecuentes">',
      );
      expect(html).toContain("<h2>¿Qué es el REINFO?</h2>");
    }));

  test("emits privacidad.html and terminos.html with their own canonical", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const privacidad = await Bun.file(join(outDir, "privacidad.html")).text();
      expect(privacidad).toContain("<title>Política de Privacidad | COMINORSA</title>");
      expect(privacidad).toContain(
        '<link rel="canonical" href="https://cominorsa.com/privacidad">',
      );

      const terminos = await Bun.file(join(outDir, "terminos.html")).text();
      expect(terminos).toContain("<title>Términos y Condiciones | COMINORSA</title>");
      expect(terminos).toContain(
        '<link rel="canonical" href="https://cominorsa.com/terminos">',
      );
    }));

  test("emits 404.html noindex, with no canonical link", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "404.html")).text();
      expect(html).toContain("<title>Página no encontrada | COMINORSA</title>");
      expect(html).toContain('<meta name="robots" content="noindex, follow">');
      expect(html).not.toContain('rel="canonical"');
      expect(html).toContain("Volver al inicio");
    }));

  test("never emits a URL on the stale, non-resolving .com.pe domain, on any page", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      for (const route of PAGE_ROUTES) {
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        expect(html).not.toContain(".com.pe");
      }
    }));

  test("every page links the same hashed CSS and fonts files that actually exist in the output", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const seguridadHtml = await Bun.file(join(outDir, "seguridad-minera.html")).text();
      const matches = [...seguridadHtml.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(
        (m) => m[1]!,
      );
      expect(matches.length).toBe(2);
      const cssHref = matches.find((href) => href.includes("globals-"))!;
      const fontsHref = matches.find((href) => href.includes("fonts-"))!;
      expect(cssHref).toMatch(/^\/assets\/globals-[a-z0-9]+\.css$/);
      expect(fontsHref).toMatch(/^\/assets\/fonts-[a-z0-9]+\.css$/);
      expect(await Bun.file(join(outDir, cssHref.replace(/^\//, ""))).exists()).toBe(true);
      expect(await Bun.file(join(outDir, fontsHref.replace(/^\//, ""))).exists()).toBe(true);

      // Every other page links the exact same hashed files — one CSS
      // build, shared across the whole route table, not one per page.
      for (const route of PAGE_ROUTES) {
        if (route.slug === "seguridad-minera") continue;
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        expect(html).toContain(`<link rel="stylesheet" href="${cssHref}">`);
        expect(html).toContain(`<link rel="stylesheet" href="${fontsHref}">`);
      }
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
