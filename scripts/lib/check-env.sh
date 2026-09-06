#!/usr/bin/env bash
# lib/check-env.sh — Carga y valida variables de entorno para Cloudflare CLI
#
# USO:
#   source scripts/lib/check-env.sh
#
# Busca credenciales en este orden:
#   1. Variables de entorno ya exportadas
#   2. .env en la raíz del proyecto
#
# Variables requeridas:
#   CLOUDFLARE_API_TOKEN    — API token con Workers Scripts:Edit + Zone:Read
#                             + Account Settings:Read (cominorsa-web es un
#                             Worker, no un proyecto Pages)
#   CLOUDFLARE_ACCOUNT_ID   — 32 hex chars, del dashboard de Cloudflare

set -euo pipefail

# Buscar la raíz del proyecto (donde está package.json)
_find_root() {
  local dir="${1:-$(pwd)}"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/package.json" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

PROJECT_ROOT="$(_find_root)"

# Cargar .env si existe y las vars no están seteadas
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090,SC1091
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Validar que estén exportadas
_missing=()
[[ -z "${CLOUDFLARE_API_TOKEN:-}" ]] && _missing+=("CLOUDFLARE_API_TOKEN")
[[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]] && _missing+=("CLOUDFLARE_ACCOUNT_ID")

if [[ ${#_missing[@]} -gt 0 ]]; then
  echo "✗ Variables faltantes: ${_missing[*]}" >&2
  echo "" >&2
  echo "  Opción A — Exportar en la terminal:" >&2
  echo "    export CLOUDFLARE_API_TOKEN=\"...\"" >&2
  echo "    export CLOUDFLARE_ACCOUNT_ID=\"...\"" >&2
  echo "" >&2
  echo "  Opción B — Crear .env en la raíz del proyecto:" >&2
  echo "    CLOUDFLARE_API_TOKEN=..." >&2
  echo "    CLOUDFLARE_ACCOUNT_ID=..." >&2
  echo "" >&2
  echo "  Dónde obtenerlas:" >&2
  echo "    • API Token: https://dash.cloudflare.com/profile/api-tokens" >&2
  echo "    • Account ID: panel celeste abajo a la derecha del dashboard" >&2
  exit 1
fi

# Validar formato del Account ID (32 hex chars)
if ! [[ "${CLOUDFLARE_ACCOUNT_ID}" =~ ^[a-f0-9]{32}$ ]]; then
  echo "✗ CLOUDFLARE_ACCOUNT_ID no tiene formato válido (32 hex chars)" >&2
  echo "  Actual: ${CLOUDFLARE_ACCOUNT_ID}" >&2
  echo "  Longitud: ${#CLOUDFLARE_ACCOUNT_ID} chars (esperado: 32)" >&2
  exit 1
fi

# Validar longitud mínima del token (los de CF suelen ser ~40)
if [[ ${#CLOUDFLARE_API_TOKEN} -lt 30 ]]; then
  echo "✗ CLOUDFLARE_API_TOKEN parece muy corto (${#CLOUDFLARE_API_TOKEN} chars)" >&2
  exit 1
fi

# Exportar PROJECT_ROOT para los scripts que sourceen este lib
export PROJECT_ROOT

echo "✓ Credenciales OK"
echo "  Account ID: ${CLOUDFLARE_ACCOUNT_ID:0:8}...${CLOUDFLARE_ACCOUNT_ID: -4}"
echo "  Token:      ${CLOUDFLARE_API_TOKEN:0:8}...${CLOUDFLARE_API_TOKEN: -4}"
