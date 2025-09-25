\
#!/usr/bin/env bash
set -Eeuo pipefail
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
LOG_DIR="/var/log/minipost"; mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"; LOG_FILE="$LOG_DIR/bootstrap.${STAMP}.log"
RED="\033[31m"; GREEN="\033[32m"; YEL="\033[33m"; BLUE="\033[34m"; GRAY="\033[90m"; NC="\033[0m"
tail -n 5 -f "$LOG_FILE" & TAIL_PID=$!

trap 'echo -e "\n${RED}✘ 脚本异常${NC}"; echo -e "查看日志（复制执行）：${YEL}tail -n 200 \"$LOG_FILE\"${NC}"; kill $TAIL_PID >/dev/null 2>&1 || true' ERR

echo -e "${BLUE}[STEP] 0. 审前检查${NC}" | tee -a "$LOG_FILE"
if [[ $EUID -ne 0 ]]; then echo -e "${RED}请使用 root 运行${NC}" | tee -a "$LOG_FILE"; exit 1; fi

echo -e "${BLUE}[STEP] 1. 选择模式${NC}"
echo -e "${GREEN}1${NC} 全新安装  ${GREEN}2${NC} 覆盖安装  ${GREEN}3${NC} 回滚修复"
read -rp "输入 1/2/3：" MODE
[[ "$MODE" =~ ^[123]$ ]] || { echo -e "${RED}输入无效${NC}"; exit 1; }

cd "$BASE_DIR/compose"
[[ -f .deploy.env ]] || cp .deploy.env.example .deploy.env

if [[ "$MODE" == "1" ]]; then
  docker compose down -v >>"$LOG_FILE" 2>&1 || true
  docker system prune -f >>"$LOG_FILE" 2>&1 || true
elif [[ "$MODE" == "3" ]]; then
  bash "$BASE_DIR/scripts/restore_pg.sh" >>"$LOG_FILE" 2>&1 || true
fi

docker compose pull >>"$LOG_FILE" 2>&1 || true
docker compose up -d --build >>"$LOG_FILE" 2>&1

# 开放防火墙
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then ufw allow 8000/tcp >>"$LOG_FILE" 2>&1 || true; fi

kill $TAIL_PID >/dev/null 2>&1 || true
echo -e "${GREEN}✔ 部署完成${NC} 访问：http://<服务器IP>:8000/admin"
echo -e "—— 查看部署日志（复制执行）：${YEL}tail -n 200 \"$LOG_FILE\"${NC}"

# 初始化管理员（交互式）
cd "$BASE_DIR/compose" && docker compose exec -T web python -m app.bootstrap --init-admin
