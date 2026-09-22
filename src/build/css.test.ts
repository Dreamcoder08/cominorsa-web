// src/build/css.test.ts
//
// Wraps `Bun.build`'s native CSS bundling/minification/content-hashing
// (its `[hash]` naming token is a real content hash of the *minified*
// output bytes, verified empirically: identical input -> identical
// hash across runs; a real value change -> a different hash). No
// separate `Bun.CryptoHasher` pass is needed on top of it.
//
// `app/globals.css` starts with `@import "tailwindcss";`. Bun's CSS
// bundler resolves that import (inlining the Tailwind package's own
// preflight/theme CSS) but doesn't understand Tailwind v4's `@theme`/
// `@tailwind` at-rules — it emits a non-fatal warning and passes them
// through verbatim. This is expected until T11 drops the Tailwind
// dependency entirely; browsers discard unrecognized at-rule blocks
// during parsing, so nothing renders incorrectly because of it.

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCss } from "./css";

async function fixture(cssSource: string): Promise<{ dir: string; entry: string }> {
  // Must live under the repo (not /tmp) so the bare `"tailwindcss"`
  // import resolves against this project's node_modules.
  const dir = await mkdtemp(join(process.cwd(), ".css-fixture-"));
  const entry = join(dir, "styles.css");
  await writeFile(entry, cssSource, "utf8");
  return { dir, entry };
}

describe("buildCss", () => {
  test("produces a minified, content-hashed CSS file that exists on disk", async () => {
    const { dir, entry } = await fixture(":root { --x: 1px; }\n");
    const outDir = join(dir, "out");
    try {
      const result = await buildCss(entry, outDir);
      expect(result.fileName).toMatch(/^styles-[a-z0-9]+\.css$/);
      expect(await Bun.file(join(outDir, result.fileName)).exists()).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("is deterministic: rebuilding identical content yields the identical hash", async () => {
    const { dir, entry } = await fixture(":root { --x: 2px; }\n");
    try {
      const first = await buildCss(entry, join(dir, "out1"));
      const second = await buildCss(entry, join(dir, "out2"));
      expect(second.fileName).toBe(first.fileName);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("changes the hash when the CSS content changes", async () => {
    const { dir, entry } = await fixture(":root { --x: 3px; }\n");
    try {
      const before = await buildCss(entry, join(dir, "out1"));
      await writeFile(entry, ":root { --x: 4px; }\n", "utf8");
      const after = await buildCss(entry, join(dir, "out2"));
      expect(after.fileName).not.toBe(before.fileName);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("throws with the build logs when the entry file does not exist", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".css-fixture-"));
    try {
      await expect(buildCss(join(dir, "missing.css"), join(dir, "out"))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
