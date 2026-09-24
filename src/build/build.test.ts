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

import { Glob } from "bun";
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

  test("emits the homepage as index.html with its brand-first title, root canonical, and the consultation form", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "index.html")).text();

      expect(html).toContain("<!doctype html>");
      expect(html).toContain(
        "<title>COMINORSA | Consultoría minera y ambiental</title>",
      );
      expect(html).toContain('<link rel="canonical" href="https://cominorsa.com/">');
      expect(html).toContain('<meta property="og:url" content="https://cominorsa.com/">');
      expect(html).toContain('<span class="reveal-line">Técnica que impulsa.</span>');
      expect(html).toContain('<form class="consultation-form" id="consultation-form" method="post">');
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
      // P8 (audit P2-1): rendered inside the full site shell.
      expect(html).toContain('<header class="site-header">');
      expect(html).toContain("<footer>");
    }));

  test("never emits a URL on the stale, non-resolving .com.pe domain, on any page", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      for (const route of PAGE_ROUTES) {
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        expect(html).not.toContain(".com.pe");
      }
    }));

  // P9: the @font-face rules are bundled into the one stylesheet (was a
  // second render-blocking fonts-*.css request).
  test("every page links the same single hashed stylesheet, which carries the @font-face rules", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const seguridadHtml = await Bun.file(join(outDir, "seguridad-minera.html")).text();
      const matches = [...seguridadHtml.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(
        (m) => m[1]!,
      );
      expect(matches.length).toBe(1);
      const cssHref = matches[0]!;
      expect(cssHref).toMatch(/^\/assets\/globals-[a-z0-9]+\.css$/);
      const css = await Bun.file(join(outDir, cssHref.replace(/^\//, ""))).text();
      expect(css).toContain("@font-face");
      expect(css).toContain("--font-display:");
      // @font-face must precede the rules that use the families.
      expect(css.indexOf("@font-face")).toBeLessThan(css.indexOf("body{"));
      expect(await Array.fromAsync(new Glob("fonts-*.css").scan({ cwd: join(outDir, "assets") }))).toEqual([]);

      // Every other page links the exact same hashed file — one CSS
      // build, shared across the whole route table, not one per page.
      for (const route of PAGE_ROUTES) {
        if (route.slug === "seguridad-minera") continue;
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        expect([...html.matchAll(/rel="stylesheet"/g)].length).toBe(1);
        expect(html).toContain(`<link rel="stylesheet" href="${cssHref}">`);
      }
    }));

  // P9 (audit P2-8): the home h1 <em> renders in Newsreader italic above
  // the fold, so the homepage preloads it too; other pages don't use it.
  test("P9: only the homepage preloads Newsreader italic, every page preloads Archivo", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      for (const route of PAGE_ROUTES) {
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        const preloads = [...html.matchAll(/<link rel="preload" href="\/fonts\/([a-z-]+)-[0-9a-f]{8}\.woff2"/g)].map(
          (m) => m[1],
        );
        expect(preloads).toEqual(
          route.slug === ""
            ? ["archivo-latin-variable", "newsreader-italic-latin-variable"]
            : ["archivo-latin-variable"],
        );
      }
    }));

  // P9 (audit P2-11): what lets the CSP drop style-src 'unsafe-inline'.
  test("P9: no page has a style attribute or a <style> element", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir, { gaMeasurementId: "G-TEST123" });
      for (const route of PAGE_ROUTES) {
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        expect(html).not.toMatch(/\sstyle=/i);
        expect(html).not.toMatch(/<style[\s>]/i);
      }
    }));

  test("P6: fonts ship under content-hashed names, preloaded and referenced by hash", () =>
    withTempOutDir(async (outDir) => {
      const { cssFileName } = await runStaticBuild(outDir);
      const html = await Bun.file(join(outDir, "seguridad-minera.html")).text();
      const fontsCss = await Bun.file(join(outDir, "assets", cssFileName)).text();
      const shipped = (await Array.fromAsync(new Glob("*").scan({ cwd: join(outDir, "fonts") }))).sort();

      const hashed = /^(archivo-latin-variable|newsreader-italic-latin-variable|geist-mono-latin)-[0-9a-f]{8}\.woff2$/;
      expect(shipped).toHaveLength(3);
      for (const file of shipped) {
        expect(file).toMatch(hashed);
        // Every shipped font is referenced by the stylesheet under that exact name.
        expect(fontsCss).toContain(`/fonts/${file}`);
      }

      const archivo = shipped.find((f) => f.startsWith("archivo-"))!;
      expect(html).toContain(
        `<link rel="preload" href="/fonts/${archivo}" as="font" type="font/woff2" crossorigin>`,
      );
      // No unhashed font URL survives anywhere, and no README ships publicly.
      expect(fontsCss).not.toMatch(/\/fonts\/[a-z-]+\.woff2/);
      expect(html).not.toMatch(/\/fonts\/[a-z-]+\.woff2/);
      expect(shipped).not.toContain("README.md");
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

  // P2 (audit P1-1, P1-2, P2-14): head completeness across the whole
  // emitted site, read back from the real output files.
  test("every indexable page has one canonical, og:url equal to it, unique og:title, and a unique description of at most 160 chars", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const ogTitles: string[] = [];
      const descriptions: string[] = [];
      for (const route of PAGE_ROUTES) {
        if (route.slug === "404") continue;
        const label = route.slug || "index";
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)">/g)].map((m) => m[1]);
        expect(canonicals.length, `${label}: canonical count`).toBe(1);
        const ogUrl = html.match(/<meta property="og:url" content="([^"]+)">/)?.[1];
        expect(ogUrl, `${label}: og:url`).toBe(canonicals[0]!);
        const ogTitle = html.match(/<meta property="og:title" content="([^"]+)">/)?.[1];
        const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
        expect(ogTitle, `${label}: og:title`).toBe(title!);
        ogTitles.push(ogTitle!);
        const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
        expect(description, `${label}: description`).toBeDefined();
        expect(description!.length, `${label}: description length`).toBeLessThanOrEqual(160);
        expect(html).toContain(`<meta property="og:description" content="${description}">`);
        expect(html).toContain(`<meta name="twitter:title" content="${title}">`);
        expect(html).toContain(`<meta name="twitter:description" content="${description}">`);
        descriptions.push(description!);
      }
      expect(new Set(ogTitles).size).toBe(ogTitles.length);
      expect(new Set(descriptions).size).toBe(descriptions.length);
    }));

  // P3 (audit P1-4, P1-5, P1-6): landmark structure and heading text,
  // checked on every emitted page.
  test("every page: skip link first in <body> targeting main#contenido; header/footer outside <main>", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      for (const route of PAGE_ROUTES) {
        const label = route.slug || "index";
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();

        expect(html, `${label}: skip link first in body`).toMatch(
          /<body><a class="skip-link" href="#contenido">Ir al contenido<\/a>/,
        );
        expect(html.match(/class="skip-link"/g)?.length, `${label}: skip link count`).toBe(1);
        expect(html.match(/<main\b/g)?.length, `${label}: main count`).toBe(1);
        expect(html.match(/id="contenido"/g)?.length, `${label}: #contenido count`).toBe(1);
        expect(html, `${label}: main carries the target id`).toMatch(/<main id="contenido"/);

        const mainStart = html.indexOf("<main");
        const mainEnd = html.indexOf("</main>");
        for (const tag of ['<header class="site-header">', "<footer>"]) {
          const at = html.indexOf(tag);
          expect(at, `${label}: ${tag} present`).not.toBe(-1);
          expect(at < mainStart || at > mainEnd, `${label}: ${tag} inside <main>`).toBe(true);
        }
      }
    }));

  test("no heading's text content runs two words together", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      for (const route of PAGE_ROUTES) {
        const label = route.slug || "index";
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        for (const [, inner] of html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)) {
          const text = inner!.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ");
          expect(text, `${label}: "${text}"`).not.toMatch(/[a-záéíóúñ][.,][A-ZÁÉÍÓÚ]/);
          expect(text, `${label}: "${text}"`).not.toMatch(/[a-z]por\b/);
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
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        expect(html, route.slug || "index").toContain('id="cookie-preferences-button"');
      }
      const privacy = await Bun.file(join(outDir, "privacidad.html")).text();
      expect(privacy).toContain("Google Analytics 4");
    }));

  // P8 (audit P2-1, P2-15): visible copy is neutral Peruvian Spanish
  // (tú, never voseo) and prose quotes are typographic (“ ” / ‘ ’).
  // Checked on every page, with and without analytics (the GA-only
  // privacy paragraphs render only in the second build).
  test("P8: no page's visible text uses voseo or straight quotes", async () => {
    const VOSEO = /(?<!\p{L})(buscás|acá|avisanos|tenés|podés|querés|sabés)(?!\p{L})/iu;
    for (const gaMeasurementId of ["", "G-TEST123"]) {
      await withTempOutDir(async (outDir) => {
        await runStaticBuild(outDir, { gaMeasurementId });
        for (const route of PAGE_ROUTES) {
          const label = `${route.slug || "index"} (GA: ${gaMeasurementId || "none"})`;
          const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
          const text = html
            .replace(/<head>[\s\S]*?<\/head>/, "")
            .replace(/<script\b[\s\S]*?<\/script>/g, "")
            .replace(/<[^>]*>/g, " ");
          expect(text, label).not.toMatch(VOSEO);
          expect(text, label).not.toMatch(/"|&quot;|&#34;/);
        }
      });
    }
  });

  // P5 (audit P1-8, P1-10): each service page carries the organization,
  // its own Service and a BreadcrumbList — all valid JSON, linked by @id.
  test("P5: every service page has parseable Service + BreadcrumbList JSON-LD tied to the organization", () =>
    withTempOutDir(async (outDir) => {
      await runStaticBuild(outDir);
      const serviceSlugs = PAGE_ROUTES.filter((r) => r.jsonLd !== undefined).map((r) => r.slug);
      expect(serviceSlugs.length).toBe(6);

      for (const route of PAGE_ROUTES) {
        const html = await Bun.file(join(outDir, fileNameFor(route.slug))).text();
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
          (m) => JSON.parse(m[1]!),
        );
        const org = blocks.find((b) => b["@type"] === "ProfessionalService");
        expect(org["@id"]).toBe("https://cominorsa.com/#organization");
        if (!serviceSlugs.includes(route.slug)) {
          expect(blocks.length).toBe(1);
          continue;
        }

        const service = blocks.find((b) => b["@type"] === "Service");
        expect(service.provider["@id"]).toBe(org["@id"]);
        expect(service.url).toBe(`https://cominorsa.com/${route.slug}`);

        const breadcrumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
        const items = breadcrumbs.itemListElement as { position: number; item: string }[];
        expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
        for (const item of items) expect(item.item).toMatch(/^https:\/\/cominorsa\.com\//);
        expect(items.at(-1)!.item).toBe(service.url);

        for (const key of ["geo", "openingHoursSpecification", "openingHours", "email"]) {
          expect(html).not.toContain(`"${key}"`);
        }
        expect(html).toContain('aria-label="Migas de pan"');
        for (const sibling of serviceSlugs.filter((slug) => slug !== route.slug)) {
          expect(html).toContain(`<a href="/${sibling}">`);
        }
      }
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
