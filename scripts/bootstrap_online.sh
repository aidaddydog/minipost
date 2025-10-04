#!/usr/bin/env bash
# 一键部署（在线）：按仓库根部署；必须 root；仅在需要的场景交互
set -Eeuo pipefail

# ========= 配色 =========
c_red='\033[0;31m'
c_grn='\033[0;32m'
c_ylw='\033[0;33m'
c_cyn='\033[0;36m'
c_blu='\033[38;5;39m'      # 芙蒂尼蓝（近似）
c_org='\033[38;5;214m'     # 橙色（保留但不再用于最终报告）
c_dgrn_i='\033[3;38;5;22m' # 斜体墨绿色
c_rst='\033[0m'

# 日志样式：把“绿色标题”改成芙蒂尼蓝，不加粗
ok()   { echo -e "${c_blu}[+] $*${c_rst}"; }
warn() { echo -e "${c_ylw}[!] $*${c_rst}"; }
err()  { echo -e "${c_red}[-] $*${c_rst}" >&2; }
die()  { err "$1"; exit 1; }

# ========= 旋转指示（黄色 ⣿ / 完成 ✓ 绿色）=========
SPIN_PID=0
SPIN_FILE=""
SPIN_MSG=""

spin_begin() {
  SPIN_MSG="$1"
  SPIN_FILE="$(mktemp)"
  : > "${SPIN_FILE}"
  (
    local frames=(⣾ ⣿ ⣷ ⣯ ⣟ ⣻ ⣽ ⣾)
    local i=0
    tput civis 2>/dev/null || true
    while [[ -f "${SPIN_FILE}" ]]; do
      local f="${frames[i % ${#frames[@]}]}"
      printf "\r\033[0;33m%s\033[0m \033[38;5;39m%s\033[0m" "${f}" "${SPIN_MSG}"
      i=$((i+1))
      sleep 0.1
    done
    tput cnorm 2>/dev/null || true
  ) &
  SPIN_PID=$!
}

spin_end() {
  local rc="${1:-0}"
  [[ -n "${SPIN_FILE}" && -f "${SPIN_FILE}" ]] && rm -f "${SPIN_FILE}"
  wait "${SPIN_PID}" 2>/dev/null || true
  if [[ "${rc}" -eq 0 ]]; then
    printf "\r\033[0;32m✓\033[0m \033[38;5;39m%s\033[0m\n" "${SPIN_MSG}"
  else
    printf "\r\033[0;31m✗\033[0m \033[38;5;39m%s\033[0m\n" "${SPIN_MSG}"
  fi
  SPIN_PID=0
  SPIN_FILE=""
  SPIN_MSG=""
}

# ========= 分支自动识别（新增） =========
# 优先顺序：
# 1) 显式环境变量：MINIPOST_BRANCH / BRANCH（若设置且不为 "auto"）
# 2) 若在本地 git 仓库中执行：使用当前分支
# 3) 使用脚本自带的分支（本文件所在分支）
# 4) 兜底：main
: "${SELF_BRANCH:=mainV1.1}"   # ← 本文件所在分支；在 mainV1.1 分支内保持 mainV1.1

detect_branch() {
  local explicit="${MINIPOST_BRANCH:-${BRANCH:-}}"
  if [[ -n "${explicit}" && "${explicit}" != "auto" ]]; then
    echo "${explicit}"
    return 0
  fi

  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local cur_branch
    cur_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
    if [[ -n "${cur_branch}" && "${cur_branch}" != "HEAD" ]]; then
      echo "${cur_branch}"
      return 0
    fi
  fi

  echo "${SELF_BRANCH:-main}"
}

# ========= 常量 =========
REPO_URL="${REPO_URL:-https://github.com/aidaddydog/minipost.git}"
BRANCH="${BRANCH:-$(detect_branch)}"
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

ensure_pkgs(){
  spin_begin "安装/校验基础软件（git/curl/ufw/chrony/yaml 解析等）"
  apt-get update -y >/dev/null
  apt-get install -y ca-certificates curl gnupg lsb-release git ufw chrony python3-yaml >/dev/null 2>&1 || true
  spin_end 0
}

check_net_time(){
  ok "系统/网络/时间/端口检查"
  if command -v timedatectl >/dev/null 2>&1; then timedatectl set-ntp true >/dev/null 2>&1 || true; else systemctl enable --now chrony >/dev/null 2>&1 || true; fi
  local p="${APP_PORT:-8000}"
  if ss -ltn | awk '{print $4}' | grep -q ":${p}\$"; then
    warn "预检提示：检测到端口 ${p} 被占用（稍后将按 .deploy.env 的 APP_PORT 严格校验与释放）"
  fi
}

ensure_docker(){
  spin_begin "安装/检查 Docker Engine 与 Compose 插件"
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
  spin_end 0
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
  echo -e "  ${c_blu}1) 全新安装${c_rst}：备份→清理容器/卷/镜像/缓存→重装"
  echo -e "  ${c_blu}2) 覆盖安装（默认）${c_rst}：保留数据卷，仅更新结构与镜像"
  echo -e "  ${c_blu}3) 升级安装${c_rst}：仅同步差异；若有迁移→自动幂等迁移"
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
  put USE_REAL_NAV true; put UFW_OPEN true; put ENVIRONMENT production
  grep -q '^PG_PASSWORD=' .deploy.env || echo "PG_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '\n=/' | cut -c1-32)" >> .deploy.env
  grep -q '^JWT_SECRET=' .deploy.env  || echo "JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '\n=/' | cut -c1-48)" >> .deploy.env

  # ===== HTTPS 登录 Cookie Secure 开关（默认 N）=====
  if ! grep -q '^COOKIE_SECURE=' .deploy.env; then
    echo -e "${c_cyn}是否开启 HTTPS 登录（Cookie 将设置 Secure，仅 HTTPS 生效）？${c_rst}"
    read -rp "开启请输入 y，默认 [n]: " _ans || true
    _ans="$(echo "${_ans:-n}" | tr 'A-Z' 'a-z')"
    if [[ "${_ans}" == "y" || "${_ans}" == "yes" ]]; then
      echo "COOKIE_SECURE=on" >> .deploy.env
      ok "已设置 COOKIE_SECURE=on（仅 HTTPS 登录）"
    else
      echo "COOKIE_SECURE=off" >> .deploy.env
      warn "已设置 COOKIE_SECURE=off（允许 HTTP，建议仅用于临时/测试环境）"
    fi
  fi
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
  spin_begin "构建 Web 镜像"
  if [[ "${MODE}" == "1" ]]; then
    docker compose -f "${COMPOSE_FILE}" build --pull --no-cache web
  else
    docker compose -f "${COMPOSE_FILE}" build --pull web
  fi
  local rc=$?
  spin_end "${rc}"
  local ver
  ver="$(docker compose -f "${COMPOSE_FILE}" run --rm -w /app web python - <<'PY'
import bcrypt, passlib, fastapi, uvicorn
print("bcrypt", bcrypt.__version__, "| passlib", passlib.__version__, "| fastapi", fastapi.__version__, "| uvicorn", uvicorn.__version__)
PY
  )"
  box5 "构建环境版本（bcrypt/passlib/fastapi/uvicorn）" "$ver"
}

start_pg(){
  spin_begin "启动 PostgreSQL 16"
  docker compose -f "${COMPOSE_FILE}" up -d postgres
  local DB USER; DB="$(grep '^PG_DB=' .deploy.env | cut -d= -f2- | tr -d '\r')"; USER="$(grep '^PG_USER=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  for _ in {1..60}; do
    if docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U "${USER}" -d "${DB}" -h localhost >/dev/null 2>&1; then
      spin_end 0
      ok "Postgres 就绪"
      return 0
    fi
    sleep 1
  done
  spin_end 1
  die "Postgres 就绪检测超时"
}

migrate_db(){
  spin_begin "执行 Alembic 迁移"
  local out; set +e
  out="$(docker compose -f "${COMPOSE_FILE}" run --rm -w /app web alembic -c /app/alembic.ini upgrade head 2>&1)"
  local rc=$?; set -e
  spin_end "${rc}"
  box5 "迁移输出（仅显示末尾 5 行）" "$out"
  [[ $rc -eq 0 ]] || { err "迁移失败"; echo "一行日志命令：${LOG_CMD_COMPOSE}"; exit 1; }
}

# ========== 管理员初始化（按模式分流）==========
ADMIN_USER_INPUT=""; ADMIN_PWD_INPUT=""; ADMIN_INIT_DONE=0

init_admin_do(){
  docker compose -f "${COMPOSE_FILE}" run --rm -e PYTHONUNBUFFERED=1 web \
    python -m app.bootstrap init-admin --username "${ADMIN_USER_INPUT}" --password "${ADMIN_PWD_INPUT}"
  ADMIN_INIT_DONE=1
}

maybe_init_admin_by_mode(){
  case "${MODE}" in
    1)
      ok "【全新安装】初始化管理员（必填，明文）"
      read -rp "请输入管理员用户名（默认 admin）: " ADMIN_USER_INPUT || true; ADMIN_USER_INPUT="${ADMIN_USER_INPUT:-admin}"
      read -rp "请输入管理员密码（明文）: " ADMIN_PWD_INPUT
      init_admin_do
      ;;
    2)
      ok "【覆盖安装】可选是否重置管理员（默认否）"
      read -rp "是否初始化管理员账号密码？(y/N): " CH || true; CH="${CH:-N}"
      if [[ "${CH}" =~ ^[Yy]$ ]]; then
        read -rp "请输入管理员用户名（默认 admin）: " ADMIN_USER_INPUT || true; ADMIN_USER_INPUT="${ADMIN_USER_INPUT:-admin}"
        read -rp "请输入管理员密码（明文）: " ADMIN_PWD_INPUT
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
  spin_begin "启动 Web 服务"
  docker compose -f "${COMPOSE_FILE}" up -d web
  local PORT; PORT="$(grep '^APP_PORT=' .deploy.env | cut -d= -f2- | tr -d '\r')"
  local passed=0
  for _ in {1..60}; do
    if curl -sf "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
      spin_end 0
      ok "Web 健康检查通过"
      passed=1
      break
    fi
    sleep 2
  done
  if [[ $passed -ne 1 ]]; then
    spin_end 1
    err "Web 健康检查超时，自动打印最近 50 行容器日志："
    docker compose -f "${COMPOSE_FILE}" logs web --tail=50 || true
    echo "一行日志命令：${LOG_CMD_COMPOSE}"
    exit 1
  fi
}

hot_reload(){
  spin_begin "热重载导航 /api/nav（统计模块/菜单/页签）"
  bash "${APP_DIR}/scripts/reload_nav.sh" || true
  spin_end 0
}

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

  echo -e "${c_dgrn_i}================== 部署完成（报告） ==================${c_rst}"
  echo -e "${c_dgrn_i}访问地址（内网）： http://${IP}:${PORT}/${c_rst}"
  [[ -n "${PUB}" ]] && echo -e "${c_dgrn_i}访问地址（公网）： http://${PUB}:${PORT}/${c_rst}"
  echo -e "${c_dgrn_i}健康检查：         http://${IP}:${PORT}/healthz${c_rst}"
  [[ -n "${PUB}" ]] && echo -e "${c_dgrn_i}健康检查（公网）： http://${PUB}:${PORT}/healthz${c_rst}"
  echo -e "${c_dgrn_i}管理登录入口：     http://${IP}:${PORT}/login${c_rst}"
  [[ -n "${PUB}" ]] && echo -e "${c_dgrn_i}管理登录入口（公网）：http://${PUB}:${PORT}/login${c_rst}"

  if [[ ${ADMIN_INIT_DONE} -eq 1 ]]; then
    echo -e "${c_dgrn_i}管理员账号（本次初始化）：${ADMIN_USER_INPUT}${c_rst}"
    echo -e "${c_dgrn_i}管理员密码（本次明文）：    ${ADMIN_PWD_INPUT}${c_rst}"
  else
    echo -e "${c_dgrn_i}管理员：本次未初始化，沿用已有账号密码（未显示）${c_rst}"
  fi

  # 聚合状态：一行
  local agg
  agg="$(docker compose -f "${COMPOSE_FILE}" ps --format 'table {{.Service}}\t{{.State}}' \
        | tail -n +2 | awk '{s=$1; $1=""; sub(/^ /,""); st=$0; printf "%s=%s, ", s, st}' | sed 's/, $//')"
  [[ -z "${agg}" ]] && agg="(无容器信息)"
  echo -e "${c_dgrn_i}聚合状态：${agg}${c_rst}"

  echo -e "${c_dgrn_i}数据/日志目录： ${APP_DIR}/backups  /  ${APP_DIR}/logs${c_rst}"
  echo -e "${c_dgrn_i}一行日志命令：${c_rst}"
  echo -e "${c_dgrn_i}  systemd：${LOG_CMD_SYSTEMD}${c_rst}"
  echo -e "${c_dgrn_i}  Docker ：${LOG_CMD_COMPOSE}${c_rst}"
  echo -e "${c_dgrn_i}  Nginx ：${LOG_CMD_NGINX}${c_rst}"
  echo -e "${c_dgrn_i}======================================================${c_rst}"
}

# ========= 主流程 =========
need_root; check_os; ensure_pkgs; check_net_time; ensure_docker;
choose_mode; prepare_repo; pre_stop_if_installed; prepare_env; load_deploy_env; write_postgres_env; ensure_port_free; validate_modules; tune_perf; apply_mode;
build_web; start_pg; migrate_db; maybe_init_admin_by_mode; start_web; hot_reload; ufw_and_verify; restart_services; report
