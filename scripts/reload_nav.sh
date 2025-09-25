#!/usr/bin/env bash
set -e; cd "$(dirname "$0")/.."
docker compose -f compose/docker-compose.yml exec -T web bash -lc "python -m app.bootstrap rebuild-nav"
