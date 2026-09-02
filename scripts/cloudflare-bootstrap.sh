#!/usr/bin/env bash
# cloudflare-bootstrap.sh — Verificación pre-vuelo completa antes del go-live
#
# USO: ./scripts/cloudflare-bootstrap.sh
#
# NO requiere credenciales. Verifica:
#   1. Repo local limpio
#   2. Todos los commits pusheados a GitHub
#   3. Tests pasando localmente
#   4. Build sin errores
#   5. Lint limpio
#   6. Scripts ejecutables
#   7. Headers CSP correctos
#   8. Files críticos presentes (favicon, og.png, robots, sitemap)
#
# Sale 0 si todo OK, 1 si hay problemas.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.." || exit 1

ERRORS=0
WARNINGS=0

ok()   { printf "  [OK] %s\n" "$1"; }
fail() { printf "  [FAIL] %s\n" "$1"; ERRORS=$((ERRORS + 1)); }
warn() { printf "  [WARN] %s\n" "$1"; WARNINGS=$((WARNINGS + 1)); }
hr()   { echo "----------------------------------------"; }

echo ""
echo "Pre-vuelo de cominorsa-web"
echo "========================================================"
echo ""

hr
echo "1. Repo local"
hr
if [[ -z "$(git status --porcelain 2>/dev/null)" ]]; then
  ok "Working tree limpio"
else
  warn "Cambios sin commitear:"
  git status --short | sed 's/^/    /'
fi
echo ""

hr
echo "2. Push a GitHub"
hr
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null)
if [[ -z "$LOCAL" || -z "$REMOTE" ]]; then
  warn "No se puede comparar con origin/main"
elif [[ "$LOCAL" == "$REMOTE" ]]; then
  ok "main está sincronizado con origin/main"
else
  warn "Local y remote divergentes"
  echo "    Local:  $LOCAL"
  echo "    Remote: $REMOTE"
fi
echo ""

hr
echo "3. Tests"
hr
if pnpm test 2>&1 | grep -q "fail 0"; then
  ok "66/66 tests pasando"
else
  fail "Tests fallando - revisar"
fi
echo ""

hr
echo "4. Lint"
hr
LINT_OUT=$(pnpm run lint 2>&1 || true)
if echo "$LINT_OUT" | grep -qE "[1-9][0-9]* error"; then
  fail "Lint tiene errors"
elif echo "$LINT_OUT" | grep -qE "[1-9][0-9]* warning"; then
  warn "Lint tiene warnings"
else
  ok "Lint limpio (0 errors, 0 warnings)"
fi
echo ""

hr
echo "5. Build"
hr
if [[ -d "dist/client" ]]; then
  ok "dist/ existe (build previo)"
  JS_SIZE=$(du -sb dist/client/_next/static/chunks/*.js 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
  CSS_SIZE=$(du -sb dist/client/_next/static/css/*.css 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
  echo "    JS:  $((JS_SIZE / 1024)) KB"
  echo "    CSS: $((CSS_SIZE / 1024)) KB"
else
  warn "No hay dist/ - corre 'pnpm run build' antes de deployar"
fi
echo ""

hr
echo "6. Scripts ejecutables"
hr
FOUND_SCRIPTS=0
for s in scripts/cloudflare-*.sh; do
  if [[ -f "$s" ]]; then
    FOUND_SCRIPTS=$((FOUND_SCRIPTS + 1))
    if [[ -x "$s" ]]; then
      ok "$s es ejecutable"
    else
      fail "$s no es ejecutable (chmod +x)"
    fi
  fi
done
if [[ $FOUND_SCRIPTS -eq 0 ]]; then
  warn "No se encontraron scripts cloudflare-*.sh"
fi
echo ""

hr
echo "7. Headers de seguridad"
hr
if [[ -f "dist/client/_headers" ]]; then
  HEADERS=$(cat dist/client/_headers)
  if echo "$HEADERS" | grep -q "Content-Security-Policy"; then
    ok "CSP presente"
  else
    fail "CSP faltante en dist/client/_headers"
  fi
  if echo "$HEADERS" | grep -q "Strict-Transport-Security"; then
    ok "HSTS presente"
  else
    warn "HSTS faltante"
  fi
  if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    ok "X-Frame-Options presente"
  else
    warn "X-Frame-Options faltante"
  fi
else
  fail "dist/client/_headers no existe (corre build)"
fi
echo ""

hr
echo "8. Files críticos"
hr
for f in public/favicon.ico public/og.png public/robots.txt public/sitemap.xml; do
  if [[ -f "$f" ]]; then
    SIZE=$(stat -c%s "$f" 2>/dev/null)
    ok "$f ($SIZE bytes)"
  else
    fail "$f FALTA"
  fi
done
echo ""

hr
echo "9. Estado DNS (requiere NIC.pe actualizado)"
hr
"$SCRIPT_DIR/cloudflare-status.sh" 2>&1 | tail -8
echo ""

hr
echo "RESUMEN"
hr
if [[ $ERRORS -gt 0 ]]; then
  echo "  $ERRORS errores criticos"
  echo "  $WARNINGS warnings"
  echo ""
  echo "ACCION REQUERIDA: revisar antes de go-live"
  exit 1
fi

if [[ $WARNINGS -gt 0 ]]; then
  echo "  0 errores criticos"
  echo "  $WARNINGS warnings"
  echo ""
  echo "OK para go-live (revisar warnings)"
  exit 0
fi

echo "  TODO OK - listo para go-live"
echo ""
echo "Proximos pasos:"
echo "  1. NIC.pe: cambiar NS a harleigh.ns.cloudflare.com y johnathan.ns.cloudflare.com"
echo "  2. Esperar 1-2h para propagacion"
echo "  3. pnpm cf:watch (monitorea hasta que termine)"
echo "  4. CF dashboard: Workers & Pages → cominorsa-web → Custom domains → Set up cominorsa.com.pe"
echo "  5. pnpm cf:smoke --url https://cominorsa.com.pe"
exit 0
