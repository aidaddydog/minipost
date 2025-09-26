#!/usr/bin/env bash
# 一键部署（在线）：按仓库根部署；必须 root；仅在需要的场景交互
set -Eeuo pipefail

# ========= 配色 =========
c_red='\033[1;31m'
c_grn='\033[1;32m'
c_ylw='\033[1;33m'
c_cyn='\033[1;36m'
c_blu='\033[38;5;39m'      # 芙蒂尼蓝（近似）
c_org='\033[38;5;214m'     # 橙色（报告）
c_rst='\033[0m'

ok()   { echo -e "${c_grn}[+] $*${c_rst}"; }
warn() { echo -e "${c_ylw}[!] $*${c_rst}"; }
err()  { echo -e "${c_red}[-] $*${c_rst}" >&2; }
die()  { err "$1"; exit 1; }

# ========= 行动/进度 示例（按要求展示）=========
spin(){ echo -e "${c_cyn}行动状态：⠙ ${*}${c_rst}"; }
progress_demo(){ echo -e "${c_cyn}安装进度：[⣿⣿⣿⣿⣿⣿⣿⣿⣶⣿⣿⣿⣿⣿] 95%${c_rst}"; }

# ========= 常量 =========
REPO_URL="${REPO_URL:-https://github.com/aidaddydog/minipost.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/minipost}"
COMPOSE_FILE="${APP_DIR}/deploy/docker-compose.yml"
: "${APP_PORT:=8000}"

LOG_CMD_SYSTEMD="journalctl -u minipost.service -e -n 200"
LOG_CMD_COMPOSE="docker compose -f ${COMPOSE_FILE} logs web --tail=200"
LOG_CMD_NGINX="tail -n 200 /var/log/nginx/error.log"

# ========= 5 行浅灰日志窗口 =========
box5(){ # box5 "标题" "$content"
  local title="$1"; shift; local content="${*}"
  echo -e "${c_cyn}${title}${c_rst}"
  echo "────────────────────────────────────────────────────────"
  echo -e "$content" | tail -n 5
  echo "────────────────────────────────────────────────────────"
}

# ========= 0) Preflight =========
need_root(){ [[ ${EUID:-$(id -u)} -eq 0 ]] || die "请先 sudo -i 或 su - 切换到 root 后重试（EUID 必须 0）"; }
check_os(){ . /etc/os-release || true; [[ "${ID:-}" = "ubuntu" && "${VERSION_ID:-}" = "24.04" ]] || warn "建议 Ubuntu 24.04 LTS，当前：${PRETTY_NAME:-unknown}（继续尝试）"; }
ensure_pkgs(){ ok "安装/校验基础软件（git/curl/ufw/chrony/yaml 解析等）"; apt-get update -y >/dev/null; apt-get install -y ca-certificates curl gnupg lsb-release git ufw chrony python3-yaml >/dev/null 2>&1 || true; }

check_net_time(){
  ok "系统/网络/时间/端口检查"
  if command -v timedatectl >/dev/null 2>&1; then timedatectl set-ntp true >/dev/null 2>&1 || true; else systemctl enable --now chrony >/dev/null 2>&1 || true; fi
  local p="${APP_PORT:-8000}"
  if ss -ltn | awk '{print $4}' | grep -q ":${p}\$"; then
    warn "预检提示：检测到端口 ${p} 被占用（稍后将按 .deploy.env 的 APP_PORT 严格校验与释放）"
  fi
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
  docker compose version >/dev/null 2>&1 || die "缺少 docker compose 插件"
}

# ========= 端到端复用的辅助 =========
pre_stop_if_installed(){
  ok "检测并停止旧实例（systemd + compose + 残留容器）"
  if systemctl list-unit-files | awk '{print $1}' | grep -qx "minipost.service"; then systemctl stop minipost.service >/dev/null 2>&1 || true; fi
  if [[ -f "${COMPOSE_FILE}" ]]; then docker compose -f "${COMPOSE_FILE}" down --remove-orphans >/dev/null 2>&1 || true; fi
  local ids; ids="$(docker ps -q --filter "name=minipost_")"; [[ -n "${ids}" ]] && docker stop ${ids} >/dev/null 2>&1 || true
}

choose_mode(){
  echo -e "${c_cyn}请选择部署模式（仅输入数字）：${c_rst}"
  echo -e "  ${c_grn}1) 全新安装${c_rst}：备份→清理容器/卷/镜像/缓存→重装"
  echo -e "  ${c_grn}2) 覆盖安装（默认）${c_rst}：保留数据卷，仅更新结构与镜像"
  echo -e "  ${c_grn}3) 升级安装${c_rst}：仅同步差异；若有迁移→自动幂等迁移"
  read -rp "输入 [1/2/3]（默认 2）: " MODE || true
  MODE="${MODE:-2}"
  [[ "${MODE}" =~ ^[123]$ ]] || die "非法输入：${MODE}"
}

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

load_deploy_env(){
  if [[ -f "${APP_DIR}/.deploy.env" ]]; then
    set -a; . "${APP_DIR}/.deploy.env"; set +a
    ok "已加载 .deploy.env 环境变量（PG_* / APP_*）"
  else
    warn ".deploy.env 未找到（prepare_env 将在后续创建）"
  fi
}

write_postgres_env(){
  ok "写入 Postgres 环境文件（deploy/postgres.env）"
  mkdir -p "${APP_DIR}/deploy"
  cat > "${APP_DIR}/deploy/postgres.env" <<EOF
POSTGRES_USER=${PG_USER}
POSTGRES_PASSWORD=${PG_PASSWORD}
POSTGRES_DB=${PG_DB}
EOF
}

ensure_port_free(){
  local p="${APP_PORT:-8000}"
  if [[ -f "${APP_DIR}/.deploy.env" ]]; then p="$(grep -E '^APP_PORT=' "${APP_DIR}/.deploy.env" | cut -d= -f2- | tr -d '\r')"; p="${p:-8000}"; fi
  ok "检查并释放端口 ${p}"
  local ids
  ids="$(docker ps --format '{{.ID}} {{.Ports}}' | awk -v P=":${p}->" '$0 ~ P {print $1}')"
  [[ -n "${ids}" ]] && docker stop ${ids} >/dev/null 2>&1 || true
  pkill -f "docker-proxy.*:${p}->"  >/dev/null 2>&1 || true
  pkill -f "docker-proxy.*-p ${p}:" >/dev/null 2>&1 || true
  local pids cmd
  pids="$(ss -ltnp | awk -v P=":${p}$" '$4 ~ P {print $7}' | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)"
  for pid in ${pids}; do
    cmd="$(tr '\0' ' ' < /proc/${pid}/cmdline 2>/dev/null || true)"
    if echo "${cmd}" | grep -E 'uvicorn|gunicorn|python' | grep -qE 'minipost|/opt/minipost|app\.main'; then
      kill -TERM "${pid}" >/dev/null 2>&1 || true; sleep 1; kill -KILL "${pid}" >/dev/null 2>&1 || true
    fi
  done
  if ss -ltn | awk '{print $4}' | grep -q ":${p}\$"; then
    err "端口 ${p} 仍被非 minipost 进程占用："; ss -ltnp | awk -v P=":${p}$" '$4 ~ P'
    die "请释放该端口或修改 ${APP_DIR}/.deploy.env 的 APP_PORT 后重试"
  else ok "端口 ${p} 已可用"; fi
}

validate_modules(){
  ok "校验模块 YAML（module.meta / menu.register / tabs.register / permissions.register）"
  local out; out="$(python3 "${APP_DIR}/scripts/validate_modules.py" || true)"
  box5 "校验输出（仅显示末尾 5 行）" "$out"
  echo "$out" | grep -q "__SCHEMA_OK__" || {
    err "模块 YAML 校验不通过，已阻止启动。"
    echo "一行日志命令（Compose）：${LOG_CMD_COMPOSE}"
    exit 1
  }
}

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

apply_mode(){
  case "${MODE}" in
    1)
      ok "全新安装：备份并清理旧实例"
      mkdir -p "${APP_DIR}/backups"
      local TS; TS="$(date +%Y%m%d-%H%M%S)"
      [[ -f "${APP_DIR}/.deploy.env" ]] && cp -a "${APP_DIR}/.deploy.env" "${APP_DIR}/backups/.deploy.env.${TS}.bak" || true
      local OLD_PG_PASSWORD=""; [[ -f "${APP_DIR}/backups/.deploy.env.${TS}.bak" ]] && OLD_PG_PASSWORD="$(grep '^PG_PASSWORD=' "${APP_DIR}/backups/.deploy.env.${TS}.bak" | cut -d= -f2- | tr -d '\r')" || true
      docker compose -f "${COMPOSE_FILE}" down -v --remove-orphans || true
      docker image prune -f || true
      if [[ -n "${OLD_PG_PASSWORD}" ]]; then sed -i "s/^PG_PASSWORD=.*/PG_PASSWORD=${OLD_PG_PASSWORD}/" "${APP_DIR}/.deploy.env" || true; fi
      ;;
    2) ok "覆盖安装：保留数据卷，仅更新镜像与结构" ;;
    3) ok "升级安装：同步差异；如存在迁移将幂等执行" ;;
  esac
}

build_web(){
  spin "构建 Web 镜像"; progress_demo
  if [[ "${MODE}" == "1" ]]; then docker compose -f "${COMPOSE_FILE}" build --pull --no-cache web; else docker compose -f "${COMPOSE_FILE}" build --pull web; fi
  local ver
  ver="$(docker compose -f "${COMPOSE_FILE}" run --rm -w /app web python - <<'PY'
import bcrypt, passlib, fastapi, uvicorn
print("bcrypt", bcrypt.__version__, "| passlib", passlib.__version__, "| fastapi", fastapi.__version__, "| uvicorn", uvicorn.__version__)
PY
  )"
  box5 "构建环境版本（bcrypt/passlib/fastapi/uvicorn）" "$ver"
}

start_pg(){
  spin "启动 PostgreSQL 16"; progress_demo
  docker compose -f "${COMPOSE_FILE}" up -d postgres
  local DB USER; DB="$(grep '^PG_DB=' .deploy.env | cut -d= -f2- | tr -d '\r')"; USER="$(grep '^PG_USER=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  for _ in {1..60}; do
    if docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U "${USER}" -d "${DB}" -h localhost >/dev/null 2>&1; then ok "Postgres 就绪"; break; fi; sleep 1
  done
}

migrate_db(){
  spin "执行 Alembic 迁移"; progress_demo
  local out; set +e
  out="$(docker compose -f "${COMPOSE_FILE}" run --rm -w /app web alembic -c /app/alembic.ini upgrade head 2>&1)"
  local rc=$?; set -e
  box5 "迁移输出（仅显示末尾 5 行）" "$out"
  [[ $rc -eq 0 ]] || { err "迁移失败"; echo "一行日志命令：${LOG_CMD_COMPOSE}"; exit 1; }
}

# ========== 管理员初始化（按模式分流）==========
ADMIN_USER_INPUT=""; ADMIN_PWD_INPUT=""; ADMIN_INIT_DONE=0

init_admin_do(){
  # 以容器运行 bootstrap 子命令；明文密码按你的要求输入并打印到最终报告（仅当本次初始化）
  docker compose -f "${COMPOSE_FILE}" run --rm -e PYTHONUNBUFFERED=1 web \
    python -m app.bootstrap init-admin --username "${ADMIN_USER_INPUT}" --password "${ADMIN_PWD_INPUT}"
  ADMIN_INIT_DONE=1
}

maybe_init_admin_by_mode(){
  case "${MODE}" in
    1)
      ok "【全新安装】初始化管理员（必填，明文）"
      read -rp "请输入管理员用户名（默认 admin）: " ADMIN_USER_INPUT || true; ADMIN_USER_INPUT="${ADMIN_USER_INPUT:-admin}"
      read -rsp "请输入管理员密码（明文）: " ADMIN_PWD_INPUT; echo
      init_admin_do
      ;;
    2)
      ok "【覆盖安装】可选是否重置管理员（默认否）"
      read -rp "是否初始化管理员账号密码？(y/N): " CH || true; CH="${CH:-N}"
      if [[ "${CH}" =~ ^[Yy]$ ]]; then
        read -rp "请输入管理员用户名（默认 admin）: " ADMIN_USER_INPUT || true; ADMIN_USER_INPUT="${ADMIN_USER_INPUT:-admin}"
        read -rsp "请输入管理员密码（明文）: " ADMIN_PWD_INPUT; echo
        init_admin_do
      else
        ok "本次覆盖安装未重置管理员，沿用原有账号密码"
      fi
      ;;
    3)
      ok "【升级安装】静默跳过管理员初始化，沿用原有账号密码"
      ;;
  esac
}

start_web(){
  spin "启动 Web 服务"; progress_demo
  docker compose -f "${COMPOSE_FILE}" up -d web
  local PORT; PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  local passed=0
  for _ in {1..60}; do
    if curl -sf "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then ok "Web 健康检查通过"; passed=1; break; fi
    sleep 2
  done
  if [[ $passed -ne 1 ]]; then
    err "Web 健康检查超时，自动打印最近 50 行容器日志："
    docker compose -f "${COMPOSE_FILE}" logs web --tail=50 || true
    echo "一行日志命令：${LOG_CMD_COMPOSE}"
    exit 1
  fi
}

hot_reload(){ ok "热重载导航 /api/nav（统计模块/菜单/页签）"; bash "${APP_DIR}/scripts/reload_nav.sh" || true; }

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

# 新增：部署完成后重启必要关联服务（栈内 web）
restart_services(){
  echo -e "${c_blu}启动服务中...${c_rst}"
  docker compose -f "${COMPOSE_FILE}" restart web >/dev/null 2>&1 || true
}

report(){
  local PORT IP PUB
  PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  IP="$(hostname -I | awk '{print $1}')"
  PUB="$(curl -sf https://ifconfig.me 2>/dev/null || true)"

  echo -e "${c_org}================== 部署完成（报告） ==================${c_rst}"
  echo -e "${c_org}访问地址（内网）： http://${IP}:${PORT}/${c_rst}"
  [[ -n "${PUB}" ]] && echo -e "${c_org}访问地址（公网）： http://${PUB}:${PORT}/${c_rst}"
  echo -e "${c_org}健康检查：         http://${IP}:${PORT}/healthz${c_rst}"
  [[ -n "${PUB}" ]] && echo -e "${c_org}健康检查（公网）： http://${PUB}:${PORT}/healthz${c_rst}"
  echo -e "${c_org}管理登录入口：     http://${IP}:${PORT}/login${c_rst}"
  [[ -n "${PUB}" ]] && echo -e "${c_org}管理登录入口（公网）：http://${PUB}:${PORT}/login${c_rst}"

  if [[ ${ADMIN_INIT_DONE} -eq 1 ]]; then
    echo -e "${c_org}管理员账号（本次初始化）：${ADMIN_USER_INPUT}${c_rst}"
    echo -e "${c_org}管理员密码（本次明文）：    ${ADMIN_PWD_INPUT}${c_rst}"
  else
    echo -e "${c_org}管理员：本次未初始化，沿用已有账号密码（未显示）${c_rst}"
  fi

  echo -e "${c_org}容器状态：${c_rst}"
  docker compose -f "${COMPOSE_FILE}" ps

  echo -e "${c_org}数据/日志目录： ${APP_DIR}/backups  /  ${APP_DIR}/logs${c_rst}"
  echo -e "${c_org}一行日志命令：${c_rst}"
  echo -e "${c_org}  systemd：${LOG_CMD_SYSTEMD}${c_rst}"
  echo -e "${c_org}  Docker ：${LOG_CMD_COMPOSE}${c_rst}"
  echo -e "${c_org}  Nginx ：${LOG_CMD_NGINX}${c_rst}"
  echo -e "${c_org}======================================================${c_rst}"
}

# ========= 主流程 =========
need_root; check_os; ensure_pkgs; check_net_time; ensure_docker;
choose_mode; prepare_repo; pre_stop_if_installed; prepare_env; load_deploy_env; write_postgres_env; ensure_port_free; validate_modules; tune_perf; apply_mode;
build_web; start_pg; migrate_db; maybe_init_admin_by_mode; start_web; hot_reload; ufw_and_verify; restart_services; report
