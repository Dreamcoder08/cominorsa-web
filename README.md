<div align="center">

# COMINORSA — Web

Landing page institucional de **COMINORSA S.A.C.**, consultoría minera y ambiental desde Piura, Perú.

[![License](https://img.shields.io/badge/license-proprietary-lightgrey.svg)](LICENSE)
[![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%2B%20React%2019%20%2F%20Cloudflare%20Workers-informational)]()

</div>

---

## Demo

![COMINORSA screenshot](./docs/assets/cominorsa-screenshot.png)

## Índice

- [Demo](#demo)
- [Descripción](#descripción)
- [Características](#características)
- [Stack técnico](#stack-técnico)
- [Instalación](#instalación)
- [Uso](#uso)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Testing](#testing)
- [Despliegue](#despliegue)
- [Licencia](#licencia)

## Descripción

Sitio institucional de COMINORSA S.A.C., consultoría minera y ambiental. Presenta los servicios de la empresa (formalización minera IGAFOM/REINFO, gestión ambiental, ingeniería y planes de minado, seguridad minera, trámites MINEM/INGEMMET/DREM) y canaliza las consultas de contacto directo a WhatsApp, con reenvío opcional del lead a un CRM interno (Twenty CRM).

## Características

- Landing multi-sección con páginas de servicio dedicadas (`igafom-reinfo`, `gestion-ambiental-minera`, `ingenieria-y-planes-de-minado`, `seguridad-minera`, `tramites-minem-ingemmet-drem`, `declaraciones-dac-estamin`, `preguntas-frecuentes`).
- Formulario de consulta que arma un mensaje prellenado y abre WhatsApp (`wa.me/...`), sin depender de que ningún backend responda.
- Reenvío opcional y no bloqueante del lead a Twenty CRM vía `/api/crm-lead`, activo solo si `TWENTY_API_KEY`/`TWENTY_API_URL` están configuradas.
- Accesibilidad: HTML semántico en español, `lang` declarado, skip-link, landmarks, jerarquía de headings monotónica.
- SEO: Open Graph y Twitter Card completos, `robots.ts`, `sitemap.ts`, `manifest.ts`, `og.png` preloadeado.
- Aviso de cookies y páginas legales (`privacidad`, `terminos`).
- Headers de seguridad (CSP, HSTS, X-Frame-Options, Permissions-Policy) vía `public/_headers` para Cloudflare Pages.
- Suite de tests propia (a11y, performance, seguridad de output, SEO, integridad del build) con `node --test`, sin dependencias externas.

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router) + React 19, servido con [Vinext](https://github.com/cloudflare/vinext) |
| Backend | Route handler de Next.js (`app/api/crm-lead`) que reenvía leads a Twenty CRM |
| Base de datos | Ninguna — los leads van a Twenty CRM vía `/api/crm-lead` |
| Infraestructura | Cloudflare Workers + Cloudflare Pages, deploy con Wrangler |
| Estilos | Tailwind CSS 4 (`@tailwindcss/postcss`, sin config custom) |
| Testing | `node --test` (unit/QA) + Playwright (`pnpm test:e2e`) |

## Instalación

Requisitos: **Node.js >= 22.13.0** y **pnpm >= 11.0.0**.

```bash
git clone git@github.com:Dreamcoder08/cominorsa-web.git
cd cominorsa-web
pnpm install --frozen-lockfile
```

### Variables de entorno

```bash
cp .env.example .env
```

Variables relevantes documentadas en el proyecto (ver `.env.example` y `DEPLOY.md` para el detalle completo):

- `TWENTY_API_KEY` / `TWENTY_API_URL` — opcionales; si faltan, `/api/crm-lead` responde `200 {"ok":true}` sin hacer nada (no-op silencioso).
- Variables de Cloudflare (`CLOUDFLARE_API_TOKEN`, dominio, etc.) — ver [DEPLOY.md](./DEPLOY.md), sección "Variables de entorno y secrets".

## Uso

```bash
pnpm dev
# -> http://localhost:3000

pnpm build     # compila el worker y los assets en dist/
pnpm start     # sirve el build de producción localmente
```

## Estructura del proyecto

```
cominorsa-web/
├── app/                    # Next.js App Router (RSC)
│   ├── layout.tsx          # Root layout + generateMetadata (OG, Twitter)
│   ├── page.tsx            # Landing principal
│   ├── ConsultationForm.tsx
│   ├── api/crm-lead/       # Reenvío de leads a Twenty CRM
│   ├── <servicio>/page.tsx # Páginas de cada línea de servicio
│   ├── robots.ts, sitemap.ts, manifest.ts
│   └── globals.css
├── public/                 # og.png, logo.png, favicons, _headers
├── docker/twenty/           # Stack local/producción de Twenty CRM
├── tests/
│   ├── rendered-html.test.mjs
│   └── qa/                  # a11y, performance, security, SEO, build
├── scripts/                 # Automatización de Cloudflare y Twenty CRM
├── DEPLOY.md                # Guía de despliegue a Cloudflare Workers
└── package.json
```

## Testing

```bash
pnpm test                    # build + suite completa (CI)
node --test tests/rendered-html.test.mjs   # sólo render
node --test tests/qa/                      # sólo QA suite
pnpm test:e2e                              # Playwright
```

## E2E local aislado

Antes de `pnpm test:e2e`, iniciá manualmente la web local en el puerto 3001. La
suite E2E sólo acepta un `PLAYWRIGHT_BASE_URL` loopback y todos los specs deben
importar `test`/`expect` desde `tests/e2e/guarded-test.ts`. Ese fixture bloquea
service workers y tráfico externo, intercepta `POST /api/crm-lead`, responde con
un resultado sintético y expone los payloads capturados para las aserciones.

**Dejar variables de entorno vacías no es aislamiento:** Vinext puede cargar
archivos `.env` igualmente. No ejecutes formularios con el `test` base de
`@playwright/test` ni apuntes la suite a un dominio desplegado.

```bash
pnpm test:e2e
# Regresión de aislamiento, sin Vinext ni integraciones:
pnpm exec playwright test tests/e2e/provider-isolation.spec.ts --project=chromium
```

## Límite y abuso del endpoint CRM

El límite de 16 KiB se aplica mientras se consume el stream; no depende de `Content-Length`. Es deliberadamente mucho menor que el límite de cuerpo de 100 MB de Workers Free/Pro, porque ese límite de plataforma no es un límite seguro para una aplicación con 128 MB de memoria ([límites de Workers](https://developers.cloudflare.com/workers/platform/limits/)).

La validación evita payloads inválidos y consumo de memoria sin límite, pero **no evita spam con payloads válidos**. La mitigación corresponde al despliegue (por ejemplo, una regla de rate limiting/WAF de Cloudflare y observabilidad), no a estado distribuido inventado dentro del Worker.

## Despliegue

Ver [DEPLOY.md](./DEPLOY.md) para la guía paso a paso de despliegue a Cloudflare Workers, bindings de D1/R2 y configuración de dominio custom.

## Licencia

Software propietario. © COMINORSA S.A.C. — RUC 20614147131. Todos los derechos reservados. Ver [LICENSE](./LICENSE) para los términos completos; el código fuente no puede ser copiado, modificado ni distribuido sin autorización escrita de COMINORSA S.A.C.
