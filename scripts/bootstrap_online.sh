# 路径: scripts/bootstrap_online.sh
#!/usr/bin/env bash
set -euo pipefail

log(){ echo -e "\033[1;32m[+] $*\033[0m"; }
warn(){ echo -e "\033[1;33m[!] $*\033[0m"; }
err(){ echo -e "\033[1;31m[-] $*\033[0m" >&2; }

need_root(){
  if [ "$(id -u)" != "0" ]; then err "请用 root 或 sudo 运行"; exit 1; fi
}

install_prereqs(){
  log "安装基础组件与 Docker / compose 插件"
  apt-get update -y
  apt-get install -y ca-certificates curl git jq openssl
  command -v docker >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh
  apt-get install -y docker-compose-plugin || true
  systemctl enable --now docker
}

tune_system(){
  log "系统调优：THP / BBR / ulimits / Docker 守护进程"
  # 关闭 THP（清单 6）
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

  # BBR + sysctl（清单 7）
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

  # ulimits（清单 8）
  mkdir -p /etc/security/limits.d
  cat >/etc/security/limits.d/99-erp-oms.conf <<'LIM'
* soft nofile 1048576
* hard nofile 1048576
root soft nofile 1048576
root hard nofile 1048576
LIM

  # Docker 守护进程（清单 9）
  mkdir -p /etc/docker
  if [ -f /etc/docker/daemon.json ]; then
    jq -s '.[0] * .[1]' /etc/docker/daemon.json <(cat <<'JSON'
{"log-driver":"local","log-opts":{"max-size":"64m","max-file":"5"},"exec-opts":["native.cgroupdriver=systemd"],"live-restore":true}
JSON
) >/etc/docker/daemon.json.new && mv /etc/docker/daemon.json.new /etc/docker/daemon.json
  else
    cat >/etc/docker/daemon.json <<'JSON'
{"log-driver":"local","log-opts":{"max-size":"64m","max-file":"5"},"exec-opts":["native.cgroupdriver=systemd"],"live-restore":true}
JSON
  fi
  systemctl restart docker
}

prepare_repo_env(){
  log "获取/更新仓库与生成 .deploy.env"
  if [ ! -d minipost/.git ]; then
    git clone https://github.com/aidaddydog/minipost.git
  fi
  cd minipost && git pull

  if [ ! -f .deploy.env ]; then
    cat > .deploy.env <<'EOF'
APP_ENV=prod
APP_PORT=8000
TZ=Asia/Shanghai
DATA_ROOT=/opt/minipost/data
LOG_ROOT=/opt/minipost/logs
POSTGRES_USER=minipost
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '\n' | sed 's/[^a-zA-Z0-9]//g')
POSTGRES_DB=minipost
APP_SECRET_KEY=$(openssl rand -hex 32)
COMPOSE_PROJECT_NAME=minipost
EOF
  fi
}

compose_up(){
  log "优雅下线并清理历史同名容器（避免 name 冲突）"
  docker compose -f compose/docker-compose.yml down --remove-orphans || true
  docker ps -a --format '{{.Names}}' | egrep '^minipost_web$|^minipost_postgres$' | xargs -r docker rm -f || true

  log "启动 Compose 栈"
  docker compose -f compose/docker-compose.yml up -d --build

  log "等待服务健康"
  for i in {1..30}; do
    ok=$(docker compose -f compose/docker-compose.yml ps --format json | jq -r 'map(.Health=="healthy")|all' 2>/dev/null || echo false)
    [ "$ok" = "true" ] && break || sleep 3
  done
  docker compose -f compose/docker-compose.yml ps
}

migrate_and_seed(){
  log "执行数据库迁移"
  bash scripts/migrate.sh || (err "迁移失败，查看 web 容器日志"; docker compose -f compose/docker-compose.yml logs web --tail=200; exit 1)

  if [ -x scripts/init_admin.sh ]; then
    log "初始化管理员与基础角色"; bash scripts/init_admin.sh || warn "init_admin.sh 返回非 0，请手动检查"
  else
    warn "未发现 scripts/init_admin.sh，跳过初始化"
  fi
}

report(){
  log "部署完成：生成交付报告"
  IP=$(curl -4 -s ifconfig.me || hostname -I | awk '{print $1}')
  cat <<RPT

访问地址：
  - 内部直连:  http://$IP:$(grep -E '^APP_PORT=' .deploy.env | cut -d= -f2)
  - 反代(如启用Nginx)：https://YOUR_DOMAIN

数据/日志目录：
  - DATA_ROOT=$(grep -E '^DATA_ROOT=' .deploy.env | cut -d= -f2)
  - LOG_ROOT=$(grep -E '^LOG_ROOT=' .deploy.env | cut -d= -f2)

常用日志：
  docker compose -f compose/docker-compose.yml logs web --tail=200
  docker compose -f compose/docker-compose.yml logs postgres --tail=200
  docker compose -f compose/docker-compose.yml logs nginx --tail=200

健康检查：
  curl -fsS http://127.0.0.1:$(grep -E '^APP_PORT=' .deploy.env | cut -d= -f2)/healthz

导航热更新：
  bash scripts/reload_nav.sh
RPT
}

main(){
  need_root
  install_prereqs
  tune_system
  prepare_repo_env
  compose_up
  migrate_and_seed
  report
}
main "$@"
