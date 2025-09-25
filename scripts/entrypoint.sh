#!/usr/bin/env bash
set -Eeuo pipefail
LOG=${LOG_ROOT:-/logs}/web_entrypoint.log
mkdir -p "$(dirname "$LOG")"; touch "$LOG"

echo "[INFO] (1/3) 重建导航缓存..." | tee -a "$LOG"
python - <<'PY' || { echo "[ERR] 导航缓存重建失败"; exit 1; }
from app.bootstrap import run_startup_tasks
run_startup_tasks()
print("done")
PY

echo "[INFO] (2/3) 执行数据库迁移..." | tee -a "$LOG"
alembic upgrade head || { echo "[ERR] Alembic 迁移失败"; echo "日志：docker compose -f compose/docker-compose.yml logs web --tail=200  # 查看web容器日志"; exit 1; }

echo "[INFO] (3/3) 启动 Gunicorn..." | tee -a "$LOG"
exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${APP_PORT:-8000} --workers ${APP_WORKERS:-2} --log-level ${APP_LOG_LEVEL:-info}
