#!/usr/bin/env bash
set -Eeuo pipefail
echo "[DB] Alembic 升级到 head ..."
docker compose -f compose/docker-compose.yml exec -T web bash -lc 'alembic upgrade head'
echo "[DB] 完成。"
