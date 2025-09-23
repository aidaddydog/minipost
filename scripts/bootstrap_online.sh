#!/usr/bin/env bash
# =========================================================
# minipost 一键部署（Docker 统一版 · 强化版 · 镜像加速 & Git接管 Adopt）
# - 自动安装/优化 Docker；默认镜像加速器探测写入
# - ZRAM/Swap、THP、BBR、ulimits、UFW、fail2ban/自动更新（可选）
# - Git 目录容错：存在非Git目录 → 采用“Adopt 模式”（在 .repo 里克隆仓库并切换到该编排），不破坏现有目录
# - 仍支持“备份并重建”标准模式
# 适配：Ubuntu 24.04 LTS（root）
# =========================================================

set -Eeuo pipefail
green(){ echo -e "\033[32m$*\033[0m"; }
yellow(){ echo -e "\033[33m$*\033[0m"; }
red(){ echo -e "\033[31m$*\033[0m"; }
info(){ echo "[`date +%H:%M:%S`] $*"; }

confirm(){ local tip="$1"; local def="${2:-N}"; local ans; read -r -p "$tip [$def] " ans || true; ans="${ans:-$def}"; case "$ans" in y|Y|yes|YES) return 0;; *) return 1;; esac; }
retry(){ local times="$1"; shift; local n=0 rc=0; while :; do set +e; eval "$@"; rc=$?; set -e; [ $rc -eq 0 ] && return 0; n=$((n+1)); [ $n -ge $times ] && return $rc; sleep $(( n*2 )); yellow "重试第 $n 次：$*"; done; }
ensure_env_var(){ local k="$1" v="$2" f="${BASE_DIR}/.deploy.env"; [ -f "$f" ] || { echo "# minipost 部署环境（自动生成）" > "$f"; chmod 600 "$f"; }; grep -q "^${k}=" "$f" 2>/dev/null || echo "${k}=${v}" >> "$f"; }
merge_daemon_json(){ local key="$1" value="$2" f="/etc/docker/daemon.json"; install -d -m 0755 /etc/docker; [ -f "$f" ] || echo '{}' > "$f"; tmp="$(mktemp)"; jq "$key = $value" "$f" > "$tmp" && cat "$tmp" > "$f" && rm -f "$tmp"; }

# ---------- 加载/默认变量 ----------
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
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"   # 可能被 Adopt 模式改写为 ${BASE_DIR}/.repo/deploy/docker-compose.yml
: "${COMPOSE_PROFILES:=web,backend,postgres,editor}"
: "${AUTO_OPEN_UFW:=yes}"
: "${AUTO_PRUNE_OLD:=no}"
: "${AUTO_FAIL2BAN:=no}"
: "${AUTO_UNATTENDED_UPDATES:=no}"
: "${AUTO_TUNE_NET:=yes}"
: "${AUTO_ULIMITS:=yes}"
: "${AUTO_ZRAM_SWAP:=yes}"
: "${SWAP_SIZE_GB:=8}"
: "${DO_BACKUP_DATA:=yes}"
: "${DOCKER_MIRROR_URL:=}"   # 交互可追加自定义镜像
: "${DEFAULT_MIRRORS:="https://docker.m.daocloud.io https://hub-mirror.c.163.com https://mirror.ccs.tencentyun.com"}"
: "${GIT_AUTH_HEADER:=}"
export BASE_DIR SERVICE_NAME APP_PORT EDITOR_PORT COMPOSE_PROFILES
set -u

# ---------- 日志 ----------
LOG_DIR="${BASE_DIR}/logs"; install -d -m 0755 "$LOG_DIR"
LOG_FILE="${LOG_DIR}/bootstrap_$(date +%Y%m%d_%H%M%S).log"
ln -sfn "$LOG_FILE" "${LOG_DIR}/bootstrap.latest.log"
exec > >(tee -a "$LOG_FILE") 2>&1
[ "$(id -u)" -eq 0 ] || { red "✘ 需要 root 运行"; exit 1; }
info "安装日志：$LOG_FILE"

# ---------- 交互选项 ----------
confirm "是否『二次覆盖清理』（停旧容器/清镜像/清卷）？" N && AUTO_PRUNE_OLD=yes || AUTO_PRUNE_OLD=no
confirm "是否在启动前『备份 data/ 目录』（如存在）？" Y && DO_BACKUP_DATA=yes || DO_BACKUP_DATA=no
confirm "是否启用『ZRAM/Swap 自动策略』？" Y && AUTO_ZRAM_SWAP=yes || AUTO_ZRAM_SWAP=no
confirm "是否应用『BBR + sysctl 调优』？" Y && AUTO_TUNE_NET=yes || AUTO_TUNE_NET=no
confirm "是否设置『ulimits(100万)』及 Docker default-ulimits？" Y && AUTO_ULIMITS=yes || AUTO_ULIMITS=no
confirm "是否启用『fail2ban』？" N && AUTO_FAIL2BAN=yes || AUTO_FAIL2BAN=no
confirm "是否启用『自动安全更新（unattended-upgrades）』？" N && AUTO_UNATTENDED_UPDATES=yes || AUTO_UNATTENDED_UPDATES=no
read -r -p "可选：额外镜像加速器（逗号或空格分隔，留空跳过）: " DOCKER_MIRROR_URL || true

# ---------- 回写 .deploy.env ----------
install -d -m 0755 "$BASE_DIR"
ensure_env_var APP_PORT "${APP_PORT}"
ensure_env_var EDITOR_PORT "${EDITOR_PORT}"
ensure_env_var EDITOR_USER "${EDITOR_USER}"
ensure_env_var EDITOR_PASS "${EDITOR_PASS}"
ensure_env_var COMPOSE_PROFILES "${COMPOSE_PROFILES}"
ensure_env_var AUTO_OPEN_UFW "${AUTO_OPEN_UFW}"
ensure_env_var AUTO_PRUNE_OLD "${AUTO_PRUNE_OLD}"

# ---------- 基础依赖 / Docker ----------
export DEBIAN_FRONTEND=noninteractive
retry 3 "apt-get update -y"
retry 3 "apt-get install -y ca-certificates curl gnupg lsb-release jq ufw zram-tools"
[ "$AUTO_FAIL2BAN" = "yes" ] && retry 3 "apt-get install -y fail2ban"
[ "$AUTO_UNATTENDED_UPDATES" = "yes" ] && retry 3 "apt-get install -y unattended-upgrades"

if ! command -v docker >/dev/null 2>&1; then
  yellow "⏳ 安装 Docker（官方源失败则回退 Ubuntu 源）"
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
      yellow "⚠ 官方源失败，回退 Ubuntu 源 docker.io"
      retry 3 "apt-get update -y"
      retry 3 "apt-get install -y docker.io docker-compose-plugin"
    fi
  else
    yellow "⚠ GPG 失败，使用 Ubuntu 源安装"
    retry 3 "apt-get update -y"
    retry 3 "apt-get install -y docker.io docker-compose-plugin"
  fi
fi
systemctl enable --now docker
docker compose version >/dev/null 2>&1 || { red "✘ docker compose 插件不可用"; echo "tail -n 200 /var/log/apt/term.log"; exit 1; }
green "✔ Docker/Compose 就绪"

# ---------- Docker 守护进程优化 + 镜像加速 ----------
probe_mirror(){ local url="$1" code; code="$(curl -m 3 -fsSIX GET "$url/v2/" -o /dev/null -w '%{http_code}' || true)"; [ -n "$code" ] && [ "$code" -lt 500 ]; }
build_mirrors_json(){
  local all=() u; if [ -n "$DOCKER_MIRROR_URL" ]; then IFS=', ' read -r -a user_mirrors <<< "$DOCKER_MIRROR_URL"; for u in "${user_mirrors[@]}"; do [ -n "$u" ] && all+=("$u"); done; fi
  for u in $DEFAULT_MIRRORS; do all+=("$u"); done
  local uniq=() seen="" m; for m in "${all[@]}"; do [[ " $seen " == *" $m "* ]] && continue; seen="$seen $m"; probe_mirror "$m" && uniq+=("$m"); done
  printf '%s\n' "${uniq[@]}" | jq -R . | jq -s .
}
if command -v jq >/dev/null 2>&1; then
  merge_daemon_json '.["log-driver"]' '"local"'
  merge_daemon_json '.["log-opts"]' '{"max-size":"64m","max-file":"5"}'
  merge_daemon_json '.["exec-opts"]' '["native.cgroupdriver=systemd"]'
  merge_daemon_json '.["live-restore"]' 'true'
  MIRRORS_JSON="$(build_mirrors_json)"
  if [ "$(echo "$MIRRORS_JSON" | jq 'length')" -gt 0 ]; then
    merge_daemon_json '.["registry-mirrors"]' "$MIRRORS_JSON"
    info "✔ 已写入镜像加速器：$(echo "$MIRRORS_JSON" | jq -r '.[]' | xargs)"
  else
    yellow "⚠ 未发现可用镜像加速器（可随后手工配置）"
  fi
  systemctl restart docker
  green "✔ Docker daemon.json 已优化并重启（日志滚动/systemd cgroup/live-restore/镜像加速）"
else
  yellow "⚠ 未安装 jq，跳过 daemon.json 合并"
fi

# ---------- ulimits ----------
if [ "${AUTO_ULIMITS}" = "yes" ]; then
  cat >/etc/security/limits.d/99-erp-oms.conf <<'EOF'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
EOF
  if command -v jq >/dev/null 2>&1; then
    merge_daemon_json '.["default-ulimits"]' '{"nofile":{"Name":"nofile","Hard":1048576,"Soft":1048576}}'
    systemctl restart docker
  fi
  green "✔ 已设置 ulimits（nofile 100万）"
fi

# ---------- ZRAM/Swap ----------
if [ "${AUTO_ZRAM_SWAP}" = "yes" ]; then
  MEM_GB=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
  if [ "$MEM_GB" -le 8 ]; then
    install -d -m 0755 /etc/default
    cat >/etc/default/zramswap <<'EOF'
ENABLED=true
PERCENT=50
PRIORITY=100
EOF
    systemctl restart zramswap || systemctl restart zram-config || true
    swapoff -a || true
    green "✔ ZRAM 已启用（≤8GB 内存）"
  else
    if ! grep -q " /swapfile " /etc/fstab 2>/dev/null; then
      fallocate -l "${SWAP_SIZE_GB}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1G count="${SWAP_SIZE_GB}"
      chmod 600 /swapfile && mkswap /swapfile
      echo "/swapfile none swap sw 0 0" >> /etc/fstab
      swapon -a
    fi
    green "✔ Swapfile 已配置（>${MEM_GB}GB 内存）"
  fi
  sysctl -w vm.swappiness=10 >/dev/null
  sysctl -w vm.vfs_cache_pressure=50 >/dev/null
fi

# ---------- 关闭 THP ----------
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

# ---------- BBR + sysctl ----------
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

# ---------- 安全基线 ----------
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

# ---------- 仓库同步（支持 Adopt 模式） ----------
info "同步仓库（支持 Adopt 非破坏接管）"
REPO_DIR="$BASE_DIR"         # 默认直接用 BASE_DIR
USE_ADOPT="no"

if [ -d "$BASE_DIR" ] && [ ! -d "$BASE_DIR/.git" ]; then
  yellow "检测到目录已存在但不是 Git 仓库：$BASE_DIR"
  echo "请选择处理方式："
  echo "  A) 备份该目录并用 ${REPO_URL} 重建（推荐标准模式）"
  echo "  B) 采用“Adopt 非破坏接管”：在 ${BASE_DIR}/.repo 克隆仓库并使用该编排（不动现有目录）"
  echo "  C) 取消"
  read -r -p "你的选择 [B]: " CHOICE; CHOICE="${CHOICE:-B}"
  case "$CHOICE" in
    A|a)
      BAK="${BASE_DIR}.pre_$(date +%Y%m%d_%H%M%S)"
      mv "$BASE_DIR" "$BAK"
      green "✔ 已备份到：$BAK"
      install -d -m 0755 "$BASE_DIR"
      retry 3 "git clone '$REPO_URL' '$BASE_DIR'"
      REPO_DIR="$BASE_DIR"
      ;;
    B|b)
      USE_ADOPT="yes"
      REPO_DIR="${BASE_DIR}/.repo"
      install -d -m 0755 "$REPO_DIR"
      if [ ! -d "$REPO_DIR/.git" ]; then
        retry 3 "git clone '$REPO_URL' '$REPO_DIR'"
      else
        retry 3 "git -C '$REPO_DIR' fetch --all"
        retry 3 "git -C '$REPO_DIR' reset --hard origin/main"
      fi
      ;;
    *)
      red "✘ 取消操作"; exit 1;;
  esac
elif [ -d "$BASE_DIR/.git" ]; then
  ORIGIN="$(git -C "$BASE_DIR" remote get-url origin || true)"
  if [ -n "$ORIGIN" ] && [ "$ORIGIN" != "$REPO_URL" ]; then
    yellow "当前 origin 与 REPO_URL 不一致："
    echo "  origin:   $ORIGIN"
    echo "  REPO_URL: $REPO_URL"
    confirm "是否将 origin 改为 REPO_URL 并强制同步？" Y && git -C "$BASE_DIR" remote set-url origin "$REPO_URL" || true
  fi
  retry 3 "git -C '$BASE_DIR' fetch --all"
  retry 3 "git -C '$BASE_DIR' reset --hard origin/main"
else
  install -d -m 0755 "$BASE_DIR"
  retry 3 "git clone '$REPO_URL' '$BASE_DIR'"
fi

# 根据模式确定 compose 文件位置
if [ "$USE_ADOPT" = "yes" ]; then
  COMPOSE_FILE="${REPO_DIR}/deploy/docker-compose.yml"     # 切换到 .repo 的编排
  ensure_env_var COMPOSE_FILE "${COMPOSE_FILE}"
else
  COMPOSE_FILE="${BASE_DIR}/deploy/docker-compose.yml"
  ensure_env_var COMPOSE_FILE "${COMPOSE_FILE}"
fi
export COMPOSE_FILE

# ---------- 数据备份 & 二次覆盖 ----------
BACKUP_ROOT="${BASE_DIR}/backup/$(date +%Y%m%d_%H%M%S)"
[ "${DO_BACKUP_DATA}" = "yes" ] && [ -d "${BASE_DIR}/data" ] && { install -d -m 0755 "$BACKUP_ROOT"; tar -czf "${BACKUP_ROOT}/data.tgz" -C "${BASE_DIR}" data; info "✔ 数据已备份：${BACKUP_ROOT}/data.tgz"; }
if [ "${AUTO_PRUNE_OLD}" = "yes" ] && [ -f "$COMPOSE_FILE" ]; then
  docker compose -f "$COMPOSE_FILE" down -v || true
  docker image prune -f || true
  docker volume prune -f || true
  yellow "已执行二次覆盖清理"
fi

# ---------- 构建 & 启动 ----------
[ -f "$COMPOSE_FILE" ] || { red "✘ 未找到编排文件：$COMPOSE_FILE"; echo "tail -n 200 $LOG_FILE"; exit 1; }
info "构建镜像：${COMPOSE_PROFILES//,/ + }"
set +e
COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" build --progress=auto
BUILD_RC=$?; set -e
[ $BUILD_RC -ne 0 ] && { red "✘ 构建失败（$BUILD_RC）"; echo "docker compose -f $COMPOSE_FILE logs --tail=200"; exit $BUILD_RC; }

info "启动：${COMPOSE_PROFILES//,/ + }"
COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" up -d || { red "✘ 启动失败"; docker compose -f "$COMPOSE_FILE" ps; docker compose -f "$COMPOSE_FILE" logs --tail=200; exit 1; }

# ---------- 健康检查 ----------
wait_healthy(){ local svc="$1" timeout="${2:-240}" cid status start=$(date +%s); cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$svc")"; [ -z "$cid" ] && { yellow "⚠ 未找到服务 $svc 的容器"; return 0; }; while :; do status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$cid" 2>/dev/null || echo unknown)"; case "$status" in healthy|running) green "✔ $svc 健康：$status"; return 0;; esac; [ $(( $(date +%s) - start )) -ge $timeout ] && { red "✘ $svc 健康检查超时"; return 1; }; sleep 3; done; }
wait_healthy db 300 || true
wait_healthy backend 300 || true

# ---------- 迁移 ----------
info "执行数据库迁移（Alembic）..."
set +e
docker compose -f "$COMPOSE_FILE" exec -T backend sh -lc 'python -m alembic upgrade head'
MIG_RC=$?; set -e
if [ $MIG_RC -ne 0 ]; then
  red "✘ 迁移失败：建议回滚数据（如有备份：$BACKUP_ROOT）"
  echo "docker compose -f $COMPOSE_FILE down && tar -xzf $BACKUP_ROOT/data.tgz -C $BASE_DIR   # 如有 data 备份"
  exit $MIG_RC
fi
green "✔ 迁移完成"

# ---------- 端口验证 ----------
info "验证端口：APP ${APP_PORT} / EDITOR ${EDITOR_PORT}"
retry 3 "curl -fsSI --max-time 3 http://127.0.0.1:${APP_PORT}/ || true"
retry 3 "curl -fsSI --max-time 3 http://127.0.0.1:${EDITOR_PORT}/login || true"

# ---------- 完成 & 常用命令 ----------
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
