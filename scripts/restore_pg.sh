#!/usr/bin/env bash
set -Eeuo pipefail
COMPOSE_FILE="compose/docker-compose.yml"
IN="${1:-backup.sql}"
if [ ! -f "$IN" ]; then
  echo "用法：$0 <备份文件.sql>"
  exit 1
fi
cat "$IN" | docker compose -f "$COMPOSE_FILE" exec -T db psql -U ${POSTGRES_USER:-minipost} -d ${POSTGRES_DB:-minipost}
echo "— 恢复完成"
echo "查看数据库日志（复制执行）：docker compose -f $COMPOSE_FILE logs db --tail=200"
