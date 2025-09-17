#!/usr/bin/env bash
# ------------------------------------------------------------
# deploy_onekey.sh
# minipost 一键部署脚本（Ubuntu 24 / root 或 sudo 执行）
#
# 特性：
# - 进度与中文提示，详细日志：/var/log/minipost_deploy.log
# - 安装 Docker / Compose
# - UFW 自动放行 80/443（以及调试用 8080）
# - Docker Compose 启动：server + caddy（静态站点 + /api 反代）
# - 二次覆盖更新：检测旧容器并给出清理选项（支持 -y 自动清理）
# ------------------------------------------------------------

set -euo pipefail

LOG_FILE="/var/log/minipost_deploy.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

# ---------- UI ----------
green(){ printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
red(){ printf "\033[31m%s\033[0m\n" "$*"; }
step(){ green "\n==> $*"; }
info(){ echo " • $*"; }

AUTO_YES=0
if [[ "${1:-}" == "-y" ]]; then
  AUTO_YES=1
fi

require_root(){
  if [[ $EUID -ne 0 ]]; then
    yellow "建议使用 root 运行（或 sudo）。当前非 root 也可继续，但安装/放行可能要求 sudo。"
  fi
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    yellow "未检测到 $1，正在安装..."
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update -y
      sudo apt-get install -y "$1" || true
    fi
  fi
}

ufw_allow(){
  local port="$1"
  if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow "$port" || true
  fi
}

require_root

step "安装基础依赖（git、curl、ufw、docker、docker compose）"
need_cmd git
need_cmd curl
need_cmd ufw
# Docker
if ! command -v docker >/dev/null 2>&1; then
  yellow "安装 Docker ..."
  sudo apt-get update -y
  sudo apt-get install -y docker.io
fi
if ! docker compose version >/dev/null 2>&1; then
  yellow "安装 docker compose 插件 ..."
  sudo apt-get install -y docker-compose-plugin
fi
sudo systemctl enable --now docker

step "UFW 放行端口（80/443，用于 HTTP/HTTPS；8080 用于后端调试）"
ufw_allow 80
ufw_allow 443
ufw_allow 8080 || true

step "检测旧版本容器"
EXIST=$(docker ps -a --format '{{.Names}}' | grep -E '^minipost_' || true)
if [[ -n "$EXIST" ]]; then
  yellow "检测到历史容器："
  echo "$EXIST"
  if [[ $AUTO_YES -eq 1 ]]; then
    REPLY="y"
  else
    read -r -p "是否清理并重新部署？(y/N): " REPLY
  fi
  if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    step "停止并删除历史容器/网络/匿名卷"
    docker compose down --remove-orphans || true
    docker rm -f $EXIST || true
    # 清理悬空镜像与卷（安全起见仅清理悬空项）
    docker image prune -f || true
    docker volume prune -f || true
  else
    info "保留历史容器，将尝试覆盖式构建与重启。"
  fi
fi

step "构建并启动服务（server + caddy）"
docker compose build --pull
docker compose up -d

step "等待后端健康检查"
# 最多重试 30 次
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/api/v1/health >/dev/null 2>&1; then
    green "后端健康检查通过。"
    break
  else
    sleep 2
    echo -n "."
  fi
  if [[ $i -eq 30 ]]; then
    red "后端健康检查失败，请查看日志：docker logs minipost_server"
    exit 1
  fi
done

step "访问指引"
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
info "前端（反代）:  http://${IP:-<服务器IP>}"
info "后端（直连）: http://${IP:-<服务器IP>}:8080/api/v1/health"

green "部署完成！完整日志：$LOG_FILE"
echo ""
echo "常用命令："
echo "  查看服务： docker compose ps"
echo "  查看日志： docker logs -f minipost_server"
echo "  重启服务： docker compose restart"
echo "  停止服务： docker compose down"
