// src/build/document.test.ts
//
// Minimal `<head>` shell for the static build. Full metadata/JSON-LD
// parity with `app/layout.tsx` (`generateMetadata`, OG/Twitter tags,
// favicons, theme color) is T4 — this only covers what's "correct
// enough to ship a page": charset, viewport, title, description,
// canonical, and the built stylesheet link.

import { describe, expect, test } from "bun:test";
import { renderDocument } from "./document";
import { raw } from "../html/jsx-runtime";

const html = renderDocument({
  title: "Seguridad minera y consultoría mensual | COMINORSA",
  description: "Planes de Seguridad y Salud Ocupacional.",
  canonicalPath: "/seguridad-minera/",
  cssHref: "/assets/globals-abc123.css",
  children: raw("<main><p>body</p></main>"),
});

describe("renderDocument", () => {
  test("starts with a doctype and the Spanish lang attribute", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="es">');
  });

  test("declares utf-8 charset before any other head content", () => {
    const headStart = html.indexOf("<head>");
    const charsetIndex = html.indexOf('<meta charset="utf-8">');
    expect(charsetIndex).toBeGreaterThan(headStart);
    expect(charsetIndex).toBeLessThan(html.indexOf("<title>"));
  });

  test("declares a responsive viewport", () => {
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
    );
  });

  test("sets the exact page title", () => {
    expect(html).toContain(
      "<title>Seguridad minera y consultoría mensual | COMINORSA</title>",
    );
  });

  test("sets the meta description, escaped", () => {
    expect(html).toContain(
      '<meta name="description" content="Planes de Seguridad y Salud Ocupacional.">',
    );
  });

  test("sets an absolute canonical URL under the production domain", () => {
    expect(html).toContain(
      '<link rel="canonical" href="https://cominorsa.com.pe/seguridad-minera/">',
    );
  });

  test("links the hashed stylesheet passed in", () => {
    expect(html).toContain(
      '<link rel="stylesheet" href="/assets/globals-abc123.css">',
    );
  });

  test("renders children inside body, unescaped when passed as raw()", () => {
    expect(html).toContain("<body><main><p>body</p></main></body>");
  });

  test("escapes an unsafe title instead of injecting markup", () => {
    const unsafe = renderDocument({
      title: '</title><script>alert(1)</script>',
      description: "d",
      canonicalPath: "/x/",
      cssHref: "/assets/x.css",
      children: raw("<p></p>"),
    });
    expect(unsafe).not.toContain("<script>alert(1)</script>");
    expect(unsafe).toContain(
      "&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
});
