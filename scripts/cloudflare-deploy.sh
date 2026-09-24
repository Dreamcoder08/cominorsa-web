#!/usr/bin/env bash
# cloudflare-deploy.sh — Build local + deploy a Cloudflare Workers vía wrangler
#
# T11: el sitio ahora es estático (Cloudflare Workers Static Assets desde
# dist-static/) más un Worker chico para las 2 rutas /api/*. El config
# canónico es el wrangler.jsonc de la raíz del repo (ya NO
# dist/server/wrangler.json, que era generado por vinext/@cloudflare/vite-plugin
# — ese pipeline se retiró en este cutover).
#
# USO:
#   ./scripts/cloudflare-deploy.sh                    # deploy a production
#
# Variables opcionales (además de las requeridas en check-env.sh):
#   SKIP_BUILD  — si está en "1", no corre `pnpm run build`

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=lib/check-env.sh
source "$SCRIPT_DIR/lib/check-env.sh"

WORKER_NAME="cominorsa-web"

while [[ $# -gt 0 ]]; do
    case "$1" in
    -h | --help)
        echo "Uso: $0"
        echo ""
        echo "  Build + wrangler deploy contra el wrangler.jsonc de la raíz"
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

WRANGLER_CONFIG="$PROJECT_ROOT/wrangler.jsonc"

if [[ ! -f "$WRANGLER_CONFIG" ]]; then
    echo "✗ No existe $WRANGLER_CONFIG" >&2
    exit 1
fi

if [[ ! -d "$PROJECT_ROOT/dist-static" ]]; then
    echo "✗ No existe dist-static/ — corré el build primero" >&2
    exit 1
fi

# A stale .wrangler/deploy/config.json (left over from an old `vinext
# build`/`wrangler deploy --dry-run`, before this cutover) can silently
# pin wrangler to a retired config even with the real wrangler.jsonc
# present at the root — bit this exact migration during T11 (see
# odd/tasks/bun-vanilla-migration.md). If a deploy ever behaves like it's
# reading the wrong config, `rm -rf .wrangler` (gitignored, safe) first.
echo ""
echo "▶ Deploying a Cloudflare Workers..."
cd "$PROJECT_ROOT"
pnpm exec wrangler deploy --config "$WRANGLER_CONFIG" --name "$WORKER_NAME"

echo ""
echo "✓ Deploy completo. Verificá:"
echo "  pnpm exec wrangler deployments list --name=$WORKER_NAME"
