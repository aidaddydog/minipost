#!/usr/bin/env bash
set -euo pipefail

# 中文日志 + 严格模式
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo -e "\e[31m[错误]\e[0m 请先 sudo -i 或 su - 切换到 root 后重试。"
  exit 1
fi

cd "$(dirname "$0")/.."

echo -e "\e[36m[迁移]\e[0m 使用 Docker Compose 在容器内执行 Alembic 升级…"
docker compose -f deploy/docker-compose.yml run --rm web alembic upgrade head
echo -e "\e[32m[完成]\e[0m 数据库迁移成功。"
