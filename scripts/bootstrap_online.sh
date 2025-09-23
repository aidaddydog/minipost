#!/usr/bin/env bash
# 一键安装 Docker → 拉取/更新仓库 → 构建并启动（web+backend+postgres）
# 支持多次执行覆盖，完成后提供健康检查与访问入口
set -Eeuo pipefail

# —— 安全默认值与环境加载（修复 BASE_DIR 未赋值问题）——
# 说明：先“宽松”加载 .deploy.env，再补默认值，最后再切回严格模式，避免 set -u 下未赋值报错。

set +u  # 暂时关闭未定义变量立刻报错，先加载环境
# 自动加载同目录或仓库根目录的 .deploy.env（按你当前布局自适应）
if [ -f ".deploy.env" ]; then
  set -a
  . ".deploy.env"
  set +a
elif [ -f "/opt/minipost/.deploy.env" ]; then
  set -a
  . "/opt/minipost/.deploy.env"
  set +a
fi

# 给关键变量设置安全默认值（若已在 .deploy.env 里定义，则不会覆盖）
: "${BASE_DIR:=/opt/minipost}"          # 仓库工作目录
: "${DATA_DIR:=${BASE_DIR}/data}"       # 数据目录
: "${LOG_DIR:=${BASE_DIR}/logs}"        # 日志目录
: "${REPO_URL:=https://github.com/aidaddydog/minipost.git}"  # 仓库地址
: "${SERVICE_NAME:=minipost}"           # systemd 服务名
: "${APP_PORT:=8000}"                   # 应用端口
: "${COMPOSE_PROFILES:=web,backend,postgres}"  # docker compose 启动的 profiles

export BASE_DIR DATA_DIR LOG_DIR REPO_URL SERVICE_NAME APP_PORT COMPOSE_PROFILES

set -u  # 重新开启严格模式

# ===== 美化输出 =====
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
  printf "${C5}%s${RESET} " "$msg"
  ( while true; do printf "\r${C5}%s${RESET} " "${fr[i++ % ${#fr[@]}]} $msg"; sleep .1; done ) & SPIN_PID=$!
}
spin_stop(){ [ -n "$SPIN_PID" ] && kill "$SPIN_PID" >/dev/null 2>&1 || true; printf "\r"; }

# ===== 变量与路径 =====
REPO_URL="${REPO_URL:-https://github.com/aidaddydog/minipost}"
REPO_DIR="${REPO_DIR:-/opt/minipost}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"
WEB_HTTP_PORT="${WEB_HTTP_PORT:-80}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

mkdir -p "$REPO_DIR"

# ===== 0. 预检 =====
if [ "$EUID" -ne 0 ]; then err "请以 root 运行（或使用 sudo）"; exit 1; fi

# OS
. /etc/os-release || true
case "${ID:-unknown}" in
  ubuntu|debian) ;;
  *) warn "未识别的发行版：${ID:-?}，尝试以 Debian/Ubuntu 方式安装 Docker";;
esac

# 基础网络
if ! ping -c1 -W2 registry-1.docker.io >/dev/null 2>&1; then
  warn "访问 Docker Hub 失败，后续构建可能较慢或失败，请准备镜像源"
fi

# ===== 1. 安装 Docker (若不存在) =====
if ! command -v docker >/dev/null 2>&1; then
  info "安装 Docker Engine"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/${ID}/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo     "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID}     $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker 安装完成"
else
  ok "Docker 已存在"
fi

# ===== 2. 拉取/更新仓库 =====
if [ ! -d "$REPO_DIR/.git" ]; then
  info "克隆仓库：$REPO_URL"
  git clone --depth=1 -b "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
  info "更新仓库：$REPO_DIR"
  (cd "$REPO_DIR" && git fetch --all -p && git reset --hard "origin/$BRANCH")
fi

cd "$REPO_DIR"

# ===== 3. 端口检测 =====
for P in "$WEB_HTTP_PORT" 443; do
  if ss -ltn | awk '{print $4}' | grep -q ":$P$"; then
    warn "端口 $P 已被占用。Caddy/前端可能无法绑定该端口。"
  fi
done

# ===== 端口占用兜底（变量区之后、Step 7 之前放置）=====
if command -v ss >/dev/null 2>&1; then
  if ss -ltnp | grep -q ':80 '; then
    if ! grep -q '^WEB_HTTP_PORT=' "$ENV_FILE"; then
      warn "检测到 80 端口被占用，将在本次部署使用 8080（可在 .deploy.env 中自定义 WEB_HTTP_PORT）"
      sed -i 's/^WEB_HTTP_PORT=.*/WEB_HTTP_PORT=8080/' "$ENV_FILE" || true
      export WEB_HTTP_PORT=8080
    fi
  fi
fi

# ===== 构建并启动（替换原来的 Step 7）=====
info "启动编排：web + backend + postgres"
cd "$BASE_DIR"
set +e
if [ "${MINIPOST_DEBUG:-0}" = "1" ]; then
  docker compose -f "$COMPOSE_FILE" pull
  docker compose -f "$COMPOSE_FILE" build --progress=plain || EXIT_CODE=$?
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans || EXIT_CODE=${EXIT_CODE:-$?}
else
  docker compose -f "$COMPOSE_FILE" pull >/dev/null 2>&1
  docker compose -f "$COMPOSE_FILE" build --progress=plain || EXIT_CODE=$?
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans >/dev/null 2>&1 || EXIT_CODE=${EXIT_CODE:-$?}
fi
set -e
if [ -n "${EXIT_CODE:-}" ]; then
  err "编排启动失败（EXIT_CODE=$EXIT_CODE）。以下为最近输出，便于快速定位："
  docker compose -f "$COMPOSE_FILE" ps
  docker compose -f "$COMPOSE_FILE" logs -n 200 db || true
  docker compose -f "$COMPOSE_FILE" logs -n 200 backend || true
  docker compose -f "$COMPOSE_FILE" logs -n 200 web || true
  exit $EXIT_CODE
fi
ok "容器已启动"


# ===== 5. 健康检查 =====
BACKOFF=(2 3 5 8 13)
HEALTH_OK=0
for sec in "${BACKOFF[@]}"; do
  sleep "$sec"
  if curl -fsS "http://127.0.0.1/api/health" >/dev/null 2>&1; then HEALTH_OK=1; break; fi
done
if [ $HEALTH_OK -eq 1 ]; then ok "健康检查通过（/api/health）"; else warn "健康检查未通过，容器可能仍在初始化"; fi

# ===== 6. 输出入口 & 常用命令 =====
PUB_IP="$(curl -fsSL ipinfo.io/ip || true)"
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
ok  "祝使用顺利！"
