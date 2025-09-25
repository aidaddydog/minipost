#!/usr/bin/env bash
# PostgreSQL 备份：docker exec + pg_dump
set -e
OUT=${1:-"/mnt/backup/minipost_$(date +%Y%m%d_%H%M%S).sql"}
COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/compose/docker-compose.yml"
echo "[备份] 输出到：$OUT"
docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U ${POSTGRES_USER:-minipost} ${POSTGRES_DB:-minipost} > "$OUT"
echo "[备份] 完成。查看日志： docker compose -f $COMPOSE_FILE logs db --tail=200"
