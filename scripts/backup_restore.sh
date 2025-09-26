#!/usr/bin/env bash
set -euo pipefail

# 备份与回滚（PostgreSQL 16）
# 用法：
#   ./scripts/backup_restore.sh backup
#   ./scripts/backup_restore.sh restore <backup_file.sql.gz>

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo -e "\e[31m[错误]\e[0m 请先 sudo -i 或 su - 切换到 root 后重试。"
  exit 1
fi

CMD="${1:-}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
mkdir -p "$BACKUP_DIR"

source "${ROOT_DIR}/.deploy.env" || true

PG_CONT="minipost-postgres-1"
DB="${PG_DB:-minipost}"
USER="${PG_USER:-minipost}"

if [[ "$CMD" == "backup" ]]; then
  ts="$(date +%Y%m%d_%H%M%S)"
  file="${BACKUP_DIR}/pg_${DB}_${ts}.sql.gz"
  echo -e "\e[36m[备份]\e[0m 导出数据库 ${DB} -> ${file}"
  docker exec "${PG_CONT}" bash -lc "pg_dump -U ${USER} ${DB} | gzip -9" > "${file}"
  echo -e "\e[32m[完成]\e[0m 已备份到 ${file}"
elif [[ "$CMD" == "restore" ]]; then
  file="${2:-}"
  if [[ -z "$file" || ! -f "$file" ]]; then
    echo -e "\e[31m[错误]\e[0m 请提供有效备份文件路径。"
    exit 1
  fi
  echo -e "\e[33m[回滚]\e[0m 从备份 ${file} 恢复…"
  gunzip -c "$file" | docker exec -i "${PG_CONT}" bash -lc "psql -U ${USER} ${DB}"
  echo -e "\e[32m[完成]\e[0m 回滚成功。"
else
  echo "用法: $0 backup|restore <file.sql.gz>"
  exit 1
fi
