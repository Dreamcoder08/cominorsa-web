// src/html/jsx-runtime.test.ts
//
// Behavioral coverage for the hand-written JSX-to-HTML-string runtime.
// Every assertion checks the exact HTML string produced, not internal
// shape — these tests must keep passing across a full rewrite of the
// runtime's internals.
//
// Called directly (`jsx(...)`, not `<div />`) because `tsconfig`
// `jsxImportSource` wiring is a later task (T3).

import { describe, expect, test } from "bun:test";
import { Fragment, jsx, jsxs, raw, render, type Child } from "./jsx-runtime";

describe("text escaping", () => {
  test("escapes & < > in text children", () => {
    expect(render(jsx("p", { children: "a & b < c > d" }))).toBe(
      "<p>a &amp; b &lt; c &gt; d</p>",
    );
  });

  test("does not escape quotes in text children", () => {
    expect(render(jsx("p", { children: `it's "quoted"` }))).toBe(
      `<p>it's "quoted"</p>`,
    );
  });
});

describe("attribute escaping", () => {
  test("escapes & < > in attribute values", () => {
    expect(render(jsx("a", { href: "a&b<c>d" }))).toBe(
      '<a href="a&amp;b&lt;c&gt;d"></a>',
    );
  });

  test("escapes double quotes in attribute values", () => {
    expect(render(jsx("a", { title: `say "hi"` }))).toBe(
      '<a title="say &quot;hi&quot;"></a>',
    );
  });

  test("escapes single quotes in attribute values", () => {
    expect(render(jsx("a", { title: "it's fine" }))).toBe(
      '<a title="it&#39;s fine"></a>',
    );
  });

  test("always emits double-quoted attribute values", () => {
    const html = render(jsx("input", { value: "x" }));
    expect(html).toContain('value="x"');
  });
});

describe("void elements", () => {
  test("self-closes without a closing tag", () => {
    expect(render(jsx("br", {}))).toBe("<br>");
    expect(render(jsx("img", { src: "a.png", alt: "A" }))).toBe(
      '<img src="a.png" alt="A">',
    );
  });

  test("covers the full void element set", () => {
    const voidTags = [
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "source",
      "track",
      "wbr",
    ];
    for (const tag of voidTags) {
      expect(render(jsx(tag, {}))).toBe(`<${tag}>`);
    }
  });

  test("throws when a void element is given children", () => {
    expect(() => render(jsx("img", { src: "a.png", children: "text" }))).toThrow();
  });
});

describe("prop name mapping", () => {
  test("maps className to class", () => {
    expect(render(jsx("div", { className: "a b" }))).toBe(
      '<div class="a b"></div>',
    );
  });

  test("maps htmlFor to for", () => {
    expect(render(jsx("label", { htmlFor: "email" }))).toBe(
      '<label for="email"></label>',
    );
  });

  test("passes unmapped prop names through as-is", () => {
    expect(render(jsx("div", { "data-testid": "x" }))).toBe(
      '<div data-testid="x"></div>',
    );
  });
});

describe("boolean attributes", () => {
  test("true renders the bare attribute name", () => {
    expect(render(jsx("input", { disabled: true }))).toBe(
      "<input disabled>",
    );
  });

  test("false omits the attribute", () => {
    expect(render(jsx("input", { disabled: false }))).toBe("<input>");
  });

  test("null omits the attribute", () => {
    expect(render(jsx("div", { title: null }))).toBe("<div></div>");
  });

  test("undefined omits the attribute", () => {
    expect(render(jsx("div", { title: undefined }))).toBe("<div></div>");
  });
});

describe("children", () => {
  test("flattens nested arrays recursively", () => {
    const html = render(
      jsxs("ul", {
        children: [
          jsx("li", { children: "a" }),
          [jsx("li", { children: "b" }), jsx("li", { children: "c" })],
        ],
      }),
    );
    expect(html).toBe("<ul><li>a</li><li>b</li><li>c</li></ul>");
  });

  test("renders null, undefined, false, true children as nothing", () => {
    expect(
      render(jsxs("div", { children: [null, undefined, false, true, "x"] })),
    ).toBe("<div>x</div>");
  });

  test("stringifies number children", () => {
    expect(render(jsx("span", { children: 42 }))).toBe("<span>42</span>");
  });

  test("renders a single null child as an empty element", () => {
    expect(render(jsx("div", { children: null }))).toBe("<div></div>");
  });
});

describe("function components", () => {
  test("calls the function with props, including children", () => {
    function Greeting(props: { name: string }) {
      return jsx("p", { children: `Hello, ${props.name}` });
    }
    expect(render(jsx(Greeting, { name: "World" }))).toBe(
      "<p>Hello, World</p>",
    );
  });

  test("forwards children through a wrapping component", () => {
    function Card(props: { children?: Child }) {
      return jsx("section", { className: "card", children: props.children });
    }
    expect(
      render(jsx(Card, { children: jsx("p", { children: "inside" }) })),
    ).toBe('<section class="card"><p>inside</p></section>');
  });
});

describe("Fragment", () => {
  test("renders children with no wrapper element", () => {
    const html = render(
      jsxs(Fragment, {
        children: [jsx("span", { children: "a" }), jsx("span", { children: "b" })],
      }),
    );
    expect(html).toBe("<span>a</span><span>b</span>");
  });
});

describe("raw()", () => {
  test("passes the string through unescaped", () => {
    expect(render(raw("<b>bold</b> & stuff"))).toBe("<b>bold</b> & stuff");
  });

  test("embeds unescaped inside a parent element", () => {
    expect(render(jsx("div", { children: raw("<b>x</b>") }))).toBe(
      "<div><b>x</b></div>",
    );
  });

  test("does not double-escape already-rendered output", () => {
    const inner = render(jsx("span", { children: "a & b" }));
    expect(inner).toBe("<span>a &amp; b</span>");

    const outer = render(jsx("div", { children: raw(inner) }));
    expect(outer).toBe("<div><span>a &amp; b</span></div>");
  });
});

describe("key", () => {
  test("is accepted and ignored", () => {
    expect(render(jsx("li", { children: "a" }, "some-key"))).toBe(
      "<li>a</li>",
    );
  });
});

describe("attribute name validation", () => {
  test("rejects a name containing whitespace", () => {
    expect(() => render(jsx("div", { "foo bar": "x" }))).toThrow();
  });

  test("rejects a name containing a slash", () => {
    expect(() => render(jsx("div", { "foo/bar": "x" }))).toThrow();
  });

  test("rejects a name containing >", () => {
    expect(() => render(jsx("div", { "foo>bar": "x" }))).toThrow();
  });

  test("rejects a name containing =", () => {
    expect(() => render(jsx("div", { "foo=bar": "x" }))).toThrow();
  });

  test("rejects a name containing a double quote", () => {
    expect(() => render(jsx("div", { 'foo"bar': "x" }))).toThrow();
  });

  test("rejects a name containing a single quote", () => {
    expect(() => render(jsx("div", { "foo'bar": "x" }))).toThrow();
  });

  test("rejects a name containing a control character", () => {
    expect(() => render(jsx("div", { "foo\u0000bar": "x" }))).toThrow();
  });
});

describe("nesting", () => {
  test("renders deeply nested elements", () => {
    const html = render(
      jsx("div", {
        className: "outer",
        children: jsx("section", {
          children: jsx("p", { children: "deep" }),
        }),
      }),
    );
    expect(html).toBe('<div class="outer"><section><p>deep</p></section></div>');
  });
});
