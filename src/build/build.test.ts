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
  // Under the repo, not /tmp, for consistency with this project's other
  // fixture directories.
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

  // T7: every route renders SiteHeader/SiteFooter (mobile nav + the
  // cookie-preferences button), so every route needs the mobile-nav and
  // consent widgets; only the homepage has a #consultation-form to wire.
  test("every page links the mobile-nav and consent module scripts, built and copied to disk", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      for (const route of PAGE_ROUTES) {
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        const srcs = [
          ...html.matchAll(/<script type="module" src="([^"]+)" defer><\/script>/g),
        ].map((m) => m[1]!);

        const mobileNavSrc = srcs.find((src) => src.includes("mobile-nav"));
        const consentSrc = srcs.find((src) => src.includes("consent"));
        expect(mobileNavSrc, `${route.slug || "index"}: missing mobile-nav script`).toBeDefined();
        expect(consentSrc, `${route.slug || "index"}: missing consent script`).toBeDefined();
        expect(mobileNavSrc).toMatch(/^\/assets\/mobile-nav-entry-[a-z0-9]+\.js$/);
        expect(consentSrc).toMatch(/^\/assets\/consent-entry-[a-z0-9]+\.js$/);
        expect(await Bun.file(join(outDir, mobileNavSrc!.replace(/^\//, ""))).exists()).toBe(true);
        expect(await Bun.file(join(outDir, consentSrc!.replace(/^\//, ""))).exists()).toBe(true);
      }
    }));

  test("only the homepage links the consultation-form module script", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const home = await Bun.file(join(outDir, "index.html")).text();
      expect(home).toMatch(/<script type="module" src="\/assets\/consultation-form-entry-[a-z0-9]+\.js" defer><\/script>/);

      const seguridad = await Bun.file(join(outDir, "seguridad-minera.html")).text();
      expect(seguridad).not.toContain("consultation-form-entry");
    }));

  test("emits no inline <script> body anywhere (only src-based module scripts and the JSON-LD data block)", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      for (const route of PAGE_ROUTES) {
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        for (const [tag, body] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
          const isJsonLd = tag.includes('type="application/ld+json"');
          const isModule = tag.includes('type="module"') && tag.includes(" src=");
          expect(isJsonLd || isModule, `unexpected inline script tag: ${tag}`).toBe(true);
          if (isModule) expect(body).toBe("");
        }
      }
    }));

  // P1 (audit P0-2): one source of truth for "does this build have
  // analytics": the GA measurement ID passed to runStaticBuild (defaults
  // to NEXT_PUBLIC_GA_MEASUREMENT_ID). It both bakes into the consent
  // bundle and decides whether pages render the preferences button and
  // the GA paragraph of the privacy policy.
  test("without a GA ID, no page renders the cookie-preferences button or GA copy", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir, { gaMeasurementId: "" });
      for (const route of PAGE_ROUTES) {
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        expect(html, route.slug || "index").not.toContain("cookie-preferences-button");
      }
      const privacy = await Bun.file(join(outDir, "privacidad.html")).text();
      expect(privacy).not.toContain("Google Analytics");
    }));

  test("with a GA ID, every page with a footer renders the preferences button and the policy describes GA4", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir, { gaMeasurementId: "G-TEST123" });
      for (const route of PAGE_ROUTES) {
        if (route.slug === "404") continue; // standalone page, no SiteFooter
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        expect(html, route.slug || "index").toContain('id="cookie-preferences-button"');
      }
      const privacy = await Bun.file(join(outDir, "privacidad.html")).text();
      expect(privacy).toContain("Google Analytics 4");
    }));

  // T8: sitemap.xml/robots.txt/manifest.webmanifest, generated from the
  // same PAGE_ROUTES table + site-config.ts constants exercised in
  // sitemap.test.ts/robots.test.ts/webmanifest.test.ts directly — this
  // just proves runStaticBuild actually wires them into the output dir.
  test("writes sitemap.xml, robots.txt, and manifest.webmanifest to the output root", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);

      const sitemap = await Bun.file(join(outDir, "sitemap.xml")).text();
      expect(sitemap).toContain("<loc>https://cominorsa.com/</loc>");
      expect(sitemap).toContain("<loc>https://cominorsa.com/seguridad-minera</loc>");
      expect(sitemap).not.toContain("404");

      const robots = await Bun.file(join(outDir, "robots.txt")).text();
      expect(robots).toContain("Sitemap: https://cominorsa.com/sitemap.xml");

      const manifest = await Bun.file(join(outDir, "manifest.webmanifest")).text();
      expect(JSON.parse(manifest).name).toBe("COMINORSA | Consultoría minera y ambiental");
    }));

  // T10: dist-static/_headers, generated from security-policy.ts — see
  // headers.test.ts for the unit-level policy assertions; this proves
  // it actually lands in the build output.
  test("writes dist-static/_headers with the security policy and asset caching rules", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const headers = await Bun.file(join(outDir, "_headers")).text();
      expect(headers).toContain("Content-Security-Policy:");
      expect(headers).not.toContain("nonce-");
      expect(headers).toContain("/assets/*");
      expect(headers).toContain("/fonts/*");
    }));
});
