#!/usr/bin/env bash
# cloudflare-deploy.sh — Build local + deploy a Cloudflare Pages vía wrangler
#
# USO:
#   ./scripts/cloudflare-deploy.sh                    # deploy a production
#   ./scripts/cloudflare-deploy.sh --preview           # preview deploy (branch=HEAD)
#   ./scripts/cloudflare-deploy.sh --branch nombre     # preview con nombre custom
#
# Variables opcionales (además de las requeridas en check-env.sh):
#   CLOUDFLARE_COMMIT_MESSAGE  — mensaje del commit a deployar (default: "Manual deploy")
#   SKIP_BUILD                  — si está en "1", no corre `pnpm run build`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/check-env.sh
source "$SCRIPT_DIR/lib/check-env.sh"

PROJECT_NAME="cominorsa-web"
PREVIEW=false
BRANCH_OVERRIDE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
    --preview)
        PREVIEW=true
        shift
        ;;
    --branch)
        BRANCH_OVERRIDE="$2"
        shift 2
        ;;
    -h | --help)
        echo "Uso: $0 [--preview] [--branch nombre]"
        echo ""
        echo "  (sin flags)    Deploy a production"
        echo "  --preview      Deploy como preview (URL temporal)"
        echo "  --branch NAME  Preview con nombre custom de branch"
        exit 0
        ;;
    *)
        echo "✗ Flag desconocida: $1" >&2
        exit 1
        ;;
    esac
done

# Build
if [[ "${SKIP_BUILD:-}" != "1" ]]; then
    echo "▶ Corriendo build..."
    pnpm run build
else
    echo "▶ Build salteado (SKIP_BUILD=1)"
fi

if [[ ! -d "dist" ]]; then
    echo "✗ No existe ./dist — corré el build primero" >&2
    exit 1
fi

# Deploy
DEPLOY_ARGS=(
    pages
    deploy
    dist
    --project-name="$PROJECT_NAME"
    --commit-dirty=true
)

if [[ -n "${CLOUDFLARE_COMMIT_MESSAGE:-}" ]]; then
    DEPLOY_ARGS+=(--commit-message="$CLOUDFLARE_COMMIT_MESSAGE")
fi

if [[ "$PREVIEW" == "true" ]]; then
    DEPLOY_ARGS+=(--branch="${BRANCH_OVERRIDE:-$(git rev-parse --abbrev-ref HEAD)}")
    ENV_LABEL="preview"
else
    DEPLOY_ARGS+=(--branch="${BRANCH_OVERRIDE:-main}")
    ENV_LABEL="production"
fi

echo ""
echo "▶ Deploying a $ENV_LABEL..."
pnpm exec wrangler "${DEPLOY_ARGS[@]}"

echo ""
echo "✓ Deploy completo. Verificá:"
echo "  pnpm exec wrangler pages deployment list --project-name=$PROJECT_NAME"
