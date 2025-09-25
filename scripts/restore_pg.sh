#!/usr/bin/env bash
# PostgreSQL 恢复：docker exec + psql
set -e
IN=${1:?请提供 SQL 备份文件路径}
COMPOSE_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/compose/docker-compose.yml"
echo "[恢复] 从：$IN"
docker compose -f "$COMPOSE_FILE" exec -T db psql -U ${POSTGRES_USER:-minipost} -d ${POSTGRES_DB:-minipost} < "$IN"
echo "[恢复] 完成。查看日志： docker compose -f $COMPOSE_FILE logs db --tail=200"
