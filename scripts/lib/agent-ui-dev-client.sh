#!/usr/bin/env bash
# Shared Expo dev-client Metro URL (sourced by agent-ui-host + ensure-packager).

: "${METRO_PORT:=8081}"

# Print exp+ontrack://… URL for packager host [$1] (default PACKAGER_HOST / 127.0.0.1).
agent_ui_dev_client_metro_url() {
  local host="${1:-${PACKAGER_HOST:-127.0.0.1}}"
  local port="${2:-${METRO_PORT:-8081}}"
  case "$host" in
    localhost|lan|LAN) host=127.0.0.1 ;;
  esac
  local encoded
  encoded="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "http://${host}:${port}")"
  printf 'exp+ontrack://expo-development-client/?url=%s' "$encoded"
}
