#!/usr/bin/env node
/**
 * Bundle size report.
 *
 * Walks dist/client/_next/static/ and prints a sorted table of every JS
 * and CSS asset, with size and gzipped size. Useful for spotting
 * regressions during code review.
 *
 * Output is plain text (one row per file, columns aligned). Designed to
 * be readable in a terminal and to diff cleanly in PRs.
 *
 * Usage:  pnpm run bundle:report   (after pnpm run build)
 * Exit:   0 always (report-only, no failure mode).
 */
import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const STATIC = join(ROOT, "dist/client/_next/static");

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(p)));
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

function fmtKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`.padStart(10);
}

const files = await walk(STATIC);
const targets = files.filter((f) => f.endsWith(".js") || f.endsWith(".css"));

if (targets.length === 0) {
  process.stdout.write(
    `no JS/CSS files found under ${STATIC}\n  run pnpm run build first\n`,
  );
  process.exit(0);
}

const rows = await Promise.all(
  targets.map(async (p) => {
    const rel = p.replace(`${ROOT}/dist/client/`, "");
    const s = await stat(p);
    const raw = await readFile(p);
    const gz = gzipSync(raw, { level: 9 });
    return {
      path: rel,
      kind: p.endsWith(".js") ? "js" : "css",
      raw: s.size,
      gz: gz.length,
    };
  }),
);

rows.sort((a, b) => b.raw - a.raw);

const totals = rows.reduce(
  (acc, r) => {
    acc.raw += r.raw;
    acc.gz += r.gz;
    if (r.kind === "js") acc.jsRaw += r.raw;
    else acc.cssRaw += r.raw;
    return acc;
  },
  { raw: 0, gz: 0, jsRaw: 0, cssRaw: 0 },
);

process.stdout.write(`\n== Bundle report ==\n\n`);
process.stdout.write(
  `${"kind".padEnd(4)} ${"raw".padStart(10)} ${"gzip".padStart(10)}  path\n`,
);
process.stdout.write(
  `${"----".padEnd(4)} ${"---".padStart(10)} ${"----".padStart(10)}  ----\n`,
);
for (const r of rows) {
  process.stdout.write(
    `${r.kind.padEnd(4)} ${fmtKb(r.raw)} ${fmtKb(r.gz)}  ${r.path}\n`,
  );
}
process.stdout.write(
  `${"----".padEnd(4)} ${"---".padStart(10)} ${"----".padStart(10)}  ----\n`,
);
process.stdout.write(
  `${"js".padEnd(4)} ${fmtKb(totals.jsRaw)} ${"".padStart(10)}  (JS total)\n`,
);
process.stdout.write(
  `${"css".padEnd(4)} ${fmtKb(totals.cssRaw)} ${"".padStart(10)}  (CSS total)\n`,
);
process.stdout.write(
  `${"all".padEnd(4)} ${fmtKb(totals.raw)} ${fmtKb(totals.gz)}  (total)\n\n`,
);
