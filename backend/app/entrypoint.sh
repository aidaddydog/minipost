#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] running alembic upgrade head..."
  set +e
  python -m alembic upgrade heads
  RC=$?
  set -e
  if [ $RC -ne 0 ]; then
    echo "[entrypoint] alembic failed (ignored), RC=$RC"
  else
    echo "[entrypoint] alembic done"
  fi
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
