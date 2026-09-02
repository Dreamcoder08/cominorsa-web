// Helper compartido para los tests QA de COMINORSA-web.
// Renderiza la página vía el worker de Vinext y devuelve el HTML.

/**
 * Render the production worker in-process and return the Response.
 * @param {string} pathname
 * @param {Record<string, string>} [extraHeaders]
 */
export async function render(pathname = "/", extraHeaders = {}) {
 const workerUrl = new URL("../../dist/server/index.js", import.meta.url);
 workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
 const { default: worker } = await import(workerUrl.href);

 return worker.fetch(
  new Request(`http://localhost${pathname}`, {
   headers: { accept: "text/html", ...extraHeaders },
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

/**
 * Render and return the response + parsed HTML body.
 * @param {string} [pathname]
 */
export async function fetchHtml(pathname = "/") {
 const response = await render(pathname);
 const status = response.status;
 const headers = Object.fromEntries(response.headers.entries());
 // Always return the body; tests can assert on error pages too.
 const html = await response.text();
 return { status, headers, html };
}

/**
 * Extract the content of <meta name="..."> tags.
 * @param {string} html
 * @param {string} name
 */
export function metaContent(html, name) {
 const re = new RegExp(
  `<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`,
  "i",
 );
 const m = html.match(re);
 return m ? m[1] : null;
}

/**
 * Extract <meta property="og:..."> content.
 * @param {string} html
 * @param {string} property
 */
export function ogContent(html, property) {
 const re = new RegExp(
  `<meta[^>]+property=["']${property}["'][^>]*content=["']([^"']*)["']`,
  "i",
 );
 const m = html.match(re);
 return m ? m[1] : null;
}
