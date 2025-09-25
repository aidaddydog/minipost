#!/usr/bin/env bash
# -*- coding: utf-8 -*-
# 一键部署（Ubuntu 24 LTS 优先）
# - 彩色输出：菜单墨绿、警告红、进度条灰蓝
# - 支持：全新安装 / 覆盖安装 / 仅更新
# - 自动：检测 & 安装 Docker(含 Compose)、放行端口、建表、初始化管理员、错误回滚
set -euo pipefail

# 颜色
C_RESET="\033[0m"
C_RED="\033[31m"
C_GREEN="\033[38;5;28m"
C_CYAN="\033[36m"
C_BAR="\033[38;5;67m"   # 灰蓝
C_DIM="\033[2m"

# 路径与日志
TS="$(date +%Y%m%d_%H%M%S)"
BASE_DIR="/opt/minipost"
LOG_DIR="/var/log/minipost"; mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/bootstrap.$TS.log"
LATEST="$LOG_DIR/bootstrap.latest.log"
ln -sf "$LOG_FILE" "$LATEST"

# 默认仓库（可通过环境变量覆盖）
REPO_URL="${REPO_URL:-https://github.com/aidaddydog/minipost.git}"

# 统一输出（带日志）
log(){ echo -e "$@" | tee -a "$LOG_FILE" ; }
step(){ log "\n${C_CYAN}[STEP]${C_RESET} $1" ; }
ok(){ log "${C_GREEN}✔ $1${C_RESET}" ; }
warn(){ log "${C_RED}✘ $1${C_RESET}" ; }
bar(){  # 灰蓝进度条
  local pct="$1"; local msg="$2"
  local w=36; local fill=$((pct*w/100)); local empty=$((w-fill))
  printf "${C_BAR}｜%s%s｜%3s%% %s${C_RESET}\n" "$(printf '█%.0s' $(seq 1 $fill))" "$(printf ' %.0s' $(seq 1 $empty))" "$pct" "$msg" | tee -a "$LOG_FILE"
}

# 失败回滚
rollback(){
  warn "部署失败，执行自动回滚..."
  if [ -f "$BASE_DIR/compose/.deploy.env" ]; then
    bash "$BASE_DIR/scripts/restore_pg.sh" || true
  fi
  warn "—— 查看日志（复制执行）：tail -n 200 $LATEST"
  exit 1
}
trap rollback ERR

# 审前检查
step "0. 审前检查（root/系统/网络）"
[ "$(id -u)" -eq 0 ] || { warn "请使用 root 运行"; exit 1; }
uname -a | tee -a "$LOG_FILE" >/dev/null
if ! ping -c1 -W1 github.com >/dev/null 2>&1; then warn "网络不可达：github.com"; fi
PUBIP="$( (curl -fsSL ifconfig.me || curl -fsSL ipinfo.io/ip || echo unknown) 2>/dev/null )"
log "公网IP: $PUBIP"

# Docker/Compose
step "1. 检测/安装 Docker 与 Compose"
if ! command -v docker >/dev/null 2>&1; then
  bar 10 "安装 Docker..."
  curl -fsSL https://get.docker.com | sh | tee -a "$LOG_FILE"
  bar 40 "Docker 已安装"
fi
if ! docker compose version >/dev/null 2>&1; then
  bar 50 "安装 Docker Compose 插件..."
  apt-get update -y && apt-get install -y docker-compose-plugin | tee -a "$LOG_FILE"
fi
ok "Docker: $(docker --version) | Compose: $(docker compose version | head -n1)"

# 菜单（输入数字 1/2/3）
step "2. 选择安装方式"
cat <<'MENU' >&2
\033[38;5;28m
[1] 全新安装（删除旧容器/镜像/卷，备份数据库后重装）
[2] 覆盖安装（保留数据，重新构建并启动）
[3] 仅更新代码/镜像（不改数据库）
\033[0m
MENU
read -rp "请输入 1/2/3 并回车: " MODE
MODE="${MODE:-2}"
log "选择：$MODE"

# 拉取/更新仓库
step "3. 拉取/更新仓库到 $BASE_DIR（二次执行将拉取更新）"
mkdir -p "$(dirname "$BASE_DIR")"
if [ ! -d "$BASE_DIR/.git" ]; then
  bar 30 "克隆仓库..."
  git clone --depth=1 "$REPO_URL" "$BASE_DIR" | tee -a "$LOG_FILE"
else
  bar 30 "更新仓库..."
  git -C "$BASE_DIR" pull --ff-only | tee -a "$LOG_FILE"
fi
ok "仓库就绪"

# 生成/更新 .deploy.env
step "4. 生成/更新 .deploy.env"
if [ ! -f "$BASE_DIR/compose/.deploy.env" ]; then
  cp "$BASE_DIR/compose/.deploy.env.example" "$BASE_DIR/compose/.deploy.env"
  ok "已生成 compose/.deploy.env"
fi

# 强制输入管理员账号/密码（覆盖 .deploy.env 中的默认值）
step "5. 初始化管理员账号（必填）"
read -rp "请输入管理员账号（ADMIN_USER）: " ADMIN_USER
read -rsp "请输入管理员密码（ADMIN_PASS）: " ADMIN_PASS; echo
[ -n "$ADMIN_USER" ] && [ -n "$ADMIN_PASS" ] || { warn "管理员账号/密码不能为空"; exit 1; }
# 写入 .deploy.env（若存在则覆盖对应行）
sed -i "s/^ADMIN_USER=.*/ADMIN_USER=${ADMIN_USER}/" "$BASE_DIR/compose/.deploy.env"
sed -i "s/^ADMIN_PASS=.*/ADMIN_PASS=${ADMIN_PASS}/" "$BASE_DIR/compose/.deploy.env"
ok "管理员已写入 .deploy.env（不会记录明文到日志）"

# 全新安装：清理
if [ "$MODE" = "1" ]; then
  step "6. 备份数据库并清理旧版本"
  bash "$BASE_DIR/scripts/backup_pg.sh" || true
  docker compose -f "$BASE_DIR/compose/docker-compose.yml" down -v --remove-orphans || true
  ok "旧容器/网络/卷已清理（pgdata 卷可能保留，由上一步备份）"
fi

# 放行端口
step "7. 放行端口 8000（如启用 UFW）"
if command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -q "Status: active"; then
    ufw allow 8000/tcp || true
    ok "UFW 已放行 8000/tcp"
  else
    ok "UFW 未启用，跳过"
  fi
else
  ok "未检测到 UFW，跳过"
fi

# 构建/启动
step "8. 构建与启动 Docker Compose"
( cd "$BASE_DIR/compose" && docker compose up -d --build ) | tee -a "$LOG_FILE"
bar 70 "等待服务健康..."
# 等待 healthz
for i in $(seq 1 60); do
  if docker compose -f "$BASE_DIR/compose/docker-compose.yml" ps --services --filter "status=running" | grep -q web; then
    H=$(docker compose -f "$BASE_DIR/compose/docker-compose.yml" ps --format json | jq -r '.[].Health' 2>/dev/null || true)
    # 允许无 jq 环境：直接试探接口
    if curl -fsS http://127.0.0.1:8000/healthz >/dev/null 2>&1; then break; fi
  fi
  sleep 2
done
ok "容器已启动"

# 迁移/建表
step "9. 迁移/建表"
bash "$BASE_DIR/scripts/migrate.sh" | tee -a "$LOG_FILE"
ok "迁移完成"

# 创建管理员
step "10. 创建/更新管理员"
( cd "$BASE_DIR/compose" && ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" docker compose run --rm web python -m app.bootstrap create-admin ) | tee -a "$LOG_FILE"
ok "管理员创建/更新完成"

# 聚合导航（可选）
step "11. 聚合导航（可选）"
bash "$BASE_DIR/scripts/reload_nav.sh" | tee -a "$LOG_FILE" || true

# 完成
bar 100 "部署完成"
ok "访问：http://$PUBIP:8000/admin"
ok "—— 查看日志（复制执行）：docker compose -f $BASE_DIR/compose/docker-compose.yml logs web --tail=200"
