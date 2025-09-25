#!/usr/bin/env bash
set -e
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
LAST="$(ls -1t "$BASE_DIR/backups"/minipost.*.sql.gz 2>/dev/null | head -n1 || true)"
[[ -z "$LAST" ]] && { echo "未找到备份"; exit 1; }
cd "$BASE_DIR/compose"
zcat "$LAST" | docker compose exec -T postgres psql -U minipost minipost
echo "[OK] 已恢复：$LAST"
