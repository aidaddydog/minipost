#!/usr/bin/env bash
set -Eeuo pipefail

# === 环境 ===
REPO_URL="${REPO_URL:-https://github.com/aidaddydog/minipost}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/minipost}"
VENV_DIR="${VENV_DIR:-$APP_DIR/.venv}"
: "${HOST:=0.0.0.0}"
: "${PORT:=8000}"
: "${LOG_DIR:=$APP_DIR/logs}"
: "${SERVICE_NAME:=minipost}"

export PIP_INDEX_URL="${PIP_INDEX_URL:-http://mirrors.cloud.aliyuncs.com/pypi/simple/}"
export PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-mirrors.cloud.aliyuncs.com}"

say() { echo -e "$@"; }

get_pub_ip() {
  local ip=""
  ip="$(curl -fsS --max-time 4 https://ipinfo.io/ip || true)"
  [[ -z "$ip" ]] && ip="$(dig +short myip.opendns.com @resolver1.opendns.com || true)"
  [[ -z "$ip" ]] && ip="$(hostname -I 2>/dev/null | awk '{print $1}')" || true
  [[ -z "$ip" ]] && ip="127.0.0.1"
  echo "$ip"
}

install_base() {
  say "==> 安装基础依赖"
  apt-get update -y -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl ca-certificates python3 python3-venv python3-pip unzip ufw >/dev/null
}

sync_repo() {
  say "==> 拉取/更新仓库到 $APP_DIR"
  mkdir -p "$APP_DIR"
  if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" fetch --all -q
    git -C "$APP_DIR" reset --hard "origin/${BRANCH}" -q
  else
    git clone -q -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  # 清理编译缓存
  rm -rf "$APP_DIR/app/__pycache__" "$VENV_DIR"
}

setup_venv() {
  say "==> 准备 Python 虚拟环境"
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install -U pip >/dev/null
  "$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt" >/dev/null
}

write_env() {
  say "==> 写入默认 .deploy.env（保留已存在）"
  if [[ ! -f "$APP_DIR/.deploy.env" ]]; then
cat >"$APP_DIR/.deploy.env" <<EOF
HOST=$HOST
PORT=$PORT
EOF
    say "✔ 已写入 $APP_DIR/.deploy.env"
  else
    say "✔ 已存在 $APP_DIR/.deploy.env，跳过覆盖"
  fi
}

install_service() {
  say "==> 创建日志与运行目录"
  install -d -m 0755 "$LOG_DIR"

  say "==> 安装 systemd 服务"
cat >/etc/systemd/system/${SERVICE_NAME}.service <<'UNIT'
[Unit]
Description=minipost (FastAPI) Service
After=network.target

[Service]
Type=simple
EnvironmentFile=/opt/minipost/.deploy.env
WorkingDirectory=/opt/minipost
ExecStartPre=/usr/bin/install -d -m 0755 /opt/minipost/logs
ExecStart=/opt/minipost/.venv/bin/uvicorn app.main:app --host ${HOST} --port ${PORT}
Restart=on-failure
RestartSec=2
StandardOutput=append:/opt/minipost/logs/uvicorn.out.log
StandardError=append:/opt/minipost/logs/uvicorn.err.log

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable --now "${SERVICE_NAME}.service"
}

open_firewall() {
  say "==> 开放防火墙 $PORT 端口（如已启用 UFW）"
  ufw allow "$PORT/tcp" >/dev/null 2>&1 || true
}

health_check_and_print() {
  say "==> 启动服务"
  systemctl restart "${SERVICE_NAME}.service"
  sleep 1
  systemctl --no-pager -l status "${SERVICE_NAME}.service" | sed -n '1,20p'

  # 健康检查：用 /admin/login 而不是根路径，避免 404
  local PUBIP; PUBIP="$(get_pub_ip)"
  local URL="http://${PUBIP}:${PORT}/admin/login"
  local tries=20
  local ok=0
  for i in $(seq 1 $tries); do
    if curl -fsS -o /dev/null "$URL"; then ok=1; break; fi
    sleep 0.6
  done
  if [[ "$ok" -ne 1 ]]; then
    echo "✘ 健康检查失败，详见：journalctl -u ${SERVICE_NAME}.service -e -n 200"
    exit 1
  fi

  echo "✔ 完成。后台：http://${PUBIP}:${PORT}/admin   登录：/admin/login"
}

main() {
  install_base
  sync_repo
  setup_venv
  write_env
  install_service
  open_firewall
  health_check_and_print
}
main "$@"
