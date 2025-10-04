#!/usr/bin/env bash
# --- 依赖预检（第 0 步） ---
source "$(cd "$(dirname "$0")" && pwd)/preflight.sh"
# --- 安装密钥守卫（第 1 步） ---
source "$(cd "$(dirname "$0")" && pwd)/install_guard.sh"

# 一键部署（离线模式）
set -euo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo -e "\e[31m[错误]\e[0m 请先 sudo -i 或 su - 切换为 root 后重试"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

OFFLINE_DIR="${ROOT_DIR}/offline"
if [[ ! -d "$OFFLINE_DIR" ]]; then
  echo -e "\e[31m[错误]\e[0m 未找到离线包目录：${OFFLINE_DIR}"
  echo "请将 docker-ce*.deb、docker-compose-plugin*.deb、以及所需镜像 tar 存放于 offline/"
  exit 1
fi

# 安装 Docker/Compose（离线）
dpkg -i ${OFFLINE_DIR}/docker/*.deb || true
dpkg -i ${OFFLINE_DIR}/compose/*.deb || true
systemctl restart docker
docker version >/dev/null 2>&1 || { echo -e "\e[31m[错误]\e[0m Docker 未安装成功"; exit 1; }

# 预加载镜像（web/postgres/nginx 可选）
if ls ${OFFLINE_DIR}/*.tar >/dev/null 2>&1; then
  for t in ${OFFLINE_DIR}/*.tar; do
    docker load -i "$t" || true
  done
fi

# 继续调用在线脚本余下流程（不再联网）
exec "${ROOT_DIR}/scripts/bootstrap_online.sh"
