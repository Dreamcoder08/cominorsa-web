import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const ROOT = resolve(import.meta.dirname, "../..");

test("hosting config reads omitted optional bindings through runtime string checks", async () => {
  const source = await readFile(resolve(ROOT, "vite.config.ts"), "utf8");

  assert.match(source, /"d1" in config && typeof config\.d1 === "string"/);
  assert.match(source, /"r2" in config && typeof config\.r2 === "string"/);
  assert.match(source, /readOptionalBinding\(hostingConfig\)/);
  assert.doesNotMatch(source, /const \{ d1, r2 \} = hostingConfig/);
});
