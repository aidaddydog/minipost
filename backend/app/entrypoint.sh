#!/usr/bin/env bash
set -Eeuo pipefail

# 可选：在容器启动时自动迁移（默认关闭；统一由外部一键脚本控制）
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[entrypoint] running alembic upgrade head..."
  # 容器内已包含 /app/alembic.ini 与 /app/alembic
  python -m alembic upgrade head || echo "[entrypoint] alembic failed (ignored)"
fi

# 启动 API
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
