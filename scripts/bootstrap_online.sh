#!/usr/bin/env bash
# 一键部署（在线）：支持任意目录/进程替换执行；自动克隆/更新到 /opt/minipost
# 硬性要求：必须 root；仅在管理员账号/密码处交互；默认“2 覆盖安装”
set -Eeuo pipefail

# ===== 统一配色 =====
c_red='\033[1;31m'; c_grn='\033[1;32m'; c_ylw='\033[1;33m'; c_cyn='\033[1;36m'; c_rst='\033[0m'
ok(){   echo -e "${c_grn}[+] $*${c_rst}"; }
warn(){ echo -e "${c_ylw}[!] $*${c_rst}"; }
err(){  echo -e "${c_red}[-] $*${c_rst}" >&2; }
die(){  err "$1"; exit 1; }

# ===== 常量（可通过环境变量覆写）=====
REPO_URL="${REPO_URL:-https://github.com/aidaddydog/minipost.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/minipost}"
COMPOSE_FILE="${APP_DIR}/deploy/docker-compose.yml"
: "${APP_PORT:=8000}"   # 供 Preflight 端口校验使用（未设置则用 8000）

LOG_CMD_SYSTEMD="journalctl -u minipost.service -e -n 200"
LOG_CMD_COMPOSE="docker compose -f ${COMPOSE_FILE} logs web --tail=200"
LOG_CMD_NGINX="tail -n 200 /var/log/nginx/error.log"

# ===== 小工具：5 行浅灰日志窗口（只显示末尾 5 行）=====
box5(){ # box5 "标题" "$content"
  local title="$1"; shift; local content="${*}"
  echo -e "${c_cyn}${title}${c_rst}"
  echo "────────────────────────────────────────────────────────"
  echo -e "$content" | tail -n 5
  echo "────────────────────────────────────────────────────────"
}

# ===== 0) Preflight 自检 =====
need_root(){ [[ ${EUID:-$(id -u)} -eq 0 ]] || die "请先 sudo -i 或 su - 切换到 root 后重试（EUID 必须 0）"; }
check_os(){ . /etc/os-release || true; [[ "${ID:-}" = "ubuntu" && "${VERSION_ID:-}" = "24.04" ]] || warn "建议 Ubuntu 24.04 LTS，当前：${PRETTY_NAME:-unknown}（继续尝试）"; }
ensure_pkgs(){ ok "安装/校验基础软件（git/curl/ufw/chrony/yaml 解析等）"; apt-get update -y >/dev/null; apt-get install -y ca-certificates curl gnupg lsb-release git ufw chrony python3-yaml >/dev/null 2>&1 || true; }
check_net_time(){
  ok "系统/网络/时间/端口检查"
  if command -v timedatectl >/dev/null 2>&1; then timedatectl set-ntp true >/dev/null 2>&1 || true; else systemctl enable --now chrony >/dev/null 2>&1 || true; fi
  local p="${APP_PORT:-8000}"; if ss -ltn | awk '{print $4}' | grep -q ":${p}\$"; then die "端口 ${p} 已被占用，请修改 .deploy.env 的 APP_PORT 或释放端口后重试"; fi
}
ensure_docker(){
  ok "安装/检查 Docker Engine 与 Compose 插件"
  if ! command -v docker >/dev/null 2>&1; then
    install -m0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
  else
    apt-get install -y docker-compose-plugin >/dev/null 2>&1 || true
    systemctl enable --now docker
  fi
  docker run --rm hello-world >/dev/null 2>&1 || die "Docker hello-world 运行失败（请检查网络/镜像源/代理）"
  docker compose version >/dev/null 2>&1 || die "缺少 docker compose 插件（docker-compose-plugin）"
}

# ===== 1) 菜单（墨绿色样式）=====
choose_mode(){
  echo -e "${c_cyn}请选择部署模式（仅输入数字）：${c_rst}"
  echo -e "  ${c_grn}1) 全新安装${c_rst}：备份→清理容器/卷/镜像/缓存→重装"
  echo -e "  ${c_grn}2) 覆盖安装（默认）${c_rst}：保留数据卷，仅更新结构与镜像"
  echo -e "  ${c_grn}3) 升级安装${c_rst}：仅同步差异；若检测到迁移→自动幂等迁移"
  read -rp "输入 [1/2/3]（默认 2）: " MODE || true
  MODE="${MODE:-2}"
  [[ "${MODE}" =~ ^[123]$ ]] || die "非法输入：${MODE}"
}

# ===== 2) 拉库到 /opt/minipost（与当前目录解耦）=====
prepare_repo(){
  ok "准备/更新仓库 -> ${APP_DIR}"
  mkdir -p "$(dirname "${APP_DIR}")"
  if [[ ! -d "${APP_DIR}/.git" ]]; then
    git clone --depth=1 -b "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  else
    git -C "${APP_DIR}" fetch origin "${BRANCH}" --depth=1 -p
    git -C "${APP_DIR}" reset --hard "origin/${BRANCH}"
  fi
  [[ -f "${COMPOSE_FILE}" ]] || die "未找到 Compose 文件：${COMPOSE_FILE}"
}

# ===== 3) 写/合并 .deploy.env =====
prepare_env(){
  cd "${APP_DIR}"
  touch .deploy.env
  put(){ local k="$1"; local v="$2"; grep -q "^${k}=" .deploy.env || echo "${k}=${v}" >> .deploy.env; }
  put APP_HOST 0.0.0.0; put APP_PORT 8000; put THEME_NAME default
  put DB postgres; put PG_HOST postgres; put PG_PORT 5432; put PG_DB minipost; put PG_USER minipost
  put USE_REAL_NAV false; put UFW_OPEN true; put ENVIRONMENT production
  grep -q '^PG_PASSWORD=' .deploy.env || echo "PG_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '\n=/' | cut -c1-32)" >> .deploy.env
  grep -q '^JWT_SECRET=' .deploy.env  || echo "JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '\n=/' | cut -c1-48)" >> .deploy.env
}

# ===== 启动前校验：模块 YAML Schema（失败阻断启动）=====
validate_modules(){
  ok "校验模块 YAML（module.meta / menu.register / tabs.register / permissions.register）"
  local out; out="$(python3 "${APP_DIR}/scripts/validate_modules.py" || true)"
  box5 "校验输出（仅显示末尾 5 行）" "$out"
  echo "$out" | grep -q "__SCHEMA_OK__" || {
    err "模块 YAML 校验不通过，已阻止启动。请根据上方错误修复后重试。"
    echo "一行日志命令（Compose）：${LOG_CMD_COMPOSE}"
    exit 1
  }
}

# ===== 4) 性能优化（失败不阻断）=====
tune_perf(){
  ok "应用性能优化（失败不阻断）"
  sysctl -w net.core.default_qdisc=fq >/dev/null 2>&1 || true
  sysctl -w net.ipv4.tcp_congestion_control=bbr >/dev/null 2>&1 || true
  [[ -w /sys/kernel/mm/transparent_hugepage/enabled ]] && echo never > /sys/kernel/mm/transparent_hugepage/enabled || true
  ulimit -n 65535 || true
  mkdir -p /etc/docker
  cat >/etc/docker/daemon.json <<'JSON' || true
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
  systemctl reload docker >/dev/null 2>&1 || true
}

# ===== 5) 根据模式处理旧实例 =====
apply_mode(){
  case "${MODE}" in
    1) ok "全新安装：备份并清理旧实例"; mkdir -p "${APP_DIR}/backups"; docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans || true; docker image prune -f || true ;;
    2) ok "覆盖安装：保留数据卷，仅更新镜像与结构" ;;
    3) ok "升级安装：同步差异；如存在迁移将幂等执行" ;;
  esac
}

# ★★★ 新增：在迁移前强制构建 web 镜像（把最新代码和 alembic.ini 打进镜像） ★★★
build_web(){
  ok "构建 Web 镜像（包含最新代码与 alembic.ini）"
  # --pull 确保基础镜像拉新；不加 --no-cache，保持构建速度；如需彻底重建，可改为 MODE=1 时加 --no-cache
  docker compose -f "${COMPOSE_FILE}" build --pull web
}

# ===== 6) 启动 Postgres16 并等待健康 =====
start_pg(){
  ok "启动数据库（PostgreSQL 16）"
  docker compose -f "${COMPOSE_FILE}" up -d postgres
  local DB USER; DB="$(grep '^PG_DB=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  USER="$(grep '^PG_USER=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  for _ in {1..60}; do
    if docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U "${USER}" -d "${DB}" -h localhost >/dev/null 2>&1; then
      ok "Postgres 就绪"; break; fi; sleep 1
  done
}

# ===== 7) 迁移（全新=强制；覆盖/升级=幂等）=====
migrate_db(){
  ok "执行 Alembic 迁移"
  local out
  set +e
  out="$(docker compose -f "${COMPOSE_FILE}" run --rm -w /app web alembic -c /app/alembic.ini upgrade head 2>&1)"
  local rc=$?
  set -e
  box5 "迁移输出（仅显示末尾 5 行）" "$out"
  [[ $rc -eq 0 ]] || { err "迁移失败"; echo "一行日志命令：${LOG_CMD_COMPOSE}"; exit 1; }
}

# ===== 8) 初始化管理员（唯一必填交互）=====
init_admin(){
  ok "初始化管理员账号（不会回显密码）"
  read -rp "请输入管理员用户名（默认 admin）: " ADMIN_USER || true; ADMIN_USER="${ADMIN_USER:-admin}"
  read -rsp "请输入管理员密码: " ADMIN_PWD; echo
  docker compose -f "${COMPOSE_FILE}" run --rm -e PYTHONUNBUFFERED=1 web \
    python -m app.bootstrap init-admin --username "${ADMIN_USER}" --password "${ADMIN_PWD}"
}

# ===== 9) 启动 Web & 健康检查 =====
start_web(){
  ok "启动 Web 服务"
  docker compose -f "${COMPOSE_FILE}" up -d web
  local PORT; PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  for _ in {1..60}; do
    if curl -sf "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then ok "Web 健康检查通过"; break; fi; sleep 2
  done
}

# ===== 10) 自动热重载导航 =====
hot_reload(){ ok "热重载导航 /api/nav（统计模块/菜单/页签到终端）"; bash "${APP_DIR}/scripts/reload_nav.sh" || true; }

# ===== 11) UFW 策略 & 链路验证（本地+公网）=====
ufw_and_verify(){
  local HOST PORT OPEN; HOST="$(grep '^APP_HOST=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  OPEN="$(grep '^UFW_OPEN=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  if command -v ufw >/dev/null 2>&1 && [[ "${OPEN}" == "true" && "${HOST}" == "0.0.0.0" ]]; then
    ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true; ok "已放行 TCP ${PORT}"
  fi
  local PUB=""; PUB="$(curl -sf https://ifconfig.me 2>/dev/null || true)"
  if [[ -n "${PUB}" ]]; then
    curl -sf "http://${PUB}:${PORT}/healthz" >/dev/null 2>&1 && ok "公网 /healthz 200 OK" || warn "公网健康检查失败（可能是云防火墙/安全组未放行）"
  fi
}

# ===== 12) 最终报告 =====
report(){
  local PORT; PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  local IP="$(hostname -I | awk '{print $1}')"
  ok "部署完成"
  echo "访问地址： http://${IP}:${PORT}/"
  echo "容器状态："; docker compose -f "${COMPOSE_FILE}" ps
  echo "数据/日志目录： ${APP_DIR}/backups  / ${APP_DIR}/logs"
  echo "一行日志命令："
  echo "  systemd：${LOG_CMD_SYSTEMD}"
  echo "  Docker ：${LOG_CMD_COMPOSE}"
  echo "  Nginx ：${LOG_CMD_NGINX}"
}

# ===== 主流程（命令之间必须以分号或换行分隔）=====
need_root; check_os; ensure_pkgs; check_net_time; ensure_docker;
choose_mode; prepare_repo; prepare_env; validate_modules; tune_perf; apply_mode;
build_web;           # ★ 新增：迁移前构建 web 镜像，确保包含最新的 alembic.ini 与代码
start_pg; migrate_db; init_admin; start_web; hot_reload; ufw_and_verify; report
