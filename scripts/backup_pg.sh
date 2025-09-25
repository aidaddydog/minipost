#!/usr/bin/env bash
set -e; cd "$(dirname "$0")/.."; mkdir -p backup
docker compose -f compose/docker-compose.yml exec -T postgres pg_dump -U ${DB_USER:-minipost} ${DB_NAME:-minipost} | gzip -9 > "backup/pg_$(date +%Y%m%d_%H%M%S).sql.gz"
echo "备份文件在 backup/ 目录。"
