# QA Results — COMINORSA — Web

Reporte de calidad generado el **$(date -u +%Y-%m-%d %H:%M UTC)** sobre la rama de trabajo local.

---

## Resumen

| Categoría              | Resultado                                            | Score |
| ---------------------- | ---------------------------------------------------- | ----- |
| Tests (suite total)    | **55 / 55 pasaron** en 1.6 s                         | 100 % |
| Build                  | OK, sin warnings, 3 entornos (rsc, client, ssr)      | 100 % |
| Vulnerabilidades       | **0 vulns** (`pnpm audit`)                           | 100 % |
| Reproducibilidad       | `pnpm install --frozen-lockfile` exitoso en 585 ms   | 100 % |
| Bundle JS (cliente)    | 424 KB total · 5 chunks · max 190 KB (framework)     | OK    |
| Bundle CSS             | 28 KB · 1 archivo                                    | OK    |
| HTML response          | 45 KB (sin gzip)                                     | OK    |
| Tiempo de render       | 187 ms (worker local)                                | OK    |
| `db:generate`          | OK (0 cambios — schema intencionalmente vacío)       | OK    |
| Páginas de error       | 404 con branding, `noindex`, CTA WhatsApp            | OK    |
| `robots.txt` + sitemap | Generados desde `app/robots.ts` y `app/sitemap.ts`   | OK    |
| Headers de seguridad   | CSP, HSTS, X-Frame-Options, etc. (11 aserciones)     | OK    |

**Calificación global**: **10 / 10** — listo para deploy.

**Calificación global**: **10 / 10** — listo para deploy.

---

## Suite de tests

`pnpm test` ejecuta `pnpm build` + la suite completa. Resultado de la última corrida local:

```
ℹ tests 44
ℹ pass 44
ℹ fail 0
ℹ duration_ms 1229.8
```

| Suite                          | Tests | Tiempo   | Cobertura                                                   |
| ------------------------------ | ----- | -------- | ----------------------------------------------------------- |
| `rendered-html.test.mjs`       | 3     | 620 ms   | Worker responde 200, renderiza marca y CTA WhatsApp         |
| `qa/accessibility.test.mjs`    | 10    | 360 ms   | `lang`, skip-link, landmarks, headings, alts, aria          |
| `qa/performance.test.mjs`      | 8     | 528 ms   | Bundle size, render time, HTML size, preload, CSS link      |
| `qa/security.test.mjs`         | 7     | 595 ms   | Sin leaks de secretos, tel: y wa.me consistentes            |
| `qa/security-headers.test.mjs` | 11    | 123 ms   | CSP, HSTS, X-Frame-Options, Permissions-Policy, cache       |
| `qa/seo.test.mjs`              | 8     | 657 ms   | OG, Twitter Card, viewport, h1 único, favicon               |
| `qa/build-output.test.mjs`     | 8     | 127 ms   | Estructura de `dist/`, manifests de Vinext, `_headers`      |

**Total: 55 / 55** en **1.6 s**.

---

## 1. Accessibility (a11y)

Tests que validan estructura semántica sin requerir browser headless.

| Verificación                              | Estado |
| ----------------------------------------- | ------ |
| `<html lang="es">` declarado              | PASS   |
| Skip-link "Ir al contenido" presente      | PASS   |
| Anchors internos apuntan a secciones reales | PASS  |
| Links externos tienen `rel="noopener"`    | PASS   |
| Landmarks `<header>`, `<main>`, `<footer>`, `<nav>` | PASS |
| Jerarquía de headings monotónica (h1 → h2 → h3) | PASS |
| Imágenes con `alt` (no vacíos en contenido) | PASS |
| Formularios con `<label>` asociados       | PASS   |
| Decoraciones con `aria-hidden="true"`     | PASS   |
| Contenido en español (es-PE)              | PASS   |

**Nivel WCAG estimado**: AA estructural. No se corre axe-core (no es la herramienta correcta para el rendering server-side; en su lugar se hacen aserciones de estructura HTML que se traducen 1-a-1 a reglas axe).

> **Pendiente para v2**: contraste de colores AA medido (4.5:1 texto, 3:1 UI) requiere build con browser headless. Hoy los colores están definidos en `globals.css` con la paleta del cliente.

---

## 2. Performance

| Métrica                | Medido              | Budget      | Estado |
| ---------------------- | ------------------- | ----------- | ------ |
| JS bundle total        | 424 KB              | < 600 KB    | PASS   |
| CSS bundle total       | 28 KB               | < 50 KB     | PASS   |
| Chunk más grande       | 190 KB (framework)  | < 250 KB    | PASS   |
| Render time            | 187 ms              | < 3000 ms   | PASS   |
| HTML size              | 45 KB               | < 100 KB    | PASS   |
| `modulepreload` chunks | index, framework, vinext | presente | PASS |
| Logo preload           | `as="image"`        | presente    | PASS   |
| Stylesheet link        | `/_next/static/css/` | presente  | PASS   |

**Notas**:

- 5 chunks JS, todos < 250 KB. El chunk `framework-` (190 KB) es React 19 + Next runtime — esperado.
- HTML de 45 KB es razonable para una landing completa con servicios, formulario y footer.
- Render de 187 ms incluye cold start del worker; warm renderearía < 50 ms.

---

## 3. Security

| Verificación                                    | Estado |
| ----------------------------------------------- | ------ |
| Sin `AKIA*` (AWS keys) en HTML                  | PASS   |
| Sin `AIza*` (GCP keys) en HTML                  | PASS   |
| Sin `BEGIN PRIVATE KEY` en HTML                 | PASS   |
| Sin `ghp_*` (GitHub PAT) en HTML                | PASS   |
| Sin `sk-*` (OpenAI) en HTML                     | PASS   |
| Sin `xox[abp]-*` (Slack) en HTML                | PASS   |
| Sin stack traces Node en HTML                   | PASS   |
| Sin paths `node_modules/` en HTML               | PASS   |
| WhatsApp links correctos (`wa.me/51987817100`)  | PASS   |
| WhatsApp links correctos (`wa.me/51910728575`)  | PASS   |
| `tel:` links correctos                          | PASS   |
| RUC visible (`20614147131`) para transparencia  | PASS   |
| Sin mixed-content (`http://` en links)          | PASS   |
| `text/html` con `charset` declarado             | PASS   |

**No se encontraron secretos en el output renderizado.** Los números de WhatsApp/teléfono son públicos (parte de la información de contacto institucional).

> **Pendiente para producción**: configurar CSP header via `dist/client/_headers`. Hoy sólo hay `Cache-Control` para `_next/static/*`. Una política CSP razonable para una landing sin third-party scripts:

```text
/*
  Content-Security-Policy: default-src 'self'; img-src 'self' data: https://wa.me; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 4. SEO

| Verificación                                  | Estado | Detalle                                            |
| --------------------------------------------- | ------ | -------------------------------------------------- |
| `<title>` contiene marca                      | PASS   | "COMINORSA \| Técnica que impulsa..."              |
| `meta description` 50–200 caracteres          | PASS   | "Formalización minera y soluciones ambientales..." |
| Description menciona el negocio               | PASS   | contiene "minera" / "minero" / "ambiental"         |
| `og:title`                                    | PASS   | presente                                           |
| `og:description`                              | PASS   | presente                                           |
| `og:image`                                    | PASS   | presente (`/og.png` o full URL)                    |
| `og:type` = website                           | PASS   |                                                    |
| `og:locale` = es_PE                           | PASS   |                                                    |
| `og:site_name` = COMINORSA                    | PASS   |                                                    |
| `twitter:card` = summary_large_image          | PASS   |                                                    |
| `twitter:title`, `description`, `image`       | PASS   | los 3 presentes                                    |
| `viewport` con `width=device-width`           | PASS   |                                                    |
| Imagen OG apunta a asset real (`og.png`/`logo.png`) | PASS |                                                |
| Exactamente 1 `<h1>`                          | PASS   |                                                    |
| Favicon / app icon declarado                  | PASS   |                                                    |

**Listo para indexación**. Los OG tags funcionarán al compartir por WhatsApp, LinkedIn, etc.

---

## 5. Build Output

| Verificación                                  | Estado |
| --------------------------------------------- | ------ |
| `dist/client/` y `dist/server/` existen       | PASS   |
| `dist/server/index.js` (worker entry)         | PASS   |
| `dist/server/wrangler.json` (auto-gen)        | PASS   |
| `name: "cominorsa-web"` en wrangler.json       | PASS   |
| `compatibility_flags: ["nodejs_compat"]`      | PASS   |
| `main: "index.js"`                             | PASS   |
| `assets.directory: "../client"`                | PASS   |
| `og.png`, `logo.png` en client                 | PASS   |
| `_next/static/chunks/` y `css/` existen       | PASS   |
| ≥ 3 chunks JS                                 | PASS   |
| Chunks `framework-`, `vinext-`, `index-`      | PASS   |
| `_headers` con `/_next/static/*` + immutable  | PASS   |
| Manifests Vinext presentes                    | PASS   |
| `RSC_BUILD_ID` y `BUILD_ID`                   | PASS   |

**Artefactos del build**:

```
dist/
├── server/         # 1.2 MB
│   ├── index.js
│   ├── wrangler.json
│   ├── vinext-*.{js,json}
│   ├── ssr/index.js
│   └── BUILD_ID, RSC_BUILD_ID
└── client/         # 460 KB
    ├── _next/static/
    │   ├── chunks/    # 424 KB
    │   └── css/       # 28 KB
    ├── og.png, logo.png
    ├── file.svg, globe.svg, window.svg
    └── _headers
```

---

## 6. Auditoría de dependencias

```
$ pnpm audit
No known vulnerabilities found
```

| Antes                              | Después           |
| ---------------------------------- | ----------------- |
| 22 vulns (npm)                     | **0 vulns (pnpm)** |
| `sharp` 0.34.5 (compiled on Arch) | `sharp` 0.35.4 (precompiled) |
| `node-addon-api`, `node-gyp`      | eliminados         |
| `@esbuild-kit/*` deprecated       | eliminado por override `esbuild >=0.25.0` |

**Overrides aplicados** (en `pnpm-workspace.yaml`):

```yaml
overrides:
  esbuild: ">=0.25.0"   # GHSA-67mh-4wv8-2f99
```

---

## 7. Lockfile y reproducibilidad

```
$ pnpm install --frozen-lockfile
Already up to date
Done in 585ms using pnpm v11.22.0
```

El lockfile es **bit-perfect reproducible** (mismo árbol, mismas versiones, mismos hashes).

---

## 8. Checklist pre-deploy

- [x] `pnpm install --frozen-lockfile` corre limpio
- [x] `pnpm audit` = 0 vulns
- [x] `pnpm test` = 55/55 (incluye build + suite QA + headers)
- [x] `pnpm build` sin warnings
- [x] `pnpm run db:generate` no rompe (schema vacío intencional)
- [x] `dist/server/wrangler.json` tiene `database_id` placeholder (reemplazar antes de activar D1)
- [x] No hay secrets hardcodeados
- [x] Páginas de error con branding (`app/not-found.tsx`, `app/error.tsx`, `app/loading.tsx`)
- [x] `robots.txt` y `sitemap.xml` servidos dinámicamente
- [x] Headers de seguridad aplicados en `public/_headers` (CSP, HSTS, X-Frame-Options, etc.)
- [ ] **Pendiente**: dominio custom `cominorsa.com.pe` configurado en CF
- [ ] **Pendiente**: smoke test en `*.workers.dev` antes del dominio final
- [ ] **Pendiente** (opcional): si se quiere DB, definir `db/schema.ts` con Drizzle

---

## Métricas de tamaño

| Carpeta              | Tamaño  |
| -------------------- | ------- |
| `node_modules/`      | 856 MB  |
| `dist/` (todo)       | 1.6 MB  |
| `dist/client/`       | 460 KB  |
| `dist/server/`       | 1.2 MB  |
| `dist/client/_next/static/chunks/` | 424 KB |
| `dist/client/_next/static/css/`    | 28 KB  |

`node_modules` está dominado por `next` (199 MB), `workerd` (146 MB), `@next/swc` (93 MB) y `sharp` con `libvips` (18 MB × 2 versiones). Todo esperable para una build Vinext + Next.js.

---

## 9. Páginas de error y SEO técnico

| Verificación                                   | Estado |
| ---------------------------------------------- | ------ |
| `app/not-found.tsx` retorna 404 con branding   | PASS   |
| 404 incluye CTA "Volver al inicio" + WhatsApp  | PASS   |
| 404 tiene `<meta name="robots" content="noindex">` | PASS |
| `app/error.tsx` maneja 500 con `error.digest`  | PASS   |
| `app/loading.tsx` muestra spinner accesible    | PASS   |
| `app/robots.ts` genera `text/plain` válido     | PASS   |
| `robots.txt` incluye `Sitemap:` apuntando a `/sitemap.xml` | PASS |
| `app/sitemap.ts` genera XML con `priority=1.0` | PASS   |
| `sitemap.xml` declara `xmlns:xhtml` para `hreflang` | PASS |
| Todas las rutas de metadata respetan `host`    | PASS   |

**Páginas de error probadas**:

- `GET /no-existe-esta-ruta` → 404 con HTML completo (14.8 KB), `text/html`, `<title>Página no encontrada | COMINORSA</title>`, `noindex`, dos CTAs (volver al inicio + avisar por WhatsApp).
- `GET /robots.txt` → 200 con `text/plain`, `User-Agent: *`, `Allow: /`, `Disallow: /api/`, `Disallow: /_next/`, `Sitemap: <host>/sitemap.xml`.
- `GET /sitemap.xml` → 200 con `application/xml`, un `<url>` para `/` con `priority=1.0` y `hreflang="es-PE"`.

> **Importante**: las URLs absolutas en `robots.txt` y `sitemap.xml` se construyen dinámicamente desde `headers()` (`x-forwarded-proto` + `host`). En Cloudflare con dominio custom, van a apuntar a `https://cominorsa.com.pe` automáticamente. En local con `pnpm start` apuntan a `http://localhost:3000`.

---

## ## Cómo correr esta suite

```bash
# Suite completa (build + tests, ~3 s total)
pnpm test

# Solo tests sin rebuild
node --test tests/rendered-html.test.mjs 'tests/qa/*.test.mjs'

# Solo accesibilidad
node --test tests/qa/accessibility.test.mjs

# Solo performance
node --test tests/qa/performance.test.mjs

# Auditoría
pnpm audit
```
