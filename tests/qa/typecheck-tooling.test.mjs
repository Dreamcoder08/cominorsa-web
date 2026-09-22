import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "../..");

test("the typecheck workflow refreshes vinext routes and exposes Wrangler generation", async () => {
  const pkg = JSON.parse(await readFile(resolve(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts?.typecheck, "node scripts/typecheck.mjs");
  assert.match(pkg.scripts?.["types:worker"], /wrangler types worker-configuration\.d\.ts/);
  assert.match(pkg.scripts?.["types:worker"], /--config dist\/server\/wrangler\.json/);

  const script = await readFile(resolve(ROOT, "scripts/typecheck.mjs"), "utf8");
  const routeTypes = script.lastIndexOf('["exec", "vinext", "typegen"]');
  const compiler = script.lastIndexOf('["exec", "tsc", "--noEmit"]');

  assert.ok(routeTypes >= 0, "typecheck must run vinext type generation");
  assert.ok(compiler > routeTypes, "tsc must run after vinext type generation");
  assert.match(script, /Runtime types generated with workerd@/);
});

test("tsconfig does not compile stale Next validators alongside vinext route declarations", async () => {
  const config = JSON.parse(await readFile(resolve(ROOT, "tsconfig.json"), "utf8"));
  assert.ok(config.exclude?.includes(".next/types/validator.ts"));
  assert.ok(config.include?.includes(".next/types/routes.d.ts"));
  assert.ok(config.include?.includes("worker-configuration.d.ts"));
});
