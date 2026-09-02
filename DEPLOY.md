# DEPLOY — Cloudflare Workers

Guía paso a paso para llevar **COMINORSA — Web** a producción en Cloudflare Workers + Pages.

> **Estado actual del proyecto**: el código está listo para deployar, pero el `db/schema.ts` está vacío y la app no consume D1 ni R2. El formulario de consulta se envía por WhatsApp. Antes de activar D1/R2 hay que definir el schema.

---

## Tabla de contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Configuración inicial de Cloudflare](#configuración-inicial-de-cloudflare)
3. [Bindings de D1 y R2](#bindings-de-d1-y-r2)
4. [Deploy manual con Wrangler](#deploy-manual-con-wrangler)
5. [Deploy automático desde GitHub](#deploy-automático-desde-github)
6. [Dominio custom](#dominio-custom)
7. [Variables de entorno y secrets](#variables-de-entorno-y-secrets)
8. [Troubleshooting](#troubleshooting)
9. [Checklist pre-producción](#checklist-pre-producción)

---

## Prerrequisitos

| Herramienta | Versión mínima | Cómo instalar                                                   |
| ----------- | -------------- | --------------------------------------------------------------- |
| Node.js     | 22.13.0        | `nvm install 22` o [fnm](https://github.com/Schniz/fnm)         |
| pnpm        | 11.0.0         | `corepack enable && corepack prepare pnpm@11.22.0 --activate`   |
| Wrangler    | 4.128+         | `pnpm add -g wrangler` (o usar el `wrangler` del proyecto)      |
| Cuenta CF   | —              | <https://dash.cloudflare.com/sign-up> (plan Free alcanza)         |

Wrangler lee `dist/server/wrangler.json` que Vinext genera automáticamente al correr `pnpm build`.

---

## Configuración inicial de Cloudflare

### 1. Login

```bash
pnpm exec wrangler login
# Abre el navegador, autorizá la app. El token se guarda en ~/.config/.wrangler/config/default.toml
```

### 2. Crear el proyecto

Si es la primera vez:

```bash
pnpm exec wrangler deploy --dry-run --outdir=dist
# Verifica que wrangler.json está bien formado
```

El `wrangler.json` que vinext genera tiene `name: "cominorsa-web"`, que es el nombre que CF le va a dar al Worker.

### 3. Bindings de D1 (opcional, sólo si activás DB)

```bash
# Crear la base D1
pnpm exec wrangler d1 create site-creator-d1
# Output:
# database_name = "site-creator-d1"
# database_id   = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Editá `vite.config.ts` o `.openai/hosting.json` y reemplazá el `database_id` placeholder por el real. Si agregás `db/schema.ts`, definí las tablas con Drizzle y corré:

```bash
pnpm db:generate           # genera archivos en drizzle/
pnpm exec wrangler d1 migrations apply site-creator-d1 --remote
```

### 4. Bindings de R2 (opcional)

```bash
pnpm exec wrangler r2 bucket create site-creator-r2
```

---

## Bindings de D1 y R2

`dist/server/wrangler.json` ya viene con placeholders:

```json
"d1_databases": [
  {
    "binding": "SITE_CREATOR_DB",
    "database_name": "site-creator-d1",
    "database_id": "00000000-0000-4000-8000-000000000000"
  }
],
"r2_buckets": [
  { "binding": "SITE_CREATOR_BUCKET", "bucket_name": "site-creator-r2" }
]
```

Para activarlos de verdad:

1. Creá los recursos en Cloudflare (`wrangler d1 create`, `wrangler r2 bucket create`).
2. Reemplazá el `database_id` placeholder con el UUID real.
3. Re-corré `pnpm build` para que vinext reemita el `wrangler.json`.
4. Commit el cambio.

> **Importante**: hasta que el código no consuma estos bindings con `env.SITE_CREATOR_DB.prepare(...).run(...)`, el deploy funciona sin ellos. No hay coste extra ni runtime check.

---

## Deploy manual con Wrangler

```bash
# 1. Compilar
pnpm build

# 2. Deploy
pnpm exec wrangler deploy
# Output esperado:
# Uploaded cominorsa-web (X.XX sec)
# Published cominorsa-web (X.XX sec)
#   https://cominorsa-web.<tu-subdominio>.workers.dev
```

El primer deploy asigna una URL `*.workers.dev` automática. Los siguientes sólo actualizan el código.

### Rollback

```bash
# Listar versiones
pnpm exec wrangler deployments list

# Volver a una versión anterior
pnpm exec wrangler rollback --message "regresando a versión estable"
```

---

## Deploy automático desde GitHub

### Opción A: Wrangler GitHub Action (recomendado)

Creá `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11.22.0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: .
          command: deploy
```

### Opción B: Cloudflare Pages directo

Conectá el repo desde <https://dash.cloudflare.com> → Workers & Pages → Create → Pages → Connect to Git.

- **Build command**: `pnpm build`
- **Build output directory**: `dist/client`
- **Root directory**: `/`

---

## Dominio custom

1. En Cloudflare Dashboard → **Workers & Pages** → cominorsa-web → **Settings** → **Triggers** → **Custom Domains**
2. Click **Add Custom Domain** → escribí `cominorsa.com.pe` (o el que tengas)
3. Si el dominio ya está en Cloudflare (DNS autoritativo), se configura solo.
4. Si está en otro registrar (GoDaddy, Namecheap, etc.), agregá el CNAME que CF te indica.

> **HTTPS automático**: Cloudflare provisiona un cert Let's Encrypt en segundos. No hay que hacer nada extra.

---

## Variables de entorno y secrets

### Vars (no sensibles, se commitean en `wrangler.json`)

Editá `dist/server/wrangler.json` → sección `"vars"`:

```json
"vars": {
  "ENVIRONMENT": "production",
  "PUBLIC_SITE_URL": "https://cominorsa.com.pe"
}
```

### Secrets (sensibles, NUNCA commitear)

```bash
# Setear un secret
pnpm exec wrangler secret put SENDGRID_API_KEY
# Pegás el valor, queda cifrado en CF

# Listar secrets
pnpm exec wrangler secret list

# Borrar
pnpm exec wrangler secret delete SENDGRID_API_KEY
```

En el código se accede via `env.SENDGRID_API_KEY` en handlers del Worker, o via `process.env.SENDGRID_API_KEY` si vinext lo expone en RSC.

---

## Headers de seguridad (CSP, HSTS, etc.)

El proyecto incluye un `public/_headers` con la política de seguridad lista para producción. Cloudflare Pages lo lee y aplica automáticamente en el edge — **no hay que hacer nada extra en el deploy**.

El archivo define:

- `Content-Security-Policy`: default-src 'self', permite sólo recursos de `wa.me` y la CDN de WhatsApp para imágenes/conectividad del formulario.
- `X-Frame-Options: DENY` y `frame-ancestors 'none'`: previene clickjacking.
- `Strict-Transport-Security`: HSTS por 2 años, con subdominios y preload.
- `Permissions-Policy`: desactiva cámara, micrófono, geolocalización y otros APIs sensibles.
- `Referrer-Policy: strict-origin-when-cross-origin`: limita fuga de referrer.
- `X-Content-Type-Options: nosniff`: previene MIME sniffing.

Si necesitás agregar una excepción (por ejemplo, sumar un dominio de analytics o un CDN de imágenes), editá `public/_headers` y volvé a buildear. Los cambios en headers **requieren re-deploy** — no se hot-reloadan.

> **Local vs producción**: el worker local (`pnpm start`) **no aplica** `_headers` — esos los inyecta Cloudflare en el edge. Por eso los tests de headers validan el **archivo fuente**, no el response. La validación real se hace abriendo las DevTools → Network → Response Headers en `cominorsa-web.workers.dev`.

---

## Troubleshooting

### `wrangler deploy` falla con "Authentication error [code: 10000]"

Token expirado o sin scopes. Re-login:

```bash
pnpm exec wrangler logout
pnpm exec wrangler login
```

### "Could not resolve binding 'SITE_CREATOR_DB'"

El binding está en `wrangler.json` pero no existe en Cloudflare. O:

- Lo creaste con `wrangler d1 create` y no actualizaste el `database_id`, o
- Borraste la base en el dashboard.

Solución: crear la D1 (o sacar el binding si no la usás).

### El deploy funciona pero la página da 500

Probable mismatch de Node compat. Verificá en `dist/server/wrangler.json`:

```json
"compatibility_date": "2026-08-31",
"compatibility_flags": ["nodejs_compat"]
```

Si CF actualizó la default version, bumpeá `compatibility_date` a la fecha actual.

### El sitio carga pero sin estilos (CSS 404)

`dist/client/_next/static/css/*.css` no se está sirviendo. Verificá:

1. `dist/client/_headers` tiene `/  next/static/*  Cache-Control: public, ...`
2. La sección `"assets"` de `wrangler.json` apunta a `../client`.

### Cambios en código no se reflejan

Wrangler a veces sirve desde el último deploy. Forzá:

```bash
pnpm exec wrangler deploy --force
```

---

## Checklist pre-producción

Antes de hacer deploy a producción:

- [x] `pnpm install --frozen-lockfile` corre sin warnings
- [x] `pnpm audit` muestra **0 vulns**
- [x] `pnpm test` pasa completo (55 tests: suite QA + render + headers de seguridad)
- [x] `pnpm build` termina sin errores ni warnings
- [x] Headers de seguridad aplicados vía `public/_headers` (CSP, HSTS, X-Frame-Options, etc.)
- [x] Páginas de error con branding (`app/not-found.tsx`, `app/error.tsx`, `app/loading.tsx`)
- [x] `robots.txt` y `sitemap.xml` servidos desde `app/robots.ts` y `app/sitemap.ts`
- [ ] `dist/server/wrangler.json` tiene los `database_id` reales (si usás D1)
- [ ] No hay secrets hardcodeados en el código
- [ ] El dominio custom tiene HTTPS activo (candado verde en el browser)
- [ ] Variables de entorno configuradas vía `wrangler secret put` (no en código)
- [ ] Primer deploy de prueba en staging (subdominio `*.workers.dev`) antes del dominio final
- [ ] Smoke test manual: cargar `/`, clickear CTA, abrir WhatsApp, verificar imagen OG
