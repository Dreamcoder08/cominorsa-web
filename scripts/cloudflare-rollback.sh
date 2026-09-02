#!/usr/bin/env bash
# cloudflare-rollback.sh — Rollback del deploy al anterior
#
# USO:
#   ./scripts/cloudflare-rollback.sh                # rollback a producción
#   ./scripts/cloudflare-rollback.sh --preview      # rollback del último preview
#   ./scripts/cloudflare-rollback.sh --list         # listar deploys disponibles
#
# Requiere:
#   CLOUDFLARE_API_TOKEN (variable de entorno o en .env)
#   CLOUDFLARE_ACCOUNT_ID (variable de entorno o en .env)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Cargar lib de API
# shellcheck source=lib/api.sh
source "$SCRIPT_DIR/lib/api.sh"
# shellcheck source=lib/check-env.sh
source "$SCRIPT_DIR/lib/check-env.sh"

PROJECT="cominorsa-web"
ENVIRONMENT="production"
LIST_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --preview) ENVIRONMENT="preview"; shift ;;
    --list) LIST_ONLY=true; shift ;;
    -h|--help)
      echo "Uso: $0 [--preview] [--list]"
      echo ""
      echo "  --preview  Rollback del último preview deploy"
      echo "  --list     Solo listar los deploys disponibles"
      exit 0
      ;;
    *) echo "Flag desconocida: $1" >&2; exit 1 ;;
  esac
done

echo ""
echo "Rollback de $PROJECT ($ENVIRONMENT)"
echo "========================================================"
echo ""

# Verificar credenciales (skip en --list)
if [[ "$LIST_ONLY" != "true" ]]; then
  check_env_token
fi

# Listar deploys
echo "Obteniendo lista de deploys..."
DEPLOYMENTS=$(cf_list_pages_deployments "$PROJECT" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if isinstance(d, list):
        for dep in d[:10]:
            env = dep.get('environment', '?')
            url = dep.get('url', '?')
            ts = dep.get('created_on', '?')
            sha = dep.get('deployment_trigger', {}).get('metadata', {}).get('commit_sha', '?')[:7]
            print(f\"  {env:10} {ts} {url} ({sha})\")
    else:
        print('  (no se pudo parsear la respuesta)')
except Exception as e:
    print(f'  Error: {e}')
" 2>&1)

echo "$DEPLOYMENTS"
echo ""

if [[ "$LIST_ONLY" == "true" ]]; then
  exit 0
fi

# Confirmar
echo "Esto hara rollback del deploy activo en '$ENVIRONMENT'."
echo "Requiere wrangler CLI (no tenemos)"
echo ""
echo "Para hacer rollback manual:"
echo "  1. Workers & Pages → cominorsa-web → Deployments"
echo "  2. Click en el deploy al que queres volver"
echo "  3. Click en 'Promote to production' (para prod) o"
echo "     'Set as active' (para preview)"
echo ""
echo "O via CLI:"
echo "  npx wrangler pages deployment rollback <deployment-id> --project-name $PROJECT"
echo ""
echo "ADVERTENCIA: el rollback no es destructivo. El deploy activo sigue existiendo."
exit 0
