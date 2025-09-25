#!/usr/bin/env bash
set -Eeuo pipefail
IN=${1:?缺少备份文件路径}
echo "==> 从 $IN 恢复 PG"
gzip -cd "$IN" | docker compose -f compose/docker-compose.yml exec -T postgres psql -U ${DB_USER:-minipost} ${DB_NAME:-minipost}
echo "完成。"
