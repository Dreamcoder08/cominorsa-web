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
