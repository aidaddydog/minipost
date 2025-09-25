#!/usr/bin/env bash
set -Eeuo pipefail
echo "==> 执行数据库迁移（alembic upgrade head）"
alembic upgrade head
# 失败排查：docker compose -f compose/docker-compose.yml logs web --tail=200
