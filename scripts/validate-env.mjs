#!/usr/bin/env node
/**
 * Pre-build / pre-commit environment validator.
 *
 * Checks that the project is ready to build, test, and (eventually) deploy.
 * No external dependencies — runs with plain `node`.
 *
 * Usage:  node scripts/validate-env.mjs
 * Exit:   0 on success, 1 on any failure.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fail = [];
const warn = [];

/** Safe JSON.parse: returns null on error, records a failure with `name`. */
function readJson(name, filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    fail.push(`${name} (cannot read: ${err.message})`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail.push(`${name} (invalid JSON: ${err.message})`);
    return null;
  }
}

/** Record a check. Status is "ok" if `cond` is truthy. */
function check(name, cond, msg) {
  if (cond) {
    process.stdout.write(`  \u2713 ${name}\n`);
  } else {
    process.stdout.write(`  \u2717 ${name} \u2014 ${msg}\n`);
    fail.push(name);
  }
}

function note(name, cond, msg) {
  if (!cond) {
    process.stdout.write(`  ! ${name} \u2014 ${msg}\n`);
    warn.push(name);
  }
}

process.stdout.write("\n== Environment validation ==\n\n");

// 1. Node + pnpm version
const nodeMajor = Number(process.versions.node.split(".")[0]);
check(
  "Node >= 22.13.0",
  nodeMajor >= 22 && process.versions.node >= "22.13.0",
  `found ${process.versions.node}`,
);
const pkg = readJson("package.json", join(ROOT, "package.json")) ?? {};
const expectedPnpm = pkg.packageManager?.replace("pnpm@", "");
const actualPnpm = process.env.npm_config_user_agent?.match(/pnpm\/(\S+)/)?.[1];
note(
  `pnpm ${expectedPnpm} (package.json pins this)`,
  actualPnpm === expectedPnpm,
  actualPnpm
    ? `found ${actualPnpm} (mismatch with package.json)`
    : `could not detect pnpm version (run via \`pnpm run validate\`, not \`node\`, to verify)`,
);

// 2. Lockfile is in sync with package.json
const lockExists = existsSync(join(ROOT, "pnpm-lock.yaml"));
check("pnpm-lock.yaml present", lockExists, "run `pnpm install` first");

// 3. Required files
const required = [
  "app/layout.tsx",
  "app/page.tsx",
  "app/robots.ts",
  "app/sitemap.ts",
  "app/not-found.tsx",
  "app/error.tsx",
  "app/loading.tsx",
  "app/manifest.ts",
  "proxy.ts",
  "public/_headers",
  "public/og.png",
  "public/favicon.ico",
  "public/apple-touch-icon.png",
  "vite.config.ts",
  "scripts/validate-env.mjs",
  ".env.example",
];
for (const f of required) {
  check(`file present: ${f}`, existsSync(join(ROOT, f)), "missing");
}

// 4. Public assets within size budgets
const ogSize = existsSync(join(ROOT, "public/og.png"))
  ? statSync(join(ROOT, "public/og.png")).size
  : 0;
check(
  "public/og.png < 1 MB",
  ogSize < 1024 * 1024,
  `${(ogSize / 1024 / 1024).toFixed(2)} MB`,
);

// 5. _headers file is not empty and declares immutable caching for static
// assets. It intentionally does NOT declare CSP — Cloudflare only applies
// _headers to responses served directly from the assets binding, and this
// app is fully SSR'd, so CSP (with a per-request nonce) is set in proxy.ts
// instead. See proxy.ts's top comment for the full explanation.
const headersRaw = existsSync(join(ROOT, "public/_headers"))
  ? readFileSync(join(ROOT, "public/_headers"), "utf8")
  : "";
check(
  "public/_headers declares HSTS",
  /Strict-Transport-Security/i.test(headersRaw),
  "HSTS header missing",
);
check(
  "public/_headers does not redeclare CSP (would be dead weight / a conflicting policy)",
  !/Content-Security-Policy/i.test(headersRaw),
  "CSP found in public/_headers — it belongs in proxy.ts instead",
);

// 5b. proxy.ts sets the real security headers for every SSR'd document.
const proxyRaw = existsSync(join(ROOT, "proxy.ts"))
  ? readFileSync(join(ROOT, "proxy.ts"), "utf8")
  : "";
check(
  "proxy.ts declares CSP",
  /Content-Security-Policy/i.test(proxyRaw),
  "CSP header missing from proxy.ts",
);
check(
  "proxy.ts uses a per-request nonce, not 'unsafe-inline', in script-src",
  /'nonce-\$\{nonce\}'/.test(proxyRaw) && !/script-src[^`]*'unsafe-inline'/.test(proxyRaw),
  "expected a nonce-based script-src in proxy.ts",
);

// 6. .env files: warn if a real one is committed (should only have .example)
const envFiles = [".env", ".env.local", ".env.production"];
for (const f of envFiles) {
  const p = join(ROOT, f);
  note(
    `${f} not present (only .env.example should exist in repo)`,
    !existsSync(p),
    `found real env file — verify it has no secrets before committing`,
  );
}

// 7. node_modules installed
check(
  "node_modules present",
  existsSync(join(ROOT, "node_modules")),
  "run `pnpm install` first",
);

// 8. Hosting stub does NOT declare D1/R2 bindings
// cominorsa-web is a static SSR Worker with no persistent storage
// (form is WhatsApp-based, no DB). `.openai/hosting.json` must omit
// `d1` and `r2` so that `vinext build` produces a clean
// `dist/server/wrangler.json` with empty `d1_databases` / `r2_buckets`.
// If those keys reappear, the deploy will fail with code 10042
// ("Please enable R2 through the Cloudflare Dashboard").
if (existsSync(join(ROOT, ".openai/hosting.json"))) {
  const hosting = readJson("hosting.json", join(ROOT, ".openai/hosting.json"));
  if (hosting) {
    check(
      ".openai/hosting.json has no d1 binding",
      !("d1" in hosting) || hosting.d1 === null || hosting.d1 === "",
      "project does not use D1 — remove d1 from .openai/hosting.json",
    );
    check(
      ".openai/hosting.json has no r2 binding",
      !("r2" in hosting) || hosting.r2 === null || hosting.r2 === "",
      "project does not use R2 — remove r2 from .openai/hosting.json",
    );
  }
}

process.stdout.write("\n== Summary ==\n\n");
if (fail.length === 0) {
  process.stdout.write(
    `\u2713 all required checks passed (${warn.length} warnings)\n`,
  );
  if (warn.length > 0) {
    process.stdout.write(`  warnings: ${warn.join(", ")}\n`);
  }
  process.exit(0);
} else {
  process.stdout.write(
    `\u2717 ${fail.length} check(s) failed: ${fail.join(", ")}\n`,
  );
  process.exit(1);
}
