#!/usr/bin/env bash
# 一键部署（在线模式）
set -euo pipefail

# ===== 颜色函数 =====
c_red(){ echo -e "\e[31m$*\e[0m"; }
c_green(){ echo -e "\e[32m$*\e[0m"; }
c_blue(){ echo -e "\e[36m$*\e[0m"; }
c_yellow(){ echo -e "\e[33m$*\e[0m"; }

# ===== Root 校验（每个关键步骤都会二次复检） =====
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  c_red "[错误] 请先 sudo -i 或 su - 切换到 root 后重试"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

LOG_CMD_SYSTEMD="journalctl -u minipost.service -e -n 200"
LOG_CMD_COMPOSE="docker compose -f deploy/docker-compose.yml logs web --tail=200"
LOG_CMD_NGINX="tail -n 200 /var/log/nginx/error.log"

# ===== 0) Preflight 自检 =====
c_blue "[0/8] Preflight 自检…"
# OS
. /etc/os-release || true
if [[ "${NAME:-}" != "Ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
  c_yellow "[警告] 推荐 Ubuntu 24.04 LTS，当前：${PRETTY_NAME:-unknown}"
fi

# 资源/网络/DNS/NTP
CPU_CORES="$(nproc)"
MEM_MB="$(free -m | awk '/Mem:/{print $2}')"
DISK_MB="$(df -Pm / | awk 'NR==2{print $4}')"
c_blue "  - CPU: ${CPU_CORES} 核  内存: ${MEM_MB}MB  磁盘可用: ${DISK_MB}MB"
ping -c1 -W1 1.1.1.1 >/dev/null 2>&1 && c_blue "  - 网络连通: OK" || { c_red "  - 网络连通: 失败"; exit 1; }
getent hosts github.com >/dev/null 2>&1 && c_blue "  - DNS 解析: OK" || c_yellow "  - DNS 解析: 警告"
timedatectl >/dev/null 2>&1 && c_blue "  - 时间同步(NTP): $(timedatectl show -p NTPSynchronized --value 2>/dev/null || echo unknown)"

# 端口占用（8000/5432/80/443）
for P in 8000 5432 80 443; do
  if ss -lnt | awk '{print $4}' | grep -q ":$P$"; then
    c_yellow "  - 端口 $P 已被占用，请确认冲突。"
  fi
done

# Docker & Compose
if ! command -v docker >/dev/null 2>&1; then
  c_blue "  - 安装 Docker Engine…"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
if ! docker run --rm hello-world >/dev/null 2>&1; then
  c_red "  - Docker hello-world 运行失败"
  exit 1
fi
docker compose version >/dev/null 2>&1 || { c_red "  - 缺少 Docker Compose 插件"; exit 1; }
c_green "  - Docker/Compose: OK"

# ===== 1) 模式选择 =====
echo
c_blue "[1/8] 选择部署模式："
echo "  1) 全新安装"
echo "  2) 安全覆盖（备份->替换->自动回滚）"
echo "  3) 回滚上次备份"
read -r -p "请输入数字 [1/2/3]: " MODE
[[ -z "${MODE:-}" ]] && MODE=1

# 备份目录
BACKUP_DIR="${ROOT_DIR}/backups"
mkdir -p "$BACKUP_DIR"

# ===== 2) 准备运行目录 + .deploy.env =====
c_blue "[2/8] 准备运行目录 …"
mkdir -p logs data tmp
touch .deploy.env
# 再次 root 复检
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then c_red "[错误] 非 root 环境"; exit 1; fi

# 合并默认 env（如不存在键）
merge_env(){
  local k="$1" v="$2"
  grep -q "^$k=" .deploy.env || echo "$k=$v" >> .deploy.env
}
merge_env "APP_HOST" "0.0.0.0"
merge_env "APP_PORT" "8000"
merge_env "THEME_NAME" "default"
merge_env "DB" "postgres"
merge_env "PG_HOST" "postgres"
merge_env "PG_PORT" "5432"
merge_env "PG_DB" "minipost"
merge_env "PG_USER" "minipost"
if ! grep -q "^PG_PASSWORD=" .deploy.env; then
  read -r -p "请输入 PostgreSQL 密码（强口令）： " PG_PWD
  echo "PG_PASSWORD=${PG_PWD}" >> .deploy.env
fi
merge_env "USE_REAL_NAV" "false"
merge_env "UFW_OPEN" "true"
if ! grep -q "^JWT_SECRET=" .deploy.env; then
  SEC="$(head -c 32 /dev/urandom | base64 | tr -d '\n=/' | cut -c1-32)"
  echo "JWT_SECRET=${SEC}" >> .deploy.env
fi
merge_env "ENVIRONMENT" "production"

# ===== 3) 启动 PostgreSQL 16（持久化 + 健康检查） =====
c_blue "[3/8] 启动/更新数据库（PostgreSQL 16）…"
docker compose -f deploy/docker-compose.yml up -d postgres
c_blue "  - 等待数据库就绪…"
for i in {1..60}; do
  if docker exec minipost-postgres-1 pg_isready -U "$(grep ^PG_USER= .deploy.env | cut -d= -f2)" -d "$(grep ^PG_DB= .deploy.env | cut -d= -f2)" >/dev/null 2>&1; then
    c_green "  - Postgres 就绪"
    break
  fi
  sleep 1
done

# ===== 4) Alembic 迁移 =====
c_blue "[4/8] 执行数据库迁移…"
set +e
if ! ./scripts/migrate.sh; then
  c_red "[失败] 迁移失败，已停止。"
  echo "一键日志命令："
  echo "  systemd：${LOG_CMD_SYSTEMD}"
  echo "  Docker ：${LOG_CMD_COMPOSE}"
  echo "  Nginx ：${LOG_CMD_NGINX}"
  exit 1
fi
set -e

# ===== 5) 初始化管理员 =====
c_blue "[5/8] 初始化管理员账号 …（不会回显密码）"
read -r -p "请输入管理员用户名: " ADMIN_USER
read -r -s -p "请输入管理员密码: " ADMIN_PWD; echo
docker compose -f deploy/docker-compose.yml run --rm -e PYTHONUNBUFFERED=1 web python -m app.bootstrap init-admin --username "${ADMIN_USER}" --password "${ADMIN_PWD}"
c_green "  - 管理员已初始化"

# ===== 6) 启动 web 并健康检查 =====
c_blue "[6/8] 启动 Web…"
docker compose -f deploy/docker-compose.yml up -d web
c_blue "  - 等待健康检查 …"
for i in {1..60}; do
  if docker compose -f deploy/docker-compose.yml exec -T web curl -sf http://127.0.0.1:8000/healthz >/dev/null; then
    c_green "  - Web 就绪"
    break
  fi
  sleep 1
done

# ===== 7) 端口策略（UFW） =====
c_blue "[7/8] 端口开放策略 …"
APP_HOST="$(grep ^APP_HOST= .deploy.env | cut -d= -f2)"
APP_PORT="$(grep ^APP_PORT= .deploy.env | cut -d= -f2)"
UFW_OPEN="$(grep ^UFW_OPEN= .deploy.env | cut -d= -f2)"
if [[ "${UFW_OPEN}" == "true" && "${APP_HOST}" == "0.0.0.0" ]]; then
  if command -v ufw >/dev/null 2>&1; then
    ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    c_green "  - 已放行 TCP ${APP_PORT}"
  else
    c_yellow "  - 未安装 ufw，跳过"
  fi
else
  c_blue "  - 仅监听 127.0.0.1 或已关闭 UFW 放行"
fi

# ===== 8) 结果输出 =====
c_green "[8/8] 部署完成"
IP="$(hostname -I | awk '{print $1}')"
URL="http://${IP}:${APP_PORT}/"
echo "访问 URL：${URL}"
echo "管理员账号：${ADMIN_USER}（密码不回显）"
echo "备份目录：${ROOT_DIR}/backups"
echo "一键日志命令："
echo "  systemd：${LOG_CMD_SYSTEMD}"
echo "  Docker ：${LOG_CMD_COMPOSE}"
echo "  Nginx ：${LOG_CMD_NGINX}"
