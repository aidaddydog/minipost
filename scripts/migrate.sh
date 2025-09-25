#!/usr/bin/env bash
# 统一迁移脚本（容器内执行），失败时提供一行日志命令
set -e
AL_CMD="alembic upgrade head"
echo "[迁移] 执行：$AL_CMD"
$AL_CMD
echo "[迁移] 完成。如有问题请执行：journalctl -u <服务名>.service -e -n 200  # systemd 日志（如使用）"
