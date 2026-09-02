#!/usr/bin/env bash
# cloudflare-watch.sh — Monitorea propagación hasta que los NS apunten a Cloudflare
#
# USO:
#   ./scripts/cloudflare-watch.sh                    # poll cada 60s, default domain
#   ./scripts/cloudflare-watch.sh --interval 30      # poll cada 30s
#   ./scripts/cloudflare-watch.sh --max 7200         # máximo 2h de espera
#   ./scripts/cloudflare-watch.sh --zone otro.com
#
# Sale 0 cuando los NS apuntan a Cloudflare, 1 si se acaba el tiempo.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ZONE="cominorsa.com.pe"
INTERVAL=60
MAX_SECONDS=3600  # 1 hora

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval) INTERVAL="$2"; shift 2 ;;
    --max) MAX_SECONDS="$2"; shift 2 ;;
    --zone) ZONE="$2"; shift 2 ;;
    -h|--help)
      echo "Uso: $0 [--interval N] [--max N] [--zone dominio.com]"
      echo ""
      echo "  --interval N  Segundos entre checks (default: 60)"
      echo "  --max N       Tiempo máximo de espera en segundos (default: 3600)"
      exit 0
      ;;
    *) echo "Flag desconocida: $1" >&2; exit 1 ;;
  esac
done

START_TIME=$(date +%s)
ATTEMPT=0

echo ""
echo "Monitoreando propagación de NS para $ZONE"
echo "  Intervalo: ${INTERVAL}s"
echo "  Max: ${MAX_SECONDS}s ($(($MAX_SECONDS / 60)) min)"
echo ""

while true; do
  ATTEMPT=$((ATTEMPT + 1))
  ELAPSED=$(($(date +%s) - START_TIME))

  if [[ $ELAPSED -gt $MAX_SECONDS ]]; then
    echo ""
    echo "TIMEOUT - Tiempo maximo alcanzado ($MAX_SECONDS s)"
    echo "La propagacion aun no se completo"
    echo ""
    echo "Verificacion manual:"
    echo "  dig NS $ZONE @1.1.1.1"
    exit 1
  fi

  NS_RESULT="$(dig NS "$ZONE" @1.1.1.1 +short 2>&1 || true)"

  TIMESTAMP=$(date '+%H:%M:%S')
  printf "[%s] intento #%d (%ds elapsed) ... " "$TIMESTAMP" "$ATTEMPT" "$ELAPSED"

  if echo "$NS_RESULT" | grep -qi "cloudflare.com"; then
    echo "OK - NS apuntan a Cloudflare"
    echo ""
    echo "$NS_RESULT" | sed 's/^/    /'
    echo ""
    echo "PROPAGACION COMPLETA"
    echo ""
    echo "Proximos pasos:"
    echo "  1. Workers & Pages → cominorsa-web → Custom domains"
    echo "  2. Set up a custom domain → cominorsa.com.pe"
    echo "  3. Cloudflare crea el CNAME record automaticamente"
    echo "  4. Esperar 2-5 min"
    echo "  5. pnpm cf:smoke --url https://cominorsa.com.pe"
    exit 0
  fi

  echo "esperando..."
  sleep "$INTERVAL"
done
