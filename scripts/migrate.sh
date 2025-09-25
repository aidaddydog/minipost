#!/usr/bin/env bash
set -e; cd "$(dirname "$0")/.."
docker compose -f compose/docker-compose.yml exec -T web bash -lc "alembic -x module=core upgrade head && alembic -x module=auth upgrade head && python -m app.bootstrap rebuild-nav"
