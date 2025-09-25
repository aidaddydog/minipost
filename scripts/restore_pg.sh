#!/usr/bin/env bash
set -e; cd "$(dirname "$0")/.."
FILE="$1"; [ -f "$FILE" ] || { echo "用法：scripts/restore_pg.sh <pg_xxx.sql.gz>"; exit 1; }
zcat "$FILE" | docker compose -f compose/docker-compose.yml exec -T postgres psql -U ${DB_USER:-minipost} ${DB_NAME:-minipost}
echo "恢复完成。"
