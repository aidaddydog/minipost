#!/usr/bin/env bash
set -euo pipefail

# ===== 基础参数 =====
REPO_URL="https://github.com/aidaddydog/minipost"
BRANCH="${BRANCH:-main}"
APP_DIR="/opt/minipost"
VENV_DIR="$APP_DIR/.venv"
SERVICE_NAME="minipost.service"

# 避免未定义报错
LOG_DIR="${LOG_DIR:-$APP_DIR/logs}"
HOST_DEFAULT="0.0.0.0"
PORT_DEFAULT="8000"

say() { printf "%s\n" "$*"; }
step() { say "==> $*"; }
ok() { say "✔ $*"; }
err() { say "✘ $*" >&2; }

# ===== 安装依赖 =====
step "安装基础依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y git curl ca-certificates python3 python3-venv python3-pip unzip ufw >/dev/null 2>&1 || true

# ===== 拉取/更新仓库 =====
step "拉取/更新仓库到 $APP_DIR"
mkdir -p "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone -b "$BRANCH" --depth=1 "$REPO_URL" "$APP_DIR" >/dev/null
else
  git -C "$APP_DIR" fetch origin "$BRANCH" --depth=1 >/dev/null
  git -C "$APP_DIR" reset --hard "origin/$BRANCH" >/dev/null
fi

# ===== Python 虚拟环境 =====
step "准备 Python 虚拟环境"
python3 -m venv "$VENV_DIR"
# 使用国内镜像更快
"$VENV_DIR/bin/pip" install -U pip -i http://mirrors.cloud.aliyuncs.com/pypi/simple/ --trusted-host mirrors.cloud.aliyuncs.com >/dev/null
"$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt" -i http://mirrors.cloud.aliyuncs.com/pypi/simple/ --trusted-host mirrors.cloud.aliyuncs.com >/dev/null

# ===== .deploy.env（若不存在创建）=====
step "写入默认 .deploy.env（保留已存在）"
DEPLOY_ENV="$APP_DIR/.deploy.env"
if [ ! -f "$DEPLOY_ENV" ]; then
  cat >"$DEPLOY_ENV" <<EOF
HOST=$HOST_DEFAULT
PORT=$PORT_DEFAULT
EOF
  ok "已写入 $DEPLOY_ENV"
else
  ok "已存在 $DEPLOY_ENV，跳过覆盖"
fi

# 读取端口
set +u
# shellcheck disable=SC1090
. "$DEPLOY_ENV"
HOST="${HOST:-$HOST_DEFAULT}"
PORT="${PORT:-$PORT_DEFAULT}"
set -u

# ===== 目录/权限 =====
step "创建日志与运行目录"
install -d -m 0755 "$LOG_DIR"

# ===== 安装 systemd 服务 =====
step "安装 systemd 服务"
install -D -m 0644 "$APP_DIR/scripts/systemd/minipost.service" "/etc/systemd/system/$SERVICE_NAME"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true

# ===== 放行防火墙 =====
step "开放防火墙 $PORT 端口（如已启用 UFW）"
ufw allow "$PORT"/tcp >/dev/null 2>&1 || true

# ===== 启动服务 =====
step "启动服务"
if ! systemctl restart "$SERVICE_NAME"; then
  err "启动失败，查看日志：journalctl -u $SERVICE_NAME -e -n 200"
  exit 1
fi

# ===== 健康检查（避免 curl 404）=====
HEALTH_URL="http://127.0.0.1:$PORT/healthz"
for i in $(seq 1 30); do
  if curl -fsS --max-time 1 "$HEALTH_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# 打印状态
systemctl --no-pager --full status "$SERVICE_NAME" || true

# ===== 解析公网 IP =====
get_public_ip() {
  # 多重回退，选第一个可用的
  curl -4fsS --max-time 3 https://api.ipify.org \
  || curl -4fsS --max-time 3 http://whatismyip.akamai.com \
  || curl -4fsS --max-time 3 http://ifconfig.me \
  || curl -4fsS --max-time 3 http://ip.3322.net \
  || hostname -I | awk '{print $1}'
}
PUB_IP="$(get_public_ip)"
[ -n "$PUB_IP" ] || PUB_IP="<服务器IP>"

say "✔ 完成。后台：http://$PUB_IP:$PORT/admin   登录：/admin/login"
