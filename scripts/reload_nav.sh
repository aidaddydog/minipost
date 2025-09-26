#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/docker-compose.yml"
# 在容器内调用 /api/nav/reload，随后打印统计信息
docker compose -f "${COMPOSE_FILE}" exec -T web \
  sh -lc 'res=$(curl -sf -X POST http://127.0.0.1:8000/api/nav/reload || true); echo "$res"'
