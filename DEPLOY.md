# DEPLOY — Cloudflare Workers

Guía de despliegue de **COMINORSA — Web** a Cloudflare Workers.

> **T11 cutover (2026-09)**: el sitio dejó de ser Next.js/vinext SSR y
> pasó a ser un sitio **estático** (Cloudflare Workers Static Assets)
> más un Worker chico que sólo atiende `/api/crm-lead` y
> `/api/next-business-day`. No hay D1 ni R2 — el formulario de consulta
> se envía por WhatsApp; el lead se reenvía opcionalmente a Twenty CRM.

---

## Tabla de contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Hecho crítico: Cloudflare Workers Builds](#hecho-crítico-cloudflare-workers-builds)
3. [Deploy manual con Wrangler](#deploy-manual-con-wrangler)
4. [Dominio custom](#dominio-custom)
5. [Variables de entorno y secrets](#variables-de-entorno-y-secrets)
6. [Headers de seguridad](#headers-de-seguridad)
7. [Protección de `/api/crm-lead`](#protección-de-apicrm-lead)
8. [Troubleshooting](#troubleshooting)
9. [Checklist pre-producción](#checklist-pre-producción)

---

## Prerrequisitos

| Herramienta | Versión mínima | Cómo instalar                                                  |
| ----------- | -------------- | --------------------------------------------------------------- |
| Node.js     | 22.18.0        | `nvm install 22` o [fnm](https://github.com/Schniz/fnm)         |
| pnpm        | 11.0.0         | `corepack enable && corepack prepare pnpm@11.25.0 --activate`   |
| Bun         | latest         | `curl -fsSL https://bun.sh/install \| bash` — build/dev/test runtime; never runs in production (Cloudflare Workers runs `workerd`, not Bun) |
| Wrangler    | 4.128+         | ya es una devDependency del proyecto (`pnpm exec wrangler`)     |
| Cuenta CF   | —              | <https://dash.cloudflare.com/sign-up> (plan Free alcanza)         |

Wrangler lee el **`wrangler.jsonc` de la raíz del repo** — es el único
config de Wrangler que queda en el proyecto desde el cutover (el
`dist/server/wrangler.json` que generaba vinext, y el `worker/index.ts`
+ `vite.config.ts` que lo producían, ya no existen).

---

## Hecho crítico: Cloudflare Workers Builds

**Cloudflare Workers Builds está conectado a este repo de GitHub** para
el Worker `cominorsa-web`: cada push a cualquier rama dispara un
**preview** (alias `https://<rama>-cominorsa-web.dreamcoder-dev08.workers.dev`),
y un push a `main` muy probablemente **deploya producción**. El comando
de build/deploy que usa Workers Builds vive en el **dashboard de
Cloudflare** — este repo no lo controla ni lo puede ver.

Por eso los **defaults del repo tienen que andar solos, sin tocar el
dashboard**:

- `pnpm build` (o `npm run build`) → corre `bun run src/build/build.ts`
  → produce `dist-static/` completo (HTML + `assets/` + `_headers` +
  `sitemap.xml`/`robots.txt`/`manifest.webmanifest`).
- El `wrangler.jsonc` de la raíz (el que `wrangler deploy`/
  `wrangler versions upload` recogen por defecto) es el config estático,
  con `"name": "cominorsa-web"` — el mismo nombre que producción ya usa,
  a propósito, para que el preview de cualquier rama ejercite el Worker
  real sin tener que tocar nada en el dashboard.

### Qué revisar en el dashboard de Cloudflare (Workers Builds)

Dashboard → Workers & Pages → **cominorsa-web** → Settings → Builds:

| Campo | Valor esperado |
| --- | --- |
| Build command | `pnpm install --frozen-lockfile && pnpm run build` (o equivalente — el build debe correr `bun run src/build/build.ts`, que requiere Bun disponible en el builder; si Workers Builds no trae Bun preinstalado, el build command necesita instalarlo primero, p. ej. `curl -fsSL https://bun.sh/install \| bash && export PATH="$HOME/.bun/bin:$PATH"`) |
| Deploy command | `pnpm exec wrangler deploy` (sin `--config`: recoge el `wrangler.jsonc` de la raíz automáticamente) |
| Root directory | `/` (raíz del repo) |
| Non-production branch deployments | según se quiera (cada rama ya generará un preview funcional una vez el build ande) |

**Variables de entorno del build** (Settings → Variables and Secrets,
scope "Build"): deben estar seteadas **en build time**, no sólo en
runtime, porque `NEXT_PUBLIC_GA_MEASUREMENT_ID` se **inlinea** dentro
del JS bundle en el momento del build (`src/build/js.ts`'s `define`) —
un Worker corriendo con la variable seteada pero un build viejo sin
ella sigue sirviendo GA4 apagado.

| Variable | Requerida | Efecto si falta |
| --- | --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Sí, para que GA4 funcione | Se inlinea como `""`; el bundle de consentimiento nunca llama a `loadGa4` (mismo comportamiento que hoy con la variable sin setear — no rompe el build, sólo apaga analytics) |
| `SITEMAP_LAST_MODIFIED` | No | Si falta, `sitemap.ts` usa la fecha del commit actual vía `git log -1` (T11); si el builder no tiene metadata de git (clone sin `.git/`), cae a una constante fija — ver `src/build/site-config.ts` |

> El nombre `NEXT_PUBLIC_GA_MEASUREMENT_ID` es un remanente de la era
> Next.js — renombrarlo apagaría GA4 en el próximo deploy sin avisar.
> Mantenido tal cual a propósito; un rename es tarea de limpieza para
> la fase de polish (T12), no de este cutover.

---

## Deploy manual con Wrangler

```bash
# 1. Compilar
pnpm run build          # -> dist-static/

# 2. Deploy (recoge wrangler.jsonc de la raíz automáticamente)
pnpm run cf:deploy
# o directamente:
pnpm exec wrangler deploy
```

### Verificar sin deployar (dry-run)

```bash
pnpm exec wrangler deploy --dry-run --outdir /tmp/cominorsa-dryrun
```

`--dry-run` construye y valida el Worker (bundlea, resuelve bindings,
valida el config) pero **nunca sube nada** a Cloudflare — confirmado en
`wrangler deploy --help`. Es la forma segura de probar que
`wrangler.jsonc` está bien formado sin arriesgar producción.

### Rollback

```bash
pnpm exec wrangler deployments list
pnpm exec wrangler rollback --message "regresando a versión estable"
```

---

## Dominio custom

1. Dashboard → **Workers & Pages** → `cominorsa-web` → **Settings** →
   **Triggers** → **Custom Domains**.
2. El dominio real de producción es **`cominorsa.com`** (sin `.pe` —
   `cominorsa.com.pe` no resuelve; ver `src/build/site-config.ts`'s
   propio comentario y `COMINORSA-COM-DOMAIN-SETUP.md`).
3. Si el dominio ya está en Cloudflare (DNS autoritativo), se configura
   solo. Si está en otro registrar, agregar el CNAME que CF indica.

> **HTTPS automático**: Cloudflare provisiona un cert Let's Encrypt en
> segundos, sin pasos extra.

### Redirección `www` → dominio raíz (301)

`https://www.cominorsa.com/` responde **200** con el mismo contenido
(verificado 2026-09-23 con `curl -sI https://www.cominorsa.com/`), así
que existen dos copias del sitio para los buscadores. Las páginas ya
declaran `<link rel="canonical">` hacia `https://cominorsa.com/…`, pero
la corrección real es una regla de zona de Cloudflare, no código:

1. Dashboard → zona **`cominorsa.com`** → **Rules** → **Redirect Rules**
   → **Create rule** (o la plantilla *Redirect from WWW to root*).
2. **If incoming requests match** → *Custom filter expression*:
   `(http.host eq "www.cominorsa.com")`
3. **Then** → *Dynamic*:
   - Expression: `concat("https://cominorsa.com", http.request.uri.path)`
   - Status code: **301**
   - **Preserve query string**: activado.
4. El registro DNS `www` debe seguir **proxied** (nube naranja): la regla
   solo corre sobre tráfico que pasa por Cloudflare.
5. Verificar:
   `curl -sI "https://www.cominorsa.com/seguridad-minera?x=1"` →
   `301` con `location: https://cominorsa.com/seguridad-minera?x=1`.

---

## Variables de entorno y secrets

### Vars (no sensibles)

Se configuran en el dashboard de Cloudflare (Settings → Variables and
Secrets) — ver la tabla de la sección anterior. No hay `"vars"` en
`wrangler.jsonc` hoy porque las 2 rutas `/api/*` sólo necesitan
secrets, no vars públicas del lado del Worker.

### Secrets (sensibles, NUNCA commitear)

```bash
pnpm exec wrangler secret put TWENTY_API_KEY
pnpm exec wrangler secret put TWENTY_API_URL
pnpm exec wrangler secret put RESEND_API_KEY

pnpm exec wrangler secret list
pnpm exec wrangler secret delete TWENTY_API_KEY
```

Leídas en el código vía `process.env.TWENTY_API_KEY` (etc.) en
`app/api/crm-lead/route.ts` — disponibles en runtime gracias al
`compatibility_flags: ["nodejs_compat"]` de `wrangler.jsonc`. Si faltan,
`/api/crm-lead` sigue respondiendo `200 {"ok":true}` sin hacer nada
(no-op silencioso, por diseño — ver ese archivo).

---

## Headers de seguridad

`dist-static/_headers` — generado en build time por
`src/build/headers.ts` a partir de `src/build/security-policy.ts` — es
la **única** fuente de verdad para los headers de seguridad de cada
página (CSP, HSTS, X-Frame-Options, Permissions-Policy, etc.).
Cloudflare lo aplica automáticamente a toda respuesta servida desde el
binding de assets estáticos.

Las 2 rutas `/api/*` **no** pasan por `_headers` (Cloudflare nunca lo
aplica a una respuesta que el propio script del Worker devuelve) — por
eso `src/worker/security-headers.ts` envuelve esas 2 respuestas con la
misma política, importada del mismo `security-policy.ts`, para que no
puedan divergir.

Si hace falta agregar una excepción (por ejemplo, un nuevo dominio de
analytics), editar `src/build/security-policy.ts` y volver a buildear —
`dist-static/_headers` se regenera solo. **No editar `_headers` a
mano**: se sobreescribe en cada build.

---

## Protección de `/api/crm-lead`

El endpoint del formulario tiene tres capas (P4 de
`odd/tasks/landing-polish.md`):

1. **Guardia de origen (en el código)** — `app/api/crm-lead/route.ts`
   sólo acepta un `POST` cuyo `Origin` sea `https://cominorsa.com` o el
   propio origen de la request (así siguen funcionando `wrangler dev` en
   localhost y los previews `*.workers.dev`), y cuyo `Sec-Fetch-Site`,
   si viene, sea `same-origin`. Sin `Origin` (curl, scripts) → `403
   {"ok":false}`. El formulario real nunca cae en ese camino.
2. **Honeypot (en el código)** — campo oculto `website` en el
   formulario. Si llega con algo escrito, la ruta responde `200
   {"ok":true}` y **no** llama a Twenty ni a Resend.
3. **Rate limiting (en el dashboard de Cloudflare, no en el Worker)** —
   un script puede falsificar `Origin`, así que el límite por IP lo
   pone Cloudflare delante del Worker. Paso manual (no se aplicó desde
   este repo, no hay llamadas a la API de Cloudflare):

   1. Dashboard → zona `cominorsa.com` → **Security → WAF → Rate
      limiting rules** → **Create rule**.
   2. Nombre: `crm-lead POST por IP`.
   3. Expresión (editor de expresiones):

      ```
      (http.request.uri.path eq "/api/crm-lead" and http.request.method eq "POST")
      ```

   4. Contar por: **IP**. Umbral: **5 requests / 1 minuto**. Acción:
      **Block** durante **10 minutos**.
   5. Deploy y probar: 6 `POST` seguidos desde la misma IP → el sexto
      recibe `429`.

   Los períodos y duraciones disponibles dependen del plan de la zona
   (el plan Free sólo ofrece períodos cortos, p. ej. 10 s; revisar las
   opciones que muestra el dashboard). Con períodos cortos, usar el
   equivalente más cercano (p. ej. 2 requests / 10 s). Una persona real
   envía el formulario una vez; el límite no afecta el handoff a
   WhatsApp, que no depende de esta respuesta.

`/api/next-business-day` **no** lleva guardia de origen ni rate limit:
lo llama el workflow de Twenty CRM desde su servidor (nodo HTTP
Request, sin `Origin`) para calcular la fecha de seguimiento de una
Task — ver `app/api/next-business-day/route.ts` y el commit `6e22cc5`.
No borrar mientras ese workflow exista.

---

## Troubleshooting

### `wrangler dev`/`wrangler deploy` sirve/deploya contenido viejo (Next.js), aunque `wrangler.jsonc` ya es el config estático

**Causa real, encontrada durante T11**: un `.wrangler/deploy/config.json`
viejo (dejado por un `vinext build`/`wrangler deploy --dry-run` previo
al cutover) fija el config a la ruta vieja
(`dist/server/wrangler.json`) y Wrangler lo prioriza por sobre el
`wrangler.jsonc` de la raíz. Solución:

```bash
rm -rf .wrangler   # gitignored, se regenera solo
```

### `wrangler deploy` falla con "Authentication error [code: 10000]"

Token expirado o sin scopes. Re-login:

```bash
pnpm exec wrangler logout
pnpm exec wrangler login
```

### El deploy funciona pero la página da 500 (en `/api/*`)

Probable mismatch de compatibilidad. Verificá en `wrangler.jsonc`:

```jsonc
"compatibility_date": "2026-08-31",
"compatibility_flags": ["nodejs_compat"]
```

Si Cloudflare actualizó la versión default, bumpear `compatibility_date`
a mano (deliberadamente, no en cada deploy rutinario).

### El sitio carga pero sin estilos (CSS 404)

Verificar que `dist-static/assets/globals-*.css` existe (`pnpm run
build` lo genera) y que `wrangler.jsonc`'s `assets.directory` apunta a
`"dist-static"`.

### Cambios en código no se reflejan

```bash
pnpm exec wrangler deploy --force
```

---

## Checklist pre-producción

Antes de hacer deploy a producción:

- [x] `pnpm install --frozen-lockfile` corre sin warnings
- [x] `pnpm audit` sin vulns `high`+
- [x] `pnpm run validate` pasa
- [x] `pnpm run lint` y `pnpm run typecheck` sin errores
- [x] `bun test src/` pasa completo
- [x] `pnpm test` pasa completo (build + suite QA)
- [x] `pnpm run e2e:static` pasa completo (Playwright, build determinístico)
- [x] Headers de seguridad generados en `dist-static/_headers`
- [x] `robots.txt`, `sitemap.xml`, `manifest.webmanifest` generados en
      `dist-static/`
- [ ] Variables de build (`NEXT_PUBLIC_GA_MEASUREMENT_ID`,
      `SITEMAP_LAST_MODIFIED`) confirmadas en el dashboard de Cloudflare
      Workers Builds (build-time, no sólo runtime)
- [ ] Build command / Deploy command / Root directory de Workers Builds
      confirmados según la tabla de arriba
- [ ] Secrets (`TWENTY_API_KEY`, `TWENTY_API_URL`, `RESEND_API_KEY`)
      seteados vía `wrangler secret put` (no en código, no en vars)
- [ ] Preview URL de la rama del cutover revisado manualmente antes de
      mergear a `main`
- [ ] El dominio custom (`cominorsa.com`) sigue con HTTPS activo tras el
      deploy
- [ ] Smoke test manual: cargar `/`, clickear el CTA de WhatsApp, abrir
      el formulario de consulta, verificar la imagen OG al compartir
