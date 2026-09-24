/**
 * Bundle budget regression test.
 *
 * T11 cutover: walks dist-static/assets/ (the static build's hashed CSS
 * and the 3 tiny progressive-enhancement JS bundles, T7) instead of
 * dist/client/_next/static/ (Next's chunked framework bundle, gone).
 * The JS budget is tightened from the old 600 KB (a full React+Next
 * framework bundle) to a gzip-based budget that actually matches this
 * site's real output — 3 dependency-free ES modules totaling ~4.9 KB raw
 * / ~2.6 KB gzip (see odd/tasks/bun-vanilla-migration.md's T7 entry) — a
 * meaningful regression alarm now, not a number so loose it could never
 * fire. Runs after `pnpm run build` (the test suite script chains build
 * before tests), so this is always fresh.
 *
 * Budgets:
 *   - JS total (gzip): <= 20 KB — roughly 8x this site's real total,
 *     enough headroom for a genuine new widget without being the old
 *     600 KB budget that could never catch a real regression.
 *   - Inlined CSS (P11): < 50 KB raw, < 10 KB gzip — unchanged threshold; real output
 *     (~32 KB, Tailwind's Preflight reset plus this site's own CSS) has
 *     comfortable headroom.
 */
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ASSETS_DIR = join(ROOT, "dist-static", "assets");

async function filesWithExt(ext) {
  let entries;
  try {
    entries = await readdir(ASSETS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(ext))
    .map((e) => join(ASSETS_DIR, e.name));
}

test("JS bundle total (gzip) is under 20 KB", async () => {
  const files = await filesWithExt(".js");
  assert.ok(files.length > 0, "no JS bundles found — did you run `pnpm build`?");
  let total = 0;
  for (const f of files) {
    const raw = await readFile(f);
    total += gzipSync(raw, { level: 9 }).length;
  }
  const kb = total / 1024;
  assert.ok(kb < 20, `JS total (gzip) ${kb.toFixed(2)} KB exceeds the 20 KB budget`);
});

// P11: the CSS is inlined into every page's <style>, so its budget is
// measured there (raw, as before; plus gzip, since it now travels inside
// every HTML response instead of being cached once).
test("inlined CSS is under 50 KB raw and 10 KB gzip", async () => {
  const html = await readFile(join(ROOT, "dist-static", "index.html"), "utf8");
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  assert.ok(css, "no inlined <style> found — did you run `pnpm build`?");
  const kb = Buffer.byteLength(css) / 1024;
  const gzKb = gzipSync(css, { level: 9 }).length / 1024;
  assert.ok(kb < 50, `CSS ${kb.toFixed(1)} KB exceeds 50 KB budget`);
  assert.ok(gzKb < 10, `CSS gzip ${gzKb.toFixed(1)} KB exceeds 10 KB budget`);
});

test("no single JS bundle exceeds 10 KB raw (each widget stays independently tiny)", async () => {
  const files = await filesWithExt(".js");
  for (const f of files) {
    const s = await stat(f);
    const kb = s.size / 1024;
    assert.ok(kb < 10, `${f} is ${kb.toFixed(1)} KB, exceeds the 10 KB per-bundle budget`);
  }
});
