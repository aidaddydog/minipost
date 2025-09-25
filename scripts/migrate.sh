#!/usr/bin/env bash
set -e
cd "$(cd "$(dirname "$0")"/.. && pwd)/compose" && docker compose exec -T web alembic -c migrations/alembic.ini upgrade head
