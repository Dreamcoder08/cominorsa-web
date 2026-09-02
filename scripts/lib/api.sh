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
  local code
  code="$(echo "$response" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("result",{}).get("code", 200) if isinstance(json.load(sys.stdin).get("result"), dict) and "code" in json.load(sys.stdin).get("result",{}) else 200)' 2>/dev/null || echo "0")"

  # Si la respuesta tiene "success": false, fallar
  local success
  success="$(echo "$response" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("success", False))')"
  if [[ "$success" != "True" && "$success" != "true" ]]; then
    echo "✗ API call failed: $method $path" >&2
    echo "$response" | python3 -m json.tool >&2
    return 1
  fi

  echo "$response"
}

# cf_verify_token — Verifica que el token funcione
cf_verify_token() {
  local response
  response="$(cf_api GET "/user/tokens/verify")"
  local status
  status="$(echo "$response" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["result"]["status"] if d.get("success") else "invalid")')"
  if [[ "$status" == "active" ]]; then
    echo "✓ Token activo"
    echo "$response" | python3 -c '
import sys, json
d = json.load(sys.stdin)
r = d.get("result", {})
print(f"  ID:       {r.get(\"id\", \"?\")}")
print(f"  Name:     {r.get(\"name\", \"?\")}")
print(f"  Expires:  {r.get(\"expires_on\", \"never\")}")
'
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
  echo "$response" | python3 -c '
import sys, json
d = json.load(sys.stdin)
projects = d.get("result", [])
if not projects:
    print("(no hay proyectos Pages)")
    sys.exit(0)
print(f"{len(projects)} proyecto(s):")
for p in projects:
    name = p.get("name", "?")
    pid = p.get("id", "?")
    subdomain = p.get("subdomain", "?")
    created = p.get("created_on", "?")[:10]
    print(f"  • {name}")
    print(f"      subdomain: {subdomain}.pages.dev")
    print(f"      id:        {pid}")
    print(f"      created:   {created}")
'
}

# cf_list_pages_deployments <project>
cf_list_pages_deployments() {
  local project="$1"
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}/deployments")"
  echo "$response" | python3 -c '
import sys, json
d = json.load(sys.stdin)
deploys = d.get("result", [])
if not deploys:
    print("(no hay deployments)")
    sys.exit(0)
print(f"{len(deploys)} deployment(s):")
for dep in deploys[:10]:  # últimos 10
    did = dep.get("id", "?")
    env = dep.get("environment", "?")
    branch = dep.get("deployment_trigger", {}).get("metadata", {}).get("branch", "?")
    commit = dep.get("deployment_trigger", {}).get("metadata", {}).get("commit_hash", "?")[:7]
    url = dep.get("url", "?")
    created = dep.get("created_on", "?")[:19]
    print(f"  • {did}")
    print(f"      env:    {env}")
    print(f"      branch: {branch} @ {commit}")
    print(f"      url:    {url}")
    print(f"      when:   {created}")
'
}

# cf_list_zones — Lista dominios (zonas) en la cuenta
cf_list_zones() {
  local response
  response="$(cf_api GET "/zones?per_page=50")"
  echo "$response" | python3 -c '
import sys, json
d = json.load(sys.stdin)
zones = d.get("result", [])
if not zones:
    print("(no hay zonas — agregá un dominio a Cloudflare primero)")
    sys.exit(0)
print(f"{len(zones)} zona(s):")
for z in zones:
    name = z.get("name", "?")
    status = z.get("status", "?")
    zid = z.get("id", "?")
    ns = z.get("name_servers", [])
    print(f"  • {name}")
    print(f"      status:  {status}")
    print(f"      id:      {zid}")
    print(f"      ns:      {\", \".join(ns[:2])}")
'
}

# cf_get_zone_by_name <domain>
cf_get_zone_by_name() {
  local domain="$1"
  local response
  response="$(cf_api GET "/zones?name=${domain}")"
  echo "$response" | python3 -c "
import sys, json
d = json.load(sys.stdin)
zones = d.get('result', [])
if not zones:
    print('NOT_FOUND')
    sys.exit(0)
z = zones[0]
print(z.get('id', ''))
"
}

# cf_list_pages_domains <project> — Lista custom domains configurados en Pages
cf_list_pages_domains() {
  local project="$1"
  local response
  response="$(cf_api GET "/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}/domains")"
  echo "$response" | python3 -c '
import sys, json
d = json.load(sys.stdin)
domains = d.get("result", [])
if not domains:
    print("(no hay custom domains)")
    sys.exit(0)
for dom in domains:
    name = dom.get("name", "?")
    status = dom.get("status", "?")
    print(f"  • {name} — {status}")
'
}
