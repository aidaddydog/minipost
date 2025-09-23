#!/usr/bin/env bash
# =========================================================
# minipost 一键部署（零交互 · 极简进度条 · 失败必给一键日志指令 · 公网IP展示）
# =========================================================
set -Eeuo pipefail

# ===== 主题 / 颜色 =====
COL_RESET="\033[0m"; COL_DIM="\033[2m"; COL_MUTE="\033[90m"
COL_OK="\033[38;5;84m"; COL_WARN="\033[38;5;214m"; COL_ERR="\033[38;5;203m"
COL_BAR_FG="\033[38;5;48m"; COL_BAR_BG="\033[38;5;240m"
BAR_LEN=28; SPIN=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)

hide_cursor(){ tput civis 2>/dev/null || true; }
show_cursor(){ tput cnorm 2>/dev/null || true; }
on_exit(){ show_cursor; echo; }
trap on_exit EXIT

# ===== 进度条 =====
STEP=0; STEPS=13
pct(){ python3 - <<PY 2>/dev/null || awk 'BEGIN{print int('$1'/'$2'*100)}'
print(int($1/$2*100))
PY
}
bar_draw(){ # $1 pct, $2 msg
  local p="$1"; local msg="$2"
  [ "$p" -gt 100 ] && p=100
  local fill=$(( p*BAR_LEN/100 )); [ $fill -gt $BAR_LEN ] && fill=$BAR_LEN
  local empty=$(( BAR_LEN-fill ))
  local filled=$(printf '█%.0s' $(seq 1 $fill))
  local blanks=$(printf '░%.0s' $(seq 1 $empty))
  printf "\r ${COL_BAR_FG}[${filled}${COL_BAR_BG}${blanks}${COL_BAR_FG}]${COL_RESET} %3d%%  %s" "$p" "$msg"
}

ok_mark(){ printf "  ${COL_OK}✓${COL_RESET}\n"; }
warn_mark(){ printf "  ${COL_WARN}⚠${COL_RESET}\n"; }
err_mark(){ printf "  ${COL_ERR}✘${COL_RESET}\n"; }

# ===== 变量 / 日志 =====
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
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"   # 运行中可能被改写为 .repo 路径
: "${COMPOSE_PROFILES:=web,backend,postgres,editor}"
: "${AUTO_OPEN_UFW:=yes}"

# 零交互最佳默认（可用 .deploy.env 覆盖）
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

# ===== 工具函数 =====
ensure_env_var(){ # ensure_env_var KEY VAL
  local k="$1" v="$2" f="${BASE_DIR}/.deploy.env"
  install -d -m 0755 "${BASE_DIR}"
  [ -f "$f" ] || { echo "# minipost 部署环境（自动生成）" > "$f"; chmod 600 "$f"; }
  grep -q "^${k}=" "$f" 2>/dev/null || echo "${k}=${v}" >> "$f"
}
merge_daemon_json(){ # merge_daemon_json '.["key"]' 'json'
  local key="$1" value="$2" f="/etc/docker/daemon.json"
  install -d -m 0755 /etc/docker
  [ -f "$f" ] || echo '{}' > "$f"
  local tmp; tmp="$(mktemp)"
  jq "$key = $value" "$f" > "$tmp" && cat "$tmp" > "$f" && rm -f "$tmp"
}
detect_public_ip(){
  local ip=""
  ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(ip route get 1 2>/dev/null | awk '/src/{print $7; exit}')"
  echo "${ip:-未知}"
}

# ——失败时：打印“一键日志指令”（可直接复制粘贴）——
fail_with_help(){ # $1 描述
  local desc="$1"
  show_cursor
  echo
  echo -e "${COL_ERR}✘ 失败：${desc}${COL_RESET}"
  echo -e "${COL_DIM}请复制执行以下任一命令查看详情：${COL_RESET}"
  echo "  tail -n 200 ${BASE_DIR}/logs/bootstrap.latest.log"
  echo "  docker compose -f ${COMPOSE_FILE} logs backend --tail=200"
  echo "  docker compose -f ${COMPOSE_FILE} logs editor  --tail=200"
  exit 1
}

# 带旋转动画的任务
spin_run(){ # spin_run "描述" "命令"
  local desc="$1"; shift; local cmd="$*"
  STEP=$((STEP+1)); local p=$(pct $STEP $STEPS)
  hide_cursor; bar_draw "$p" "${desc}…"
  { bash -lc "$cmd" >>"$LOG_FILE" 2>&1; echo $? >"$LOG_FILE.rc"; } &
  local pid=$! i=0
  while kill -0 $pid 2>/dev/null; do
    printf "\r "; bar_draw "$p" "${desc}… ${COL_MUTE}${SPIN[$((i%${#SPIN[@]}))]}${COL_RESET}"
    i=$((i+1)); sleep 0.1
  done
  local rc=$(cat "$LOG_FILE.rc" 2>/dev/null || echo 1); rm -f "$LOG_FILE.rc"
  printf "\r "; bar_draw "$p" "${desc}"
  if [ $rc -eq 0 ]; then ok_mark; else err_mark; fail_with_help "$desc"; fi
}

# 静默任务（无动画）
run_silent(){ # run_silent "描述" "命令"
  local desc="$1"; shift; local cmd="$*"
  STEP=$((STEP+1)); local p=$(pct $STEP $STEPS)
  hide_cursor; bar_draw "$p" "${desc}…"
  if bash -lc "$cmd" >>"$LOG_FILE" 2>&1; then
    printf "\r "; bar_draw "$p" "${desc}"; ok_mark
  else
    printf "\r "; bar_draw "$p" "${desc}"; err_mark; fail_with_help "$desc"
  fi
}

# ===== 开始 =====
echo -e "${COL_DIM}安装日志 -> ${LOG_FILE}${COL_RESET}"
[ "$(id -u)" -eq 0 ] || { echo -e "${COL_ERR}✘ 需要 root 运行${COL_RESET}"; exit 1; }

# 1/13 基础依赖
spin_run "安装基础依赖" "
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release jq ufw zram-tools fail2ban unattended-upgrades
"

# 2/13 Docker & Compose
spin_run "安装/校验 Docker + Compose" "
  install -d -m 0755 /etc/apt/keyrings
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor >/etc/apt/keyrings/docker.gpg 2>/dev/null || true
    chmod a+r /etc/apt/keyrings/docker.gpg 2>/dev/null || true
    UB_CODENAME=\$(. /etc/os-release && echo \$VERSION_CODENAME)
    echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \$UB_CODENAME stable\" >/etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || apt-get install -y docker.io docker-compose-plugin
  fi
  systemctl enable --now docker
  docker compose version >/dev/null 2>&1
"

# 3/13 Docker 守护进程优化 + 镜像加速
spin_run "优化 Docker 守护进程" "
  probe(){ code=\$(curl -m 3 -fsIX GET \"\$1/v2/\" -o /dev/null -w '%{http_code}' 2>/dev/null || echo); case \"\$code\" in 200|401|403) return 0;; *) return 1;; esac; }
  MIRR=()
  [ -n \"$DOCKER_MIRROR_URL\" ] && { IFS=', ' read -r -a UMS <<< \"$DOCKER_MIRROR_URL\"; for u in \"\${UMS[@]}\"; do [ -n \"\$u\" ] && MIRR+=(\"\$u\"); done; }
  for u in $DEFAULT_MIRRORS; do MIRR+=(\"\$u\"); done
  uniq=(); seen=' '; for m in \"\${MIRR[@]}\"; do echo \"\$seen\" | grep -q \" \$m \" && continue; seen=\"\$seen \$m\"; probe \"\$m\" && uniq+=(\"\$m\"); done
  merge_daemon_json '.[\"log-driver\"]' '\"local\"'
  merge_daemon_json '.[\"log-opts\"]' '{\"max-size\":\"64m\",\"max-file\":\"5\"}'
  merge_daemon_json '.[\"exec-opts\"]' '[\"native.cgroupdriver=systemd\"]'
  merge_daemon_json '.[\"live-restore\"]' 'true'
  if [ \${#uniq[@]} -gt 0 ]; then
    printf '%s\n' \"\${uniq[@]}\" | jq -R . | jq -s . > /tmp/mirrors.json
    merge_daemon_json '.[\"registry-mirrors\"]' \"\$(cat /tmp/mirrors.json)\"
  fi
  systemctl restart docker
"

# 4/13 ulimits
run_silent "设置 ulimits" "
  cat >/etc/security/limits.d/99-erp-oms.conf <<'EOF'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
EOF
  merge_daemon_json '.["default-ulimits"]' '{\"nofile\":{\"Name\":\"nofile\",\"Hard\":1048576,\"Soft\":1048576}}'
  systemctl restart docker
"

# 5/13 ZRAM / Swap
run_silent "配置 ZRAM/Swap" "
  MEM_GB=\$(awk '/MemTotal/{printf \"%.0f\", \$2/1024/1024}' /proc/meminfo)
  if [ \"$AUTO_ZRAM_SWAP\" = \"yes\" ]; then
    if [ \"\$MEM_GB\" -le 8 ]; then
      install -d -m 0755 /etc/default
      cat >/etc/default/zramswap <<'EOF'
ENABLED=true
PERCENT=50
PRIORITY=100
EOF
      systemctl restart zramswap || systemctl restart zram-config || true
      swapoff -a || true
    else
      if ! grep -q ' /swapfile ' /etc/fstab 2>/dev/null; then
        fallocate -l \"${SWAP_SIZE_GB}G\" /swapfile || dd if=/dev/zero of=/swapfile bs=1G count=\"${SWAP_SIZE_GB}\"
        chmod 600 /swapfile && mkswap /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        swapon -a
      fi
    fi
    sysctl -w vm.swappiness=10 >/dev/null
    sysctl -w vm.vfs_cache_pressure=50 >/dev/null
  fi
"

# 6/13 关闭 THP
run_silent "关闭 THP" "
  cat >/etc/systemd/system/disable-thp.service <<'EOF'
[Unit]
Description=Disable Transparent Huge Pages
After=sysinit.target
[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled || true'
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/defrag || true'
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now disable-thp.service
"

# 7/13 BBR + sysctl
run_silent "应用 BBR + sysctl" "
  [ \"$AUTO_TUNE_NET\" = \"yes\" ] || exit 0
  cat >/etc/sysctl.d/90-erp-oms.conf <<'EOF'
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.core.somaxconn=65535
net.core.netdev_max_backlog=250000
net.ipv4.ip_local_port_range=1024 65000
net.ipv4.tcp_fin_timeout=15
net.ipv4.tcp_max_syn_backlog=262144
net.ipv4.tcp_tw_reuse=1
net.ipv4.tcp_rmem=4096 87380 67108864
net.ipv4.tcp_wmem=4096 65536 67108864
EOF
  sysctl --system >/dev/null 2>&1 || true
"

# 8/13 安全基线
run_silent "启用安全组件" "
  [ \"$AUTO_FAIL2BAN\" = \"yes\" ] && systemctl enable --now fail2ban || true
  [ \"$AUTO_UNATTENDED_UPDATES\" = \"yes\" ] && systemctl enable --now unattended-upgrades || true
  if command -v ufw >/dev/null 2>&1 && [ \"$AUTO_OPEN_UFW\" = \"yes\" ]; then
    if ufw status | grep -q 'Status: active'; then
      ufw allow 22/tcp >/dev/null 2>&1 || true
      ufw allow \"${APP_PORT}/tcp\" >/dev/null 2>&1 || true
      ufw allow \"${EDITOR_PORT}/tcp\" >/dev/null 2>&1 || true
    fi
  fi
"

# 9/13 回写 .deploy.env（你刚才卡在这里——现在失败会给一键日志指令）
run_silent "写入部署环境参数" "
  ensure_env_var APP_PORT \"${APP_PORT}\"
  ensure_env_var EDITOR_PORT \"${EDITOR_PORT}\"
  ensure_env_var EDITOR_USER \"${EDITOR_USER}\"
  ensure_env_var EDITOR_PASS \"${EDITOR_PASS}\"
  ensure_env_var COMPOSE_PROFILES \"${COMPOSE_PROFILES}\"
  ensure_env_var AUTO_OPEN_UFW \"${AUTO_OPEN_UFW}\"
"

# 10/13 同步仓库（自动 Adopt）
spin_run "同步仓库" "
  REPO_DIR='${BASE_DIR}'; USE_ADOPT='no'
  if [ -d '${BASE_DIR}' ] && [ ! -d '${BASE_DIR}/.git' ]; then
    USE_ADOPT='yes'; REPO_DIR='${BASE_DIR}/.repo'
    install -d -m 0755 \"\$REPO_DIR\"
    if [ ! -d \"\$REPO_DIR/.git\" ]; then git clone '${REPO_URL}' \"\$REPO_DIR\"; else git -C \"\$REPO_DIR\" fetch --all && git -C \"\$REPO_DIR\" reset --hard origin/main; fi
  elif [ -d '${BASE_DIR}/.git' ]; then
    git -C '${BASE_DIR}' fetch --all && git -C '${BASE_DIR}' reset --hard origin/main
  else
    install -d -m 0755 '${BASE_DIR}'
    git clone '${REPO_URL}' '${BASE_DIR}'
  fi
  if [ \"\$USE_ADOPT\" = 'yes' ]; then
    echo '${BASE_DIR}/.repo/deploy/docker-compose.yml' > '${BASE_DIR}/.compose.path'
  else
    echo '${BASE_DIR}/deploy/docker-compose.yml' > '${BASE_DIR}/.compose.path'
  fi
"

COMPOSE_FILE="$(cat "${BASE_DIR}/.compose.path" 2>/dev/null || echo "${COMPOSE_FILE}")"
export COMPOSE_FILE
ensure_env_var COMPOSE_FILE "${COMPOSE_FILE}"

# 11/13 备份 & 二次覆盖
run_silent "备份数据/清理旧容器" "
  if [ \"${DO_BACKUP_DATA}\" = 'yes' ] && [ -d '${BASE_DIR}/data' ]; then
    BDIR='${BASE_DIR}/backup/$(date +%Y%m%d_%H%M%S)'
    install -d -m 0755 \"\$BDIR\"
    tar -czf \"\$BDIR/data.tgz\" -C '${BASE_DIR}' data
  fi
  if [ \"${AUTO_PRUNE_OLD}\" = 'yes' ] && [ -f '${COMPOSE_FILE}' ]; then
    docker compose -f '${COMPOSE_FILE}' down -v || true
    docker image prune -f || true
    docker volume prune -f || true
  fi
"

# 12/13 构建
spin_run "构建镜像（web+backend+postgres+editor）" "
  COMPOSE_PROFILES='${COMPOSE_PROFILES}' docker compose -f '${COMPOSE_FILE}' build
"

# 13/13 启动
spin_run "启动服务" "
  COMPOSE_PROFILES='${COMPOSE_PROFILES}' docker compose -f '${COMPOSE_FILE}' up -d
"

# —— 迁移（限时重试，不阻塞）——
STEP=$STEPS; p=$(pct $STEPS $STEPS); bar_draw "$p" "执行数据库迁移（限时重试）…"
migrate_try(){ timeout 90s docker compose -f "${COMPOSE_FILE}" exec -T backend sh -lc 'python -m alembic upgrade head' >>"$LOG_FILE" 2>&1; }
if migrate_try; then
  printf "\r "; bar_draw 100 "迁移完成"; ok_mark
else
  sleep 5
  if migrate_try; then
    printf "\r "; bar_draw 100 "迁移完成（重试）"; ok_mark
  else
    printf "\r "; bar_draw 100 "迁移失败"; warn_mark
    fail_with_help "数据库迁移（alembic upgrade head）"
  fi
fi

# —— 收尾：端口探测（不阻塞）——
curl -fsSI --max-time 3 "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1 || true
curl -fsSI --max-time 3 "http://127.0.0.1:${EDITOR_PORT}/login" >/dev/null 2>&1 || true

# —— 展示公网 IP —— 
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
