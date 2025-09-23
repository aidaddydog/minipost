#!/usr/bin/env bash
# =========================================================
# minipost 一键部署（Docker 统一版 · 零交互最佳默认 · 公网IP展示）
# - 零交互：采用最佳默认（可用 .deploy.env 覆盖）
# - 自动安装/优化 Docker；默认镜像加速器“可达性探测后写入”
# - 自动模式选择：目录存在且非 Git → Adopt 接管（.repo）
# - ZRAM/Swap、THP、BBR、ulimits、UFW、fail2ban、自动安全更新
# - 自动构建/启动/健康检查/迁移；结尾展示公网 IP 访问地址
# 适配：Ubuntu 24.04 LTS（root）
# =========================================================

set -Eeuo pipefail

# ---------- 彩色输出 ----------
green(){ echo -e "\033[32m$*\033[0m"; }
yellow(){ echo -e "\033[33m$*\033[0m"; }
red(){ echo -e "\033[31m$*\033[0m"; }
info(){ echo "[`date +%H:%M:%S`] $*"; }

# ---------- 小工具 ----------
retry(){ local t="$1"; shift; local n=0 rc=0; while :; do set +e; eval "$@"; rc=$?; set -e; [ $rc -eq 0 ] && return 0; n=$((n+1)); [ $n -ge $t ] && return $rc; sleep $(( n*2 )); yellow "重试第 $n 次：$*"; done; }
ensure_env_var(){ local k="$1" v="$2" f="${BASE_DIR}/.deploy.env"; [ -f "$f" ] || { echo "# minipost 部署环境（自动生成）" > "$f"; chmod 600 "$f"; }; grep -q "^${k}=" "$f" 2>/dev/null || echo "${k}=${v}" >> "$f"; }
merge_daemon_json(){ local key="$1" value="$2" f="/etc/docker/daemon.json"; install -d -m 0755 /etc/docker; [ -f "$f" ] || echo '{}' > "$f"; tmp="$(mktemp)"; jq "$key = $value" "$f" > "$tmp" && cat "$tmp" > "$f" && rm -f "$tmp"; }
detect_public_ip(){
  local ip=""
  ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null || true)"
  [ -z "$ip" ] && ip="$(ip route get 1 2>/dev/null | awk '/src/{print $7; exit}')"
  echo "${ip:-未知}"
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
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"   # Adopt 时会改写为 .repo 路径
: "${COMPOSE_PROFILES:=web,backend,postgres,editor}"
: "${AUTO_OPEN_UFW:=yes}"
# —— 零交互最佳默认 ——（可在 .deploy.env 覆盖）
: "${AUTO_PRUNE_OLD:=no}"            # 默认不清理卷/镜像，避免误删数据
: "${DO_BACKUP_DATA:=yes}"           # 启动前备份 BASE_DIR/data（如存在）
: "${AUTO_FAIL2BAN:=yes}"            # 开启防暴力破解
: "${AUTO_UNATTENDED_UPDATES:=yes}"  # 开启自动安全更新（不强制重启）
: "${AUTO_TUNE_NET:=yes}"            # BBR + sysctl
: "${AUTO_ULIMITS:=yes}"             # nofile=1,048,576
: "${AUTO_ZRAM_SWAP:=yes}"           # ≤8G 用 ZRAM；>8G 建 swapfile
: "${SWAP_SIZE_GB:=8}"
: "${DOCKER_MIRROR_URL:=}"           # 额外自定义镜像（逗号/空格分隔）
: "${DEFAULT_MIRRORS:="https://docker.m.daocloud.io https://hub-mirror.c.163.com https://mirror.ccs.tencentyun.com"}"
: "${GIT_AUTH_HEADER:=}"
export BASE_DIR SERVICE_NAME APP_PORT EDITOR_PORT COMPOSE_PROFILES
set -u

# ---------- 日志 ----------
install -d -m 0755 "${BASE_DIR}/logs"
LOG_FILE="${BASE_DIR}/logs/bootstrap_$(date +%Y%m%d_%H%M%S).log"
ln -sfn "$LOG_FILE" "${BASE_DIR}/logs/bootstrap.latest.log"
exec > >(tee -a "$LOG_FILE") 2>&1
[ "$(id -u)" -eq 0 ] || { red "✘ 需要 root 运行"; exit 1; }
info "安装日志：$LOG_FILE"

# ---------- 基础依赖 / Docker ----------
export DEBIAN_FRONTEND=noninteractive
retry 3 "apt-get update -y"
retry 3 "apt-get install -y ca-certificates curl gnupg lsb-release jq ufw zram-tools fail2ban unattended-upgrades"
install -d -m 0755 /etc/apt/keyrings
if ! command -v docker >/dev/null 2>&1; then
  set +e
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor >/etc/apt/keyrings/docker.gpg 2>/dev/null
  RC=$?; set -e
  if [ $RC -eq 0 ]; then
    chmod a+r /etc/apt/keyrings/docker.gpg
    UB_CODENAME="$(. /etc/os-release && echo $VERSION_CODENAME)"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${UB_CODENAME} stable" >/etc/apt/sources.list.d/docker.list
    retry 3 "apt-get update -y"
    set +e; apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; RC=$?; set -e
    [ $RC -ne 0 ] && { yellow "⚠ 官方源失败，回退 Ubuntu 源 docker.io"; retry 3 "apt-get update -y"; retry 3 "apt-get install -y docker.io docker-compose-plugin"; }
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
probe_mirror(){ # 仅接受 200/401/403，且不输出错误
  local url="$1" code
  code="$(curl -m 3 -fsIX GET "$url/v2/" -o /dev/null -w '%{http_code}' 2>/dev/null || echo "")"
  case "$code" in 200|401|403) return 0;; *) return 1;; esac
}
build_mirrors_json(){
  local all=() uniq=() seen="" u
  if [ -n "$DOCKER_MIRROR_URL" ]; then IFS=', ' read -r -a user_mirrors <<< "$DOCKER_MIRROR_URL"; for u in "${user_mirrors[@]}"; do [ -n "$u" ] && all+=("$u"); done; fi
  for u in $DEFAULT_MIRRORS; do all+=("$u"); done
  for u in "${all[@]}"; do [[ " $seen " == *" $u "* ]] && continue; seen="$seen $u"; probe_mirror "$u" && uniq+=("$u"); done
  printf '%s\n' "${uniq[@]}" | jq -R . | jq -s .
}
merge_daemon_json '.["log-driver"]' '"local"'
merge_daemon_json '.["log-opts"]' '{"max-size":"64m","max-file":"5"}'
merge_daemon_json '.["exec-opts"]' '["native.cgroupdriver=systemd"]'
merge_daemon_json '.["live-restore"]' 'true'
MIRRORS_JSON="$(build_mirrors_json)"
if [ "$(echo "$MIRRORS_JSON" | jq 'length')" -gt 0 ]; then
  merge_daemon_json '.["registry-mirrors"]' "$MIRRORS_JSON"
  info "✔ 已写入镜像加速器：$(echo "$MIRRORS_JSON" | jq -r '.[]' | xargs)"
else
  yellow "⚠ 未发现可用镜像加速器（可稍后手工配置 /etc/docker/daemon.json）"
fi
systemctl restart docker
green "✔ Docker daemon.json 已优化并重启（日志滚动/systemd/live-restore/镜像加速）"

# ---------- ulimits ----------
if [ "${AUTO_ULIMITS}" = "yes" ]; then
  cat >/etc/security/limits.d/99-erp-oms.conf <<'EOF'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
EOF
  merge_daemon_json '.["default-ulimits"]' '{"nofile":{"Name":"nofile","Hard":1048576,"Soft":1048576}}'
  systemctl restart docker
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
systemctl enable --now fail2ban >/dev/null 2>&1 || true
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
if command -v ufw >/dev/null 2>&1 && [ "${AUTO_OPEN_UFW}" = "yes" ]; then
  if ufw status | grep -q "Status: active"; then
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    ufw allow "${EDITOR_PORT}/tcp" >/dev/null 2>&1 || true
    info "✔ UFW 已放行：22, ${APP_PORT}, ${EDITOR_PORT}"
  fi
fi

# ---------- 仓库同步（自动选择模式：标准 / Adopt 接管） ----------
info "同步仓库（自动模式）"
REPO_DIR="$BASE_DIR"     # 标准模式
USE_ADOPT="no"

if [ -d "$BASE_DIR" ] && [ ! -d "$BASE_DIR/.git" ]; then
  # 非 Git 目录 → Adopt 接管：在 .repo 克隆，保持你原目录不动
  USE_ADOPT="yes"
  REPO_DIR="${BASE_DIR}/.repo"
  install -d -m 0755 "$REPO_DIR"
  if [ ! -d "$REPO_DIR/.git" ]; then
    retry 3 "git clone '$REPO_URL' '$REPO_DIR'"
  else
    retry 3 "git -C '$REPO_DIR' fetch --all"
    retry 3 "git -C '$REPO_DIR' reset --hard origin/main"
  fi
elif [ -d "$BASE_DIR/.git" ]; then
  retry 3 "git -C '$BASE_DIR' fetch --all"
  retry 3 "git -C '$BASE_DIR' reset --hard origin/main"
else
  install -d -m 0755 "$BASE_DIR"
  retry 3 "git clone '$REPO_URL' '$BASE_DIR'"
fi

# 选择 compose 文件位置
if [ "$USE_ADOPT" = "yes" ]; then
  COMPOSE_FILE="${REPO_DIR}/deploy/docker-compose.yml"
else
  COMPOSE_FILE="${BASE_DIR}/deploy/docker-compose.yml"
fi
export COMPOSE_FILE
ensure_env_var COMPOSE_FILE "${COMPOSE_FILE}"

# ---------- 备份数据 & 二次覆盖 ----------
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
COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" build
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

# ---------- 端口验证（本机） ----------
retry 3 "curl -fsSI --max-time 3 http://127.0.0.1:${APP_PORT}/ >/dev/null || true"
retry 3 "curl -fsSI --max-time 3 http://127.0.0.1:${EDITOR_PORT}/login >/dev/null || true"

# ---------- 完成 & 公网IP展示 ----------
PUBIP="$(detect_public_ip)"
green "✔ 部署完成"
echo
echo "== 访问地址（公网IP 自动探测） =="
echo "管理端：     http://${PUBIP}:${APP_PORT}"
echo "模板编辑器： http://${PUBIP}:${EDITOR_PORT}    （账号：${EDITOR_USER}）"
echo
echo "== 常用一键日志命令 =="
echo "docker compose -f $COMPOSE_FILE ps"
echo "docker compose -f $COMPOSE_FILE logs backend --tail=200"
echo "docker compose -f $COMPOSE_FILE logs editor  --tail=200"
echo "journalctl -u docker.service -e -n 200"
echo "tail -n 200 $LOG_FILE"
