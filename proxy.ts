import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Security response headers live here, not in public/_headers.
 *
 * public/_headers is only applied by Cloudflare to responses served
 * directly from the static-assets binding (env.ASSETS.fetch). This app is
 * fully SSR'd — worker/index.ts hands every document request to vinext's
 * app-router handler, which returns its own Response — so _headers never
 * touched the actual HTML pages. This proxy runs inside that same request
 * pipeline and is the one place that reliably sets headers on every page.
 */
export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const csp = [
    "default-src 'self'",
    "img-src 'self' data: https://wa.me https://*.whatsapp.net https://*.fbcdn.net",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `script-src 'self' 'nonce-${nonce}'`,
    "connect-src 'self' https://wa.me https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://wa.me",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-XSS-Protection", "0");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_vinext|favicon.ico).*)"],
};
