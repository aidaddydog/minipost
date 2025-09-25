#!/usr/bin/env bash
# minipost · 一键部署脚本（在线版）
# 作用：在 Ubuntu 24 上自动安装 Docker/Compose、克隆仓库、启动编排、迁移数据库并初始化管理员。
# 用法：bash <(curl -fsSL https://raw.githubusercontent.com/aidaddydog/minipost/main/scripts/bootstrap_online.sh)
set -Eeuo pipefail

PRECHECK=${PRECHECK:-1}
INSTALL_DOCKER=${INSTALL_DOCKER:-1}
NET_TUNING=${NET_TUNING:-1}
ULIMITS=${ULIMITS:-1}
DOCKER_OPT=${DOCKER_OPT:-1}
SEC_BASELINE=${SEC_BASELINE:-1}
PROXY_TLS=${PROXY_TLS:-0}
COMPOSE_UP=${COMPOSE_UP:-1}
MIGRATE_DB=${MIGRATE_DB:-1}
INIT_ADMIN=${INIT_ADMIN:-1}

AUTO_CLEAN=${AUTO_CLEAN:-0}   # 1=先清理旧容器/网络/缓存，再重新部署

REPO_URL=${REPO_URL:-"https://github.com/aidaddydog/minipost.git"}
BRANCH=${BRANCH:-"main"}
APP_DIR=${APP_DIR:-"/opt/minipost"}

LOG_DIR=/var/log/minipost; mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deploy_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "==> [0] 环境预检查"
if [[ "$PRECHECK" == "1" ]]; then
  id -u | grep -q '^0$' || { echo '需要 root 或 sudo'; exit 1; }
  . /etc/os-release && echo "$PRETTY_NAME"; uname -m
  command -v curl >/dev/null || apt-get update && apt-get install -y curl
  getent hosts registry-1.docker.io || nslookup registry-1.docker.io 1.1.1.1 || true
  curl -I --max-time 8 https://registry-1.docker.io || echo '镜像仓库不可达（不阻断）'
fi

echo "==> [1] 安装 Docker & Compose"
if [[ "$INSTALL_DOCKER" == "1" ]]; then
  apt-get update
  apt-get install -y ca-certificates curl jq gnupg lsb-release git unzip dnsutils net-tools ufw
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  docker info
fi

echo "==> [2] 克隆/更新仓库"
mkdir -p "$(dirname "$APP_DIR")"
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR" && git fetch --all -p && git checkout "$BRANCH" && git pull --ff-only
else
  git clone --depth=1 -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> [3] 端口放行（UFW）"
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
# 如果直出 APP_PORT：
APP_PORT=$(grep -E '^APP_PORT=' .deploy.env | cut -d= -f2 | tr -d '\r' || echo "8000")
ufw allow "${APP_PORT}/tcp" || true
yes | ufw enable || true


if [[ "$AUTO_CLEAN" == "1" ]]; then
  echo "==> [3.9] 清理旧容器/网络/镜像缓存（可选）"
  if [[ -f compose/docker-compose.yml ]]; then
    docker compose -f compose/docker-compose.yml down -v --remove-orphans || true
  fi
  docker system prune -f || true
fi

echo "==> [4] 启动编排"
docker compose -f compose/docker-compose.yml up -d --build
docker compose -f compose/docker-compose.yml ps

echo "==> [5] 健康检查"
for i in {1..60}; do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/healthz" >/dev/null 2>&1; then
    echo "web 健康 OK"; break
  fi
  sleep 2
  [[ $i -eq 60 ]] && { echo "web 健康检查失败"; exit 1; }
done

if [[ "$MIGRATE_DB" == "1" ]]; then
  echo "==> [6] 数据库迁移"
  docker compose -f compose/docker-compose.yml exec -T web bash -lc 'alembic upgrade head'
fi

if [[ "$INIT_ADMIN" == "1" ]]; then
  echo "==> [7] 初始化管理员（如不存在）"
  docker compose -f compose/docker-compose.yml exec -T web python - <<'PY'
from app.settings import get_settings
from app.db import SessionLocal
from modules.core.backend.models.rbac import CoreUser
from passlib.hash import bcrypt
import secrets
s=get_settings(); db=SessionLocal()
try:
  u=db.query(CoreUser).filter(CoreUser.username==s.INIT_ADMIN_USER).first()
  if not u:
    pwd=s.INIT_ADMIN_PASS or secrets.token_urlsafe(10)
    u=CoreUser(username=s.INIT_ADMIN_USER, full_name="管理员", email=s.INIT_ADMIN_EMAIL, hashed_password=bcrypt.hash(pwd), is_active=True)
    db.add(u); db.commit()
    print(f"[init-admin] 用户: {s.INIT_ADMIN_USER} 密码: {pwd}")
  else:
    print("[init-admin] 已存在，跳过。")
finally:
  db.close()
PY
fi

echo "==> 完成：访问 http://<服务器IP>:$APP_PORT"
echo "查看日志：docker compose -f compose/docker-compose.yml logs web --tail=200"
