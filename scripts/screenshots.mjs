#!/usr/bin/env node
// scripts/screenshots.mjs — `pnpm shots <baseUrl> <outDir> <paths…>`
//
// Full-page screenshots of each path at 1440 px (desktop) and 390 px
// (mobile) for visual QA (see .claude/skills/cominorsa-run). Uses the
// Playwright already installed for e2e (`@playwright/test`), no extra
// dependency. Serve the site first, e.g. `pnpm exec wrangler dev --port
// 8788`. Keep outDir outside test-results/: every e2e run wipes it.
//
//   pnpm shots http://localhost:8788 ../shots / /seguridad-minera

import { mkdir } from "node:fs/promises";
import { join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

export const SHOT_WIDTHS = [1440, 390];
const VIEWPORT_HEIGHT = 900;

/**
 * landing-craft T7: full-page capture never scrolls, so scroll-driven
 * reveals (animation-timeline: view()) would stay in their pre-entry,
 * hidden state and whole sections would look blank. Reduced motion
 * renders the static page those reveals enhance.
 */
export function pageOptions(width) {
  return { viewport: { width, height: VIEWPORT_HEIGHT }, reducedMotion: "reduce" };
}

export function shotFileName(path, width) {
  const name = path.replace(/^\/+|\/+$/g, "").replace(/\//g, "_") || "home";
  return `${name}-${width}.png`;
}

export function parseArgs(argv) {
  const [baseUrl, outDir, ...paths] = argv;
  if (!baseUrl || !outDir || paths.length === 0) {
    throw new Error("usage: pnpm shots <baseUrl> <outDir> <path> [path…]");
  }
  if (normalize(outDir).split(/[\\/]/).includes("test-results")) {
    throw new Error("outDir must not be under test-results/ (every e2e run wipes it)");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), outDir, paths };
}

async function main() {
  const { baseUrl, outDir, paths } = parseArgs(process.argv.slice(2));
  const { chromium } = await import("@playwright/test");
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const width of SHOT_WIDTHS) {
      const page = await browser.newPage(pageOptions(width));
      for (const path of paths) {
        const response = await page.goto(baseUrl + path, { waitUntil: "networkidle" });
        const file = join(outDir, shotFileName(path, width));
        await page.screenshot({ path: file, fullPage: true });
        console.log(`${width} ${path} ${response?.status() ?? "no response"} -> ${file}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
