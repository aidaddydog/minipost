#!/usr/bin/env bash
set -e
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
OUT_DIR="$BASE_DIR/backups"; mkdir -p "$OUT_DIR"; TS="$(date +%Y%m%d_%H%M%S)"
cd "$BASE_DIR/compose"
docker compose exec -T postgres pg_dump -U minipost minipost | gzip > "$OUT_DIR/minipost.$TS.sql.gz"
echo "[OK] 备份完成：$OUT_DIR/minipost.$TS.sql.gz"
