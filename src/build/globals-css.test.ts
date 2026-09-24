// src/build/globals-css.test.ts
//
// Source-level guards on app/globals.css for rules whose values were
// measured (contrast) rather than eyeballed. Ratios computed with
// .claude/skills/cominorsa-run/assets/contrast-check.mjs.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const SOURCE = await Bun.file(join(import.meta.dirname, "..", "..", "app", "globals.css")).text();
/** The stylesheet without comments (they may quote old values). */
const CSS = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "");

/** Body of the first rule whose selector list is exactly `selector`. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  const match = CSS.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`rule not found: ${selector}`);
  return match[1]!;
}

describe("consultation form fields (P7, audit P2-7)", () => {
  // Was rgba(11, 35, 24, 0.22): 1.58:1 on --white — below the 3:1 WCAG
  // 1.4.11 minimum for a field boundary. --copper-ink: 9.51:1 on the
  // field's --white, 8.94:1 on the form's --paper.
  test("field borders use the solid --copper-ink token", () => {
    const body = ruleBody(".consultation-form input,\n.consultation-form select,\n.consultation-form textarea");
    expect(body).toContain("border: 1px solid var(--copper-ink);");
    expect(body).not.toContain("rgba(");
  });

  // Focus adds a visible 2px outline (8.94:1 on --paper), not just a
  // colour change of an already-dark border.
  test("focus-visible draws a 2px --copper-ink outline", () => {
    const body = ruleBody(
      ".consultation-form input:focus-visible,\n.consultation-form select:focus-visible,\n.consultation-form textarea:focus-visible",
    );
    expect(body).toContain("outline: 2px solid var(--copper-ink);");
    expect(body).toContain("outline-offset: 2px;");
  });
});

describe("hero reveal (P9, audit P2-9)", () => {
  // The h1 is the LCP element. A clip-path mask starting at
  // inset(0 0 100% 0) kept it unpainted for the whole 900 ms reveal; the
  // reveal now only moves/fades it from an already-visible state.
  test("the reveal never hides the h1 lines behind clip-path or opacity 0", () => {
    const rule = ruleBody(".hero h1 .reveal-line");
    expect(rule).not.toContain("clip-path");
    const keyframes = CSS.match(/@keyframes reveal-up\s*\{([\s\S]*?\}\s*)\}/);
    expect(keyframes).not.toBeNull();
    expect(keyframes![1]).not.toContain("clip-path");
    expect(keyframes![1]).not.toMatch(/opacity:\s*0\s*;/);
    expect(keyframes![1]).toContain("transform:");
  });

  test("reduced motion still collapses the reveal duration", () => {
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{[^}]*--dur-reveal: 1ms;/);
  });
});

describe("text wrapping (P9)", () => {
  test("headings balance and paragraphs wrap pretty, site-wide", () => {
    expect(ruleBody("h1,\nh2,\nh3")).toContain("text-wrap: balance;");
    expect(ruleBody("p,\nli,\nblockquote")).toContain("text-wrap: pretty;");
  });
});

// P9 (audit P2-15): colours come from :root tokens. Translucent colours
// use a palette colour's channel token, e.g. rgb(var(--white-rgb) / 0.48).
describe("colour tokens (P9, audit P2-15)", () => {
  /** Declarations outside every :root block. */
  const outsideRoot = CSS.replace(/:root\s*\{[^}]*\}/g, "");
  const RAW_COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(\s*\d[^)]*\)/gi;

  // Remaining literals, each a documented token gap (not palette hues):
  // Preflight's transparent, the hero gradient's greens, the hero card's
  // copper-orange glow and contour line, the hero card shadow,
  // and the form's neutral drop shadow.
  const ALLOWED = new Map<string, number>([
    ["#0000", 3],
    ["rgba(0,23,19,0.99)", 1],
    ["rgba(0,50,35,0.98)", 1],
    ["rgba(0,77,48,0.96)", 1],
    ["rgba(16,39,33,0.25)", 1],
    ["rgba(198,106,61,0.16)", 1],
    ["rgba(0,0,0,0.2)", 1],
  ]);

  test("no raw colour literal outside :root beyond the documented token gaps", () => {
    const found = new Map<string, number>();
    for (const [match] of outsideRoot.matchAll(RAW_COLOUR)) {
      const key = match.toLowerCase().replace(/\s+/g, "");
      found.set(key, (found.get(key) ?? 0) + 1);
    }
    expect(Object.fromEntries(found)).toEqual(Object.fromEntries(ALLOWED));
  });

  test("the retired off-palette bases are gone everywhere", () => {
    expect(CSS).not.toMatch(/255,\s*253,\s*247/);
    expect(CSS).not.toMatch(/243,\s*207,\s*89/);
  });

  test("every channel token matches its palette colour", () => {
    const root = CSS.match(/:root\s*\{([^}]*)\}/)![1]!;
    const channels = [...root.matchAll(/--([a-z-]+)-rgb:\s*(\d+) (\d+) (\d+);/g)];
    expect(channels.map((m) => m[1])).toEqual(["ink", "copper", "copper-light", "white", "line"]);
    for (const [, name, r, g, b] of channels) {
      if (name === "line") {
        expect(root).toContain(`--line: rgb(var(--line-rgb) / 0.18);`);
        continue;
      }
      const hex = root.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6});`, "i"))![1]!;
      expect([r, g, b].map(Number)).toEqual([0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)));
    }
  });
});

describe("real Piura contours as the site-wide thread (landing-craft T4)", () => {
  const MASK = "url(/piura-contours.svg)";

  test("the hero draws the generated contour SVG, not the radial-gradient stand-in", () => {
    const body = ruleBody(".hero-contours");
    expect(body).toContain(`mask-image: ${MASK}`);
    expect(body).toContain("background-color: var(--copper-light);");
    expect(body).not.toContain("repeating-radial-gradient");
  });

  test("the contact section reuses the same contours instead of its own rings", () => {
    expect(ruleBody(".contact")).not.toContain("repeating-radial-gradient");
    expect(ruleBody(".contact::before")).toContain(`mask-image: ${MASK}`);
  });
});

describe("geological strata (landing-craft T5)", () => {
  test("each destination surface paints its last band with that section's token", () => {
    for (const [variant, token] of [
      ["paper", "--paper"],
      ["ink", "--ink"],
      ["cream", "--cream"],
      ["deep", "--ink-deep"],
      ["sand", "--sand"],
    ]) {
      expect(ruleBody(`.strata--to-${variant}`)).toContain(`--strata-to: var(${token});`);
    }
  });

  test("the divider overlaps the previous section instead of adding height", () => {
    const body = ruleBody(".strata");
    expect(body).toContain("margin-top: calc(-1 * var(--strata-h));");
    expect(body).toContain("pointer-events: none;");
  });
});

describe("CSS-only motion (landing-craft T6)", () => {
  /** Body of the first block opened by `prelude` (balanced braces). */
  function blockBody(prelude: string): string {
    const start = CSS.indexOf(prelude);
    if (start < 0) throw new Error(`block not found: ${prelude}`);
    let depth = 0;
    const open = CSS.indexOf("{", start);
    for (let i = open; i < CSS.length; i++) {
      if (CSS[i] === "{") depth++;
      else if (CSS[i] === "}" && --depth === 0) return CSS.slice(open + 1, i);
    }
    throw new Error(`unbalanced block: ${prelude}`);
  }

  test("cross-document view transitions are opt-in for motion-tolerant users only", () => {
    const block = blockBody("@media (prefers-reduced-motion: no-preference) {\n  @view-transition");
    expect(block).toMatch(/@view-transition\s*\{\s*navigation:\s*auto;\s*\}/);
    expect(CSS.match(/@view-transition/g)?.length).toBe(1);
  });

  test("the header keeps its place across page navigations", () => {
    expect(ruleBody(".site-header")).toContain("view-transition-name: site-header;");
  });

  test("scroll-driven reveals live behind @supports and no-preference", () => {
    const supports = blockBody("@supports (animation-timeline: view()) {\n  @media (prefers-reduced-motion: no-preference) {\n    .section-kicker");
    expect(supports).toContain("animation-name: rise-in;");
    expect(supports).toContain("animation-timeline: view();");
  });

  test("the reveal never targets the hero, so the LCP headline is never hidden", () => {
    const supports = blockBody("@supports (animation-timeline: view()) {\n  @media (prefers-reduced-motion: no-preference) {\n    .section-kicker");
    expect(supports).not.toContain(".hero");
    expect(supports).not.toContain("h1");
    expect(supports).not.toContain("reveal-line");
  });
});
