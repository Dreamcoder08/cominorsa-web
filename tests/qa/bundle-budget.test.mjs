/**
 * Bundle budget regression test.
 *
 * Walks dist/client/_next/static/ and asserts JS and CSS totals stay
 * within budgets. The thresholds are deliberately loose (matching the
 * performance suite) so a single dependency bump doesn't immediately
 * fail — the goal is to catch gross regressions, not micro-optimise.
 *
 * Budgets (raw, uncompressed):
 *   - JS total: < 600 KB
 *   - CSS total: < 50 KB
 *   - JS framework chunk (largest single): < 250 KB
 *
 * Runs after `pnpm run build`. The test suite script chains build
 * before tests, so this is always fresh.
 */
import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const STATIC = join(ROOT, "dist/client/_next/static");

async function walkJsCss(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkJsCss(p)));
    else if (e.isFile() && (p.endsWith(".js") || p.endsWith(".css"))) {
      out.push(p);
    }
  }
  return out;
}

test("JS bundle total is under 600 KB", async () => {
  const files = await walkJsCss(STATIC);
  const js = files.filter((f) => f.endsWith(".js"));
  assert.ok(js.length > 0, "no JS chunks found — did you run `pnpm build`?");
  let total = 0;
  for (const f of js) total += (await stat(f)).size;
  const kb = total / 1024;
  assert.ok(kb < 600, `JS total ${kb.toFixed(1)} KB exceeds 600 KB budget`);
});

test("CSS bundle total is under 50 KB", async () => {
  const files = await walkJsCss(STATIC);
  const css = files.filter((f) => f.endsWith(".css"));
  let total = 0;
  for (const f of css) total += (await stat(f)).size;
  const kb = total / 1024;
  assert.ok(kb < 50, `CSS total ${kb.toFixed(1)} KB exceeds 50 KB budget`);
});

test("largest JS chunk (framework) is under 250 KB", async () => {
  const files = await walkJsCss(STATIC);
  const js = files.filter((f) => f.endsWith(".js"));
  let largest = 0;
  let largestName = "";
  for (const f of js) {
    const s = await stat(f);
    if (s.size > largest) {
      largest = s.size;
      largestName = f.replace(`${ROOT}/`, "");
    }
  }
  const kb = largest / 1024;
  assert.ok(
    kb < 250,
    `largest chunk ${largestName} is ${kb.toFixed(1)} KB, exceeds 250 KB budget`,
  );
});
