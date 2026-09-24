// T11 cutover: no more `vinext typegen` step (Next's typed-route
// generation, `.next/types/routes.d.ts`) — `scripts/typecheck.mjs` now
// just verifies worker-configuration.d.ts is a real Wrangler-generated
// runtime declaration, then runs `tsc --noEmit`. `types:worker` points
// at the canonical root `wrangler.jsonc` instead of the retired
// `dist/server/wrangler.json`.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "../..");

test("the typecheck workflow verifies worker-configuration.d.ts, then runs tsc", async () => {
  const pkg = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts?.typecheck, "node scripts/typecheck.mjs");
  assert.match(pkg.scripts?.["types:worker"], /wrangler types worker-configuration\.d\.ts/);
  assert.match(pkg.scripts?.["types:worker"], /--config wrangler\.jsonc/);

  const script = await readFile(resolve(ROOT, "scripts/typecheck.mjs"), "utf8");
  assert.match(script, /Runtime types generated with workerd@/);
  assert.match(script, /\["exec", "tsc", "--noEmit"\]/);
  assert.doesNotMatch(script, /\["exec", "vinext", "typegen"\]/);
});

test("tsconfig has no leftover Next-era includes/excludes or plugin", async () => {
  const config = JSON.parse(await readFile(resolve(ROOT, "tsconfig.json"), "utf8"));
  assert.ok(!config.compilerOptions?.plugins, "no `next` TS plugin should remain");
  assert.ok(config.include?.includes("worker-configuration.d.ts"));
  for (const stale of ["next-env.d.ts", ".next/types/routes.d.ts", ".next/dev/types/**/*.ts"]) {
    assert.ok(!config.include?.includes(stale), `stale include should be removed: ${stale}`);
  }
});

test("tsconfig sets jsxImportSource project-wide via a paths alias to the T2 runtime", async () => {
  const config = JSON.parse(await readFile(resolve(ROOT, "tsconfig.json"), "utf8"));
  assert.equal(config.compilerOptions?.jsxImportSource, "@html");
  assert.deepEqual(config.compilerOptions?.paths?.["@html/jsx-runtime"], [
    "./src/html/jsx-runtime.ts",
  ]);
  assert.deepEqual(config.compilerOptions?.paths?.["@html/jsx-dev-runtime"], [
    "./src/html/jsx-dev-runtime.ts",
  ]);
});
