#!/usr/bin/env bash
# 一键安装 Docker → 拉取/更新仓库 → 构建并启动（web+backend+postgres）
# 特性：彩色进度/Spinner、端口放行（80/443）、二次覆盖、健康检查、结尾打印公网入口
set -Eeuo pipefail

# ====== UI 颜色 ======
if command -v tput >/dev/null 2>&1; then
  BOLD="$(tput bold)"; RESET="$(tput sgr0)"
  C0="$(tput setaf 250)"; C1="$(tput setaf 39)"; C2="$(tput setaf 76)"
  C3="$(tput setaf 214)"; C4="$(tput setaf 196)"; C5="$(tput setaf 45)"
else
  BOLD=""; RESET=""; C0=""; C1=""; C2=""; C3=""; C4=""; C5=""
fi
info(){ echo -e "${C1}${BOLD}[$(date +%H:%M:%S)]$RESET ${C1}$*$RESET"; }
ok(){   echo -e "${C2}${BOLD}✔$RESET ${C2}$*$RESET"; }
warn(){ echo -e "${C3}${BOLD}⚠$RESET ${C3}$*$RESET"; }
err(){  echo -e "${C4}${BOLD}✘$RESET ${C4}$*$RESET"; }

SPIN_PID=""
spin_start(){ local msg="$1"; local fr=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏); i=0
  printf "${C5}%s${RESET} " "$msg"; (
    while :; do printf "\r${C5}%s ${fr[i++%${#fr[@]}]}${RESET} " "$msg"; sleep .12; done
  ) & SPIN_PID=$!
}
spin_stop(){ [ -n "${SPIN_PID}" ] && kill -9 "$SPIN_PID" >/dev/null 2>&1 || true; echo -ne "\r"; }

# ====== 变量 ======
REPO="https://github.com/aidaddydog/minipost.git"
BRANCH="${MINIPOST_BRANCH:-main}"
BASE_DIR="${MINIPOST_BASE_DIR:-/opt/minipost}"
COMPOSE_FILE="${BASE_DIR}/deploy/docker-compose.yml"
ENV_FILE="${BASE_DIR}/.deploy.env"
LOG_DIR="${MINIPOST_LOG_DIR:-/var/log/minipost}"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/bootstrap_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

API_PORT_DEFAULT=8000
WEB_HTTP_PORT_DEFAULT=80

cat <<'BANNER'
 __  __ _       _                 _   
|  \/  (_)_ __ (_)_ __   ___  ___| |_ 
| |\/| | | '_ \| | '_ \ / _ \/ __| __|
| |  | | | | | | | | | |  __/\__ \ |_ 
|_|  |_|_|_| |_|_|_| |_|\___||___/\__|
BANNER
info "Minipost 一键上线 - 彩色进度 / 端口放行 / 健康检查 / 公网入口"

# Step 1 权限
if [ "$(id -u)" -ne 0 ]; then warn "建议使用 root 运行，当前将尝试 sudo"; SUDO="sudo -H"; else SUDO=""; fi
ok "权限检查通过"

# Step 2 Docker
if ! command -v docker >/dev/null 2>&1; then
  info "未检测到 Docker，开始安装"
  spin_start "安装 Docker / Compose"
  curl -fsSL https://get.docker.com | $SUDO sh >/dev/null 2>&1 || { spin_stop; err "Docker 安装失败"; exit 1; }
  $SUDO usermod -aG docker "${SUDO_USER:-$USER}" || true
  spin_stop; ok "Docker / Compose 安装完成"
else
  ok "已检测到 Docker：$(docker --version)"
fi

# Step 3 拉仓库
if [ -d "$BASE_DIR/.git" ]; then
  info "检测到已有仓库，执行更新：$BASE_DIR"
  (cd "$BASE_DIR" && git fetch --all && git reset --hard "origin/${BRANCH}" && git clean -fd) || { err "更新失败"; exit 1; }
  ok "仓库已更新到 $BRANCH"
else
  info "克隆仓库到 $BASE_DIR"
  $SUDO mkdir -p "$BASE_DIR"
  git clone -b "$BRANCH" --depth=1 "$REPO" "$BASE_DIR" || { err "克隆失败"; exit 1; }
  ok "克隆完成"
fi

# Step 4 生成/读取 .deploy.env
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
API_PORT=${API_PORT_DEFAULT}
WEB_HTTP_PORT=${WEB_HTTP_PORT_DEFAULT}
DB_USER=minipost
DB_PASSWORD=minipost
DB_NAME=minipost
AUTO_CLEAN=no
MINIPOST_DOMAIN=
EOF
  ok "已生成默认环境文件：$ENV_FILE"
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

# Step 5 放行端口
if command -v ufw >/dev/null 2>&1; then
  info "UFW 放行 ${WEB_HTTP_PORT}/tcp（以及 443，如用 HTTPS）"
  $SUDO ufw allow "${WEB_HTTP_PORT}"/tcp || true
  $SUDO ufw allow 443/tcp || true
  ok "UFW 已尝试放行端口"
else
  warn "未检测到 UFW，略过端口放行（如有防火墙请自行放行）"
fi

# Step 6 清理旧容器（可选）
if [ "${AUTO_CLEAN:-no}" = "yes" ]; then
  info "AUTO_CLEAN=yes → 清理旧容器/网络"
  (cd "$BASE_DIR" && docker compose -f "$COMPOSE_FILE" down --remove-orphans || true)
  ok "旧容器已清理"
else
  warn "AUTO_CLEAN=no → 跳过清理（可在 .deploy.env 设置 yes）"
fi

# Step 7 构建并启动
info "启动编排：web + backend + postgres"
cd "$BASE_DIR"
spin_start "docker compose up -d --build（首次构建略慢）"
docker compose -f "$COMPOSE_FILE" up -d --build >/dev/null 2>&1 || { spin_stop; err "编排启动失败"; exit 1; }
spin_stop; ok "容器已启动"

# Step 8 健康检查
BACKOFF=(2 3 5 8 13)
HEALTH_OK=0
for sec in "${BACKOFF[@]}"; do
  sleep "$sec"
  if curl -fsS "http://127.0.0.1/api/health" >/dev/null 2>&1; then HEALTH_OK=1; break; fi
done
if [ $HEALTH_OK -eq 1 ]; then ok "健康检查通过（/api/health）"; else warn "健康检查未通过，容器可能仍在初始化"; fi

# Step 9 打印出入口 & 日志命令
PUB_IP="$(curl -fsSL https://api.ipify.org || true)"
[ -z "$PUB_IP" ] && PUB_IP="$(hostname -I 2>/dev/null | awk '{print $1}')" || true
[ -z "$PUB_IP" ] && PUB_IP="服务器IP"
BASE_URL="http://${MINIPOST_DOMAIN:-$PUB_IP}"

echo ""
info "🎯 部署完成！管理入口与关键地址："
echo "  ${C2}前端（静态站点）${RESET}     →  ${BOLD}${BASE_URL}/${RESET}"
echo "  ${C2}后端 Swagger 文档${RESET}   →  ${BOLD}${BASE_URL}/docs${RESET}"
echo "  ${C2}健康检查${RESET}             →  ${BOLD}${BASE_URL}/api/health${RESET}"
echo ""
info "🧰 常用日志命令（可直接复制执行）："
echo "  docker compose -f ${COMPOSE_FILE} logs web -n 200      # 前端(caddy)最近200行日志"
echo "  docker compose -f ${COMPOSE_FILE} logs backend -n 200  # 后端最近200行日志"
echo "  docker compose -f ${COMPOSE_FILE} logs db -n 200       # 数据库最近200行日志"
echo ""
ok  "完整日志文件：${LOG_FILE}"
