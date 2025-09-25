#!/usr/bin/env bash
# 一键部署脚本（Ubuntu 24 + Docker Compose）
# 特点：中文注释 + 进度提示 + 二次覆盖/更新 + 自动放行端口 + 失败时提供一行日志命令
set -Eeuo pipefail

LOG_DIR="/var/log/minipost"; mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/bootstrap.$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1
trap 'echo -e "\n✘ 失败（行号:$LINENO，退出码:$?）\n—— 查看日志（复制执行）：tail -n 200 '"$LOG_FILE"'\n"' ERR

echo "[STEP] 0. 审前检查（root/系统/网络）"
id -u | grep -q '^0$' || { echo "请使用 root 或 sudo 执行"; exit 1; }
. /etc/os-release; echo "系统：$PRETTY_NAME"; uname -m
getent hosts registry-1.docker.io || true
curl -fsSI --max-time 8 https://registry-1.docker.io >/dev/null || echo "镜像仓库连接异常（继续尝试）"

echo "[STEP] 1. 安装基础依赖与 Docker"
apt-get update
apt-get install -y ca-certificates curl jq gnupg lsb-release git unzip dnsutils net-tools ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

echo "[STEP] 2. 拉取/更新仓库到 /opt/minipost（二次执行将拉取更新）"
REPO="https://github.com/aidaddydog/minipost.git"
DST="/opt/minipost"
if [ ! -d "$DST/.git" ]; then
  rm -rf "$DST" && mkdir -p "$DST"
  git clone "$REPO" "$DST"
else
  git -C "$DST" fetch --all --prune
  git -C "$DST" reset --hard origin/main
fi
cd "$DST"

echo "[STEP] 3. 写入默认 .deploy.env（保留已存在）"
if [ -f .deploy.env ]; then
  echo "✔ 已存在 .deploy.env，跳过生成"
elif [ -f .deploy.env.sample ]; then
  cp .deploy.env.sample .deploy.env
  echo "✔ 已从 .deploy.env.sample 生成 .deploy.env"
else
  cat > .deploy.env <<'ENV'
# minipost 部署环境（默认值，可在 1Panel/CI 中覆盖）
APP_HOST=0.0.0.0
APP_PORT=8000
APP_WORKERS=2
DATA_ROOT=/opt/minipost/data
LOG_ROOT=/opt/minipost/logs
DB_HOST=postgres
DB_PORT=5432
DB_NAME=minipost
DB_USER=minipost
DB_PASS=minipost_pass
REDIS_URL=
SESSION_SECRET=CHANGE_ME_SECRET
NAV_SHELL_WS=0
ADMIN_USER=admin
ADMIN_PASS=
APP_INIT_ADMIN=1
ENV
  echo "✔ 已生成默认 .deploy.env"
fi

echo "[STEP] 4. Docker 优化与 UFW"
cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "local",
  "log-opts": {"max-size":"64m","max-file":"5"},
  "exec-opts": ["native.cgroupdriver=systemd"],
  "live-restore": true,
  "default-ulimits":{"nofile":{"Name":"nofile","Soft":1048576,"Hard":1048576}}
}
JSON
systemctl restart docker || true
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

echo "[STEP] 5. 启动 Compose"
docker compose -f compose/docker-compose.yml up -d --build

echo "[STEP] 6. 等待 web 健康并执行迁移 + 初始化管理员 + 合并导航"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8000/healthz >/dev/null; then break; fi
  sleep 2
done
docker compose -f compose/docker-compose.yml exec -T web bash -lc \
  "alembic -x module=core upgrade head && \
   alembic -x module=auth upgrade head && \
   python -m app.bootstrap init-admin && \
   python -m app.bootstrap rebuild-nav"

echo "[STEP] 7. 完成"
echo "访问：http://<你的服务器IP>:${APP_PORT:-8000}（或叠加 compose/docker-compose.nginx.yml 使用 HTTPS）"
echo "查看 web 日志（复制执行）：docker compose -f compose/docker-compose.yml logs web --tail=200"
