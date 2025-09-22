#!/usr/bin/env bash
# minipost/scripts/install_root.sh
# 可选的离线/二次安装脚本（被 bootstrap_online.sh 覆盖调用）
set -Eeuo pipefail

APP_DIR=${APP_DIR:-/opt/minipost}
: "${LOG_DIR:=${APP_DIR}/logs}"   # 避免 set -u 下未绑定变量报错

echo "==> 准备目录与权限"
install -d -m 0755 "${APP_DIR}"
install -d -m 0755 "${LOG_DIR}"

echo "==> 完成（install_root.sh 占位）"
