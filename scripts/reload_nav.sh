#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$SCRIPT_DIR/../compose"
( cd "$COMPOSE_DIR" && docker compose run --rm web python -m app.bootstrap reload-nav )
