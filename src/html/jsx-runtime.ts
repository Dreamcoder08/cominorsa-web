// src/html/jsx-runtime.ts
//
// Hand-written JSX-to-HTML-string runtime. Replaces React entirely for
// this site's static generator: no VDOM, no reconciliation, no
// dependencies. `jsx()`/`jsxs()` build a plain node tree; `render()`
// walks it once into a final HTML string. Wired up via tsconfig
// `jsxImportSource` in a later task (T3) — until then callers invoke
// `jsx()`/`jsxs()` directly, as this module's own tests do.
//
// Escaping is the security boundary: every text child, and every
// attribute value, is escaped by default. `raw()` is the one sanctioned
// bypass (needed for the site's JSON-LD block). `Html` is branded as an
// object carrying an unforgeable symbol key that only `raw()` can create
// — a plain `string` structurally can never satisfy it, so `render()`
// can tell "already-safe HTML" apart from "text that still needs
// escaping" at runtime, and a value can never be escaped twice just by
// being re-embedded as someone else's child.

const HTML_TAG = Symbol("html");
const ELEMENT_TAG = Symbol("element");

export type Html = { readonly [HTML_TAG]: string };

type Key = string | number;
type ComponentFn<P = Props> = (props: P) => Child;
type Primitive = string | number | boolean | null | undefined;
export type Child = Primitive | Html | VNode | readonly Child[];
type Props = { children?: Child; [prop: string]: unknown };

interface VNode {
  readonly [ELEMENT_TAG]: true;
  readonly type: string | ComponentFn<Props>;
  readonly props: Props;
}

export namespace JSX {
  export type Element = VNode;
  // Permissive for now: any tag name, any prop bag. Tightening this to
  // the real HTML element/attribute spec is future work, not T2's job.
  export interface IntrinsicElements {
    [tagName: string]: Record<string, unknown>;
  }
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "source", "track", "wbr",
]);

const PROP_NAME_MAP: Record<string, string> = {
  className: "class",
  htmlFor: "for",
};

// Whitespace, `/ > = " '`, and control chars would all let a crafted
// prop name break out of an attribute and inject new markup — this is
// the injection boundary, so reject rather than try to escape a name.
const INVALID_ATTR_NAME = /[\s/>="'\u0000-\u001f\u007f]/;

export function raw(html: string): Html {
  return { [HTML_TAG]: html } as Html;
}

// Generic over the props type so a component declaring its own shape
// (`(props: { title: string }) => ...`, which every page component does)
// type-checks at the call site. Widening to the internal `Props` bag is
// the one unavoidable cast, contained here: `render` only ever reads
// props back out through the same component that declared them.
//
// `key` exists only for automatic-JSX-runtime signature compatibility —
// this runtime never reconciles, so it is accepted and discarded.
export function jsx<P extends object>(
  type: string | ComponentFn<P>,
  props: P,
  _key?: Key,
): VNode {
  return {
    [ELEMENT_TAG]: true,
    type: type as string | ComponentFn<Props>,
    props: props as Props,
  };
}

export const jsxs = jsx;

export const Fragment: ComponentFn = (props) => props.children ?? null;

export function render(node: Child): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "number") return String(node);
  if (typeof node === "string") return escapeText(node);
  if (Array.isArray(node)) return node.map(render).join("");
  if (isHtml(node)) return node[HTML_TAG];

  const { type, props } = node as VNode;
  if (typeof type === "function") return render(type(props));
  return renderTag(type, props);
}

function renderTag(tag: string, props: Props): string {
  const { children, ...attrs } = props;
  const isVoid = VOID_ELEMENTS.has(tag);
  if (isVoid && children !== undefined) {
    throw new Error(`Void element <${tag}> cannot have children`);
  }
  const attrString = renderAttrs(attrs);
  if (isVoid) return `<${tag}${attrString}>`;
  return `<${tag}${attrString}>${render(children)}</${tag}>`;
}

function renderAttrs(attrs: Record<string, unknown>): string {
  let out = "";
  for (const [rawName, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    const name = PROP_NAME_MAP[rawName] ?? rawName;
    if (INVALID_ATTR_NAME.test(name)) {
      throw new Error(`Invalid attribute name: ${JSON.stringify(name)}`);
    }
    out += value === true ? ` ${name}` : ` ${name}="${escapeAttr(String(value))}"`;
  }
  return out;
}

function isHtml(node: object): node is Html {
  return HTML_TAG in node;
}

function escapeText(text: string): string {
  return text.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}
