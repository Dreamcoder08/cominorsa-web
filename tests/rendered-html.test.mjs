import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Tests para COMINORSA-web: validan que el worker de Vinext renderiza la
 * página de inicio correctamente con el contenido real del proyecto
 * (consultoría minera y ambiental, IGAFOM, REINFO, etc.).
 *
 * El template original de Codex contenía assertions para un starter
 * "loading skeleton" que este proyecto no implementa, por lo que se
 * reescribieron para reflejar el contenido real de la landing page.
 */

async function render() {
 const workerUrl = new URL("../dist/server/index.js", import.meta.url);
 workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
 const { default: worker } = await import(workerUrl.href);

 return worker.fetch(
  new Request("http://localhost/", {
   headers: { accept: "text/html" },
  }),
  {
   ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
   },
  },
  {
   waitUntil() {},
   passThroughOnException() {},
  },
 );
}

test("worker returns 200 with HTML for the landing page", async () => {
 const response = await render();
 assert.equal(response.status, 200);
 const contentType = response.headers.get("content-type") ?? "";
 assert.match(contentType, /^text\/html\b/i);
});

test("landing page renders the COMINORSA brand and core services", async () => {
 const response = await render();
 const html = await response.text();

 // Brand
 assert.match(html, /COMINORSA/);
 // Hero copy
 assert.match(html, /T[ée]cnica que impulsa/);
 // Core mining service topics
 assert.match(html, /IGAFOM/);
 assert.match(html, /REINFO/);
 // Spanish UI label
 assert.match(html, /Ir al contenido/);
});

test("landing page has the consultation form CTA", async () => {
 const response = await render();
 const html = await response.text();
 assert.match(html, /Consulta S\/50|Consulta profesional|WhatsApp/);
});
