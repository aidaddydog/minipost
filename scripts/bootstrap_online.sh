#!/usr/bin/env bash
# minipost 在线一键部署引导
set -Eeuo pipefail

LOG=/var/log/minipost-bootstrap.log
exec > >(tee -a "$LOG") 2>&1

: "${BRANCH:=main}"
: "${REPO:=https://github.com/aidaddydog/minipost.git}"
: "${DEST:=/opt/minipost}"

step(){ echo "==> $*"; }
ok(){ echo "✔ $*"; }
die(){ echo "✘ $*"; exit 1; }
trap 'die "失败，详见 $LOG（或执行：journalctl -u minipost.service -e -n 200）"' ERR

step "安装基础依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends git curl ca-certificates python3 python3-venv python3-pip unzip ufw

step "拉取/更新仓库到 $DEST"
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch --all --prune
  git -C "$DEST" checkout "$BRANCH"
  git -C "$DEST" reset --hard "origin/$BRANCH"
  git -C "$DEST" clean -fd
else
  rm -rf "$DEST"
  git clone -b "$BRANCH" "$REPO" "$DEST"
fi

step "准备 Python 虚拟环境"
cd "$DEST"
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

step "写入默认 .deploy.env（保留已存在）"
if [ ! -f "$DEST/.deploy.env" ]; then
  cat > "$DEST/.deploy.env" <<'ENV'
PORT=8000
HOST=0.0.0.0
DB_URL=sqlite:///./huandan.sqlite3
SECRET_KEY=minipost-secret
LOG_LEVEL=info
AUTO_CLEAN_DAYS=30
ENV
  ok "已写入 $DEST/.deploy.env"
else
  ok "$DEST/.deploy.env 已存在，保持不变"
fi

step "安装 systemd 服务"
install -d /etc/systemd/system
install -m 0644 "$DEST/scripts/systemd/minipost.service" /etc/systemd/system/minipost.service
systemctl daemon-reload
systemctl enable minipost.service

step "开放防火墙 8000 端口（如已启用 UFW）"
ufw allow 8000/tcp || true

step "启动服务"
systemctl restart minipost.service
sleep 1
systemctl --no-pager -l status minipost.service

ok "完成。后台：http://<服务器IP>:8000/admin   登录：/admin/login"
