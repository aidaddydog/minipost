#!/usr/bin/env bash
# minipost 在线一键部署引导（兼容旧版接口/变量）
# 用法：bash <(curl -fsSL "https://api.github.com/repos/aidaddydog/minipost/contents/scripts/bootstrap_online.sh?ref=main" -H "Authorization: Bearer ${GITHUB_TOKEN:-}" -H "Accept: application/vnd.github.v3.raw")
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

[ "$(id -u)" -eq 0 ] || die "请用 root 运行"

step "安装系统依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends git curl ca-certificates tzdata python3-venv python3-pip ufw rsync unzip

step "获取代码到 $DEST（分支：$BRANCH）"
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch --all --prune
  git -C "$DEST" checkout "$BRANCH"
  git -C "$DEST" reset --hard "origin/$BRANCH"
else
  rm -rf "$DEST"
  git clone --depth=1 -b "$BRANCH" "$REPO" "$DEST"
fi

step "执行安装脚本"
cd "$DEST/scripts"
bash ./install_root.sh

ok "完成，一会儿可访问： http://<服务器IP>:${PORT:-8000}/admin"
