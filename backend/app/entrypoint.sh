#!/usr/bin/env bash
set -Eeuo pipefail

# 容器内自迁移（失败不致命，避免重启死循环）
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] running alembic upgrade head..."
  set +e
  python -m alembic upgrade head
  RC=$?
  set -e
  if [ $RC -ne 0 ]; then
    echo "[entrypoint] alembic failed (ignored), RC=$RC"
  else
    echo "[entrypoint] alembic done"
  fi
fi

# 启动 API（此时不会在 import 阶段访问 DB）
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
