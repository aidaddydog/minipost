#!/usr/bin/env bash
# 一键部署脚本（含中文进度提示、二次覆盖清理、自动放行端口、日志提示）
set -Eeuo pipefail

# 颜色
C_RESET='\033[0m'
C_BLUE='\033[1;34m'
C_GREEN='\033[1;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[1;31m'

say() { echo -e "${C_BLUE}➤${C_RESET} $*"; }
ok()  { echo -e "${C_GREEN}✔${C_RESET} $*"; }
warn(){ echo -e "${C_YELLOW}⚠${C_RESET} $*"; }
err(){ echo -e "${C_RED}✘${C_RESET} $*"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="compose/docker-compose.yml"
ENV_FILE="compose/.deploy.env"

# 统一日志命令（异常时提示）
log_hint(){
  echo
  echo "— 快速查看日志（复制执行）："
  echo "  docker compose -f $COMPOSE_FILE logs app --tail=200"
  echo "  # 上述命令含义：查看应用容器最近 200 行日志"
  echo
}

trap 'err "部署过程中发生错误！"; log_hint' ERR

say "步骤 0/7：环境检查（Docker / Compose）…"
if ! command -v docker >/dev/null 2>&1; then
  err "未检测到 Docker，请先安装 Docker。"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  err "未检测到 docker compose 插件，请安装 Docker Compose V2。"
  exit 1
fi
ok "环境检查通过"

say "步骤 1/7：准备 .deploy.env"
if [ ! -f "$ENV_FILE" ]; then
  cp compose/.deploy.env.example "$ENV_FILE"
  # 生成随机 JWT 密钥
  sed -i "s#JWT_SECRET=.*#JWT_SECRET=MP_${RANDOM}_$(date +%s)_${RANDOM}#g" "$ENV_FILE"
  ok "已创建 $ENV_FILE（请根据需要调整变量）"
else
  warn "$ENV_FILE 已存在，将直接使用"
fi

say "步骤 2/7：可选清理（旧容器/网络/数据卷）"
read -r -p "是否清理旧版本（y/N）? " yn || true
yn="${yn:-N}"
if [[ "$yn" == "y" || "$yn" == "Y" ]]; then
  docker compose -f "$COMPOSE_FILE" down -v || true
  ok "已清理"
else
  warn "跳过清理"
fi

say "步骤 3/7：构建并启动服务（可能需要几分钟）"
docker compose -f "$COMPOSE_FILE" up -d --build
ok "容器已启动"

say "步骤 4/7：数据库迁移（Alembic）"
docker compose -f "$COMPOSE_FILE" exec -T app bash -lc 'alembic -c migrations/alembic.ini upgrade head'
ok "迁移完成"

say "步骤 5/7：应用初始化（角色/管理员）"
docker compose -f "$COMPOSE_FILE" exec -T app python -m app.bootstrap
ok "初始化完成"

say "步骤 6/7：自动放行端口"
APP_PORT="$(grep '^APP_PORT=' "$ENV_FILE" | cut -d'=' -f2)"
if command -v ufw >/dev/null 2>&1; then
  if sudo ufw status | grep -q "Status: active"; then
    sudo ufw allow "${APP_PORT}"/tcp comment "minipost app" || true
    ok "已放行 UFW 端口 ${APP_PORT}/tcp"
  else
    warn "UFW 未启用，跳过放行"
  fi
else
  warn "未检测到 UFW，跳过放行"
fi

say "步骤 7/7：完成！"
echo
ok "后台地址：http://<你的服务器IP>:${APP_PORT}/admin"
echo "首次登录（API）：POST /api/auth/login { username: 'admin', password: 'Admin@123456' }"
log_hint
