# Setup: cominorsa.com via Cloudflare Registrar

> **Estado (verificado 2026-09-06): parcialmente desactualizado.**
> `cominorsa.com` SÍ está en producción y funcionando (confirmado: `curl
> https://cominorsa.com` → 200, sirve el sitio real). Pero terminó desplegado
> como **Worker** (`cominorsa-web`, `pnpm cf:deploy`), no como **Cloudflare
> Pages project** (confirmado: `wrangler pages project list` devuelve vacío —
> nunca existió un proyecto Pages). El custom domain está conectado al Worker
> vía la API de Workers Custom Domains, no vía Pages. La afirmación de este
> doc de "Deploy automático en cada git push (GitHub Actions ya configurado)"
> también es falsa hoy: `.github/workflows/ci.yml` no despliega nada — ver
> `AGENTS.md`'s `cominorsa-deploy` skill ("CI never deploys on its own").
> Los pasos 1-4 (comprar el dominio, conseguir token/account ID) siguen
> siendo el flujo correcto si hace falta repetirlos; el paso 5
> (`pnpm cf:full`) y las referencias a Pages en el resto de este documento
> no reflejan cómo terminó desplegado el sitio.

Flujo end-to-end para tener `cominorsa.com` productivo en Cloudflare Pages, con todo automatizado del lado del codigo.

## Por que Cloudflare Registrar (en vez de NIC.pe / Punto.pe / etc)

| Aspecto | Cloudflare Registrar | NIC.pe / Punto.pe |
| --------- | ---------------------- | ------------------- |
| Costo .com | **diez dolares anio** (miles de pesos) | .pe/.com.pe ~cientos de soles |
| Cambio de NS | **Automatico** (ya nace apuntando) | Manual (login en panel del registrar) |
| API para DNS | Misma API Token | Cada registrar con su propio panel |
| SSL automatico | Si | Depende |
| Tiempo total | **~quince min** | ~dos a cuatro h (incluye propagacion) |

El unico "pero": no es `.pe`. Si en algun momento necesitas presencia local peruana formal, podes agregar `cominorsa.com.pe` aparte y redirigirlo a `.com`.

---

## Paso 1 - Comprar el dominio (vos, ~cinco min)

1. Abre <https://domains.cloudflare.com/>
2. Busca `cominorsa.com`
3. Click en `cominorsa.com` (deberia decir "Available")
4. Click en `Purchase` / `Add to cart`
5. **Crea cuenta** o **logueate** con tu email de Cloudflare
6. Paga con tarjeta
7. Te llega email de confirmacion. El dominio aparece en `dash.cloudflare.com` en ~treinta segundos

**No configures nada todavia en el dashboard.** Dejame a mi el resto.

---

## Paso 2 - Crear API Token con permisos completos (vos, ~tres min)

El token que ya tenes (`wrangler-pages-cominorsa`) probablemente le faltan permisos para DNS.

1. Anda a <https://dash.cloudflare.com/profile/api-tokens>
2. Click `Create Custom Token` (o edita el que tenes con `Edit`)
3. Nombre: `wrangler-pages-cominorsa-full` (o el que ya usabas)
4. **Permissions** (todas estas):
   - `Account > Account Settings > Read`
   - `Account > Pages > Edit`
   - `Zone > DNS > Edit`
5. **Account Resources**: `Include > All accounts` (o la cuenta especifica)
6. **Zone Resources**: `Include > All zones` (o `cominorsa.com` especifico)
7. **Client IP Address Filtering**: **VACIO** (sin filtro)
8. **TTL**: `Forever`
9. Click `Continue to summary` -> `Create Token`
10. **COPIA EL TOKEN** (empieza con `cfut_...`, 40 chars). Solo se muestra una vez.

---

## Paso 3 - Conseguir Account ID (vos, 1 min)

1. Anda a <https://dash.cloudflare.com/>
2. **Account ID** aparece en el panel celeste **abajo a la derecha** del dashboard
3. Es un string de 32 caracteres hex (ej: `a1b2c3d4e5f6...`)
4. **NO es lo mismo que Zone ID**. Si ves un ID al clickear tu dominio, ese es el Zone ID (no lo uses aca)

---

## Paso 4 - Darme el token (vos, 1 min)

Decime en el chat:

```
Token: cfut_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Account ID: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

**Aviso**: el token es como una contrasena. Yo lo voy a usar para automatizar todo y despues te recomiendo que lo "rotes" (`Roll to update`) una vez que el deploy este listo.

---

## Paso 5 - Yo automatizo todo (~dos min)

Una vez que me des el token, yo corro:

```bash
export CLOUDFLARE_API_TOKEN="cfut_xxx..."
export CLOUDFLARE_ACCOUNT_ID="abc123..."

pnpm cf:full    # cloudflare-full-setup.sh
```

Ese script hace automaticamente:

1. Verifica que el token funcione
2. Verifica que `cominorsa.com` este en tu cuenta
3. Crea los DNS records:
   - `A @ -> 192.0.2.1` (CF Pages, Proxied)
   - `CNAME www -> cominorsa-web.pages.dev` (Proxied)
4. Conecta `cominorsa.com` como custom domain en el Pages project
5. Espera a que se emita el SSL (max 5 min)
6. Corre smoke test (10 checks: HTTP, headers, robots, sitemap, favicon, OG, etc.)

---

## Paso 6 - Go-live

El sitio queda en **`https://cominorsa.com`** con:

- HTTPS automatico (certificado emitido por CF)
- Headers de seguridad (CSP, HSTS, X-Frame-Options, etc.)
- CDN global (cualquier visitante del mundo carga rapido)
- Deploy automatico en cada `git push` (GitHub Actions ya configurado)

---

## Troubleshooting

### "Zone not found" en el script

- El dominio todavia no se activo en CF. Espera 1-2 min despues de comprarlo y reintenta
- Si compraste en otro registrador, primero tenes que transferirlo a CF (o cambiarle los NS ahos de CF)

### "10000" error en DNS records

- El API Token no tiene `Zone > DNS > Edit`. Volve al paso 2 y agregalo

### SSL no emitido despues de 5 min

- CF puede tardar hasta 15 min en el primer certificado
- Re-corre el script: `pnpm cf:full` (es idempotente, no rompe nada)

### "Custom domain already in use"

- El dominio esta conectado a otro Pages project
- Anda a Workers & Pages -> ese otro project -> Custom domains -> quitalo de ahi

---

## Costos recurrentes

| Item | Costo anual |
| ------ | ------------- |
| `cominorsa.com` | ~diez dolares anio (precio CF wholesale) |
| Cloudflare Pages (Free tier) | **gratis** (hasta 500 builds/mes, trafico ilimitado) |
| SSL | gratis (incluido) |
| DNS | gratis (incluido) |
| **Total** | **~diez dolares anio** |

Si en el futuro el sitio crece, el plan Pro de Pages cuesta veinte dolares por mes (con analytics avanzado, etc). El free tier es mas que suficiente para un sitio de marketing.
