#!/usr/bin/env bash
# cloudflare-setup.sh — Verifica credenciales y lista recursos de Cloudflare
#
# USO:
#   ./scripts/cloudflare-setup.sh
#
# Salida:
#   - Estado del token (activo/expirado)
#   - Lista de proyectos Pages
#   - Deployments del proyecto cominorsa-web
#   - Lista de zonas (dominios) en la cuenta
#   - Custom domains configurados en cominorsa-web

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/check-env.sh
source "$SCRIPT_DIR/lib/check-env.sh"

# shellcheck source=lib/api.sh
source "$SCRIPT_DIR/lib/api.sh"

echo ""
echo "▶ Verificando token..."
cf_verify_token

echo ""
echo "▶ Proyectos Pages en la cuenta:"
cf_list_pages_projects

echo ""
echo "▶ Deployments de cominorsa-web:"
cf_list_pages_deployments cominorsa-web

echo ""
echo "▶ Zonas (dominios) en la cuenta:"
cf_list_zones

echo ""
echo "▶ Custom domains en cominorsa-web:"
cf_list_pages_domains cominorsa-web

echo ""
echo "✓ Setup verificado"
