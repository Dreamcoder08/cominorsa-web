// src/build/js.ts
//
// Bundles, minifies, and content-hashes a browser ES module entry using
// `Bun.build` — the same content-hash contract `css.ts` (T5) already
// relies on (`naming: "[name]-[hash].[ext]"` hashes the bundled *output*
// bytes: stable across repeated builds of the same content, different
// the moment the content changes). Backs the site's 4
// progressive-enhancement widgets (T7): no framework, no bundler
// dependency beyond Bun's own built-in one.
//
// `target: "browser"` + `format: "esm"` (css.ts needs neither) produce a
// plain `<script type="module">`-loadable file. `define` exists so
// `runStaticBuild` can bake `NEXT_PUBLIC_GA_MEASUREMENT_ID` in at build
// time: a browser bundle has no `process.env` at runtime, so
// `app/constants.ts`'s `GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID`
// would otherwise crash or silently become `undefined` in every browser.

export type JsBuildResult = {
  /** e.g. "consent-a1b2c3d4.js" */
  fileName: string;
  /** Absolute path to the written file. */
  path: string;
};

export type JsBuildOptions = {
  /**
   * Compile-time substitutions, e.g.
   * `{ "process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID": JSON.stringify(id) }`.
   * Values are literal JS expression source, not plain strings — the
   * caller must `JSON.stringify` a string value itself.
   */
  define?: Record<string, string>;
};

export async function buildJs(
  entry: string,
  outDir: string,
  options?: JsBuildOptions,
): Promise<JsBuildResult> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    naming: "[name]-[hash].[ext]",
    minify: true,
    target: "browser",
    format: "esm",
    define: options?.define ?? {},
  });

  if (!result.success) {
    throw new AggregateError(
      result.logs.map((log) => new Error(String(log.message ?? log))),
      `JS build failed for ${entry}`,
    );
  }

  const [output] = result.outputs;
  if (!output) {
    throw new Error(`JS build produced no output for ${entry}`);
  }

  const fileName = output.path.split("/").pop();
  if (!fileName) {
    throw new Error(`Could not derive a file name from build output path: ${output.path}`);
  }

  return { fileName, path: output.path };
}
