# Cloudflare Scripts

Set de scripts bash para automatizar el setup, deploy, configuración de dominio y smoke test del proyecto en Cloudflare Pages.

## Setup inicial (una sola vez)

### 1. Crear API Token

1. Ir a <https://dash.cloudflare.com/profile/api-tokens>
2. **Create Token** → **Create Custom Token**
3. Configurar:
   - **Name**: `wrangler-pages-cominorsa`
   - **Permissions**:
     - `Account > Pages > Edit`
     - `Account > Account Settings > Read`
   - **Account Resources**: All accounts
   - **Zone Resources**: All zones (necesario para custom domains)
   - **Client IP Address Filtering**: vacío o `0.0.0.0/0`
   - **TTL**: Forever
4. **Continue to summary** → **Create Token** → **copiar el token**

### 2. Obtener Account ID

Dashboard de Cloudflare → abajo a la derecha en cualquier pantalla hay un panel celeste con "Account ID" (32 hex chars). Copiar.

### 3. Guardar credenciales

Opción A — Variables de entorno (temporal, dura lo que dura la sesión):

```bash
export CLOUDFLARE_API_TOKEN="cfut_xxxxx..."
export CLOUDFLARE_ACCOUNT_ID="a1b2c3d4..."
```

Opción B — Archivo `.env` (persiste, está en `.gitignore`):

```bash
cat > .env <<'EOF'
CLOUDFLARE_API_TOKEN=cfut_xxxxx...
CLOUDFLARE_ACCOUNT_ID=a1b2c3d4...
EOF
```

## Scripts disponibles

### `cloudflare-setup.sh`

Verifica credenciales, lista proyectos, deployments y zonas. **Primer script a correr** después de exportar las credenciales.

```bash
./scripts/cloudflare-setup.sh
```

Salida esperada:

```
✓ Credenciales OK
  Account ID: a1b2c3d4...c5d6
  Token:      cfut_xku...034
✓ Token activo
▶ Proyectos Pages en la cuenta:
  • cominorsa-web
      subdomain: cominorsa-web.pages.dev
      ...
```

### `cloudflare-deploy.sh`

Build local + deploy a Cloudflare Pages. Equivale a `wrangler pages deploy`.

```bash
./scripts/cloudflare-deploy.sh                    # production (branch=main)
./scripts/cloudflare-deploy.sh --preview         # preview (branch=HEAD)
./scripts/cloudflare-deploy.sh --branch mi-rama  # preview con nombre custom
```

Flags:

- `--preview` → deploy como preview (URL temporal, no afecta producción)
- `--branch NAME` → override del branch
- `SKIP_BUILD=1` → no corre `pnpm run build` (usa `dist/` existente)

### `cloudflare-domain.sh`

Configura `cominorsa.com.pe` como custom domain. **Tiene modo guiado que te lleva paso a paso** si el dominio no está en CF todavía.

```bash
./scripts/cloudflare-domain.sh              # modo guiado
./scripts/cloudflare-domain.sh --check      # solo ver estado actual
./scripts/cloudflare-domain.sh --add        # agregar dominio sin guía
```

El modo guiado hace 4 pasos:

1. Verifica que el dominio esté agregado a Cloudflare (zone)
2. Verifica que los nameservers apunten a Cloudflare
3. Agrega el dominio al proyecto Pages
4. Espera y valida que `https://cominorsa.com.pe` responda 200 con los headers de seguridad

### `cloudflare-smoke-test.sh`

Valida 10 puntos críticos del sitio deployado: HTTP 200, 404 branded, robots, sitemap, CSP, HSTS, X-Frame-Options, manifest, favicon, OG.

```bash
./scripts/cloudflare-smoke-test.sh                    # test del último deploy
./scripts/cloudflare-smoke-test.sh --url https://cominorsa.com.pe
```

Exit code: `0` si todo pasa, `1` si algo falla. Útil para CI.

## Orden recomendado

```bash
# 1. Verificar credenciales (una vez)
./scripts/cloudflare-setup.sh

# 2. Configurar dominio (una vez, modo guiado)
./scripts/cloudflare-domain.sh

# 3. Smoke test
./scripts/cloudflare-smoke-test.sh --url https://cominorsa.com.pe

# Para deploys futuros (después de cambios):
./scripts/cloudflare-deploy.sh
./scripts/cloudflare-smoke-test.sh
```

## Troubleshooting

### `Token length: 0`

Las variables no están exportadas. Verificá con `env | grep CLOUDFLARE`. Si no aparecen, exportalas o creá `.env`.

### `CLOUDFLARE_ACCOUNT_ID no tiene formato válido`

El ID tiene que ser exactamente 32 chars hex (0-9, a-f). Sin guiones, sin espacios.

### `API call failed: 7003`

El `ACCOUNT_ID` o el token son incorrectos. Verificá ambos. Para el token, probá:

```bash
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify
```

Tiene que devolver `"success": true`.

### `403 Forbidden`

El token no tiene los permisos necesarios. Verificá que tenga `Account > Pages > Edit` y `Account > Account Settings > Read`.

### `Client IP Address Filtering` rechaza la request

Tu IP cambió (ISP dinámico). Editá el token en el dashboard, quitá el IP filter, o agregá la IP actual.

### `No hay zonas` en setup

El dominio todavía no se agregó a Cloudflare. Andá al dashboard → "Add a site" → seguí el wizard.
