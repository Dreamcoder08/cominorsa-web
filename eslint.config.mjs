import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // `src/html/` and `src/build/` render JSX to plain HTML strings with
    // the hand-written runtime (see `src/html/jsx-runtime.ts`) — no
    // React, no Next router, no reconciliation. The React/Next-specific
    // rules below assume both exist and don't apply here: `jsx-key` is
    // for React's reconciler (this runtime discards `key` by design);
    // `no-html-link-for-pages`/`no-img-element`/`no-head-element` exist
    // because Next ships `<Link>`/`<Image>`/`<Head>` replacements, which
    // this Next-free build deliberately doesn't import.
    files: ["src/html/**/*.{ts,tsx}", "src/build/**/*.{ts,tsx}"],
    rules: {
      "react/jsx-key": "off",
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-head-element": "off",
    },
  },
]);

export default eslintConfig;
