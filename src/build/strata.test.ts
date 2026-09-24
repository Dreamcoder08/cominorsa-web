// src/build/strata.test.ts
//
// landing-craft T5: geological strata between home sections.

import { describe, expect, test } from "bun:test";
import { render } from "../html/jsx-runtime";
import { Strata } from "./strata";

describe("Strata", () => {
  const html = render(Strata({ to: "ink" }));

  test("is a decorative, hidden divider tagged with its destination surface", () => {
    expect(html.startsWith('<div class="strata strata--to-ink" aria-hidden="true">')).toBe(true);
  });

  test("draws four stacked bands in a stretched SVG, colored only by CSS classes", () => {
    expect(html).toContain('preserveAspectRatio="none"');
    for (const band of ["s1", "s2", "s3", "s4"]) {
      expect(html).toContain(`<polygon class="${band}"`);
    }
    expect(html.split("<polygon").length - 1).toBe(4);
    expect(html).not.toMatch(/fill="|#[0-9a-f]{3,6}\b/i);
  });
});
