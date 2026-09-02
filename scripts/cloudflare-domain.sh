#!/usr/bin/env bash
# cloudflare-domain.sh — Configura cominorsa.com.pe como custom domain en Pages
#
# USO:
#   ./scripts/cloudflare-domain.sh                # setup completo guiado
#   ./scripts/cloudflare-domain.sh --check        # solo verificar estado
#   ./scripts/cloudflare-domain.sh --add          # agregar dominio sin guía
#
# Pre-requisitos:
#   1. cominorsa.com.pe agregado a Cloudflare (DNS zone)
#   2. Nameservers cambiados en tu registrar
#   3. API Token con scope Pages:Edit (ya validado en check-env.sh)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/check-env.sh
source "$SCRIPT_DIR/lib/check-env.sh"

# shellcheck source=lib/api.sh
source "$SCRIPT_DIR/lib/api.sh"

PROJECT_NAME="cominorsa-web"
DOMAIN="cominorsa.com.pe"
MODE="guide"

while [[ $# -gt 0 ]]; do
  case "$1" in
  --check)
    MODE="check"
    shift
    ;;
  --add)
    MODE="add"
    shift
    ;;
  -h | --help)
    echo "Uso: $0 [--check | --add]"
    echo ""
    echo "  (sin flags)  Modo guiado con checks y explicaciones"
    echo "  --check      Solo verificar estado actual"
    echo "  --add        Agregar dominio sin guía"
    exit 0
    ;;
  *)
    echo "✗ Flag desconocida: $1" >&2
    exit 1
    ;;
  esac
done

# --check: solo ver estado
if [[ "$MODE" == "check" ]]; then
  echo "▶ Estado actual de cominorsa.com.pe en Cloudflare:"
  echo ""
  echo "Zona DNS:"
  ZONE_ID="$(cf_get_zone_by_name "$DOMAIN")"
  if [[ "$ZONE_ID" == "NOT_FOUND" ]]; then
    echo "  ✗ $DOMAIN NO está en Cloudflare"
    echo "  → Andá al dashboard, 'Add a site', seguí el wizard"
  else
    echo "  ✓ $DOMAIN en Cloudflare (zone id: $ZONE_ID)"
  fi
  echo ""
  echo "Custom domains en cominorsa-web:"
  cf_list_pages_domains "$PROJECT_NAME"
  exit 0
fi

# --add: skip guía
if [[ "$MODE" != "guide" ]]; then
  echo "▶ Agregando $DOMAIN a $PROJECT_NAME..."
  pnpm exec wrangler pages domain add "$DOMAIN" --project-name="$PROJECT_NAME"
  echo ""
  echo "✓ Dominio agregado. Esperá 2-5 min para que se propague."
  exit 0
fi

# Modo guide
clear_line() { printf '\r\033[2K'; }

echo "═══════════════════════════════════════════════════════"
echo "  Custom domain setup: $DOMAIN → $PROJECT_NAME"
echo "═══════════════════════════════════════════════════════"
echo ""

# Paso 1: verificar zona
echo "▶ Paso 1/4: ¿$DOMAIN está en Cloudflare?"
ZONE_ID="$(cf_get_zone_by_name "$DOMAIN")"
if [[ "$ZONE_ID" == "NOT_FOUND" ]]; then
  echo "  ✗ $DOMAIN NO está en Cloudflare"
  echo ""
  echo "  HACÉ ESTO (manual, en el dashboard):"
  echo "    1. https://dash.cloudflare.com → click 'Add a site'"
  echo "    2. Escribí $DOMAIN → click 'Add site'"
  echo "    3. Elegí plan 'Free'"
  echo "    4. CF va a escanear DNS records existentes"
  echo "    5. Te va a dar 2 nameservers (ej: clayton.ns.cloudflare.com)"
  echo "    6. Anotalos y volvé acá"
  echo ""
  echo "  DESPUÉS (en tu registrar — probablemente NIC.pe):"
  echo "    1. Login en NIC.pe → 'Mis dominios' → $DOMAIN"
  echo "    2. Configuración DNS / Nameservers"
  echo "    3. Cambiá los NS actuales por los 2 que te dio CF"
  echo "    4. Guardá y esperá 5-30 min"
  echo ""
  echo "  CUANDO TERMINE, volvé a correr este script:"
  echo "    $0"
  echo ""
  exit 0
else
  echo "  ✓ $DOMAIN en Cloudflare"
fi
echo ""

# Paso 2: verificar nameservers
echo "▶ Paso 2/4: ¿Los nameservers apuntan a Cloudflare?"
CF_NS=$(dig +short NS "$DOMAIN" @1.1.1.1 | head -2)
if [[ -z "$CF_NS" ]]; then
  echo "  ✗ No se pudo consultar (DNS no responde)"
elif echo "$CF_NS" | grep -qi "cloudflare.com"; then
  echo "  ✓ Nameservers apuntan a Cloudflare:"
  echo "$CF_NS" | sed 's/^/    /'
else
  echo "  ✗ Los nameservers NO apuntan a Cloudflare todavía:"
  echo "$CF_NS" | sed 's/^/    /'
  echo ""
  echo "  Esperá unos minutos y volvé a correr: $0"
  exit 0
fi
echo ""

# Paso 3: agregar dominio a Pages
echo "▶ Paso 3/4: Agregar $DOMAIN a $PROJECT_NAME..."
EXISTING_DOMAINS="$(cf_list_pages_domains "$PROJECT_NAME" | grep -F "$DOMAIN" || true)"
if [[ -n "$EXISTING_DOMAINS" ]]; then
  echo "  ✓ $DOMAIN ya está agregado al proyecto"
else
  echo "  Agregando..."
  if pnpm exec wrangler pages domain add "$DOMAIN" --project-name="$PROJECT_NAME"; then
    echo "  ✓ $DOMAIN agregado"
  else
    echo "  ✗ Falló. Intentá manualmente:"
    echo "    pnpm exec wrangler pages domain add $DOMAIN --project-name=$PROJECT_NAME"
    exit 1
  fi
fi
echo ""

# Paso 4: esperar y verificar SSL
echo "▶ Paso 4/4: Esperando SSL + verificación final..."
echo "  Esperá 30 segundos y testeamos..."
sleep 30

if curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN" 2>/dev/null | grep -q "200"; then
  echo "  ✓ https://$DOMAIN responde 200 OK"
  echo ""
  echo "Headers de seguridad:"
  curl -sSI "https://$DOMAIN" | grep -iE "content-security-policy|strict-transport|x-frame|x-content|referrer" | sed 's/^/    /'
else
  echo "  ⚠ https://$DOMAIN aún no responde (puede tardar hasta 5 min)"
  echo "  Verificá manualmente en unos minutos:"
  echo "    curl -I https://$DOMAIN"
fi
echo ""

echo "═══════════════════════════════════════════════════════"
echo "  ✓ Setup completo"
echo "═══════════════════════════════════════════════════════"
