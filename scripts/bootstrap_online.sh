#!/usr/bin/env bash
# minipost/scripts/bootstrap_online.sh
# 说明：一键拉起/更新 FastAPI 服务（安全幂等，修复变量展开、日志目录 & 输出公网 IP）
set -Eeuo pipefail

APP_DIR=${APP_DIR:-/opt/minipost}
REPO_URL=${REPO_URL:-https://github.com/aidaddydog/minipost.git}
BRANCH=${BRANCH:-main}
PY=${PY:-python3}
PIP_INDEX=${PIP_INDEX:-http://mirrors.cloud.aliyuncs.com/pypi/simple/}
DEBIAN_FRONTEND=noninteractive

log() { echo -e "$@"; }
step() { echo -e "==> $@"; }
ok() { echo -e "✔ $@"; }
err() { echo -e "✘ $@" 1>&2; }

detect_public_ip() {
  # 优先云厂商元数据（阿里云），再退回公网查询，最终回落到内网地址
  local ip=""
  # 阿里云元数据（可能不存在，最多 1s）
  ip=$(curl -4 -fsS --max-time 1 http://100.100.100.200/latest/meta-data/public-ipv4 || true)
  if [ -z "$ip" ]; then
    # 常见公网查询（各 2s 超时）
    ip=$(curl -4 -fsS --max-time 2 http://ifconfig.me || true)
  fi
  if [ -z "$ip" ]; then
    ip=$(curl -4 -fsS --max-time 2 http://ipinfo.io/ip || true)
  fi
  if [ -z "$ip" ]; then
    # 退回内网地址
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  fi
  echo "$ip"
}

# 1) 依赖
step "安装基础依赖"
apt-get update -y >/dev/null
apt-get install -y git curl ca-certificates python3 python3-venv python3-pip unzip ufw >/dev/null

# 2) 拉仓库
step "拉取/更新仓库到 ${APP_DIR}"
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" fetch --all -q
  git -C "${APP_DIR}" reset --hard "origin/${BRANCH}" -q
else
  install -d -m 0755 "${APP_DIR}"
  git clone -q --depth=1 -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

# 3) Python venv
step "准备 Python 虚拟环境"
install -d -m 0755 "${APP_DIR}/.venv"
if [ ! -x "${APP_DIR}/.venv/bin/python3" ]; then
  ${PY} -m venv "${APP_DIR}/.venv"
fi
"${APP_DIR}/.venv/bin/pip" install -U pip -i "${PIP_INDEX}" >/dev/null
if [ -f "${APP_DIR}/requirements.txt" ]; then
  PIP_INDEX_URL="${PIP_INDEX}" "${APP_DIR}/.venv/bin/pip" install -i "${PIP_INDEX}" -r "${APP_DIR}/requirements.txt"
fi

# 4) 默认 .deploy.env（若不存在则写入）
step "写入默认 .deploy.env（保留已存在）"
DEPLOY_ENV="${APP_DIR}/.deploy.env"
if [ ! -f "${DEPLOY_ENV}" ]; then
  cat > "${DEPLOY_ENV}" <<'ENV'
# minipost/.deploy.env
HOST=0.0.0.0
PORT=8000
ENV=prod
WORKERS=1
ENV_FILE=/opt/minipost/.env
ENV_LOG_LEVEL=info
ENV_RELOAD=0
ENV_PROXY_HEADERS=1
ENV_FORWARD_ALLOW_IPS=*
ENV_FACTORY=app.main:app
ENV_APP_DIR=/opt/minipost
ENV_STATIC_DIR=/opt/minipost/static
ENV_TEMPLATES_DIR=/opt/minipost/app/templates
ENV_LOG_DIR=/opt/minipost/logs
ENV_SYSTEMD=1
ENV
  ok "已写入 ${DEPLOY_ENV}"
else
  ok "已存在 ${DEPLOY_ENV}，跳过覆盖"
fi

# 5) 日志与运行目录
step "创建日志与运行目录"
install -d -m 0755 "${APP_DIR}/logs"

# 6) systemd 服务（用 *单引号* heredoc 禁止 shell 展开，避免未定义变量导致错误）
SVC_PATH=/etc/systemd/system/minipost.service
step "安装 systemd 服务"
cat > "${SVC_PATH}" <<'SERVICE'
[Unit]
Description=minipost (FastAPI) Service
Documentation=README.md
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/minipost
EnvironmentFile=/opt/minipost/.deploy.env
# 确保日志目录存在
ExecStartPre=/usr/bin/install -d -m 0755 /opt/minipost/logs
# 变量由 systemd 从 EnvironmentFile 展开
ExecStart=/opt/minipost/.venv/bin/uvicorn app.main:app --host ${HOST} --port ${PORT}
Restart=on-failure
RestartSec=2s
# 日志输出到 journald，查看：journalctl -u minipost.service -e -n 200

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable minipost.service >/dev/null || true

# 7) UFW
step "开放防火墙 ${PORT:-8000} 端口（如已启用 UFW）"
if command -v ufw >/dev/null 2>&1; then
  ufw allow "${PORT:-8000}/tcp" >/dev/null 2>&1 || true
fi

# 8) 启动
step "启动服务"
if ! systemctl restart minipost.service; then
  err "失败，详见 /var/log/minipost-bootstrap.log（或执行：journalctl -u minipost.service -e -n 200）"
  exit 1
fi
systemctl --no-pager --full status minipost.service | sed -n '1,20p'

# 9) 最终提示（公网 IP）
PUBLIC_IP="$(detect_public_ip)"
PORT_VAL="$(. "${DEPLOY_ENV}"; echo "${PORT}")"
echo "✔ 完成。后台：http://${PUBLIC_IP:-<服务器IP>}:${PORT_VAL:-8000}/admin   登录：/admin/login"
