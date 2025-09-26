#!/usr/bin/env bash
# 一键部署（在线，支持任意目录/进程替换执行；自动克隆/更新到 /opt/minipost）
set -Eeuo pipefail

# ===== 彩色输出 =====
c_red='\033[1;31m'; c_green='\033[1;32m'; c_yellow='\033[1;33m'; c_blue='\033[1;34m'; c_rst='\033[0m'
log(){ echo -e "${c_green}[+] $*${c_rst}"; }
warn(){ echo -e "${c_yellow}[!] $*${c_rst}"; }
err(){ echo -e "${c_red}[-] $*${c_rst}" >&2; }
die(){ err "$1"; exit 1; }

# ===== 基本参数（可用环境变量覆写）=====
REPO_URL="${REPO_URL:-https://github.com/aidaddydog/minipost.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/minipost}"                     # 仓库落地的**固定绝对路径**
COMPOSE_FILE="${APP_DIR}/deploy/docker-compose.yml"

LOG_CMD_SYSTEMD="journalctl -u minipost.service -e -n 200"
LOG_CMD_COMPOSE="docker compose -f ${COMPOSE_FILE} logs web --tail=200"
LOG_CMD_NGINX="tail -n 200 /var/log/nginx/error.log"

# ===== 0) Preflight（root/OS/网络/NTP/端口/Docker）=====
need_root(){
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    die "请先 sudo -i 或 su - 切换到 root 后重试（EUID 必须为 0）"
  fi
}
check_os(){
  . /etc/os-release || true
  if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
    warn "建议 Ubuntu 24.04 LTS，当前：${PRETTY_NAME:-unknown}（继续尝试）"
  fi
}
ensure_pkgs(){
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release git ufw || true
}
check_network_time(){
  log "系统/网络/时间/端口检查"
  ping -c1 -W1 1.1.1.1 >/dev/null 2>&1 || warn "外网 ICMP 不通；后续可能拉取缓慢/失败"
  getent hosts github.com >/dev/null 2>&1 || warn "DNS 解析 github.com 异常（可能受 DNS/防火墙影响）"
  if ! timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qi true; then
    warn "NTP 未同步，自动尝试开启"
    systemctl enable --now systemd-timesyncd || true
    timedatectl set-ntp true || true
  fi
  # 端口占用（默认 8000）
  local p="${APP_PORT:-8000}"
  if ss -ltn | awk '{print $4}' | grep -q ":${p}\$"; then
    die "端口 ${p} 已被占用，请改 .deploy.env 的 APP_PORT 或释放端口后重试"
  fi
}
ensure_docker(){
  log "安装/检查 Docker Engine 与 Compose 插件"
  if ! command -v docker >/dev/null 2>&1; then
    # 官方源安装
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
  else
    apt-get install -y docker-compose-plugin || true
    systemctl enable --now docker
  fi
  docker run --rm hello-world >/dev/null 2>&1 || die "Docker hello-world 运行失败（请检查网络/镜像源/代理）"
  docker compose version >/dev/null 2>&1 || die "缺少 Docker Compose 插件（docker-compose-plugin）"
}

# ===== 1) 模式选择（默认 1）=====
choose_mode(){
  echo -e "${c_blue}请选择部署模式：${c_rst}
  1) 全新安装
  2) 安全覆盖（备份->替换->失败自动回滚）
  3) 回滚上次备份
  "
  read -rp "输入数字并回车 [1/2/3]（默认 1）: " MODE || true
  MODE="${MODE:-1}"
  [[ "${MODE}" =~ ^[123]$ ]] || die "非法输入：${MODE}"
}

# ===== 2) 准备仓库到 /opt/minipost（不依赖当前目录）=====
prepare_repo(){
  log "准备/更新仓库 -> ${APP_DIR}"
  mkdir -p "$(dirname "${APP_DIR}")"
  if [[ ! -d "${APP_DIR}/.git" ]]; then
    git clone --depth=1 -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  else
    git -C "${APP_DIR}" fetch origin "${BRANCH}" --depth=1 -p
    git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
  fi
  if [[ ! -f "${COMPOSE_FILE}" ]]; then
    die "未找到 Compose 文件：${COMPOSE_FILE}（请确认仓库 deploy/docker-compose.yml 是否存在）"
  fi
}

# ===== 3) 环境变量（生成/合并 .deploy.env）=====
prepare_env(){
  cd "${APP_DIR}"
  touch .deploy.env
  # 合并默认键（不存在才写入）
  merge_env(){ local k="$1"; local v="$2"; grep -q "^${k}=" .deploy.env || echo "${k}=${v}" >> .deploy.env; }
  merge_env "APP_HOST" "0.0.0.0"
  merge_env "APP_PORT" "8000"
  merge_env "THEME_NAME" "default"
  merge_env "DB" "postgres"
  merge_env "PG_HOST" "postgres"
  merge_env "PG_PORT" "5432"
  merge_env "PG_DB" "minipost"
  merge_env "PG_USER" "minipost"
  merge_env "USE_REAL_NAV" "false"
  merge_env "UFW_OPEN" "true"
  merge_env "ENVIRONMENT" "production"

  # 强口令与密钥（空则自动生成）
  if ! grep -q '^PG_PASSWORD=' .deploy.env || [[ -z "$(grep '^PG_PASSWORD=' .deploy.env | cut -d= -f2-)" ]]; then
    echo "PG_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '\n=/' | cut -c1-32)" >> .deploy.env
  fi
  if ! grep -q '^JWT_SECRET=' .deploy.env || [[ -z "$(grep '^JWT_SECRET=' .deploy.env | cut -d= -f2-)" ]]; then
    echo "JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '\n=/' | cut -c1-48)" >> .deploy.env
  fi
}

# ===== 4) 数据库（PostgreSQL 16）=====
start_postgres(){
  log "启动数据库（PostgreSQL 16）"
  docker compose -f "${COMPOSE_FILE}" up -d postgres
  # 等待就绪
  local DB="$(grep '^PG_DB=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  local USER="$(grep '^PG_USER=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  for i in {1..60}; do
    if docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U "${USER}" -d "${DB}" -h localhost >/dev/null 2>&1; then
      log "Postgres 就绪"
      break
    fi
    sleep 1
  done
}

# ===== 5) 迁移 =====
migrate_db(){
  log "执行 Alembic 迁移"
  docker compose -f "${COMPOSE_FILE}" run --rm web alembic upgrade head || {
    err "迁移失败"
    echo "一键日志命令："
    echo "  systemd：${LOG_CMD_SYSTEMD}"
    echo "  Docker ：${LOG_CMD_COMPOSE}"
    echo "  Nginx ：${LOG_CMD_NGINX}"
    exit 1
  }
}

# ===== 6) 初始化管理员（交互输入，禁止默认口令）=====
init_admin(){
  log "初始化管理员账号（仅设置密码，不回显）"
  read -rp "请输入管理员用户名（默认 admin）: " ADMIN_USER || true
  ADMIN_USER="${ADMIN_USER:-admin}"
  read -rsp "请输入管理员密码: " ADMIN_PWD; echo
  docker compose -f "${COMPOSE_FILE}" run --rm -e PYTHONUNBUFFERED=1 web \
    python -m app.bootstrap init-admin --username "${ADMIN_USER}" --password "${ADMIN_PWD}"
}

# ===== 7) 启动 Web & 健康检查（无需 jq）=====
start_web(){
  log "启动 Web 服务"
  docker compose -f "${COMPOSE_FILE}" up -d web
  local PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  log "等待 Web 健康检查 …"
  for i in {1..60}; do
    if curl -sf "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
      log "Web 健康检查通过"
      break
    fi
    sleep 2
  done
}

# ===== 8) 端口开放策略（UFW）=====
ufw_apply(){
  local HOST="$(grep '^APP_HOST=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  local PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  local OPEN="$(grep '^UFW_OPEN=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  if command -v ufw >/dev/null 2>&1; then
    if [[ "${OPEN}" == "true" && "${HOST}" == "0.0.0.0" ]]; then
      ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
      log "已放行 TCP ${PORT}"
    fi
  fi
}

# ===== 9) 结果输出 =====
report(){
  local PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  log "部署完成"
  echo "访问 URL： http://$(hostname -I | awk '{print $1}'):${PORT}/"
  echo "备份目录： ${APP_DIR}/backups"
  echo "三条一键日志命令："
  echo "  systemd：${LOG_CMD_SYSTEMD}"
  echo "  Docker ：${LOG_CMD_COMPOSE}"
  echo "  Nginx ：${LOG_CMD_NGINX}"
}

# ===== 主流程（任意目录可执行；会自动克隆到 /opt/minipost）=====
need_root
check_os
ensure_pkgs
check_network_time
ensure_docker
choose_mode
prepare_repo
prepare_env
start_postgres
migrate_db
init_admin
start_web
ufw_apply
report
