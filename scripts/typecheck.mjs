#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const workerTypesPath = resolve(ROOT, "worker-configuration.d.ts");

if (!existsSync(workerTypesPath)) {
  console.error(
    "worker-configuration.d.ts is missing. Run `pnpm run types:worker` after `pnpm run build`.",
  );
  process.exit(1);
}

const workerTypes = readFileSync(workerTypesPath, "utf8");
if (!workerTypes.includes("Runtime types generated with workerd@")) {
  console.error(
    "worker-configuration.d.ts is not a Wrangler-generated runtime declaration.",
  );
  process.exit(1);
}

for (const args of [
  ["exec", "vinext", "typegen"],
  ["exec", "tsc", "--noEmit"],
]) {
  const result = spawnSync(PNPM, args, { cwd: ROOT, stdio: "inherit" });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
