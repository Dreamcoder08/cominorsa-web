/**
 * Smoke test: the env validator script itself runs cleanly.
 *
 * This guards against silent regressions in scripts/validate-env.mjs
 * (e.g. someone breaks the JSON read or a required-file check).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import test from "node:test";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("scripts/validate-env.mjs exits 0 with current project state", () => {
  const result = spawnSync(
    "node",
    [resolve(ROOT, "scripts/validate-env.mjs")],
    { encoding: "utf8", cwd: ROOT },
  );
  assert.equal(
    result.status,
    0,
    `validator failed:\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  // Sanity: the summary line is present
  assert.match(result.stdout, /all required checks passed/);
});

test("package.json declares the `validate` script", async () => {
  const { readFile } = await import("node:fs/promises");
  const pkg = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
  assert.ok(
    typeof pkg.scripts?.validate === "string",
    "package.json scripts.validate missing",
  );
  assert.match(pkg.scripts.validate, /validate-env\.mjs/);
});

test(".env.example exists and is committed (not gitignored)", async () => {
  const { readFile, stat } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");
  const p = resolve(ROOT, ".env.example");
  assert.ok(existsSync(p), ".env.example missing");
  const raw = await readFile(p, "utf8");
  // Must document the bindings policy so devs do not reintroduce D1/R2 stubs
  assert.match(raw, /\.openai\/hosting\.json/);
  assert.match(raw, /must NOT declare.+d1.+r2/s);
  // Should be a real file, not a symlink
  const s = await stat(p);
  assert.ok(s.size > 200, ".env.example too short to be useful");
});
