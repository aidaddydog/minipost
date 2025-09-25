#!/usr/bin/env bash
set -Eeuo pipefail
HOST=${1:-http://127.0.0.1:8000}
echo "==> POST $HOST/api/v1/shell/nav/rebuild"
curl -fsS -X POST "$HOST/api/v1/shell/nav/rebuild" || { echo "失败。日志命令：docker compose -f compose/docker-compose.yml logs web --tail=200"; exit 1; }
echo
