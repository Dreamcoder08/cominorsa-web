#!/usr/bin/env bash
# cloudflare-status.sh — Estado actual de la zona, nameservers y deploy
#
# USO:
#   ./scripts/cloudflare-status.sh
#   ./scripts/cloudflare-status.sh --zone otrodominio.com
#
# No requiere credenciales. Hace consultas públicas de DNS.

set -euo pipefail

ZONE="cominorsa.com.pe"
while [[ $# -gt 0 ]]; do
  case "$1" in
  --zone)
    ZONE="$2"
    shift 2
    ;;
  -h | --help)
    echo "Uso: $0 [--zone dominio.com]"
    exit 0
    ;;
  *)
    echo "Flag desconocida: $1" >&2
    exit 1
    ;;
  esac
done

echo ""
echo "Estado DNS de $ZONE"
echo "========================================================"
echo ""

# 1. WHOIS
echo "[1/8] WHOIS:"
WHOIS_OUT="$(whois "$ZONE" 2>&1 | head -20 || true)"
if echo "$WHOIS_OUT" | grep -qi "no object found"; then
  echo "  AVISO: No Object Found"
  echo "  El dominio no esta delegado en los NS autoritativos del .pe"
  echo "  Puede ser que aun no hiciste el cambio de nameservers en NIC.pe"
elif echo "$WHOIS_OUT" | grep -qi "name server"; then
  echo "$WHOIS_OUT" | grep -i "name server" | head -4 | sed 's/^/    /'
else
  echo "$WHOIS_OUT" | head -5 | sed 's/^/    /'
fi
echo ""

# 2. NS via Cloudflare
echo "[2/8] NS records - Cloudflare 1.1.1.1:"
NS_RESULT="$(dig NS "$ZONE" @1.1.1.1 +short 2>&1 || true)"
if [[ -z "$NS_RESULT" ]]; then
  echo "  AVISO: Sin respuesta - NS no apuntan a Cloudflare todavia"
  echo "  Cambialos en NIC.pe y espera 1-2h"
else
  echo "$NS_RESULT" | sed 's/^/    /'
  if echo "$NS_RESULT" | grep -qi "cloudflare.com"; then
    echo "  OK - Apuntan a Cloudflare"
  else
    echo "  AVISO - No apuntan a Cloudflare"
  fi
fi
echo ""

# 3. NS via Google
echo "[3/8] NS records - Google 8.8.8.8:"
NS_GOOGLE="$(dig NS "$ZONE" @8.8.8.8 +short 2>&1 || true)"
if [[ -n "$NS_GOOGLE" ]]; then
  echo "$NS_GOOGLE" | sed 's/^/    /'
else
  echo "    sin respuesta"
fi
echo ""

# 4. A record
echo "[4/8] A record - Cloudflare:"
A_RESULT="$(dig A "$ZONE" @1.1.1.1 +short 2>&1 || true)"
if [[ -n "$A_RESULT" ]]; then
  echo "$A_RESULT" | sed 's/^/    /'
else
  echo "    sin A record"
fi
echo ""

# 5. CNAME via DoH
echo "[5/8] CNAME records - Cloudflare DoH:"
curl -sS "https://cloudflare-dns.com/dns-query?name=$ZONE&type=CNAME" \
  -H "accept: application/dns-json" 2>&1 | python3 -c "import sys, json; d=json.load(sys.stdin); ans=d.get('Answer', []); [print('    ' + a.get('name', '?') + ' -> ' + a.get('data', '?')) for a in ans] if ans else print('    no CNAME records')"
echo ""

# 6. Pages subdomain
echo "[6/8] Pages subdomain cominorsa-web.pages.dev:"
HTTP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "https://cominorsa-web.pages.dev" 2>/dev/null || echo "000")"
if [[ "$HTTP_CODE" == "200" ]]; then
  echo "  OK - Responde 200, deploy activo"
elif [[ "$HTTP_CODE" == "000" ]]; then
  echo "  AVISO - Sin respuesta, DNS no resuelve o timeout"
else
  echo "  HTTP $HTTP_CODE"
fi
echo ""

# 7. Custom domain
echo "[7/8] Custom domain $ZONE:"
ZONE_HTTP="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "https://$ZONE" 2>/dev/null || echo "000")"
if [[ "$ZONE_HTTP" == "200" ]]; then
  echo "  OK - Custom domain activo"
elif [[ "$ZONE_HTTP" == "000" ]]; then
  echo "  AVISO - Sin respuesta, NS no propagados o dominio no delegado"
else
  echo "  HTTP $ZONE_HTTP"
fi
echo ""

# 8. Resumen
echo "[8/8] Resumen:"
if echo "$NS_RESULT" | grep -qi "cloudflare.com"; then
  echo "  OK - Nameservers apuntan a Cloudflare"
else
  echo "  ESPERANDO - Nameservers no apuntan a Cloudflare"
  echo "    Cambialos en NIC.pe si no lo hiciste"
  echo "    Esperar 1-2h para propagacion"
fi

if [[ "$ZONE_HTTP" == "200" ]]; then
  echo "  OK - Custom domain funciona"
else
  echo "  ESPERANDO - Custom domain no responde"
fi

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "  OK - Deploy Pages funciona"
fi
echo ""
