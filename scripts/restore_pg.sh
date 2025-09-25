#!/usr/bin/env bash
set -Eeuo pipefail
set -a; . ./.deploy.env; set +a
FILE="$1"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "用法：bash scripts/restore_pg.sh data/backup_pg_xxx.sql.gz"; exit 1
fi
echo "[PG] 恢复 ${FILE} ..."
gunzip -c "$FILE" | docker compose -f compose/docker-compose.yml exec -T postgres psql -U ${DB_USER:-minipost} ${DB_NAME:-minipost}
echo "[PG] 完成。"
echo "# 查看 Postgres 日志（复制即可）"
echo "docker compose -f compose/docker-compose.yml logs postgres --tail=200"
