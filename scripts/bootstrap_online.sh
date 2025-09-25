#!/usr/bin/env bash
# minipost · 一键部署（Ubuntu 24 + Docker + Compose）
# 进度提示与中文释义；失败时给出一行日志命令。
set -Eeuo pipefail

REPO=${REPO:-"https://github.com/aidaddydog/minipost.git"}
CLONE_DIR=${CLONE_DIR:-"/opt/minipost"}
LOG_DIR=/var/log/minipost; mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/bootstrap_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

step(){ echo -e "\n[STEP] $*"; }

step "0. 审前检查（root/系统/网络）"
id -u | grep -q '^0$' || { echo "[FATAL] 需要 root 执行"; exit 1; }
. /etc/os-release && echo "系统：$PRETTY_NAME"; uname -m
getent hosts registry-1.docker.io || nslookup registry-1.docker.io 1.1.1.1 || true

step "1. 安装 Docker/Compose"
apt-get update
apt-get install -y ca-certificates curl jq gnupg lsb-release git ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo   "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu   $(. /etc/os-release; echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

step "2. 克隆仓库到 $CLONE_DIR（二次执行将拉取更新）"
if [ -d "$CLONE_DIR/.git" ]; then
  git -C "$CLONE_DIR" pull --ff-only
else
  mkdir -p "$CLONE_DIR"
  git clone "$REPO" "$CLONE_DIR"
fi
cd "$CLONE_DIR"

step "3. 放行端口（80/443/APP_PORT）"
APP_PORT=$(grep -E '^APP_PORT=' .deploy.env | cut -d= -f2 | tr -d '\r' || echo 8000)
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow ${APP_PORT}/tcp || true
yes | ufw enable || true

step "4. 启动编排（web + postgres [+redis 可选]）"
docker compose -f compose/docker-compose.yml up -d --build

step "5. 等待 web 健康 /healthz=200"
for i in {1..60}; do
  if curl -fsS http://127.0.0.1:${APP_PORT}/healthz >/dev/null; then echo "OK"; break; fi
  sleep 3
done

echo -e "\n[SUCCESS] 部署完成。访问： http://<你的IP>:${APP_PORT}/ （或配合 Nginx 走 80/443）"
echo "[LOG] 查看日志：docker compose -f compose/docker-compose.yml logs web --tail=200"
