#!/usr/bin/env bash
set -Eeuo pipefail

# 可选：容器内自迁移（提高首启成功率；失败不致命）
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

# 启动 API
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
