#!/usr/bin/env bash
set -Eeuo pipefail
set -a; . ./.deploy.env; set +a
TS=$(date +%Y%m%d_%H%M%S)
OUT="backup_pg_${TS}.sql.gz"
echo "[PG] 备份到 ${OUT} ..."
docker compose -f compose/docker-compose.yml exec -T postgres pg_dump -U ${DB_USER:-minipost} ${DB_NAME:-minipost} | gzip -9 > "data/${OUT}"
echo "[PG] 完成：data/${OUT}"
echo "# 查看 Postgres 日志（复制即可）"
echo "docker compose -f compose/docker-compose.yml logs postgres --tail=200"
