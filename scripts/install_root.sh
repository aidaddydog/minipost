#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P 2>/dev/null || pwd -P)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.deploy.env}"

TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="/var/log/minipost"
INSTALL_LOG="$LOG_DIR/install-$TS.log"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$INSTALL_LOG") 2>&1
step(){ echo "==> $*"; }
ok(){ echo "✔ $*"; }
warn(){ echo "⚠ $*"; }
die(){ echo "✘ $*"; exit 1; }
trap 'echo -e "✘ 安装失败（见日志：$INSTALL_LOG）\njournalctl -u minipost.service -e -n 200"; exit 1' ERR

# 读取 .deploy.env
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

: "${PORT:=8000}"
: "${HOST:=0.0.0.0}"
: "${MINIPOST_DATA:=/opt/huandan-data}"

step "创建数据目录：$MINIPOST_DATA"
mkdir -p "$MINIPOST_DATA/pdfs" "$MINIPOST_DATA/uploads"

step "创建虚拟环境"
cd "$REPO_ROOT"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

step "生成/更新 systemd 单元"
UNIT="/etc/systemd/system/minipost.service"
cat > "$UNIT" <<EOF
[Unit]
Description=minipost FastAPI service
After=network.target

[Service]
WorkingDirectory=$REPO_ROOT
Environment=MINIPOST_DATA=$MINIPOST_DATA
Environment=PORT=$PORT
Environment=HOST=$HOST
ExecStart=$REPO_ROOT/.venv/bin/uvicorn app.main:app --host \$HOST --port \$PORT
Restart=always
RestartSec=3
User=root
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now minipost.service
ok "服务已启动：minipost.service"
