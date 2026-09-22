/** @jsxImportSource ../html */
// src/build/document.tsx
//
// Minimal `<head>` document shell for the static build. Deliberately
// NOT full parity with `app/layout.tsx`'s `generateMetadata` — no
// OG/Twitter tags, favicons, theme-color, or the JSON-LD block (that's
// T4, and JSON-LD specifically needs the `raw()` treatment documented
// as gap G2 in the feature doc). This is "correct enough to ship a
// page": charset, viewport, title, description, canonical, stylesheet.

import { render, type Child } from "../html/jsx-runtime";

const SITE_URL = "https://cominorsa.com.pe";

export type DocumentProps = {
  title: string;
  description: string;
  /** Absolute path from the site root, e.g. "/seguridad-minera/". */
  canonicalPath: string;
  /** Absolute path to the built, hashed stylesheet, e.g. "/assets/globals-abc123.css". */
  cssHref: string;
  children: Child;
};

function Document({ title, description, canonicalPath, cssHref, children }: DocumentProps) {
  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${SITE_URL}${canonicalPath}`} />
        <link rel="stylesheet" href={cssHref} />
      </head>
      <body>{children}</body>
    </html>
  );
}

export function renderDocument(props: DocumentProps): string {
  return `<!doctype html>${render(<Document {...props} />)}`;
}
