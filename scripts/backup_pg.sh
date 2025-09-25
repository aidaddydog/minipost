#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
COMPOSE_FILE="$ROOT_DIR/compose/docker-compose.yml"
ENV_FILE="$ROOT_DIR/compose/.deploy.env"

# shellcheck disable=SC1090
source "$ENV_FILE"

TS="$(date +%Y%m%d_%H%M%S)"
BK_DIR="$ROOT_DIR/backups"
mkdir -p "$BK_DIR"
BK_FILE="pg_${TS}.sql"

echo "[INFO] 备份数据库到 backups/${BK_FILE}"
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "${POSTGRES_USER:-minipost}" "${POSTGRES_DB:-minipost}" -f "/backups/${BK_FILE}"
echo "[OK] 备份完成：backups/${BK_FILE}"
