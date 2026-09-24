// src/build/js.test.ts
//
// Wraps `Bun.build` for the site's 4 progressive-enhancement ES module
// entries (T7), the same way `css.ts` (T5) wraps it for CSS: minified,
// content-hashed, one output file per entry. `format: "esm"` +
// `target: "browser"` are new here (css.ts needs neither); `define` lets
// `runStaticBuild` bake `NEXT_PUBLIC_GA_MEASUREMENT_ID` into the bundle
// at build time, since a browser bundle has no `process.env` at runtime.

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildJs } from "./js";

async function fixture(source: string, fileName = "entry.ts"): Promise<{ dir: string; entry: string }> {
  const dir = await mkdtemp(join(process.cwd(), ".js-fixture-"));
  const entry = join(dir, fileName);
  await writeFile(entry, source, "utf8");
  return { dir, entry };
}

describe("buildJs", () => {
  test("produces a minified, content-hashed ESM file that exists on disk", async () => {
    const { dir, entry } = await fixture("export const x = 1 + 1;\n");
    const outDir = join(dir, "out");
    try {
      const result = await buildJs(entry, outDir);
      expect(result.fileName).toMatch(/^entry-[a-z0-9]+\.js$/);
      expect(await Bun.file(join(outDir, result.fileName)).exists()).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("is deterministic: rebuilding identical content yields the identical hash", async () => {
    const { dir, entry } = await fixture("export const x = 2;\n");
    try {
      const first = await buildJs(entry, join(dir, "out1"));
      const second = await buildJs(entry, join(dir, "out2"));
      expect(second.fileName).toBe(first.fileName);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("changes the hash when the source content changes", async () => {
    const { dir, entry } = await fixture("export const x = 3;\n");
    try {
      const before = await buildJs(entry, join(dir, "out1"));
      await writeFile(entry, "export const x = 4;\n", "utf8");
      const after = await buildJs(entry, join(dir, "out2"));
      expect(after.fileName).not.toBe(before.fileName);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("throws with the build logs when the entry file does not exist", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".js-fixture-"));
    try {
      await expect(buildJs(join(dir, "missing.ts"), join(dir, "out"))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("bundles a relative import into the single output file", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".js-fixture-"));
    try {
      await writeFile(join(dir, "helper.ts"), 'export const greeting = "hola-mundo-marker";\n', "utf8");
      await writeFile(
        join(dir, "entry.ts"),
        'import { greeting } from "./helper";\nconsole.log(greeting);\n',
        "utf8",
      );
      const outDir = join(dir, "out");
      const result = await buildJs(join(dir, "entry.ts"), outDir);
      const js = await Bun.file(join(outDir, result.fileName)).text();
      expect(js).toContain("hola-mundo-marker");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("`define` substitutes a compile-time literal, since a browser bundle has no process.env at runtime", async () => {
    const { dir, entry } = await fixture(
      "export const measurementId = process.env.SOME_TEST_MARKER;\n",
    );
    try {
      const outDir = join(dir, "out");
      const result = await buildJs(entry, outDir, {
        define: { "process.env.SOME_TEST_MARKER": JSON.stringify("G-TESTID123") },
      });
      const js = await Bun.file(join(outDir, result.fileName)).text();
      expect(js).toContain("G-TESTID123");
      expect(js).not.toContain("process.env");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
