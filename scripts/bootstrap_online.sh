#!/usr/bin/env bash
set -Eeuo pipefail

# ========= 基本参数 =========
REPO_URL="${REPO_URL:-https://github.com/aidaddydog/minipost}"
BRANCH="${BRANCH:-main}"
DEST_DIR="${DEST_DIR:-/opt/minipost}"
SERVICE_NAME="${SERVICE_NAME:-minipost}"
PYTHON="${PYTHON:-python3}"
VENV_DIR="${VENV_DIR:-$DEST_DIR/.venv}"
REQUIREMENTS_FILE="${REQUIREMENTS_FILE:-$DEST_DIR/requirements.txt}"
DEPLOY_ENV="${DEPLOY_ENV:-$DEST_DIR/.deploy.env}"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"

# ========= 打印帮助函数 =========
info(){ echo -e "==> $*"; }
ok(){   echo -e "✔ $*"; }
err(){  echo -e "✘ $*" 1>&2; }

# ========= 公网 IP 探测 =========
detect_public_ip() {
  # 优先使用环境变量覆盖
  if [[ -n "${PUBLIC_IP:-}" ]]; then echo "$PUBLIC_IP"; return; fi

  # 尝试云厂商元数据（阿里云 / AWS）
  local ip=""
  ip="$(curl -fsS --max-time 2 http://100.100.100.200/latest/meta-data/public-ipv4 || true)"
  if [[ -z "$ip" ]]; then
    ip="$(curl -fsS --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
  fi

  # 通用外网探测
  if [[ -z "$ip" ]]; then
    ip="$(curl -fsS --max-time 3 https://api.ipify.org || true)"
  fi
  if [[ -z "$ip" ]]; then
    ip="$(curl -fsS --max-time 3 https://ifconfig.me || true)"
  fi

  # 兜底（可能是内网 IP，但至少不为空）
  if [[ -z "$ip" ]]; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  echo "$ip"
}

# ========= 安装依赖 =========
info "安装基础依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -o Acquire::Retries=3
apt-get install -y git curl ca-certificates python3 python3-venv python3-pip unzip ufw

# ========= 拉取/更新仓库 =========
info "拉取/更新仓库到 ${DEST_DIR}"
if [[ -d "$DEST_DIR/.git" ]]; then
  git -C "$DEST_DIR" fetch --all --quiet
  git -C "$DEST_DIR" reset --hard "origin/${BRANCH}"
else
  rm -rf "$DEST_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$DEST_DIR"
fi

# 清理可能的缓存
rm -rf "$DEST_DIR/app/__pycache__" "$VENV_DIR"

# ========= Python 虚拟环境 =========
info "准备 Python 虚拟环境"
$PYTHON -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install -U pip -i http://mirrors.cloud.aliyuncs.com/pypi/simple/ --trusted-host mirrors.cloud.aliyuncs.com
"$VENV_DIR/bin/pip" install -r "$REQUIREMENTS_FILE" -i http://mirrors.cloud.aliyuncs.com/pypi/simple/ --trusted-host mirrors.cloud.aliyuncs.com

# ========= 默认部署环境 =========
info "写入默认 .deploy.env（保留已存在）"
if [[ ! -f "$DEPLOY_ENV" ]]; then
  cat >"$DEPLOY_ENV" <<'EOF'
# minipost 部署默认值（可按需修改）
HOST=0.0.0.0
PORT=8000
WORKERS=1
LOG_DIR=/var/log/minipost
EOF
  ok "已写入 $DEPLOY_ENV"
else
  ok "已存在 $DEPLOY_ENV，跳过覆盖"
fi
# shellcheck disable=SC1090
source "$DEPLOY_ENV"

# ========= systemd 单元 =========
info "安装 systemd 服务（修复变量展开、日志目录）"
install -d -m 0755 "${LOG_DIR:-/var/log/minipost}"

cat >"$SYSTEMD_UNIT" <<EOF
[Unit]
Description=${SERVICE_NAME} (FastAPI) Service
After=network.target

[Service]
Type=simple
EnvironmentFile=-${DEPLOY_ENV}
WorkingDirectory=${DEST_DIR}
ExecStartPre=/usr/bin/install -d -m 0755 ${LOG_DIR}
ExecStart=${VENV_DIR}/bin/uvicorn app.main:app --host \${HOST:-0.0.0.0} --port \${PORT:-8000} --workers \${WORKERS:-1}
Restart=always
RestartSec=2
User=root
Group=root
StandardOutput=append:${LOG_DIR}/stdout.log
StandardError=append:${LOG_DIR}/stderr.log
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true

# ========= 开放防火墙端口 =========
info "开放防火墙 ${PORT:-8000} 端口（如已启用 UFW）"
ufw allow "${PORT:-8000}"/tcp || true

# ========= 启动服务 =========
info "启动服务"
systemctl restart "$SERVICE_NAME"

# 展示状态摘要
sleep 1
systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,20p' || true

# ========= 输出最终可访问地址（含公网 IP）=========
PUBLIC_IP="$(detect_public_ip)"
BASE_URL="http://${PUBLIC_IP}:${PORT:-8000}"
ok "完成。后台：${BASE_URL}/admin   登录：${BASE_URL}/admin/login"
