// src/html/jsx-dev-runtime.ts
//
// Resolves gap G1 (see odd/tasks/bun-vanilla-migration.md). TypeScript's
// and Bun's automatic JSX transform imports `jsxDEV` (plus `Fragment`)
// from `<jsxImportSource>/jsx-dev-runtime` whenever it thinks it's
// building for development (`bun dev`, `bun test`, unminified
// `Bun.build`); it only imports `jsx`/`jsxs` from `./jsx-runtime` in a
// production build. Both paths must exist or dev transpilation fails.
//
// `jsxDEV` carries three extra debug-only parameters compared to `jsx`
// (`isStaticChildren`, `source`, `self`) that real JSX runtimes use to
// produce better dev warnings. This runtime has no such warnings — it
// only ever builds a plain node tree — so they're accepted and ignored,
// same as `jsx`/`jsxs` already ignore `key`.

import { jsx } from "./jsx-runtime";

export { Fragment } from "./jsx-runtime";

export function jsxDEV<P extends object>(
  type: Parameters<typeof jsx<P>>[0],
  props: P,
  key: Parameters<typeof jsx<P>>[2],
  _isStaticChildren?: boolean,
  _source?: unknown,
  _self?: unknown,
): ReturnType<typeof jsx<P>> {
  return jsx(type, props, key);
}
