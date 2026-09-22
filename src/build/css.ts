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

export type CssBuildOptions = {
  /**
   * Glob patterns for url() references Bun's CSS bundler should pass
   * through verbatim instead of resolving as local files — e.g.
   * root-relative paths like "/fonts/x.woff2" that only resolve against
   * the site's public root at runtime (src/build/fonts.css, T5).
   */
  external?: string[];
};

export async function buildCss(
  entry: string,
  outDir: string,
  options?: CssBuildOptions,
): Promise<CssBuildResult> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    naming: "[name]-[hash].[ext]",
    minify: true,
    external: options?.external ?? [],
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
