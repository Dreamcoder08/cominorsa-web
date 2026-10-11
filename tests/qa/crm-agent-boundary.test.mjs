import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ESLint } from "eslint";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const AGENT_FILE = resolve(ROOT, "tools/crm-agent/src/cli.ts");

test("root TypeScript excludes the independently installed CRM package", () => {
  const configPath = resolve(ROOT, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.fileNames.includes(AGENT_FILE), false);
});

test("root ESLint excludes the independently installed CRM package", async () => {
  const eslint = new ESLint({ cwd: ROOT });
  assert.equal(await eslint.isPathIgnored(AGENT_FILE), true);
});

test("the public landing has no CRM-agent runtime dependency", () => {
  const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  assert.equal(Object.hasOwn(packageJson, "dependencies"), false);
  assert.equal(packageJson.devDependencies?.["@cominorsa/crm-agent"], undefined);
});
