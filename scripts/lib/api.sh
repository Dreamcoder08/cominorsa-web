#!/usr/bin/env bash
# lib/api.sh — Wrappers para la API de Cloudflare
#
# USO:
#   source scripts/lib/check-env.sh
#   source scripts/lib/api.sh
#
# Funciones:
#   cf_api <method> <path> [json_body]
#   cf_verify_token
#   cf_list_pages_projects
#   cf_list_pages_deployments <project>
#   cf_list_zones
#   cf_get_zone_by_name <domain>
#   cf_list_pages_domains <project>

# cf_api <method> <path> [json_body]
# Llama a la API de Cloudflare y devuelve solo el body JSON.
cf_api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  local args=(
    -sS
    -X "$method"
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
    -H "Content-Type: application/json"
    "https://api.cloudflare.com/client/v4${path}"
  )

  if [[ -n "$body" ]]; then
    args+=(--data "$body")
  fi

  local response
  response="$(curl "${args[@]}")"

  # Si la respuesta tiene "success": false, fallar
  local success
  success="$(CF_JSON="$response" python3 -c "import os, json; print(json.loads(os.environ['CF_JSON']).get('success', False))" 2>/dev/null)"
  if [[ "$success" != "True" && "$success" != "true" ]]; then
    echo "✗ API call failed: $method $path" >&2
    echo "$response" | python3 -m json.tool >&2
    return 1
  fi

  echo "$response"
}

# Helper: ejecuta un script Python con un JSON pasado via env var CF_JSON
_cf_py() {
  CF_JSON="$1" python3 <<'PYEOF'
import os, json
try:
    d = json.loads(os.environ["CF_JSON"])
except Exception:
    sys.exit(1)
PYEOF
}

# cf_verify_token — Verifica que el token funcione
cf_verify_token() {
  local response
  response="$(cf_api GET "/user/tokens/verify")"
  local status
  status="$(CF_JSON="$response" python3 -c "import os, json; d=json.loads(os.environ['CF_JSON']); print(d['result']['status'] if d.get('success') else 'invalid')")"
  if [[ "$status" == "active" ]]; then
    echo "✓ Token activo"
    CF_JSON="$response" python3 <<'PYEOF'
import os, json
d = json.loads(os.environ["CF_JSON"])
r = d.get("result", {})
print(f"  ID:       {r.get('id', '?')}")
print(f"  Name:     {r.get('name', '?')}")
print(f"  Expires:  {r.get('expires_on', 'never')}")
PYEOF
    return 0
  else
    echo "✗ Token no está activo: $status" >&2
    return 1
  fi
}

# cf_list_pages_projects — Lista proyectos Pages de la cuenta
cf_list_pages_projects() {
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects")"
  CF_JSON="$response" python3 <<'PYEOF'
import os, json
d = json.loads(os.environ["CF_JSON"])
projects = d.get("result", [])
if not projects:
    print("(no hay proyectos Pages)")
    exit(0)
print(f"{len(projects)} proyecto(s):")
for p in projects:
    name = p.get("name", "?")
    pid = p.get("id", "?")
    subdomain = p.get("subdomain", "?")
    created = p.get("created_on", "?")[:10]
    print(f"  - {name}")
    print(f"      subdomain: {subdomain}.pages.dev")
    print(f"      id:        {pid}")
    print(f"      created:   {created}")
PYEOF
}

# cf_list_pages_deployments <project>
cf_list_pages_deployments() {
  local project="$1"
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}/deployments")"
  CF_JSON="$response" python3 <<'PYEOF'
import os, json
d = json.loads(os.environ["CF_JSON"])
deploys = d.get("result", [])
if not deploys:
    print("(no hay deployments)")
    exit(0)
print(f"{len(deploys)} deployment(s):")
for dep in deploys[:10]:
    did = dep.get("id", "?")
    env = dep.get("environment", "?")
    branch = dep.get("deployment_trigger", {}).get("metadata", {}).get("branch", "?")
    commit = dep.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash", "?")[:7]
    url = dep.get("url", "?")
    created = dep.get("created_on", "?")[:19]
    print(f"  - {did}")
    print(f"      env:    {env}")
    print(f"      branch: {branch} @ {commit}")
    print(f"      url:    {url}")
    print(f"      when:   {created}")
PYEOF
}

# cf_list_zones — Lista dominios (zonas) en la cuenta
cf_list_zones() {
  local response
  response="$(cf_api GET "/zones?per_page=50")"
  CF_JSON="$response" python3 <<'PYEOF'
import os, json
d = json.loads(os.environ["CF_JSON"])
zones = d.get("result", [])
if not zones:
    print("(no hay zonas - agrega un dominio a Cloudflare primero)")
    exit(0)
print(f"{len(zones)} zona(s):")
for z in zones:
    name = z.get("name", "?")
    status = z.get("status", "?")
    zid = z.get("id", "?")
    ns = z.get("name_servers", [])
    print(f"  - {name}")
    print(f"      status:  {status}")
    print(f"      id:      {zid}")
    print(f"      ns:      {', '.join(ns[:2])}")
PYEOF
}

# cf_get_zone_by_name <domain>
# Devuelve el zone ID o "NOT_FOUND"
cf_get_zone_by_name() {
  local domain="$1"
  local response
  response="$(cf_api GET "/zones?name=${domain}")"
  CF_JSON="$response" python3 <<'PYEOF'
import os, json
d = json.loads(os.environ["CF_JSON"])
zones = d.get("result", [])
if not zones:
    print("NOT_FOUND")
    exit(0)
z = zones[0]
print(z.get("id", ""))
PYEOF
}

# cf_list_pages_domains <project> — Lista custom domains configurados en Pages
cf_list_pages_domains() {
  local project="$1"
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}/domains")"
  CF_JSON="$response" python3 <<'PYEOF'
import os, json
d = json.loads(os.environ["CF_JSON"])
domains = d.get("result", [])
if not domains:
    print("(no hay custom domains)")
    exit(0)
for dom in domains:
    name = dom.get("name", "?")
    status = dom.get("status", "?")
    print(f"  - {name} -- {status}")
PYEOF
}

# cf_list_worker_domains <worker_name> — Lista Custom Domains de un Worker
# (cominorsa-web es un Worker, no un proyecto Pages -- ver cf_add_worker_domain)
cf_list_worker_domains() {
  local worker="$1"
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains?service=${worker}")"
  CF_JSON="$response" python3 <<'PYEOF'
import os, json
d = json.loads(os.environ["CF_JSON"])
domains = d.get("result", [])
if not domains:
    print("(no hay custom domains en este Worker)")
    exit(0)
for dom in domains:
    hostname = dom.get("hostname", "?")
    zone_name = dom.get("zone_name", "?")
    print(f"  - {hostname} (zone: {zone_name})")
PYEOF
}

# cf_add_worker_domain <worker_name> <zone_id> <hostname>
# Adjunta un Custom Domain a un Worker. Requiere Workers Scripts:Write.
# https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/
cf_add_worker_domain() {
  local worker="$1"
  local zone_id="$2"
  local hostname="$3"
  local body
  body="$(python3 -c "import json,sys; print(json.dumps({'hostname': sys.argv[1], 'service': sys.argv[2], 'zone_id': sys.argv[3]}))" "$hostname" "$worker" "$zone_id")"
  cf_api PUT "/accounts/${CLOUDFLARE_ACCOUNT_ID}/workers/domains" "$body"
}
