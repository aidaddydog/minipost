#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P 2>/dev/null || pwd -P)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.deploy.env}"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_DIR="/var/log/minipost"
INSTALL_LOG="$LOG_DIR/install-root-$TS.log"
BACKUP_ROOT="/opt/minipost-backups"
BACKUP_DIR="$BACKUP_ROOT/$TS"

mkdir -p "$LOG_DIR" "$BACKUP_ROOT"
exec > >(tee -a "$INSTALL_LOG") 2>&1

step(){ echo "==> $*"; }
ok(){ echo "✔ $*"; }
die(){ echo "✘ $*"; exit 1; }
trap 'die 安装失败（详见 '"$INSTALL_LOG"' ）' ERR

# 读取 ENV
source "$ENV_FILE" 2>/dev/null || true
: "${BASE:=$REPO_ROOT}"
: "${DATA:=/opt/minipost-data}"
: "${HOST:=0.0.0.0}"
: "${PORT:=8000}"
: "${WORKERS:=1}"
: "${RELOAD:=0}"
: "${SERVICE_NAME:=minipost.service}"

step "1) Python 依赖与虚拟环境"
apt-get update -y
apt-get install -y --no-install-recommends python3 python3-venv python3-pip
cd "$BASE"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
ok "依赖安装完成"

step "2) 目录就绪（含 runtime/ updates/ 数据目录）"
install -d -m 755 "$BASE" "$BASE/runtime" "$BASE/updates" "$DATA/pdfs" "$DATA/uploads"
ok "目录 OK"

step "3) systemd 单元"
UNIT_FILE="$BASE/scripts/systemd/minipost.service"
install -m 644 "$UNIT_FILE" "/etc/systemd/system/minipost.service"
systemctl daemon-reload
systemctl enable minipost.service
ok "systemd 单元已安装"

step "4) 启动/重启服务"
systemctl restart minipost.service
sleep 1
systemctl status minipost.service --no-pager -l || true
ok "服务已启动"
