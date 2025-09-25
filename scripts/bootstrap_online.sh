#!/usr/bin/env bash
# ============================================================================
# minipost 一键部署（零交互 · 每步胶囊进度条 · 失败自动打印日志 · 公网IP展示）
# 修复要点：
#   1) 数据库迁移改为：一次性容器 run --rm 执行（不依赖 backend 容器 ready）
#   2) 迁移前等待 Postgres 就绪（pg_isready 探测），并保留两次 90s 限时重试
#   3) 失败自动打印“可复制”的关键日志命令（保持你的风格）
# ============================================================================

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

# ===== 胶囊进度条 / 步骤状态 =====
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

# ===== 变量 / 默认值（可被 .deploy.env 覆盖） =====
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
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"     # 运行中可能被 Adopt 改写为 .repo 路径
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
: "${GIT_AUTH_HEADER:=}"  # 若需私有仓库加速拉取，可设置 Authorization 头

export BASE_DIR SERVICE_NAME APP_PORT EDITOR_PORT COMPOSE_PROFILES
set -u

# 日志目录与文件
install -d -m 0755 "${BASE_DIR}/logs"
LOG_FILE="${BASE_DIR}/logs/bootstrap_$(date +%Y%m%d_%H%M%S).log"
ln -sfn "$LOG_FILE" "${BASE_DIR}/logs/bootstrap.latest.log"

# ===== 工具函数 =====
ensure_env_var(){ # ensure_env_var KEY VALUE —— 若 .deploy.env 无该项则追加
  local k="$1" v="$2" f="${BASE_DIR}/.deploy.env"
  touch "$f"
  if ! grep -qE "^${k}=" "$f" 2>/dev/null; then
    printf "%s=%s\n" "$k" "$v" >> "$f"
  fi
}

merge_daemon_json(){ # merge_daemon_json <jq-path> <json-value>
  local key="$1" value="$2" f="/etc/docker/daemon.json" tmp="$(mktemp)"
  install -d -m 0755 /etc/docker
  [ -s "$f" ] || echo '{}' > "$f"
  jq "$key = $value" "$f" > "$tmp" && cat "$tmp" > "$f" && rm -f "$tmp"
}

detect_public_ip(){ # 尝试公网 IP（多源兜底）
  local ip=""
  ip="$(curl -fsS --max-time 2 ifconfig.me 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(curl -fsS --max-time 2 ip.sb 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(ip route get 1.1.1.1 2>/dev/null | awk '/src/{print $7; exit}')" || true
  echo "${ip:-未知}"
}

dump_failure(){ # 自动打印关键日志（末尾 200 行）+ 一键命令
  echo -e "\n———— ${COL_ERR}失败日志（末尾 200 行）${COL_RESET} ————"
  echo "tail -n 200 ${BASE_DIR}/logs/bootstrap.latest.log"
  tail -n 200 "${BASE_DIR}/logs/bootstrap.latest.log" 2>/dev/null || true
  if [ -f "${COMPOSE_FILE}" ]; then
    echo -e "\n—— backend 容器日志（末尾 200 行） ——"
    echo "docker compose -f ${COMPOSE_FILE} logs backend --tail=200"
    docker compose -f "${COMPOSE_FILE}" logs backend --tail=200 2>/dev/null || true
    echo -e "\n—— editor 容器日志（末尾 200 行） ——"
    echo "docker compose -f ${COMPOSE_FILE} logs editor --tail=200"
    docker compose -f "${COMPOSE_FILE}" logs editor  --tail=200 2>/dev/null || true
  fi
  echo -e "\n${COL_DIM}更多请执行：${COL_RESET}"
  echo "  docker compose -f ${COMPOSE_FILE} ps"
  echo "  tail -n 500 ${BASE_DIR}/logs/bootstrap.latest.log"
}

fail_and_exit(){ local why="$1"; show_cursor; echo; echo -e "${COL_ERR}✘ 失败：${why}${COL_RESET}"; dump_failure; exit 1; }

run_step(){ # run_step "标题" "命令"
  local title="$1"; shift; local cmd="$*"
  hide_cursor; local p=7; printf "\n "; step_bar $p "${title}…"
  { bash -lc "$cmd" >>"$LOG_FILE" 2>&1; echo $? >"$LOG_FILE.rc"; } &
  local pid=$! i=0
  while kill -0 $pid 2>/dev/null; do
    i=$(( (i+1) % ${#SPIN[@]} )); p=$(( p<95 ? p+1 : 95 ))
    step_bar $p "${title}… ${SPIN[$i]}"
    sleep .18
  done
  rc=$(cat "$LOG_FILE.rc" 2>/dev/null || echo 1); rm -f "$LOG_FILE.rc"
  if [ "$rc" -eq 0 ]; then step_bar 100 "$title"; step_ok; else step_bar 100 "$title"; step_err; fail_and_exit "$title"; fi
}

run_step_silent(){ # run_step_silent "标题" "cmd"
  local title="$1"; shift; local cmd="$*"
  hide_cursor; printf "\n "; step_bar 7 "${title}…"
  bash -lc "$cmd" >>"$LOG_FILE" 2>&1 || { step_bar 100 "$title"; step_err; fail_and_exit "$title"; }
  step_bar 100 "$title"; step_ok
}

# ===== 01 安装基础依赖 =====
run_step "安装基础依赖" "export DEBIAN_FRONTEND=noninteractive;
  apt-get update;
  apt-get install -y curl ca-certificates gnupg lsb-release jq ufw zram-tools fail2ban unattended-upgrades git iproute2"

# ===== 02 安装/校验 Docker + Compose（已改为：一键清理并全新安装 · 零交互） =====
run_step "安装/校验 Docker + Compose（清理并全新安装）" "
  export DEBIAN_FRONTEND=noninteractive

  # 2.1 停止并卸载可能存在的旧版本（包含 docker.io / docker-ce / 相关插件）
  systemctl stop docker 2>/dev/null || true
  apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras docker.io || true
  apt-get autoremove -y || true
  rm -rf /var/lib/docker /var/lib/containerd || true

  # 2.2 清理旧的 Docker 软件源与 key（避免“是否覆盖 gpg”交互）
  rm -f /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.gpg || true

  # 2.3 重新写入官方源（零交互、强制覆盖）
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  codename=\"$(. /etc/os-release && echo $VERSION_CODENAME)\"
  echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable\" > /etc/apt/sources.list.d/docker.list

  # 2.4 全新安装最新版 Docker CE + Compose 插件
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # 2.5 启动并开机自启
  systemctl enable --now docker

  # 2.6 版本校验（写入日志）
  docker --version
  docker compose version
"

# ===== 03 Docker 守护进程优化 + 镜像加速 =====
run_step "优化 Docker 守护进程" "
  probe(){ code=$(curl -m 3 -fsIX GET \"$1/v2/\" -o /dev/null -w \"%{http_code}\" || true); case \"$code\" in 200|401|403) return 0;; *) return 1;; esac; }
  MIRR=(); [ -n \"$DOCKER_MIRROR_URL\" ] && { IFS=', '; for u in $DOCKER_MIRROR_URL; do MIRR+=(\"$u\"); done; }
  for u in $DEFAULT_MIRRORS; do MIRR+=(\"$u\"); done
  uniq=(); seen=' '; for m in \"${MIRR[@]}\"; do
    if echo \" $seen \" | grep -q \" $m \"; then continue; fi; seen=\"$seen $m\"
    probe \"$m\" && uniq+=(\"$m\")
  done
  merge_daemon_json '.[\"log-driver\"]' '\"local\"'
  merge_daemon_json '.[\"log-opts\"]' '{\"max-size\":\"64m\",\"max-file\":\"5\"}'
  merge_daemon_json '.[\"exec-opts\"]' '[\"native.cgroupdriver=systemd\"]'
  merge_daemon_json '.[\"live-restore\"]' 'true'
  if [ ${#uniq[@]} -gt 0 ]; then printf '%s\n' \"${uniq[@]}\" | jq -R . | jq -s . > /tmp/mirrors.json; merge_daemon_json '.[\"registry-mirrors\"]' \"$(cat /tmp/mirrors.json)\"; fi
  systemctl restart docker
"

# ===== 04 ulimits =====
if [ "${AUTO_ULIMITS}" = "yes" ]; then
  run_step_silent "设置 ulimits" "cat >/etc/security/limits.d/99-erp-oms.conf <<'EOF'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
EOF
merge_daemon_json '.["default-ulimits"]' '{\"nofile\":{\"Name\":\"nofile\",\"Hard\":1048576,\"Soft\":1048576}}'
systemctl restart docker"
fi

# ===== 05 ZRAM / Swap =====
run_step_silent "配置 ZRAM/Swap" "
  MEM_GB=$(awk '/MemTotal/{printf \"%.0f\", $2/1024/1024}' /proc/meminfo)
  if [ \"$AUTO_ZRAM_SWAP\" = \"yes\" ]; then
    if [ \"$MEM_GB\" -le 8 ]; then
      install -d -m 0755 /etc/default
      cat >/etc/default/zramswap <<'EOF'
ENABLED=true
PERCENT=50
PRIORITY=100
EOF
      systemctl restart zramswap || systemctl restart zram-config || true; swapoff -a || true
    else
      if ! grep -q ' /swapfile ' /etc/fstab 2>/dev/null; then
        fallocate -l \"${SWAP_SIZE_GB}G\" /swapfile || dd if=/dev/zero of=/swapfile bs=1G count=\"${SWAP_SIZE_GB}\"
        chmod 600 /swapfile && mkswap /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        swapon -a
      fi
    fi
    sysctl -w vm.swappiness=10 >/dev/null; sysctl -w vm.vfs_cache_pressure=50 >/dev/null
  fi
"

# ===== 06 关闭 THP =====
run_step_silent "关闭 THP" "cat >/etc/systemd/system/disable-thp.service <<'EOF'
[Unit]
Description=Disable Transparent Huge Pages
After=sysinit.target
[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled'
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable --now disable-thp.service || true"

# ===== 07 基础网络内核参数 =====
if [ "${AUTO_TUNE_NET}" = "yes" ]; then
  run_step_silent "优化内核网络参数" "cat >/etc/sysctl.d/99-erp-oms.conf <<'EOF'
net.core.somaxconn=4096
net.core.netdev_max_backlog=16384
net.ipv4.tcp_syncookies=1
net.ipv4.tcp_fin_timeout=15
net.ipv4.tcp_max_syn_backlog=262144
net.ipv4.tcp_tw_reuse=1
net.ipv4.tcp_rmem=4096 87380 67108864
net.ipv4.tcp_wmem=4096 65536 67108864
EOF
sysctl --system >/dev/null 2>&1 || true"
fi

# ===== 08 安全基线 =====
run_step_silent "启用安全组件" "
  [ \"$AUTO_FAIL2BAN\" = \"yes\" ] && systemctl enable --now fail2ban || true
  [ \"$AUTO_UNATTENDED_UPDATES\" = \"yes\" ] && systemctl enable --now unattended-upgrades || true
  if command -v ufw >/dev/null 2>&1 && [ \"$AUTO_OPEN_UFW\" = \"yes\" ]; then
    if ufw status | grep -q 'Status: active'; then
      ufw allow 80/tcp  >/dev/null 2>&1 || true
      ufw allow 443/tcp >/dev/null 2>&1 || true
      ufw allow \"${APP_PORT}/tcp\"    >/dev/null 2>&1 || true
      ufw allow \"${EDITOR_PORT}/tcp\" >/dev/null 2>&1 || true
    fi
  fi
"

# ===== 09 写入部署环境参数 =====
run_step_silent "写入部署环境参数" "
  ensure_env_var APP_PORT \"${APP_PORT}\"
  ensure_env_var EDITOR_PORT \"${EDITOR_PORT}\"
  ensure_env_var EDITOR_USER \"${EDITOR_USER}\"
  ensure_env_var EDITOR_PASS \"${EDITOR_PASS}\"
  ensure_env_var COMPOSE_PROFILES \"${COMPOSE_PROFILES}\"
"

# ===== 10 同步仓库（自动 Adopt 接管） =====
run_step "同步仓库（标准/Adopt 自动）" "
  REPO_DIR='${BASE_DIR}'; USE_ADOPT='no'
  if [ -d '${BASE_DIR}' ] && [ ! -d '${BASE_DIR}/.git' ]; then
    USE_ADOPT='yes'; REPO_DIR='${BASE_DIR}/.repo'; install -d -m 0755 \"$REPO_DIR\"
    if [ ! -d \"$REPO_DIR/.git\" ]; then git clone '${REPO_URL}' \"$REPO_DIR\"; else git -C \"$REPO_DIR\" fetch --all && git -C \"$REPO_DIR\" reset --hard origin/main; fi
  elif [ -d '${BASE_DIR}/.git' ]; then
    git -C '${BASE_DIR}' fetch --all && git -C '${BASE_DIR}' reset --hard origin/main
  else
    install -d -m 0755 '${BASE_DIR}'; git clone '${REPO_URL}' '${BASE_DIR}'
  fi
  if [ \"$USE_ADOPT\" = 'yes' ]; then echo '${BASE_DIR}/.repo/deploy/docker-compose.yml' > '${BASE_DIR}/.compose.path'; else echo '${BASE_DIR}/deploy/docker-compose.yml' > '${BASE_DIR}/.compose.path'; fi
"

# 统一 COMPOSE_FILE（支持 Adopt）
COMPOSE_FILE="$(cat "${BASE_DIR}/.compose.path" 2>/dev/null || echo "${COMPOSE_FILE}")"
export COMPOSE_FILE
ensure_env_var COMPOSE_FILE "${COMPOSE_FILE}"

# ===== 11 备份数据 / 二次覆盖（可选） =====
run_step_silent "备份数据/清理旧容器" "
  if [ \"${DO_BACKUP_DATA}\" = 'yes' ] && [ -d '${BASE_DIR}/data' ]; then
    BDIR='${BASE_DIR}/backup_$(date +%Y%m%d_%H%M%S)'; install -d -m 0755 \"$BDIR\"; tar -czf \"$BDIR/data.tgz\" -C '${BASE_DIR}' data || true
  fi
  if [ \"${AUTO_PRUNE_OLD}\" = 'yes' ] && [ -f '${COMPOSE_FILE}' ]; then
    docker compose -f '${COMPOSE_FILE}' down -v --remove-orphans || true
    docker image prune -f || true; docker volume prune -f || true
  fi
"

# ===== 12 构建镜像 =====
run_step "构建镜像（web+backend+postgres+editor）" "COMPOSE_PROFILES='${COMPOSE_PROFILES}' docker compose -f '${COMPOSE_FILE}' build"

# ===== 13 启动服务 =====
run_step "启动服务" "COMPOSE_PROFILES='${COMPOSE_PROFILES}' docker compose -f '${COMPOSE_FILE}' up -d"

# ===== 14 等待数据库就绪（pg_isready 探测，最多 60s） =====
hide_cursor; printf "\n "; step_bar 0 "等待数据库就绪…"
db_ready=0
for i in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" exec -T db bash -lc "pg_isready -U postgres -h 127.0.0.1" >>"$LOG_FILE" 2>&1; then
    db_ready=1; break
  fi
  step_bar $((i*3)) "等待数据库就绪（第 ${i}/30 次）…"; sleep 2
done
if [ "$db_ready" -eq 1 ]; then step_bar 100 "等待数据库就绪"; step_ok; else step_bar 100 "等待数据库就绪"; step_warn; fi

# ===== 15 执行数据库迁移（一次性容器 · 限时重试） =====
hide_cursor; printf "\n "; step_bar 0 "执行数据库迁移（alembic upgrade heads）…"

migrate_once(){
  # 说明：使用 run --rm 后台一次性容器执行；迁移时强制切换为同步驱动（如 env 存在 +asyncpg）
  timeout 90s docker compose -f "${COMPOSE_FILE}" run --rm -T \
    backend bash -lc 'set -e; cd /app; export DATABASE_URL="${DATABASE_URL/+asyncpg/+psycopg2}"; alembic -c /app/alembic.ini upgrade heads'
}

if migrate_once >>"$LOG_FILE" 2>&1; then
  step_bar 100 "执行数据库迁移"; step_ok
else
  sleep 5
  if migrate_once >>"$LOG_FILE" 2>&1; then
    step_bar 100 "执行数据库迁移（重试成功）"; step_ok
  else
    step_bar 100 "执行数据库迁移（两次失败）"; step_warn
    fail_and_exit "数据库迁移（alembic upgrade heads）"
  fi
fi

# ===== 16 端口探测（非阻塞） =====
curl -fsSI --max-time 3 "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1 || true
curl -fsSI --max-time 3 "http://127.0.0.1:${EDITOR_PORT}/login" >/dev/null 2>&1 || true

# ===== 17 展示公网 IP & 常用命令 =====
PUBIP="$(detect_public_ip)"
echo -e "${COL_OK}✔ 部署完成${COL_RESET}"
echo -e "${COL_DIM}访问地址（公网IP 自动探测）${COL_RESET}"
echo -e "  管理端：     ${COL_OK}http://${PUBIP}:${APP_PORT}${COL_RESET}"
echo -e "  模板编辑器： ${COL_OK}http://${PUBIP}:${EDITOR_PORT}${COL_RESET}  ${COL_DIM}（账号：${EDITOR_USER}）${COL_RESET}"
echo -e "${COL_DIM}常用一键日志命令：${COL_RESET}"
echo -e "  docker compose -f ${COMPOSE_FILE} ps"
echo -e "  docker compose -f ${COMPOSE_FILE} logs backend --tail=200"
echo -e "  docker compose -f ${COMPOSE_FILE} logs editor  --tail=200"
echo -e "  tail -n 200 ${BASE_DIR}/logs/bootstrap.latest.log"
