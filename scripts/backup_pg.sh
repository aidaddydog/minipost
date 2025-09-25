#!/usr/bin/env bash
set -Eeuo pipefail
T=${1:-$(date +%Y%m%d_%H%M%S)}
OUT=${2:-/opt/minipost/backup/pg_${T}.sql.gz}
mkdir -p "$(dirname "$OUT")"
echo "==> 备份 PG 到 $OUT"
docker compose -f compose/docker-compose.yml exec -T postgres pg_dump -U ${DB_USER:-minipost} ${DB_NAME:-minipost} | gzip -9 > "$OUT"
echo "完成。"
