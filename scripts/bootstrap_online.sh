#!/usr/bin/env bash
# =========================================================
# minipost 一键部署（零交互 · 不等待健康检查 · 迁移限时重试 · 公网IP展示）
# =========================================================
set -Eeuo pipefail
green(){ echo -e "\033[32m$*\033[0m"; }; yellow(){ echo -e "\033[33m$*\033[0m"; }; red(){ echo -e "\033[31m$*\033[0m"; }; info(){ echo "[`date +%H:%M:%S`] $*"; }
retry(){ local t="$1"; shift; local n=0 rc=0; while :; do set +e; eval "$@"; rc=$?; set -e; [ $rc -eq 0 ] && return 0; n=$((n+1)); [ $n -ge $t ] && return $rc; sleep $(( n*2 )); yellow "重试第 $n 次：$*"; done; }
ensure_env_var(){ local k="$1" v="$2" f="${BASE_DIR}/.deploy.env"; [ -f "$f" ] || { echo "# minipost 部署环境（自动生成）" > "$f"; chmod 600 "$f"; }; grep -q "^${k}=" "$f" 2>/dev/null || echo "${k}=${v}" >> "$f"; }
merge_daemon_json(){ local key="$1" value="$2" f="/etc/docker/daemon.json"; install -d -m 0755 /etc/docker; [ -f "$f" ] || echo '{}' > "$f"; tmp="$(mktemp)"; jq "$key = $value" "$f" > "$tmp" && cat "$tmp" > "$f" && rm -f "$tmp"; }
detect_public_ip(){ local ip=""; ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"; [ -z "$ip" ] && ip="$(curl -fsS --max-time 5 https://ifconfig.me 2>/dev/null || true)"; [ -z "$ip" ] && ip="$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null || true)"; [ -z "$ip" ] && ip="$(ip route get 1 2>/dev/null | awk '/src/{print $7; exit}')"; echo "${ip:-未知}"; }

# ---------- 默认变量（零交互最佳） ----------
set +u
[ -f ".deploy.env" ] && { set -a; . ".deploy.env"; set +a; }
[ -f "/opt/minipost/.deploy.env" ] && { set -a; . "/opt/minipost/.deploy.env"; set +a; }
: "${BASE_DIR:=/opt/minipost}"; : "${REPO_URL:=https://github.com/aidaddydog/minipost.git}"; : "${SERVICE_NAME:=minipost}"
: "${APP_PORT:=8000}"; : "${EDITOR_PORT:=6006}"; : "${EDITOR_USER:=daddy}"; : "${EDITOR_PASS:=20240314AaA#}"
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"; : "${COMPOSE_PROFILES:=web,backend,postgres,editor}"; : "${AUTO_OPEN_UFW:=yes}"
: "${AUTO_PRUNE_OLD:=no}"; : "${DO_BACKUP_DATA:=yes}"; : "${AUTO_FAIL2BAN:=yes}"; : "${AUTO_UNATTENDED_UPDATES:=yes}"
: "${AUTO_TUNE_NET:=yes}"; : "${AUTO_ULIMITS:=yes}"; : "${AUTO_ZRAM_SWAP:=yes}"; : "${SWAP_SIZE_GB:=8}"
: "${DOCKER_MIRROR_URL:=}"; : "${DEFAULT_MIRRORS:="https://docker.m.daocloud.io https://hub-mirror.c.163.com https://mirror.ccs.tencentyun.com"}"
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
  set +e; curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor >/etc/apt/keyrings/docker.gpg 2>/dev/null; RC=$?; set -e
  if [ $RC -eq 0 ]; then
    chmod a+r /etc/apt/keyrings/docker.gpg; UB_CODENAME="$(. /etc/os-release && echo $VERSION_CODENAME)"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${UB_CODENAME} stable" >/etc/apt/sources.list.d/docker.list
    retry 3 "apt-get update -y"; set +e; apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; RC=$?; set -e
    [ $RC -ne 0 ] && { retry 3 "apt-get update -y"; retry 3 "apt-get install -y docker.io docker-compose-plugin"; }
  else
    retry 3 "apt-get update -y"; retry 3 "apt-get install -y docker.io docker-compose-plugin"
  fi
fi
systemctl enable --now docker
docker compose version >/dev/null 2>&1 || { red "✘ docker compose 插件不可用"; exit 1; }
green "✔ Docker/Compose 就绪"

# ---------- Docker 守护进程优化 + 镜像加速 ----------
probe_mirror(){ local url="$1" code; code="$(curl -m 3 -fsIX GET "$url/v2/" -o /dev/null -w '%{http_code}' 2>/dev/null || echo "")"; case "$code" in 200|401|403) return 0;; *) return 1;; esac; }
build_mirrors_json(){ local all=() uniq=() seen="" u; [ -n "$DOCKER_MIRROR_URL" ] && { IFS=', ' read -r -a ms <<< "$DOCKER_MIRROR_URL"; for u in "${ms[@]}"; do [ -n "$u" ] && all+=("$u"); done; }; for u in $DEFAULT_MIRRORS; do all+=("$u"); done; for u in "${all[@]}"; do [[ " $seen " == *" $u "* ]] && continue; seen="$seen $u"; probe_mirror "$u" && uniq+=("$u"); done; printf '%s\n' "${uniq[@]}" | jq -R . | jq -s .; }
merge_daemon_json '.["log-driver"]' '"local"'; merge_daemon_json '.["log-opts"]' '{"max-size":"64m","max-file":"5"}'
merge_daemon_json '.["exec-opts"]' '["native.cgroupdriver=systemd"]'; merge_daemon_json '.["live-restore"]' 'true'
MIRRORS_JSON="$(build_mirrors_json)"; [ "$(echo "$MIRRORS_JSON" | jq 'length')" -gt 0 ] && merge_daemon_json '.["registry-mirrors"]' "$MIRRORS_JSON"
systemctl restart docker
green "✔ Docker daemon.json 已优化并重启"

# ---------- ulimits / ZRAM / THP / BBR / 安全 ----------
if [ "${AUTO_ULIMITS}" = "yes" ]; then
  cat >/etc/security/limits.d/99-erp-oms.conf <<'EOF'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
EOF
  merge_daemon_json '.["default-ulimits"]' '{"nofile":{"Name":"nofile","Hard":1048576,"Soft":1048576}}'; systemctl restart docker
fi
if [ "${AUTO_ZRAM_SWAP}" = "yes" ]; then
  MEM_GB=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
  if [ "$MEM_GB" -le 8 ]; then install -d -m 0755 /etc/default; cat >/etc/default/zramswap <<'EOF'
ENABLED=true
PERCENT=50
PRIORITY=100
EOF
    systemctl restart zramswap || systemctl restart zram-config || true; swapoff -a || true
  else
    if ! grep -q " /swapfile " /etc/fstab 2>/dev/null; then fallocate -l "${SWAP_SIZE_GB}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1G count="${SWAP_SIZE_GB}"; chmod 600 /swapfile && mkswap /swapfile; echo "/swapfile none swap sw 0 0" >> /etc/fstab; swapon -a; fi
  fi
  sysctl -w vm.swappiness=10 >/dev/null; sysctl -w vm.vfs_cache_pressure=50 >/dev/null
fi
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
systemctl daemon-reload; systemctl enable --now disable-thp.service >/dev/null 2>&1 || true
[ "${AUTO_TUNE_NET}" = "yes" ] && { cat >/etc/sysctl.d/90-erp-oms.conf <<'EOF'
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
  sysctl --system >/dev/null 2>&1 || true; }
systemctl enable --now fail2ban >/dev/null 2>&1 || true
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
if command -v ufw >/dev/null 2>&1 && [ "${AUTO_OPEN_UFW}" = "yes" ]; then if ufw status | grep -q "Status: active"; then ufw allow 22/tcp >/dev/null 2>&1 || true; ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true; ufw allow "${EDITOR_PORT}/tcp" >/dev/null 2>&1 || true; fi; fi

# ---------- 仓库同步（自动 Adopt 接管） ----------
info "同步仓库（自动模式：标准/Adopt）"
REPO_DIR="$BASE_DIR"; USE_ADOPT="no"
if [ -d "$BASE_DIR" ] && [ ! -d "$BASE_DIR/.git" ]; then
  USE_ADOPT="yes"; REPO_DIR="${BASE_DIR}/.repo"; install -d -m 0755 "$REPO_DIR"
  if [ ! -d "$REPO_DIR/.git" ]; then retry 3 "git clone '$REPO_URL' '$REPO_DIR'"; else retry 3 "git -C '$REPO_DIR' fetch --all"; retry 3 "git -C '$REPO_DIR' reset --hard origin/main"; fi
elif [ -d "$BASE_DIR/.git" ]; then
  retry 3 "git -C '$BASE_DIR' fetch --all"; retry 3 "git -C '$BASE_DIR' reset --hard origin/main"
else
  install -d -m 0755 "$BASE_DIR"; retry 3 "git clone '$REPO_URL' '$BASE_DIR'"
fi
if [ "$USE_ADOPT" = "yes" ]; then COMPOSE_FILE="${REPO_DIR}/deploy/docker-compose.yml"; else COMPOSE_FILE="${BASE_DIR}/deploy/docker-compose.yml"; fi
export COMPOSE_FILE; ensure_env_var COMPOSE_FILE "${COMPOSE_FILE}"

# ---------- 数据备份 & 二次覆盖 ----------
BACKUP_ROOT="${BASE_DIR}/backup/$(date +%Y%m%d_%H%M%S)"
[ "${DO_BACKUP_DATA}" = "yes" ] && [ -d "${BASE_DIR}/data" ] && { install -d -m 0755 "$BACKUP_ROOT"; tar -czf "${BACKUP_ROOT}/data.tgz" -C "${BASE_DIR}" data; info "✔ 数据已备份：${BACKUP_ROOT}/data.tgz"; }
if [ "${AUTO_PRUNE_OLD}" = "yes" ] && [ -f "$COMPOSE_FILE" ]; then docker compose -f "$COMPOSE_FILE" down -v || true; docker image prune -f || true; docker volume prune -f || true; fi

# ---------- 构建 & 启动（不等待 health） ----------
[ -f "$COMPOSE_FILE" ] || { red "✘ 未找到编排：$COMPOSE_FILE"; exit 1; }
info "构建镜像：${COMPOSE_PROFILES//,/ + }"
set +e; COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" build; BUILD_RC=$?; set -e
[ $BUILD_RC -ne 0 ] && { red "✘ 构建失败（$BUILD_RC）"; exit $BUILD_RC; }
info "启动：${COMPOSE_PROFILES//,/ + }"
COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" up -d || { red "✘ 启动失败"; exit 1; }

# ---------- 迁移（限时 + 重试，不等待 backend healthy） ----------
run_mig(){ timeout 90s docker compose -f "$COMPOSE_FILE" exec -T backend sh -lc 'python -m alembic upgrade head'; }
if run_mig; then
  green "✔ 迁移完成"
else
  yellow "⚠ 迁移第 1 次失败，5 秒后重试"; sleep 5
  if run_mig; then green "✔ 迁移完成（重试成功）"
  else
    yellow "⚠ 迁移第 2 次失败，5 秒后最后一次重试"; sleep 5
    if run_mig; then green "✔ 迁移完成（第 3 次重试成功）"
    else
      red "✘ 迁移失败（三次尝试）——已自动打印关键日志（backend/editor）"
      docker compose -f "$COMPOSE_FILE" ps || true
      docker compose -f "$COMPOSE_FILE" logs backend --tail=200 || true
      docker compose -f "$COMPOSE_FILE" logs editor  --tail=200 || true
    fi
  fi
fi

# ---------- 端口探测（不阻塞） ----------
curl -fsSI --max-time 3 "http://127.0.0.1:${APP_PORT}/" >/dev/null 2>&1 || true
curl -fsSI --max-time 3 "http://127.0.0.1:${EDITOR_PORT}/login" >/dev/null 2>&1 || true

# ---------- 完成 & 公网IP ----------
PUBIP="$(detect_public_ip)"
green "✔ 部署完成"
echo
echo "== 访问地址（公网IP） =="
echo "管理端：     http://${PUBIP}:${APP_PORT}"
echo "模板编辑器： http://${PUBIP}:${EDITOR_PORT}   （账号：${EDITOR_USER}）"
echo
echo "== 常用一键日志命令（已带绝对路径） =="
echo "docker compose -f $COMPOSE_FILE ps"
echo "docker compose -f $COMPOSE_FILE logs backend --tail=200"
echo "docker compose -f $COMPOSE_FILE logs editor  --tail=200"
echo "tail -n 200 ${BASE_DIR}/logs/bootstrap.latest.log"
