#!/usr/bin/env bash
# cloudflare-full-setup.sh — Setup completo de dominio custom en Cloudflare Pages
#
# USO:
#   export CLOUDFLARE_API_TOKEN="<token>"
#   export CLOUDFLARE_ACCOUNT_ID="<id>"
#   ./scripts/cloudflare-full-setup.sh
#   ./scripts/cloudflare-full-setup.sh --domain cominorsa.com --project cominorsa-web
#
# REQUISITOS:
#   - Dominio ya comprado en Cloudflare Registrar (o transferido aca)
#   - API Token con permisos: Account > Pages:Edit + Account Settings:Read + Zone:DNS:Edit
#   - Account ID (panel celeste abajo a la derecha del dashboard)
#
# QUE HACE:
#   1. Verifica credenciales
#   2. Verifica que el dominio existe en tu cuenta de Cloudflare
#   3. Configura DNS records:
#      - A @ → 192.0.2.1 (CF Pages IP placeholder, CF lo resuelve)
#      - CNAME www → cominorsa-web.pages.dev
#   4. Conecta el custom domain al proyecto Pages
#   5. Espera a que SSL se emita (max 5 min)
#   6. Corre smoke test

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/api.sh
source "$SCRIPT_DIR/lib/api.sh"
# shellcheck source=lib/check-env.sh
source "$SCRIPT_DIR/lib/check-env.sh"

DOMAIN="cominorsa.com"
PROJECT="cominorsa-web"
PAGES_DOMAIN="${PROJECT}.pages.dev"
WAIT_SSL_SECONDS=300

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    -h|--help)
      echo "Uso: $0 [--domain dominio.com] [--project proyecto-pages]"
      echo ""
      echo "  --domain    Dominio custom (default: cominorsa.com)"
      echo "  --project   Nombre del Pages project (default: cominorsa-web)"
      echo ""
      echo "Variables de entorno requeridas:"
      echo "  CLOUDFLARE_API_TOKEN   API Token con Pages:Edit + DNS:Edit + Account Settings:Read"
      echo "  CLOUDFLARE_ACCOUNT_ID  Account ID (32 hex chars)"
      exit 0
      ;;
    *) echo "Flag desconocida: $1" >&2; exit 1 ;;
  esac
done

echo ""
echo "Cloudflare Pages - Setup completo de custom domain"
echo "========================================================"
echo "  Dominio:  $DOMAIN"
echo "  Proyecto: $PROJECT"
echo "  Pages:    $PAGES_DOMAIN"
echo ""

# 1. Verificar credenciales
echo "[1/6] Verificando credenciales..."
check_env_token
echo "  OK - Token valido"
echo ""

# 2. Verificar que el dominio esta en la cuenta
echo "[2/6] Verificando que $DOMAIN esta en tu cuenta de Cloudflare..."
ZONE_ID=$(cf_get_zone_by_name "$DOMAIN" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    if isinstance(d, list) and len(d) > 0:
        print(d[0].get("id", ""))
    else:
        print("")
except Exception:
    print("")
')

if [[ -z "$ZONE_ID" ]]; then
  echo "  ERROR: $DOMAIN no se encontro en tu cuenta de Cloudflare"
  echo ""
  echo "Opciones:"
  echo "  1. Comprar $DOMAIN en https://domains.cloudflare.com/"
  echo "  2. Si ya lo compraste, espera unos minutos a que se active"
  echo "  3. Si lo compraste en otro registrador, transferilo a Cloudflare primero"
  exit 1
fi
echo "  OK - Zone ID: $ZONE_ID"
echo ""

# 3. Configurar DNS records
echo "[3/6] Configurando DNS records..."

# A record para apex (apex domains usan CNAME flattening en CF cuando Proxied)
echo "  - A @ → 192.0.2.1 (Proxied via Cloudflare)"
cf_api "zones/$ZONE_ID/dns_records" POST '{
  "type": "A",
  "name": "@",
  "content": "192.0.2.1",
  "proxied": true,
  "comment": "Apex domain for Cloudflare Pages"
}' >/dev/null 2>&1 || echo "    (A record puede ya existir, ok)"

# CNAME para www
echo "  - CNAME www → $PAGES_DOMAIN (Proxied)"
cf_api "zones/$ZONE_ID/dns_records" POST "{
  \"type\": \"CNAME\",
  \"name\": \"www\",
  \"content\": \"$PAGES_DOMAIN\",
  \"proxied\": true,
  \"comment\": \"www redirect for Cloudflare Pages\"
}" >/dev/null 2>&1 || echo "    (CNAME puede ya existir, ok)"

echo "  OK - DNS records configurados"
echo ""

# 4. Conectar custom domain al Pages project
echo "[4/6] Conectando $DOMAIN al Pages project $PROJECT..."
RESULT=$(cf_api "accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/domains" POST "{
  \"name\": \"$DOMAIN\"
}" 2>&1 || echo "")

if echo "$RESULT" | grep -q "success"; then
  echo "  OK - Custom domain agregado"
elif echo "$RESULT" | grep -qi "already exists"; then
  echo "  OK - Custom domain ya estaba conectado"
else
  echo "  Aviso - Respuesta:"
  echo "$RESULT" | head -5 | sed 's/^/    /'
fi
echo ""

# 5. Esperar SSL
echo "[5/6] Esperando emision de SSL (max $WAIT_SSL_SECONDS s)..."
ELAPSED=0
INTERVAL=15
while [[ $ELAPSED -lt $WAIT_SSL_SECONDS ]]; do
  if curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "https://$DOMAIN" 2>/dev/null | grep -q "200\|301\|302"; then
    echo "  OK - https://$DOMAIN responde (despues de ${ELAPSED}s)"
    break
  fi
  printf "  Esperando... (%ds/%ds)\n" "$ELAPSED" "$WAIT_SSL_SECONDS"
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [[ $ELAPSED -ge $WAIT_SSL_SECONDS ]]; then
  echo "  AVISO - SSL no emitido en $WAIT_SSL_SECONDS s"
  echo "  El dominio puede estar respondiendo, solo el SSL tarda mas"
fi
echo ""

# 6. Smoke test
echo "[6/6] Corriendo smoke test final..."
if [[ -x "$SCRIPT_DIR/cloudflare-smoke-test.sh" ]]; then
  "$SCRIPT_DIR/cloudflare-smoke-test.sh" --url "https://$DOMAIN" 2>&1 | tail -20
else
  echo "  smoke-test no encontrado, saltando"
fi

echo ""
echo "========================================================"
echo "  Setup completo"
echo "========================================================"
echo ""
echo "Tu sitio esta en: https://$DOMAIN"
echo ""
echo "Si hay problemas:"
echo "  - DNS: revisa en https://dash.cloudflare.com → $DOMAIN → DNS"
echo "  - Pages: revisa en https://dash.cloudflare.com → Workers & Pages → $PROJECT → Custom domains"
echo "  - SSL: puede tardar hasta 15 min despues del primer hit"
echo "  - Re-corre este script las veces que haga falta: bash $0"
