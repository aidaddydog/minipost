#!/usr/bin/env bash
# Minipost 在线一键部署（本仓库）
set -Eeuo pipefail

LOG=/var/log/minipost-bootstrap.log
mkdir -p /var/log
exec > >(tee -a "$LOG") 2>&1

: "${BRANCH:=main}"
: "${REPO:=https://github.com/aidaddydog/minipost.git}"
: "${DEST:=/opt/minipost}"

step(){ echo "==> $*"; }
ok(){ echo "✔ $*"; }
die(){ echo "✘ $*"; exit 1; }
trap 'die "失败，详见 $LOG（或执行：journalctl -u minipost.service -e -n 200）"' ERR

step "1) 安装基础环境（git/curl/python3/venv 等）"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends git curl ca-certificates python3 python3-venv python3-pip unzip rsync

step "2) 拉取/更新仓库到 $DEST"
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch --all
  git -C "$DEST" checkout "$BRANCH"
  git -C "$DEST" pull --ff-only origin "$BRANCH"
else
  rm -rf "$DEST"
  git clone --branch "$BRANCH" "$REPO" "$DEST"
fi
ok "仓库就绪"

step "3) 写入部署参数 $DEST/.deploy.env（不存在则创建）"
if [ ! -f "$DEST/.deploy.env" ]; then
  cat >"$DEST/.deploy.env" <<'ENV'
HOST=0.0.0.0
PORT=8000
WORKERS=1
RELOAD=0
BASE=/opt/minipost
DATA=/opt/minipost-data
AUTO_CLEAN=yes
SERVICE_NAME=minipost.service
ENV
  ok "已写入 $DEST/.deploy.env"
else
  ok "$DEST/.deploy.env 已存在，保持不变"
fi

step "4) 执行仓库安装脚本（非交互）"
cd "$DEST"
chmod +x scripts/install_root.sh
BASE="$DEST" bash scripts/install_root.sh

ok "完成。后台：http://<服务器IP>:8000/admin"
