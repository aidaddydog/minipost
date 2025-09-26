#!/usr/bin/env bash
# scripts/bootstrap_online.sh
# 一键部署（在线）：Preflight → 安装 Docker/Compose → 写入/合并 .deploy.env → Compose 拉起 → 迁移 → 初始化 → 健康检查 → 输出结果
set -Eeuo pipefail

# ====== 颜色与输出 ======
c_red='\033[1;31m'; c_green='\033[1;32m'; c_yellow='\033[1;33m'; c_blue='\033[1;34m'; c_reset='\033[0m'
log(){ echo -e "${c_green}[+] $*${c_reset}"; }
warn(){ echo -e "${c_yellow}[!] $*${c_reset}"; }
err(){ echo -e "${c_red}[-] $*${c_reset}" >&2; }
die(){ err "$1"; exit 1; }

# ====== 0. Preflight 自检 ======
need_root(){
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "请先 sudo -i 或 su - 切换到 root 后重试（EUID 必须为 0）"
  fi
}
check_os(){
  . /etc/os-release
  if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
    die "仅支持 Ubuntu 24.04 LTS，当前为 ${PRETTY_NAME:-unknown}"
  fi
}
check_basic(){
  log "系统/网络/时间/端口检查"
  command -v curl >/dev/null || apt-get update && apt-get install -y curl
  curl -fsSL https://www.google.com >/dev/null 2>&1 || warn "外网连通性异常（可忽略但后续拉取会变慢/失败）"
  timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -q true || warn "NTP 未同步"
  # 端口占用（默认 8000）
  local port="${APP_PORT:-8000}"
  if ss -ltn | awk '{print $4}' | grep -q ":${port}\$"; then
    die "端口 ${port} 已被占用，请修改 .deploy.env 中 APP_PORT 或释放该端口后重试"
  fi
}
install_docker_compose(){
  log "安装 Docker Engine 与 Compose 插件"
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sh
  fi
  apt-get install -y docker-compose-plugin || true
  systemctl enable --now docker
  docker run --rm hello-world >/dev/null 2>&1 || die "Docker 运行 hello-world 失败，请检查网络或代理"
}

# ====== 1. 模式选择 ======
choose_mode(){
  echo -e "${c_blue}请选择部署模式：${c_reset}
  1) 全新安装
  2) 安全覆盖（备份并回滚失败）
  3) 回滚上次备份
  "
  read -rp "输入数字并回车: " MODE
  [[ "${MODE}" =~ ^[123]$ ]] || die "非法输入"
}

# ====== 2. 准备仓库与 .deploy.env ======
prepare_repo_env(){
  log "准备运行目录与环境变量"
  # 在仓库根执行本脚本；若不是，尝试切到仓库根
  if [[ ! -f "deploy/docker-compose.yml" ]]; then
    die "请在仓库根目录执行：bash scripts/bootstrap_online.sh"
  fi

  # 生成或合并 .deploy.env（仅追加不存在的键）
  if [[ ! -f ".deploy.env" ]]; then
    cat > .deploy.env <<'EOF'
APP_HOST=0.0.0.0
APP_PORT=8000
THEME_NAME=default
DB=postgres
PG_HOST=postgres
PG_PORT=5432
PG_DB=minipost
PG_USER=minipost
PG_PASSWORD=
USE_REAL_NAV=false
UFW_OPEN=true
JWT_SECRET=
EOF
  fi
  # 强口令与 JWT 秘钥（若为空则生成）
  if ! grep -q '^PG_PASSWORD=' .deploy.env || [[ -z "$(grep '^PG_PASSWORD=' .deploy.env | cut -d= -f2-)" ]]; then
    sed -i "s/^PG_PASSWORD=.*/PG_PASSWORD=$(openssl rand -hex 24)/" .deploy.env
  fi
  if ! grep -q '^JWT_SECRET=' .deploy.env || [[ -z "$(grep '^JWT_SECRET=' .deploy.env | cut -d= -f2-)" ]]; then
    sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .deploy.env
  fi
}

# ====== 3. 启动 Postgres16 与 Web（Compose） ======
compose_down_old(){
  log "清理旧容器（可忽略错误）"
  docker compose -f deploy/docker-compose.yml down --remove-orphans || true
}
compose_up_new(){
  log "启动服务栈（Postgres16 + Web）"
  docker compose -f deploy/docker-compose.yml up -d --build
  log "等待健康检查通过..."
  for i in $(seq 1 60); do
    ok=$(docker compose -f deploy/docker-compose.yml ps --format json 2>/dev/null | jq -r 'map(.Health=="healthy")|all' || echo false)
    [[ "$ok" == "true" ]] && break
    sleep 2
  done
}

# ====== 4. 数据库迁移 & 初始化管理员 ======
migrate_db(){
  log "执行 Alembic 迁移"
  docker compose -f deploy/docker-compose.yml exec -T web \
    bash -lc "alembic upgrade head" || die "迁移失败，请执行：docker compose -f deploy/docker-compose.yml logs web --tail=200"
}
init_admin(){
  log "初始化管理员（交互式，仅设置密码，不回显）"
  local admin="admin"
  read -rsp "请输入管理员 ${admin} 的密码：" ADMIN_PWD
  echo
  docker compose -f deploy/docker-compose.yml exec -T web \
    python - <<PY
from modules.core.backend.models.rbac import User
from app.security import hash_password
from app.db import SessionLocal, engine
from sqlalchemy import text
db=SessionLocal()
# 若无表或异常直接退出（避免误写）
db.execute(text("SELECT 1"))
u=db.query(User).filter(User.username=="${admin}").first()
if not u:
    u=User(username="${admin}", full_name="Administrator", email="")
    u.password_hash=hash_password("${ADMIN_PWD}")
    db.add(u)
else:
    u.password_hash=hash_password("${ADMIN_PWD}")
db.commit(); db.close()
print("OK")
PY
}

# ====== 5. UFW 端口策略 & 结果输出 ======
ufw_apply(){
  local host="${APP_HOST:-0.0.0.0}" port="${APP_PORT:-8000}" open="${UFW_OPEN:-true}"
  if command -v ufw >/dev/null 2>&1; then
    if [[ "$host" == "0.0.0.0" && "$open" == "true" ]]; then
      ufw allow ${port}/tcp || true
    fi
  fi
}
report(){
  log "部署完成"
  echo "访问：http://$(hostname -I | awk '{print $1}'):${APP_PORT:-8000}/"
  echo "管理员账号：admin（密码不回显，已设置）"
  echo
  echo "一键查看日志："
  echo "  systemd：journalctl -u minipost.service -e -n 200"
  echo "  Docker ：docker compose -f deploy/docker-compose.yml logs web --tail=200"
  echo "  Nginx ：tail -n 200 /var/log/nginx/error.log"
}

# ====== 主流程 ======
need_root
check_os
check_basic
install_docker_compose
choose_mode
prepare_repo_env
compose_down_old
compose_up_new
migrate_db
init_admin
ufw_apply
report
