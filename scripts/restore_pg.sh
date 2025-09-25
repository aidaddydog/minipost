#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
COMPOSE_FILE="$ROOT_DIR/compose/docker-compose.yml"
ENV_FILE="$ROOT_DIR/compose/.deploy.env"
source "$ENV_FILE"

LAST_SQL="$(ls -t "$ROOT_DIR/backups"/pg_*.sql 2>/dev/null | head -n1 || true)"
if [ -z "$LAST_SQL" ]; then
  echo "[WARN] 未找到可恢复的 SQL 备份"; exit 0
fi
echo "[INFO] 恢复数据库：$LAST_SQL"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "${POSTGRES_USER:-minipost}" -d "${POSTGRES_DB:-minipost}" -f "/backups/$(basename "$LAST_SQL")"
echo "[OK] 恢复完成"
