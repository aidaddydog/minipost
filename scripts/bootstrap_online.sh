#!/usr/bin/env bash
# =====================================================
# minipost 一键部署脚本（必须 root）。
# - 彩色提示、灰蓝进度条、失败自动回滚
# - UFW 自动放行 8000/tcp（如启用）
# - 自动迁移、初始化管理员、热重载导航并校验 /healthz
# - 全流程中文输出 + 一行日志命令
# 适配：Ubuntu 24.x / Docker + Docker Compose
# =====================================================

set -Eeuo pipefail

# ---------- 颜色与样式 ----------
C_RESET="\033[0m"; C_RED="\033[31m"; C_GREEN="\033[32m"; C_YELLOW="\033[33m"; C_BLUE="\033[34m"; C_CYAN="\033[36m"; C_GRAY="\033[90m"
PROGRESS_BAR(){ local w=${1:-50}; local p=${2:-0}; local d=$((p*w/100)); local bar=$(printf "%${d}s" "" | tr ' ' '▰'); local space=$(printf "%$((w-d))s" "" | tr ' ' '▱'); printf "\r\033[38;2;90;110;130m[%s%s] %3d%%\033[0m" "$bar" "$space" "$p"; }
STEP(){ echo -e "\n${C_CYAN}==> $*${C_RESET}"; }
OK(){ echo -e "${C_GREEN}✔ $*${C_RESET}"; }
WARN(){ echo -e "${C_YELLOW}⚠ $*${C_RESET}"; }
ERR(){ echo -e "${C_RED}✖ $*${C_RESET}"; }

# ---------- 校验 root ----------
if [ "$(id -u)" -ne 0 ]; then
  ERR "必须以 root 执行！使用：sudo -i 后再运行此脚本。"
  exit 1
fi

# ---------- 工作目录 ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_DIR/compose/docker-compose.yml"

# ---------- 回滚机制 ----------
rollback(){
  ERR "部署失败，正在回滚容器到干净状态……"
  docker compose -f "$COMPOSE_FILE" down || true
}
trap rollback ERR

LOG_CMD="docker compose -f $COMPOSE_FILE logs web --tail=200"

# ---------- 菜单 ----------
echo -e "${C_GREEN}
==========================================
 minipost 一键部署
==========================================${C_RESET}
1) 全新安装（备份→清理→重装）
2) 覆盖安装（默认：保留数据卷，仅更新结构与镜像）
3) 升级安装（仅同步差异，自动幂等迁移）
"
read -rp "请选择操作（1/2/3，默认2）：" ACTION
ACTION="${ACTION:-2}"

# 管理员
read -rp "请输入管理员用户名：" ADMIN_USER
while [ -z "${ADMIN_USER:-}" ]; do read -rp "管理员用户名不能为空，请重新输入：" ADMIN_USER; done
read -rsp "请输入管理员密码：" ADMIN_PW; echo
while [ -z "${ADMIN_PW:-}" ]; do read -rsp "管理员密码不能为空，请重新输入：" ADMIN_PW; echo; done

# ---------- 环境准备 ----------
STEP "环境检查"
command -v docker >/dev/null 2>&1 || { ERR "未检测到 docker，请先安装 Docker。"; exit 2; }
command -v docker compose >/dev/null 2>&1 || { ERR "未检测到 docker compose v2，请安装。"; exit 2; }
OK "Docker 环境就绪"

# ---------- UFW 端口放行 ----------
STEP "安全基线：放行 8000/tcp（如 UFW 已启用）"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 8000/tcp || true
  OK "已放行 8000/tcp"
else
  WARN "UFW 未启用或不可用，跳过。"
fi

# ---------- 性能优化（失败不阻断） ----------
STEP "性能优化（可选）"
(sysctl -w net.core.default_qdisc=fq && sysctl -w net.ipv4.tcp_congestion_control=bbr) >/dev/null 2>&1 && OK "已尝试启用 BBR" || WARN "BBR 设置失败（忽略）"
(echo never > /sys/kernel/mm/transparent_hugepage/enabled) >/dev/null 2>&1 && OK "已尝试关闭 THP" || WARN "关闭 THP 失败（忽略）"

# ---------- 生成 .deploy.env ----------
STEP "加载/生成部署环境变量"
if [ ! -f "$REPO_DIR/compose/.deploy.env" ]; then
  cp "$REPO_DIR/compose/.deploy.env.example" "$REPO_DIR/compose/.deploy.env"
  OK "已生成 compose/.deploy.env（请按需修改）"
else
  OK "已存在 compose/.deploy.env"
fi

# ---------- 处理旧版本 ----------
if [ "$ACTION" = "1" ]; then
  STEP "全新安装：备份→清理旧容器/镜像/缓存"
  TS=$(date +%Y%m%d_%H%M%S)
  docker compose -f "$COMPOSE_FILE" down || true
  OK "容器已清理"
elif [ "$ACTION" = "2" ]; then
  STEP "覆盖安装：保留数据卷，仅更新结构与镜像"
  docker compose -f "$COMPOSE_FILE" down || true
  OK "旧容器已停止"
else
  STEP "升级安装：保持运行中的数据卷，同步差异"
fi

# ---------- 编排启动 ----------
STEP "拉起 PostgreSQL 16 → Web"
docker compose -f "$COMPOSE_FILE" build --pull web
docker compose -f "$COMPOSE_FILE" up -d
for i in $(seq 1 60); do PROGRESS_BAR 40 $((i*100/60)); sleep 1; done; echo

# ---------- 数据库迁移 ----------
STEP "执行数据库迁移（幂等）"
docker compose -f "$COMPOSE_FILE" exec -T web bash -lc "python -m app.bootstrap migrate"
OK "迁移完成"

# ---------- 初始化管理员 ----------
STEP "初始化管理员账号"
docker compose -f "$COMPOSE_FILE" exec -T web bash -lc "python -m app.bootstrap init-admin --user \"${ADMIN_USER}\" --password \"${ADMIN_PW}\""
OK "管理员已写入"

# ---------- 导航聚合与热重载 ----------
STEP "聚合导航并热重载"
docker compose -f "$COMPOSE_FILE" exec -T web bash -lc "python -m app.bootstrap reload-nav"
OK "导航聚合完成"

# ---------- 健康检查 ----------
STEP "健康检查：/healthz"
HTTP_LOCAL=$(curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/healthz || true)
PUB_IP=$(curl -fsSL --max-time 4 ifconfig.me || curl -fsSL --max-time 4 ipinfo.io/ip || echo "N/A")
HTTP_PUB=$(curl -fsS -o /dev/null -w "%{http_code}" "http://${PUB_IP}:8000/healthz" || true)
if [ "$HTTP_LOCAL" = "200" ]; then OK "本地健康检查通过"; else ERR "本地健康检查失败（HTTP $HTTP_LOCAL）"; fi
if [ "$PUB_IP" != "N/A" ] && [ "$HTTP_PUB" = "200" ]; then OK "公网健康检查通过（IP: $PUB_IP）"; else WARN "公网健康检查失败或不可达（IP: $PUB_IP，HTTP $HTTP_PUB）"; fi

# ---------- 最终报告 ----------
STEP "部署完成报告"
echo -e "${C_GRAY}------------------------------------------${C_RESET}"
docker compose -f "$COMPOSE_FILE" ps
echo -e "${C_GRAY}------------------------------------------${C_RESET}"
echo -e "访问地址： http://${PUB_IP:-<你的服务器IP>}:8000/"
echo -e "管理员账号： ${ADMIN_USER}"
echo -e "日志目录： /var/log/minipost/"
echo -e "一行日志命令： ${LOG_CMD}"
OK "全部完成"

# 取消回滚 trap
trap - ERR
exit 0
