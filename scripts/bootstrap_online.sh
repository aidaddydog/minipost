#!/usr/bin/env bash
# =========================================================
# minipost 一键部署（零交互 · 每步胶囊进度条 · 失败自动打印日志 · 公网IP展示）
# =========================================================
set -Eeuo pipefail

# ===== 主题配色（极简） =====
COL_RESET="\033[0m"; COL_DIM="\033[2m"; COL_MUTE="\033[90m"
COL_OK="\033[38;5;84m"; COL_WARN="\033[38;5;214m"; COL_ERR="\033[38;5;203m"
COL_BAR_FG="\033[38;5;48m"; COL_BAR_BG="\033[38;5;240m"
BAR_LEN=28; SPIN=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)

hide_cursor(){ tput civis 2>/dev/null || true; }
show_cursor(){ tput cnorm 2>/dev/null || true; }
on_exit(){ show_cursor; echo; }
trap on_exit EXIT

# ===== 每步胶囊进度条 =====
step_bar(){ # step_bar <pct> <msg>
  local p="$1"; shift; [ "$p" -gt 100 ] && p=100
  local msg="$*"
  local fill=$(( p*BAR_LEN/100 )); [ $fill -gt $BAR_LEN ] && fill=$BAR_LEN
  local empty=$(( BAR_LEN-fill ))
  local filled=$(printf '█%.0s' $(seq 1 $fill))
  local blanks=$(printf '░%.0s' $(seq 1 $empty))
  printf "\r ${COL_BAR_FG}[${filled}${COL_BAR_BG}${blanks}${COL_BAR_FG}]${COL_RESET} %3d%%  %s" "$p" "$msg"
}
step_ok(){   printf "  ${COL_OK}✓${COL_RESET}\n"; }
step_warn(){ printf "  ${COL_WARN}⚠${COL_RESET}\n"; }
step_err(){  printf "  ${COL_ERR}✘${COL_RESET}\n"; }

# ===== 变量 / 默认值 =====
set +u
[ -f ".deploy.env" ] && { set -a; . ".deploy.env"; set +a; }
[ -f "/opt/minipost/.deploy.env" ] && { set -a; . "/opt/minipost/.deploy.env"; set +a; }
: "${BASE_DIR:=/opt/minipost}"
: "${REPO_URL:=https://github.com/aidaddydog/minipost.git}"
: "${SERVICE_NAME:=minipost}"
: "${APP_PORT:=8000}"
: "${EDITOR_PORT:=6006}"
: "${EDITOR_USER:=daddy}"
: "${EDITOR_PASS:=20240314AaA#}"
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"     # 运行中可能被改写为 .repo 路径
: "${COMPOSE_PROFILES:=web,backend,postgres,editor}"
: "${AUTO_OPEN_UFW:=yes}"
# —— 零交互最佳默认（可在 .deploy.env 覆盖）——
: "${AUTO_PRUNE_OLD:=no}"
: "${DO_BACKUP_DATA:=yes}"
: "${AUTO_FAIL2BAN:=yes}"
: "${AUTO_UNATTENDED_UPDATES:=yes}"
: "${AUTO_TUNE_NET:=yes}"
: "${AUTO_ULIMITS:=yes}"
: "${AUTO_ZRAM_SWAP:=yes}"
: "${SWAP_SIZE_GB:=8}"
: "${DOCKER_MIRROR_URL:=}"
: "${DEFAULT_MIRRORS:="https://docker.m.daocloud.io https://hub-mirror.c.163.com https://mirror.ccs.tencentyun.com"}"
: "${GIT_AUTH_HEADER:=}"
export BASE_DIR SERVICE_NAME APP_PORT EDITOR_PORT COMPOSE_PROFILES
set -u

install -d -m 0755 "${BASE_DIR}/logs"
LOG_FILE="${BASE_DIR}/logs/bootstrap_$(date +%Y%m%d_%H%M%S).log"
ln -sfn "$LOG_FILE" "${BASE_DIR}/logs/bootstrap.latest.log"

# ===== 工具函数（子 Shell 要用，必须 export -f） =====
ensure_env_var(){ local k="$1" v="$2" f="${BASE_DIR}/.deploy.env"; install -d -m 0755 "${BASE_DIR}"; [ -f "$f" ] || { echo "# minipost 部署环境（自动生成）" > "$f"; chmod 600 "$f"; }; grep -q "^${k}=" "$f" 2>/dev/null || echo "${k}=${v}" >> "$f"; }
merge_daemon_json(){ local key="$1" value="$2" f="/etc/docker/daemon.json"; install -d -m 0755 /etc/docker; [ -f "$f" ] || echo '{}' > "$f"; local tmp; tmp="$(mktemp)"; jq "$key = $value" "$f" > "$tmp" && cat "$tmp" > "$f" && rm -f "$tmp"; }
detect_public_ip(){ local ip=""; ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"; [ -z "$ip" ] && ip="$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"; [ -z "$ip" ] && ip="$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null || true)"; [ -z "$ip" ] && ip="$(ip route get 1 2>/dev/null | awk '/src/{print $7; exit}')"; echo "${ip:-未知}"; }
export -f ensure_env_var
export -f merge_daemon_json

dump_failure(){ # 自动打印关键日志（末尾 200 行）+ 一键命令
  echo -e "\n———— ${COL_ERR}失败日志（末尾 200 行）${COL_RESET} ————"
  echo "tail -n 200 ${BASE_DIR}/logs/bootstrap.latest.log"
  tail -n 200 "${BASE_DIR}/logs/bootstrap.latest.log" 2>/dev/null || true
  if [ -f "${COMPOSE_FILE}" ]; then
    echo -e "\n—— backend 容器日志（末尾 200 行） ——"
    echo "docker compose -f ${COMPOSE_FILE} logs backend --tail=200"
    docker compose -f "${COMPOSE_FILE}" logs backend --tail_
