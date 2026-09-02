#!/usr/bin/env bash
# cloudflare-smoke-test.sh — Valida que el sitio deployado esté funcionando bien
#
# USO:
#   ./scripts/cloudflare-smoke-test.sh                    # test default URL (pages.dev)
#   ./scripts/cloudflare-smoke-test.sh --url https://...  # test custom URL
#   ./scripts/cloudflare-smoke-test.sh --url https://cominorsa.com.pe

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/check-env.sh
source "$SCRIPT_DIR/lib/check-env.sh"

# shellcheck source=lib/api.sh
source "$SCRIPT_DIR/lib/api.sh"

PROJECT_NAME="cominorsa-web"
TEST_URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) TEST_URL="$2"; shift 2 ;;
    -h|--help)
      echo "Uso: $0 [--url https://example.com]"
      exit 0
      ;;
    *) echo "✗ Flag desconocida: $1" >&2; exit 1 ;;
  esac
done

# Si no se pasó URL, usar la del último deploy
if [[ -z "$TEST_URL" ]]; then
  echo "▶ Obteniendo URL del último deploy..."
  DEPLOYMENTS_JSON="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/deployments?per_page=1")"
  TEST_URL="$(echo "$DEPLOYMENTS_JSON" | python3 -c '
import sys, json
d = json.load(sys.stdin)
deploys = d.get("result", [])
if not deploys:
    sys.exit("no deployments")
print(deploys[0].get("url", ""))
')"
  if [[ -z "$TEST_URL" ]]; then
    echo "✗ No se pudo obtener URL del último deploy" >&2
    exit 1
  fi
fi

# Normalizar URL (sin trailing slash)
TEST_URL="${TEST_URL%/}"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Smoke test: $TEST_URL"
echo "═══════════════════════════════════════════════════════"
echo ""

PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  local expected="$3"

  printf "  [%s] %s ... " "$([[ "$expected" == "pass" ]] && echo "✓" || echo "?")" "$name"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "✓"
    PASS=$((PASS + 1))
  else
    echo "✗"
    FAIL=$((FAIL + 1))
  fi
}

# Test 1: HTTP 200 en home
check "Home responde 200" \
  "curl -sS -o /dev/null -w '%{http_code}' --max-time 10 '$TEST_URL/' | grep -q '^200$'" \
  "pass"

# Test 2: 404 en ruta inexistente (con página branded)
HTTP_404="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$TEST_URL/no-existe-test-$(date +%s)")"
echo "  [✓] 404 en ruta inexistente → HTTP $HTTP_404 (esperado: 404)"
[[ "$HTTP_404" == "404" ]] && PASS=$((PASS + 1)) || FAIL=$((FAIL + 1))

# Test 3: robots.txt
ROBOTS=$(curl -sS --max-time 10 "$TEST_URL/robots.txt")
if echo "$ROBOTS" | grep -q "User-Agent: \*"; then
  echo "  [✓] /robots.txt tiene User-Agent: *"
  PASS=$((PASS + 1))
else
  echo "  [✗] /robots.txt no tiene User-Agent esperado"
  FAIL=$((FAIL + 1))
fi

# Test 4: sitemap.xml
SITEMAP=$(curl -sS --max-time 10 "$TEST_URL/sitemap.xml")
if echo "$SITEMAP" | grep -q "<urlset"; then
  echo "  [✓] /sitemap.xml tiene <urlset>"
  PASS=$((PASS + 1))
else
  echo "  [✗] /sitemap.xml inválido"
  FAIL=$((FAIL + 1))
fi

# Test 5: Content-Security-Policy header
CSP=$(curl -sSI --max-time 10 "$TEST_URL/" | grep -i "content-security-policy" || true)
if [[ -n "$CSP" ]]; then
  echo "  [✓] Content-Security-Policy presente"
  PASS=$((PASS + 1))
else
  echo "  [✗] Falta Content-Security-Policy"
  FAIL=$((FAIL + 1))
fi

# Test 6: HSTS
HSTS=$(curl -sSI --max-time 10 "$TEST_URL/" | grep -i "strict-transport-security" || true)
if [[ -n "$HSTS" ]]; then
  echo "  [✓] Strict-Transport-Security presente"
  PASS=$((PASS + 1))
else
  echo "  [✗] Falta HSTS"
  FAIL=$((FAIL + 1))
fi

# Test 7: X-Frame-Options
XFO=$(curl -sSI --max-time 10 "$TEST_URL/" | grep -i "x-frame-options" || true)
if [[ -n "$XFO" ]]; then
  echo "  [✓] X-Frame-Options presente"
  PASS=$((PASS + 1))
else
  echo "  [✗] Falta X-Frame-Options"
  FAIL=$((FAIL + 1))
fi

# Test 8: manifest.json
MANIFEST=$(curl -sS --max-time 10 "$TEST_URL/manifest.webmanifest" || curl -sS --max-time 10 "$TEST_URL/manifest.json" || true)
if echo "$MANIFEST" | grep -q "name"; then
  echo "  [✓] /manifest.webmanifest accesible"
  PASS=$((PASS + 1))
else
  echo "  [✗] /manifest.webmanifest no accesible"
  FAIL=$((FAIL + 1))
fi

# Test 9: favicon
FAVICON=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$TEST_URL/favicon.ico")
if [[ "$FAVICON" == "200" ]]; then
  echo "  [✓] /favicon.ico responde 200"
  PASS=$((PASS + 1))
else
  echo "  [✗] /favicon.ico responde $FAVICON"
  FAIL=$((FAIL + 1))
fi

# Test 10: OG image
OG=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$TEST_URL/og.png")
if [[ "$OG" == "200" ]]; then
  OG_SIZE=$(curl -sSI --max-time 10 "$TEST_URL/og.png" | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
  echo "  [✓] /og.png responde 200 (size: ${OG_SIZE} bytes)"
  PASS=$((PASS + 1))
else
  echo "  [✗] /og.png responde $OG"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "═══════════════════════════════════════════════════════"
if [[ $FAIL -eq 0 ]]; then
  echo "  ✓ Todos los tests pasaron ($PASS/$((PASS + FAIL)))"
else
  echo "  ✗ $FAIL test(s) fallaron ($PASS pasaron)"
fi
echo "═══════════════════════════════════════════════════════"

exit $FAIL
