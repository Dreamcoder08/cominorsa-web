# COMINORSA — Web

Landing page institucional de **COMINORSA S.A.C.**, consultoría minera y ambiental desde Piura, Perú.

- **Stack**: Next.js 16 App Router + React 19, ejecutado por [Vinext](https://github.com/cloudflare/vinext) sobre Cloudflare Workers.
- **Package manager**: pnpm 11 con lockfile reproducible.
- **A11y**: HTML semántico en español, lang declarado, skip-link, landmarks, jerarquía de headings monotónica.
- **SEO**: Open Graph y Twitter Card completos, viewport responsive, `og.png` preloadeado.

---

## Quickstart

Requisitos: **Node.js >= 22.13.0** y **pnpm >= 11.0.0**.

```bash
# 1. Instalar dependencias (lee pnpm-lock.yaml)
pnpm install --frozen-lockfile

# 2. Levantar el dev server con HMR
pnpm dev
# -> http://localhost:3000

# 3. Compilar para producción
pnpm build

# 4. Arrancar el servidor de producción
pnpm start
```

El output de build queda en `dist/` con dos directorios:

- `dist/server/` — worker de Cloudflare + manifests internos de Vinext.
- `dist/client/` — assets estáticos (`_next/static/`, `og.png`, `logo.png`, `_headers`).

---

## Scripts

| Comando            | Descripción                                                  |
| ------------------ | ------------------------------------------------------------ |
| `pnpm dev`         | Servidor de desarrollo con HMR (Vinext + Wrangler)           |
| `pnpm build`       | Compila el worker y los assets en `dist/`                    |
| `pnpm start`       | Sirve el build de producción localmente                      |
| `pnpm test`        | Build + suite completa de tests (`node --test tests/`)       |
| `pnpm lint`        | ESLint con la config de Next.js                              |
| `pnpm db:generate` | Genera migraciones de Drizzle (cuando se agreguen tablas)    |

---

## Tests

La suite cubre el render del worker, accesibilidad estructural, performance, seguridad de output, SEO y la integridad del build. Son tests rápidos (`node --test`, sin dependencias externas).

```bash
pnpm test                    # build + tests (CI)
node --test tests/rendered-html.test.mjs   # sólo render
node --test tests/qa/                     # sólo QA suite
```

| Suite                          | Qué valida                                                                |
| ------------------------------ | ------------------------------------------------------------------------- |
| `rendered-html.test.mjs`       | Worker responde 200, renderiza marca, contiene los servicios y CTA       |
| `qa/accessibility.test.mjs`    | `lang`, skip-link, landmarks, jerarquía de headings, alts, aria-hidden    |
| `qa/performance.test.mjs`      | Tamaños de bundle (JS < 600 KB, CSS < 50 KB), tiempo de render, preloads  |
| `qa/security.test.mjs`         | Sin leaks de secretos, tel: y wa.me consistentes, RUC visible             |
| `qa/security-headers.test.mjs` | CSP, HSTS, X-Frame-Options, Permissions-Policy y headers de cache         |
| `qa/seo.test.mjs`              | title, description, Open Graph, Twitter Card, viewport, h1 único         |
| `qa/build-output.test.mjs`     | Estructura de `dist/`, manifests de Vinext, `_headers` con cache          |

---

## Arquitectura

```text
.
├── app/                  # Next.js App Router (RSC)
│   ├── layout.tsx        # Root layout + generateMetadata (OG, Twitter)
│   ├── page.tsx          # Landing principal
│   ├── ConsultationForm.tsx
│   ├── not-found.tsx     # 404 con branding
│   ├── error.tsx         # 500 con branding
│   ├── loading.tsx       # Skeleton de carga
│   ├── robots.ts         # /robots.txt
│   ├── sitemap.ts        # /sitemap.xml
│   ├── manifest.ts       # PWA manifest
│   └── globals.css
├── public/
│   ├── _headers          # CSP, HSTS, etc. (Cloudflare Pages)
│   ├── og.png, logo.png
│   └── *.svg
├── build/
│   └── sites-vite-plugin.ts
├── db/
│   └── schema.ts         # Vacío por diseño (ver DEPLOY.md para activarlo)
├── drizzle/              # Migraciones (vacío hasta que se defina el schema)
├── tests/
│   ├── rendered-html.test.mjs
│   └── qa/               # Suite QA: a11y, perf, security, SEO, build, headers
├── .openai/hosting.json  # Bindings de Cloudflare para el dev server
├── vite.config.ts        # Config de Vinext + plugin de Cloudflare
├── drizzle.config.ts
├── pnpm-workspace.yaml   # allowBuilds + overrides
├── .npmrc                # Overrides locales de pnpm
└── package.json
```

### Decisiones de diseño

- **Sin Tailwind config custom**: se usa `@tailwindcss/postcss` con la config por defecto. Variables de marca van en `globals.css` con `@theme`.
- **Formulario de consulta**: el form NO persiste en D1 por defecto. Construye una URL `wa.me/...` con el mensaje prellenado y abre WhatsApp en una pestaña nueva. Ver `app/ConsultationForm.tsx`.
- **Imágenes**: `og.png` y `logo.png` se sirven desde `public/` → `dist/client/`. El build los preserva con hashing para cache-busting.
- **Sin dependencias de runtime innecesarias**: `drizzle-orm` está como dep pero el schema está vacío. Se activa cuando se decida qué tablas necesita el proyecto.

---

## Configuración de pnpm (importante)

Este proyecto usa **pnpm 11**. Algunas opciones cambiaron de ubicación con respecto a pnpm 10:

- `allowBuilds` (qué paquetes pueden correr install scripts) → `pnpm-workspace.yaml`
- `overrides` (forzar versiones de transitivas) → `pnpm-workspace.yaml`
- Los overrides de comportamiento (ignore-scripts, strict-dep-builds, etc.) → `.npmrc` local

`engines.pnpm` está pinneado a `>=11.0.0` en `package.json` y `packageManager: pnpm@11.22.0` para que Corepack elija la versión correcta.

### ¿Por qué `allowBuilds` está en una allowlist?

Por seguridad. pnpm 11+ ya no corre install scripts por defecto. Solo los paquetes explícitamente aprobados (`sharp`, `esbuild`, `unrs-resolver`, `workerd`) compilan binarios. Cualquier intento de un paquete nuevo de correr un script va a fallar hasta que se apruebe explícitamente.

---

## Despliegue a Cloudflare

Ver [DEPLOY.md](./DEPLOY.md) para la guía paso a paso de cómo deployar a Cloudflare Workers, configurar D1/R2, y conectar un dominio custom.

---

## Mantenimiento

### Auditoría de seguridad

```bash
pnpm audit                  # 0 vulns esperado
pnpm install --frozen-lockfile   # CI gate: lockfile inmutable
```

### Lockfile

- `pnpm-lock.yaml` está commiteado.
- Para CI, usar siempre `pnpm install --frozen-lockfile` (falla si el lockfile quedó desincronizado con `package.json`).
- Si `pnpm install` agrega o cambia paquetes, regenerar el lockfile localmente y commitearlo.

### Bump de versiones

```bash
pnpm update <paquete>@latest
pnpm install --frozen-lockfile   # validar reproducibilidad
pnpm test
```

---

## Licencia

Propietario. © COMINORSA S.A.C. — RUC 20614147131.
