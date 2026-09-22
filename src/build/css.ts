// src/build/css.ts
//
// Bundles, minifies, and content-hashes a CSS entry point using
// `Bun.build`'s native CSS support — no PostCSS, no separate hasher.
// `naming: "[name]-[hash].[ext]"` asks Bun to compute the hash from the
// bundled *output* bytes, which is exactly the "changes when content
// changes, stable when it doesn't" contract a cache-busting asset name
// needs (see css.test.ts for the empirical proof).

export type CssBuildResult = {
  /** e.g. "globals-a1b2c3d4.css" */
  fileName: string;
  /** Absolute path to the written file. */
  path: string;
};

export async function buildCss(entry: string, outDir: string): Promise<CssBuildResult> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    naming: "[name]-[hash].[ext]",
    minify: true,
  });

  if (!result.success) {
    throw new AggregateError(
      result.logs.map((log) => new Error(String(log.message ?? log))),
      `CSS build failed for ${entry}`,
    );
  }

  const [output] = result.outputs;
  if (!output) {
    throw new Error(`CSS build produced no output for ${entry}`);
  }

  const fileName = output.path.split("/").pop();
  if (!fileName) {
    throw new Error(`Could not derive a file name from build output path: ${output.path}`);
  }

  return { fileName, path: output.path };
}
