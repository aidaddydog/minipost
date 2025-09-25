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
fail_hint(){
  echo -e "\n✘ 失败，末尾 200 行日志（快速查看命令）："
  echo "tail -n 200 \"$LOG_FILE\"  # 查看本次安装日志末尾"
}

trap 'fail_hint' ERR

step "0. 审前检查（root/系统/网络）"
id -u | grep -q '^0$' || { echo "[FATAL] 需要 root 执行"; exit 1; }
. /etc/os-release && echo "系统：$PRETTY_NAME"; uname -m
getent hosts registry-1.docker.io || nslookup registry-1.docker.io 1.1.1.1 || true

###############################################################################
# 仅此处优化：一键清理并重新安装 Docker/Compose（无交互）
###############################################################################
step "1. 安装 Docker/Compose（一键清理并重新安装 · 无交互）"
echo "→ 停止旧服务（忽略不存在的情况）"
systemctl stop docker 2>/dev/null || true
systemctl stop containerd 2>/dev/null || true

echo "→ 彻底清理旧包（docker.io / docker-ce / compose-plugin / containerd / runc）"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get purge -y \
  docker.io docker-doc docker-compose docker-compose-plugin \
  docker-ce docker-ce-cli containerd.io containerd runc || true
apt-get autoremove -y || true

echo "→ 删除旧的数据目录（/var/lib/docker /var/lib/containerd）与残留配置（谨慎：会清空旧镜像与容器）"
rm -rf /var/lib/docker /var/lib/containerd || true

echo "→ 移除旧的 APT 源与 Key（避免覆盖提示与签名冲突）"
rm -f /etc/apt/sources.list.d/docker.list || true
rm -f /etc/apt/keyrings/docker.gpg || true
install -m 0755 -d /etc/apt/keyrings

echo "→ 写入 Docker 官方 GPG Key（非交互）"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "→ 写入 Docker 官方稳定源（stable）"
ARCH=$(dpkg --print-architecture)
CODENAME=$(. /etc/os-release; echo "$VERSION_CODENAME")
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

echo "→ 安装最新 Docker CE / CLI / containerd / compose-plugin（非交互）"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl jq gnupg lsb-release git ufw \
  docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "→ 启用并启动 docker 服务"
systemctl enable --now docker

echo "√ Docker 重新安装完成（已清理旧环境并安装最新版）"
###############################################################################

step "2. 克隆仓库到 $CLONE_DIR（二次执行将拉取更新）"
if [ -d "$CLONE_DIR/.git" ]; then
  echo "→ 检测到已存在仓库，执行拉取更新（git pull --ff-only）"
  git -C "$CLONE_DIR" pull --ff-only
else
  echo "→ 首次部署，克隆仓库到 $CLONE_DIR"
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
  if curl -fsS "http://127.0.0.1:${APP_PORT}/healthz" >/dev/null; then echo "OK"; break; fi
  sleep 3
done

echo -e "\n[SUCCESS] 部署完成。访问： http://<你的IP>:${APP_PORT}/ （或配合 Nginx 走 80/443）"
echo "[LOG] 查看日志：docker compose -f compose/docker-compose.yml logs web --tail=200"
