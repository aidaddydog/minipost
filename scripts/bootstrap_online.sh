#!/usr/bin/env bash
# =========================================================
# minipost 一键部署（Docker 统一版 · 强化版）
# 说明：
#  - 全流程中文交互 + 进度提示 + 异常兜底 + 安全回滚
#  - 对齐《docs/1keyintall.txt》执行清单的关键动作与要点
#  - 适配 Ubuntu 24.04 LTS，root 运行；默认 profiles: web,backend,postgres,editor
# =========================================================

set -Eeuo pipefail

# ---------- 彩色输出 ----------
green(){ echo -e "\033[32m$*\033[0m"; }
yellow(){ echo -e "\033[33m$*\033[0m"; }
red(){ echo -e "\033[31m$*\033[0m"; }
info(){ echo "[`date +%H:%M:%S`] $*"; }

# ---------- 工具函数 ----------
confirm(){ # confirm "提示" 默认值[y/N]
  local tip="$1"; local def="${2:-N}"; local ans
  read -r -p "$tip [$def] " ans || true
  ans="${ans:-$def}"
  case "$ans" in
    y|Y|yes|YES) return 0;;
    *) return 1;;
  esac
}
retry(){ # retry 3 "cmd ..."
  local times="$1"; shift
  local n=0; local rc=0
  while :; do
    set +e; eval "$@"; rc=$?; set -e
    [ $rc -eq 0 ] && return 0
    n=$((n+1)); [ $n -ge $times ] && return $rc
    sleep $(( n*2 ))
    yellow "重试第 $n 次：$*"
  done
}
ensure_env_var(){ # 确保 .deploy.env 有键值（不存在则追加）
  local k="$1" v="$2" f="${BASE_DIR}/.deploy.env"
  if [ ! -f "$f" ]; then
    echo "# minipost 部署环境（自动生成）" > "$f"
    chmod 600 "$f"
  fi
  if ! grep -q "^${k}=" "$f" 2>/dev/null; then
    echo "${k}=${v}" >> "$f"
  fi
}
merge_daemon_json(){ # 将 key:value 合并进 /etc/docker/daemon.json（需要 jq）
  local key="$1" value="$2" f="/etc/docker/daemon.json"
  install -d -m 0755 /etc/docker
  [ -f "$f" ] || echo '{}' > "$f"
  tmp="$(mktemp)"
  jq "$key = $value" "$f" > "$tmp" && cat "$tmp" > "$f" && rm -f "$tmp"
}

# ---------- 加载/默认变量（.deploy.env 可覆盖） ----------
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
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"
: "${COMPOSE_PROFILES:=web,backend,postgres,editor}"
: "${AUTO_OPEN_UFW:=yes}"
: "${AUTO_PRUNE_OLD:=no}"
: "${AUTO_FAIL2BAN:=no}"              # 安全基线可选（见 1key 清单第10点）
: "${AUTO_UNATTENDED_UPDATES:=no}"    # 安全基线可选
: "${AUTO_TUNE_NET:=yes}"             # BBR+sysctl（第7点）
: "${AUTO_ULIMITS:=yes}"              # ulimits（第8点）
: "${AUTO_ZRAM_SWAP:=yes}"            # ZRAM/Swap（第5点）
: "${SWAP_SIZE_GB:=8}"                # >8GB 内存时创建的 Swap 文件大小
: "${DOCKER_MIRROR_URL:=}"            # 可选镜像加速器（第9点）
: "${GIT_AUTH_HEADER:=}"              # 可选：私仓时用
export BASE_DIR SERVICE_NAME APP_PORT EDITOR_PORT COMPOSE_FILE COMPOSE_PROFILES
set -u

# ---------- 日志与审计（第1点） ----------
LOG_DIR="${BASE_DIR}/logs"
install -d -m 0755 "$LOG_DIR"
LOG_FILE="${LOG_DIR}/bootstrap_$(date +%Y%m%d_%H%M%S).log"
ln -sfn "$LOG_FILE" "${LOG_DIR}/bootstrap.latest.log"
# 整体输出 tee 双写到日志；敏感变量不直接回显
exec > >(tee -a "$LOG_FILE") 2>&1
info "安装日志：$LOG_FILE"

# ---------- 审前检查（第0点） ----------
[ "$(id -u)" -eq 0 ] || { red "✘ 需要 root 运行"; exit 1; }
info "OS: $(lsb_release -ds 2>/dev/null || cat /etc/os-release | head -n1)  Kernel: $(uname -r)"
info "CPU: $(nproc) 核  Mem: $(awk '/MemTotal/{printf \"%.1fGB\",$2/1024/1024}' /proc/meminfo)  Disk( / ): $(df -h / | awk 'NR==2{print $4\" free\"}')"

info "检测时间同步与网络可达性..."
systemctl enable --now systemd-timesyncd >/dev/null 2>&1 || true
timedatectl status | sed -n '1,6p' || true
retry 3 "curl -fsSI --max-time 5 https://github.com" >/dev/null || yellow "⚠ GitHub 探测失败（可能受网络影响）"
retry 3 "curl -fsSI --max-time 5 https://registry-1.docker.io/v2/" >/dev/null || yellow "⚠ Docker Hub 探测失败（建议配置镜像加速器）"
# —— 以上对应 0/1/2/3 的前置保障：root/OS/网络/时间（清单第0-3点） —— 参考：docs/1keyintall.txt

# ---------- 交互：策略选择（与 .deploy.env 同步） ----------
echo
confirm "是否执行『二次覆盖清理』（停旧容器/清镜像/清卷）？" N && AUTO_PRUNE_OLD=yes || AUTO_PRUNE_OLD=no
confirm "是否在启动前『备份 data/ 目录』（若存在）？" Y && DO_BACKUP_DATA=yes || DO_BACKUP_DATA=no
confirm "是否启用『ZRAM/Swap 自动策略』（≤8G 用 ZRAM，>8G 用 Swap）？" Y && AUTO_ZRAM_SWAP=yes || AUTO_ZRAM_SWAP=no
confirm "是否应用『网络加速与 sysctl 调优』（BBR 等）？" Y && AUTO_TUNE_NET=yes || AUTO_TUNE_NET=no
confirm "是否设置『ulimits(100万)』及 Docker default-ulimits？" Y && AUTO_ULIMITS=yes || AUTO_ULIMITS=no
confirm "是否启用『fail2ban』防暴力破解？" N && AUTO_FAIL2BAN=yes || AUTO_FAIL2BAN=no
confirm "是否启用『自动安全更新（unattended-upgrades）』？" N && AUTO_UNATTENDED_UPDATES=yes || AUTO_UNATTENDED_UPDATES=no
read -r -p "可选：Docker 镜像加速器 URL（留空跳过）: " DOCKER_MIRROR_URL || true

# ---------- 补写到 .deploy.env（第3点：参数可读、默认值与回写） ----------
install -d -m 0755 "$BASE_DIR"
ensure_env_var APP_PORT "${APP_PORT}"
ensure_env_var EDITOR_PORT "${EDITOR_PORT}"
ensure_env_var EDITOR_USER "${EDITOR_USER}"
ensure_env_var EDITOR_PASS "${EDITOR_PASS}"
ensure_env_var COMPOSE_PROFILES "${COMPOSE_PROFILES}"
ensure_env_var AUTO_OPEN_UFW "${AUTO_OPEN_UFW}"
ensure_env_var AUTO_PRUNE_OLD "${AUTO_PRUNE_OLD}"

# ---------- 安装基础依赖与 Docker/Compose（第2点） ----------
export DEBIAN_FRONTEND=noninteractive
info "安装基础依赖：curl git jq ufw fail2ban zram-tools 等"
retry 3 "apt-get update -y"
retry 3 "apt-get install -y ca-certificates curl gnupg lsb-release jq ufw zram-tools"
# fail2ban / 自动更新按需安装
[ "$AUTO_FAIL2BAN" = "yes" ] && retry 3 "apt-get install -y fail2ban"
[ "$AUTO_UNATTENDED_UPDATES" = "yes" ] && retry 3 "apt-get install -y unattended-upgrades"

if ! command -v docker >/dev/null 2>&1; then
  yellow "未检测到 docker，开始安装（官方源失败则回退 Ubuntu 源）"
  install -d -m 0755 /etc/apt/keyrings
  set +e
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor >/etc/apt/keyrings/docker.gpg
  RC=$?; set -e
  if [ $RC -eq 0 ]; then
    chmod a+r /etc/apt/keyrings/docker.gpg
    UB_CODENAME="$(. /etc/os-release && echo $VERSION_CODENAME)"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${UB_CODENAME} stable" >/etc/apt/sources.list.d/docker.list
    retry 3 "apt-get update -y"
    set +e; apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; RC=$?; set -e
    if [ $RC -ne 0 ]; then
      yellow "官方源失败，回退 Ubuntu 源"
      retry 3 "apt-get update -y"
      retry 3 "apt-get install -y docker.io docker-compose-plugin"
    fi
  else
    yellow "获取 Docker GPG 失败，用 Ubuntu 源安装"
    retry 3 "apt-get update -y"
    retry 3 "apt-get install -y docker.io docker-compose-plugin"
  fi
fi
systemctl enable --now docker
docker compose version >/dev/null 2>&1 || { red "✘ docker compose 插件不可用"; echo "tail -n 200 /var/log/apt/term.log"; exit 1; }
green "✔ Docker/Compose 就绪"

# ---------- Docker 守护进程优化（第9点） ----------
if command -v jq >/dev/null 2>&1; then
  # log-driver=local + 滚动日志；systemd cgroup；live-restore；可选 registry mirrors
  merge_daemon_json '.["log-driver"]' '"local"'
  merge_daemon_json '.["log-opts"]' '{"max-size":"64m","max-file":"5"}'
  merge_daemon_json '.["exec-opts"]' '["native.cgroupdriver=systemd"]'
  merge_daemon_json '.["live-restore"]' 'true'
  if [ -n "${DOCKER_MIRROR_URL}" ]; then
    merge_daemon_json '.["registry-mirrors"]' "[\"${DOCKER_MIRROR_URL}\"]"
  fi
  systemctl restart docker
  green "✔ Docker daemon.json 已优化并重启（日志滚动/系统d cgroup/live-restore/镜像加速器）"
else
  yellow "⚠ 未安装 jq，跳过 daemon.json 合并（已建议安装）"
fi

# ---------- ulimits（第8点） ----------
if [ "${AUTO_ULIMITS}" = "yes" ]; then
  cat >/etc/security/limits.d/99-erp-oms.conf <<'EOF'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
EOF
  # Docker default-ulimits
  if command -v jq >/dev/null 2>&1; then
    merge_daemon_json '.["default-ulimits"]' '{"nofile":{"Name":"nofile","Hard":1048576,"Soft":1048576}}'
    systemctl restart docker
  fi
  green "✔ 已设置 ulimits（nofile 100万）"
fi

# ---------- ZRAM/Swap 策略（第5点） ----------
if [ "${AUTO_ZRAM_SWAP}" = "yes" ]; then
  MEM_GB=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
  if [ "$MEM_GB" -le 8 ]; then
    # ZRAM：/etc/default/zramswap
    install -d -m 0755 /etc/default
    cat >/etc/default/zramswap <<'EOF'
# 启用 zram，按内存百分比分配；避免与已有 swapfile 冲突
ENABLED=true
PERCENT=50
PRIORITY=100
EOF
    systemctl restart zramswap || systemctl restart zram-config || true
    swapoff -a || true
    green "✔ ZRAM 已启用（≤8GB 内存优先 ZRAM）"
  else
    # Swapfile（8~16GB 可自调）
    if ! grep -q " /swapfile " /etc/fstab 2>/dev/null; then
      fallocate -l "${SWAP_SIZE_GB}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1G count="${SWAP_SIZE_GB}"
      chmod 600 /swapfile
      mkswap /swapfile
      echo "/swapfile none swap sw 0 0" >> /etc/fstab
      swapon -a
    fi
    green "✔ Swapfile 已配置（>${MEM_GB}GB 内存）"
  fi
  # swappiness 等
  sysctl -w vm.swappiness=10 >/dev/null
  sysctl -w vm.vfs_cache_pressure=50 >/dev/null
fi

# ---------- 关闭 THP（第6点） ----------
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
green "✔ 已关闭 THP（持久生效）"

# ---------- BBR + sysctl 调优（第7点） ----------
if [ "${AUTO_TUNE_NET}" = "yes" ]; then
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
  sysctl --system >/dev/null
  info "当前拥塞算法：$(sysctl net.ipv4.tcp_congestion_control)"
  green "✔ 已应用 BBR + sysctl 调优"
fi

# ---------- 安全基线（第10点） ----------
if command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -q "Status: active"; then
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    ufw allow "${EDITOR_PORT}/tcp" >/dev/null 2>&1 || true
    info "✔ UFW 已放行：22, ${APP_PORT}, ${EDITOR_PORT}"
  fi
fi
[ "$AUTO_FAIL2BAN" = "yes" ] && systemctl enable --now fail2ban || true
[ "$AUTO_UNATTENDED_UPDATES" = "yes" ] && systemctl enable --now unattended-upgrades || true

# ---------- 仓库拉取/更新（第3点：结构/关键文件） ----------
info "同步仓库到 ${BASE_DIR}"
if [ ! -d "$BASE_DIR/.git" ]; then
  install -d -m 0755 "$BASE_DIR"
  git clone "$REPO_URL" "$BASE_DIR"
else
  git -C "$BASE_DIR" fetch --all
  git -C "$BASE_DIR" reset --hard origin/main
fi

# ---------- 二次覆盖/备份（第4点） ----------
BACKUP_ROOT="${BASE_DIR}/backup/$(date +%Y%m%d_%H%M%S)"
if [ "${DO_BACKUP_DATA}" = "yes" ] && [ -d "${BASE_DIR}/data" ]; then
  install -d -m 0755 "$BACKUP_ROOT"
  tar -czf "${BACKUP_ROOT}/data.tgz" -C "${BASE_DIR}" data
  info "✔ 数据已备份到：${BACKUP_ROOT}/data.tgz"
fi
if [ "${AUTO_PRUNE_OLD}" = "yes" ] && [ -f "$COMPOSE_FILE" ]; then
  docker compose -f "$COMPOSE_FILE" down -v || true
  docker image prune -f || true
  docker volume prune -f || true
  yellow "已执行二次覆盖清理"
fi

# ---------- 构建与启动 Compose（第12点） ----------
if [ ! -f "$COMPOSE_FILE" ]; then
  red "✘ 未找到编排文件：$COMPOSE_FILE"
  echo "tail -n 200 $LOG_FILE   # 查看安装日志"
  exit 1
fi
info "开始构建：${COMPOSE_PROFILES//,/ + } （失败可重试）"
set +e
COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" build --progress=auto
BUILD_RC=$?
set -e
[ $BUILD_RC -ne 0 ] && { red "✘ 构建失败（$BUILD_RC）"; echo "docker compose -f $COMPOSE_FILE logs --tail=200"; exit $BUILD_RC; }

info "启动服务（后台运行）..."
COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" up -d

# ---------- 健康检查（第12点） ----------
wait_healthy(){
  local svc="$1" timeout="${2:-240}"
  local cid status start=$(date +%s)
  cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$svc")"
  [ -z "$cid" ] && { yellow "⚠ 未找到服务 $svc 的容器"; return 0; }
  while :; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$cid" 2>/dev/null || echo unknown)"
    case "$status" in
      healthy|running) green "✔ $svc 健康：$status"; return 0;;
    esac
    [ $(( $(date +%s) - start )) -ge $timeout ] && { red "✘ $svc 健康检查超时"; return 1; }
    sleep 3
  done
}
wait_healthy db 300 || true
wait_healthy backend 300 || true

# ---------- 数据库迁移（第13点） ----------
info "执行数据库迁移（Alembic）..."
set +e
docker compose -f "$COMPOSE_FILE" exec -T backend sh -lc 'python -m alembic upgrade head'
MIG_RC=$?
set -e
if [ $MIG_RC -ne 0 ]; then
  red "✘ 迁移失败，将尝试回滚（如有备份则提示恢复路径）"
  echo "备份目录：$BACKUP_ROOT"
  echo "回滚建议：docker compose -f $COMPOSE_FILE down && tar -xzf $BACKUP_ROOT/data.tgz -C $BASE_DIR （若有 data 备份）"
  exit $MIG_RC
fi
green "✔ 迁移完成"

# ---------- 管理员初始化（第14点，若无脚本则跳过） ----------
if confirm "是否尝试初始化管理员账号（若后端支持内置指令）？" N; then
  set +e
  docker compose -f "$COMPOSE_FILE" exec -T backend sh -lc 'python - <<PY
try:
    from app.scripts.init_admin import main as init_admin
    init_admin()
    print("管理员初始化已执行")
except Exception as e:
    print("未检测到内置 init_admin 脚本或执行失败：", e)
PY'
  set -e
fi

# ---------- 端口与反代验证（第15点） ----------
info "验证端口：APP ${APP_PORT} / EDITOR ${EDITOR_PORT}"
retry 3 "curl -fsSI --max-time 3 http://127.0.0.1:${APP_PORT}/ || true"
retry 3 "curl -fsSI --max-time 3 http://127.0.0.1:${EDITOR_PORT}/login || true"
info "如需 HTTPS，可在 1Panel 中用 Caddy/Nginx 反代并申请证书（80/443/域名解析需就绪）"

# ---------- 部署报告与常用日志命令（第16点） ----------
green "✔ 部署完成"
echo
echo "== 访问地址 =="
echo "管理端：     http://<服务器IP>:${APP_PORT}"
echo "模板编辑器： http://<服务器IP>:${EDITOR_PORT}   （账号：${EDITOR_USER}）"
echo
echo "== 常用一键日志命令 =="
echo "docker compose -f $COMPOSE_FILE ps"
echo "docker compose -f $COMPOSE_FILE logs backend --tail=200"
echo "docker compose -f $COMPOSE_FILE logs editor  --tail=200"
echo "journalctl -u docker.service -e -n 200"
echo "tail -n 200 $LOG_FILE"
