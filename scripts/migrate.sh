#!/usr/bin/env bash
set -euo pipefail
# 迁移/建表（首次使用 create_all；后续可切换 Alembic）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$SCRIPT_DIR/../compose"
( cd "$COMPOSE_DIR" && docker compose run --rm web python -m app.bootstrap migrate )
