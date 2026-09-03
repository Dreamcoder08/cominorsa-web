#!/usr/bin/env bash
# cloudflare-deploy.sh — Build local + deploy a Cloudflare Workers vía wrangler
#
# vinext emite un Worker SSR (dist/server/index.js + wrangler.json), no HTML
# estático — por eso el target es "wrangler deploy" contra dist/server/, no
# "wrangler pages deploy".
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
        echo "  Build + wrangler deploy contra dist/server/wrangler.json"
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

WRANGLER_CONFIG="$PROJECT_ROOT/dist/server/wrangler.json"

if [[ ! -f "$WRANGLER_CONFIG" ]]; then
    echo "✗ No existe $WRANGLER_CONFIG — corré el build primero" >&2
    exit 1
fi

# Must run from the project root with an explicit --config: invoking wrangler
# from inside dist/server makes it also discover the stale
# .wrangler/deploy/config.json left by the vite build, which triggers
# "Found both a user configuration file... and a deploy configuration file"
# even though both resolve to the same file.
echo ""
echo "▶ Deploying a Cloudflare Workers..."
cd "$PROJECT_ROOT"
pnpm exec wrangler deploy --config "$WRANGLER_CONFIG" --name "$WORKER_NAME"

echo ""
echo "✓ Deploy completo. Verificá:"
echo "  pnpm exec wrangler deployments list --name=$WORKER_NAME"
