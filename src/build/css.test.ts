// src/build/css.test.ts
//
// Wraps `Bun.build`'s native CSS bundling/minification/content-hashing
// (its `[hash]` naming token is a real content hash of the *minified*
// output bytes, verified empirically: identical input -> identical
// hash across runs; a real value change -> a different hash). No
// separate `Bun.CryptoHasher` pass is needed on top of it.
//
// Historical note (resolved at the T11 cutover): before T11,
// `app/globals.css` started with `@import "tailwindcss";`, which Bun's
// CSS bundler resolved (inlining the Tailwind package's own
// preflight/theme CSS) but didn't fully understand (Tailwind v4's
// `@theme`/`@tailwind` at-rules triggered a non-fatal warning, passed
// through verbatim). T11 removed the Tailwind dependency entirely —
// `app/globals.css` now starts with Tailwind's Preflight reset ported
// in as plain CSS instead of an `@import`.

import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildCss } from "./css";

async function fixture(cssSource: string): Promise<{ dir: string; entry: string }> {
  // Lives under the repo (not /tmp) for consistency with the other
  // fixtures in this file, none of which strictly requires it anymore
  // post-T11 (no more bare npm-package `@import` to resolve).
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

  test("leaves url() references matching `external` untouched instead of resolving them as local files", async () => {
    // Bun's CSS bundler otherwise treats url(...) as a local-file import
    // and fails with "Could not resolve" for a root-relative path like
    // "/fonts/x.woff2" that only exists at runtime under the site's
    // public root, not as a real filesystem path relative to the CSS
    // entry. `external` (used by fonts.css, T5) tells it to pass such
    // references through verbatim instead.
    const { dir, entry } = await fixture(
      '@font-face { font-family: "X"; src: url("/fonts/x.woff2") format("woff2"); }\n',
    );
    try {
      const result = await buildCss(entry, join(dir, "out"), { external: ["/fonts/*"] });
      const css = await Bun.file(join(dir, "out", result.fileName)).text();
      expect(css).toContain("url(/fonts/x.woff2)");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("without `external`, the same root-relative url() fails to resolve", async () => {
    const { dir, entry } = await fixture(
      '@font-face { font-family: "X"; src: url("/fonts/x.woff2") format("woff2"); }\n',
    );
    try {
      await expect(buildCss(entry, join(dir, "out"))).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
