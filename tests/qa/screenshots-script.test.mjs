// P10: `pnpm shots <baseUrl> <outDir> <paths…>` — the screenshot helper
// used for visual QA (cominorsa-run skill), promoted from a scratch file
// under test-results/ (which every e2e run wipes).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { parseArgs, shotFileName, SHOT_WIDTHS } from "../../scripts/screenshots.mjs";

const ROOT = join(import.meta.dirname, "..", "..");

test("package.json exposes `pnpm shots`", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts.shots, "node scripts/screenshots.mjs");
});

test("shoots desktop and mobile widths", () => {
  assert.deepEqual(SHOT_WIDTHS, [1440, 390]);
});

test("file names are readable, including the homepage", () => {
  assert.equal(shotFileName("/", 1440), "home-1440.png");
  assert.equal(shotFileName("/seguridad-minera", 390), "seguridad-minera-390.png");
  assert.equal(shotFileName("/a/b", 390), "a_b-390.png");
});

test("parses <baseUrl> <outDir> <paths…> and rejects missing arguments", () => {
  assert.deepEqual(parseArgs(["http://localhost:8788/", "out", "/", "/faq"]), {
    baseUrl: "http://localhost:8788",
    outDir: "out",
    paths: ["/", "/faq"],
  });
  assert.throws(() => parseArgs(["http://localhost:8788", "out"]), /usage/i);
});

test("refuses an output directory under test-results/ (e2e wipes it)", () => {
  assert.throws(() => parseArgs(["http://x", "test-results/shots", "/"]), /test-results/);
});
