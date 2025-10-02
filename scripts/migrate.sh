#!/usr/bin/env bash
# scripts/migrate.sh
set -Eeuo pipefail
# 说明：在“宿主机以 root 执行”，通过 docker compose 调用容器内 alembic
docker compose -f deploy/docker-compose.yml exec -T web alembic upgrade head
