#!/usr/bin/env bash
# 一键部署（Ubuntu 24）——按《一键部署执行清单》0~17步实现
# 关键点：统一 env 路径/项目名；去 container_name；健康依赖；离线合并导航；幂等可回滚
set -Eeuo pipefail

# ============== 日志与 trap（Step 1） ==============
LOG_DIR=/var/log/minipost
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deploy_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1
trap 'echo "[ERR] 行号:$LINENO 退出码:$?"' ERR

PRECHECK=${PRECHECK:-1}; INSTALL_DOCKER=${INSTALL_DOCKER:-1}; NET_TUNING=${NET_TUNING:-1}
ULIMITS=${ULIMITS:-1}; DOCKER_OPT=${DOCKER_OPT:-1}; SEC_BASELINE=${SEC_BASELINE:-1}
PROXY_TLS=${PROXY_TLS:-0}; COMPOSE_UP=${COMPOSE_UP:-1}; MIGRATE_DB=${MIGRATE_DB:-1}; INIT_ADMIN=${INIT_ADMIN:-1}

# 彩色输出
green(){ echo -e "\033[1;32m$*\033[0m"; }
yellow(){ echo -e "\033[1;33m$*\033[0m"; }
red(){ echo -e "\033[1;31m$*\033[0m"; }

# ============== Step 0 预检 ==============
precheck(){
  id -u | grep -q '^0$' || { red "需要 root"; exit 1; }
  . /etc/os-release && echo "[OS] $PRETTY_NAME"; uname -m
  nproc; free -h; df -h /
  getent hosts registry-1.docker.io || nslookup registry-1.docker.io 1.1.1.1 || true
  curl -I --max-time 8 https://registry-1.docker.io || yellow '镜像仓库不可达（将重试，由 Docker 自行拉取重试）'
  systemctl is-active systemd-timesyncd || true
  timedatectl timesync-status || true
}

# ============== Step 2 Docker/依赖 ==============
install_docker(){
  apt-get update -y
  apt-get install -y ca-certificates curl jq gnupg lsb-release git unzip dnsutils net-tools ufw python3 python3-venv
  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  fi
  apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  docker info
  docker compose version
}

# ============== Step 5~9 系统调优 ==============
tune_sys(){
  # 5) ZRAM/Swap 简化策略（≤8G 用 zram，>8G 轻量 swap）；可按需调整
  MEM_GB=$(awk '/MemTotal/ {printf "%.0f", $2/1024/1024}' /proc/meminfo || echo 0)
  if [ "$MEM_GB" -le 8 ]; then
    apt-get install -y zram-tools || true
    sed -i 's/^#*ALGO=.*/ALGO=lz4/; s/^#*PERCENT=.*/PERCENT=50/' /etc/default/zramswap || true
    systemctl enable --now zramswap || true
  else
    if ! grep -q '/swapfile' /etc/fstab 2>/dev/null; then
      fallocate -l 8G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
      echo '/swapfile none swap sw,pri=100 0 0' >> /etc/fstab
    fi
  fi
  sysctl -w vm.swappiness=10
  sysctl -w vm.vfs_cache_pressure=50

  # 6) 关闭 THP
  cat >/etc/systemd/system/disable-thp.service <<'SYS'
[Unit]
Description=Disable Transparent Huge Pages (THP)
After=multi-user.target
[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled; echo never > /sys/kernel/mm/transparent_hugepage/defrag'
[Install]
WantedBy=multi-user.target
SYS
  systemctl daemon-reload && systemctl enable --now disable-thp || true

  # 7) BBR + sysctl 调优
  cat >/etc/sysctl.d/90-erp-oms.conf <<'SYS'
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.core.somaxconn=65535
net.core.netdev_max_backlog=250000
net.ipv4.tcp_max_syn_backlog=262144
net.ipv4.ip_local_port_range=1025 65535
net.ipv4.tcp_fin_timeout=15
net.ipv4.tcp_mtu_probing=1
net.ipv4.tcp_rmem=4096 87380 134217728
net.ipv4.tcp_wmem=4096 65536 134217728
fs.file-max=1000000
vm.swappiness=10
vm.vfs_cache_pressure=50
SYS
  sysctl --system || true

  # 8) ulimits（nofile 100万）
  mkdir -p /etc/security/limits.d
  cat >/etc/security/limits.d/99-erp-oms.conf <<'LIM'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
LIM

  # 9) Docker 守护进程：日志滚动 / systemd cgroup / live-restore
  mkdir -p /etc/docker
  if [ -f /etc/docker/daemon.json ]; then
    # 合并配置
    tmp=$(mktemp)
    jq -s '.[0] * .[1]' /etc/docker/daemon.json <(cat <<'JSON'
{"log-driver":"local","log-opts":{"max-size":"64m","max-file":"5"},"exec-opts":["native.cgroupdriver=systemd"],"live-restore":true,"default-ulimits":{"nofile":{"Name":"nofile","Soft":1048576,"Hard":1048576}}}
JSON
) >"$tmp" && mv "$tmp" /etc/docker/daemon.json
  else
    cat >/etc/docker/daemon.json <<'JSON'
{"log-driver":"local","log-opts":{"max-size":"64m","max-file":"5"},"exec-opts":["native.cgroupdriver=systemd"],"live-restore":true,"default-ulimits":{"nofile":{"Name":"nofile","Soft":1048576,"Hard":1048576}}}
JSON
  fi
  systemctl restart docker
}

# ============== Step 10 安全基线（可按需） ==============
secure_baseline(){
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  yes | ufw enable || true
  ufw status || true
}

# ============== Step 3 & 仓库获取/ENV 统一 ==============
prepare_repo_env(){
  if [ ! -d minipost/.git ]; then
    git clone https://github.com/aidaddydog/minipost.git
  fi
  cd minipost && git pull

  # 固定 Compose 项目名（避免名称漂移/冲突）
  echo "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-minipost}" > .env

  # 若无 .deploy.env 则生成（有则保留）
  if [ ! -f .deploy.env ]; then
    cat > .deploy.env <<'EOF'
APP_ENV=prod
APP_PORT=8000
TZ=Asia/Shanghai

DB_HOST=postgres
DB_PORT=5432
DB_NAME=minipost
DB_USER=minipost
DB_PASS=$(openssl rand -base64 24 | tr -d '\n' | sed 's/[^a-zA-Z0-9]//g')

APP_SECRET_KEY=$(openssl rand -hex 32)
DATA_ROOT=/opt/minipost/data
LOG_ROOT=/opt/minipost/logs
EOF
    chmod 600 .deploy.env
  fi

  # 校验 compose yml 可读
  python3 - <<'PY'
import yaml, pathlib
yaml.safe_load(pathlib.Path('compose/docker-compose.yml').read_text())
print('YAML OK')
PY
}

# ============== Step 4 覆盖策略与兜底清理 ==============
down_and_cleanup(){
  docker compose -p "${COMPOSE_PROJECT_NAME:-minipost}" -f compose/docker-compose.yml down --remove-orphans || true
  # 兜底：如历史上写死过 container_name，清理同名残留
  docker ps -aq --filter 'name=^/minipost_web$' | xargs -r docker rm -f || true
  docker ps -aq --filter 'name=^/minipost_pg$'  | xargs -r docker rm -f || true
}

# ============== Step 12 Compose 启动 & 健康轮询 ==============
compose_up(){
  docker compose -p "${COMPOSE_PROJECT_NAME:-minipost}" -f compose/docker-compose.yml up -d --build

  green "[HEALTH] 等待容器健康..."
  for i in {1..40}; do
    ok=$(docker compose -p "${COMPOSE_PROJECT_NAME:-minipost}" -f compose/docker-compose.yml ps --format json | jq -r 'map(.Health=="healthy")|all' 2>/dev/null || echo false)
    [ "$ok" = "true" ] && break
    sleep 3
  done
  docker compose -p "${COMPOSE_PROJECT_NAME:-minipost}" -f compose/docker-compose.yml ps
}

# ============== Step 13 迁移 & Step 14 初始化 ==============
migrate_db(){
  docker compose -p "${COMPOSE_PROJECT_NAME:-minipost}" -f compose/docker-compose.yml exec -T web sh -lc 'cd /app && alembic upgrade head' \
    || { red "迁移失败"; docker compose -p "${COMPOSE_PROJECT_NAME:-minipost}" -f compose/docker-compose.yml logs web --tail=200; exit 1; }
}

init_admin(){
  if [ -x scripts/init_admin.sh ]; then
    bash scripts/init_admin.sh || yellow "init_admin.sh 返回非 0，请手动检查"
  else
    yellow "未发现 scripts/init_admin.sh，跳过管理员初始化"
  fi
}

# ============== Step 16 部署报告 ==============
report(){
  IP=$(curl -4 -s ifconfig.me || hostname -I | awk '{print $1}')
  PORT=$(grep -E '^APP_PORT=' .deploy.env | cut -d= -f2)
  cat <<RPT

[部署完成]
  访问地址： http://$IP:${PORT:-8000}
  数据目录： $(grep -E '^DATA_ROOT=' .deploy.env | cut -d= -f2)
  日志目录： $(grep -E '^LOG_ROOT=' .deploy.env | cut -d= -f2)

健康检查：
  curl -fsS http://127.0.0.1:${PORT:-8000}/healthz

常用日志：
  docker compose -p ${COMPOSE_PROJECT_NAME:-minipost} -f compose/docker-compose.yml logs web --tail=200
  docker compose -p ${COMPOSE_PROJECT_NAME:-minipost} -f compose/docker-compose.yml logs postgres --tail=200

导航热更新（模块改动后）：
  bash scripts/reload_nav.sh
RPT
}

main(){
  [ "$PRECHECK" = "1" ] && precheck
  [ "$INSTALL_DOCKER" = "1" ] && install_docker
  [ "$NET_TUNING" = "1" -o "$ULIMITS" = "1" -o "$DOCKER_OPT" = "1" ] && tune_sys
  [ "$SEC_BASELINE" = "1" ] && secure_baseline
  prepare_repo_env
  down_and_cleanup
  [ "$COMPOSE_UP" = "1" ] && compose_up
  [ "$MIGRATE_DB" = "1" ] && migrate_db
  [ "$INIT_ADMIN" = "1" ] && init_admin
  report
}
main "$@"
