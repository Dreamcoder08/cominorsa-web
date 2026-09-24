// src/html/jsx-dev-runtime.test.ts
//
// Resolves gap G1: Bun's automatic JSX transform imports `jsxDEV` (and
// `Fragment`) from `<jsxImportSource>/jsx-dev-runtime` in development
// builds, not `jsx`/`jsxs`. Without this module, any `.tsx` file using
// the `@jsxImportSource` pragma fails to transpile under `bun dev`/`bun
// test` even though it works under `bun build --production`.

import { describe, expect, test } from "bun:test";
import { Fragment as ProdFragment, render } from "./jsx-runtime";
import { Fragment, jsxDEV } from "./jsx-dev-runtime";

describe("jsxDEV", () => {
  test("renders an intrinsic element like jsx() does", () => {
    const node = jsxDEV("p", { children: "hola" }, undefined, false, undefined, undefined);
    expect(render(node)).toBe("<p>hola</p>");
  });

  test("renders attributes the same way jsx() does", () => {
    const node = jsxDEV(
      "a",
      { href: "https://example.com", children: "link" },
      undefined,
      false,
      undefined,
      undefined,
    );
    expect(render(node)).toBe('<a href="https://example.com">link</a>');
  });

  test("ignores the dev-only key/isStaticChildren/source/self arguments", () => {
    const node = jsxDEV(
      "span",
      { children: "x" },
      "some-key",
      true,
      { fileName: "probe.tsx", lineNumber: 1, columnNumber: 1 },
      null,
    );
    expect(render(node)).toBe("<span>x</span>");
  });

  test("renders a component function the same way jsx() does", () => {
    function Greeting({ name }: { name: string }) {
      return jsxDEV("strong", { children: `Hola, ${name}` }, undefined, false, undefined, undefined);
    }
    const node = jsxDEV(Greeting, { name: "mundo" }, undefined, false, undefined, undefined);
    expect(render(node)).toBe("<strong>Hola, mundo</strong>");
  });
});

describe("Fragment", () => {
  test("re-exports the same Fragment used by the production runtime", () => {
    expect(Fragment).toBe(ProdFragment);
  });
});
