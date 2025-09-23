#!/usr/bin/env bash
# =========================================================
# minipost 一键部署（Docker 统一版）- 带“模版编辑器”
# 说明：
#  - 新增 editor 服务（前端模版编辑器，默认端口 6006，账号/密码由 .deploy.env 控制）
#  - 模版保存即写入磁盘；后端若启用 Jinja 自动重载，保存后请求即可生效
#  - 包含：中文进度提示、二次覆盖/清理、UFW 放行、日志命令
# 适配：Ubuntu 24.04 LTS
# =========================================================

set -Eeuo pipefail

green(){ echo -e "\033[32m$*\033[0m"; }
yellow(){ echo -e "\033[33m$*\033[0m"; }
red(){ echo -e "\033[31m$*\033[0m"; }
info(){ echo "[`date +%H:%M:%S`] $*"; }

set +u
if [ -f ".deploy.env" ]; then
  set -a; . ".deploy.env"; set +a
elif [ -f "/opt/minipost/.deploy.env" ]; then
  set -a; . "/opt/minipost/.deploy.env"; set +a
fi
: "${BASE_DIR:=/opt/minipost}"
: "${REPO_URL:=https://github.com/aidaddydog/minipost.git}"
: "${SERVICE_NAME:=minipost}"
: "${APP_PORT:=8000}"
: "${EDITOR_PORT:=6006}"
: "${EDITOR_USER:=daddy}"
: "${EDITOR_PASS:=20240314AaA#}"
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"
: "${COMPOSE_PROFILES:=web,backend,postgres,editor}"
: "${AUTO_OPEN_UFW:=yes}"
: "${AUTO_PRUNE_OLD:=no}"
: "${GIT_AUTH_HEADER:=}"
export BASE_DIR SERVICE_NAME APP_PORT EDITOR_PORT COMPOSE_FILE COMPOSE_PROFILES
set -u

require() { command -v "$1" >/dev/null 2>&1 || (red "✘ 缺少 $1" && exit 1); }
require curl
require git
require docker

info "更新仓库：$BASE_DIR"
if [ ! -d "$BASE_DIR/.git" ]; then
  install -d -m 0755 "$BASE_DIR"
  git clone "$REPO_URL" "$BASE_DIR"
else
  git -C "$BASE_DIR" fetch --all
  git -C "$BASE_DIR" reset --hard origin/main
fi

ensure_env_var(){
  local k="$1" v="$2" f="${BASE_DIR}/.deploy.env"
  if [ ! -f "$f" ]; then
    echo "# minipost 部署环境（自动生成）" > "$f"
  fi
  if ! grep -q "^${k}=" "$f" 2>/dev/null; then
    echo "${k}=${v}" >> "$f"
  fi
}
ensure_env_var APP_PORT "${APP_PORT}"
ensure_env_var EDITOR_PORT "${EDITOR_PORT}"
ensure_env_var EDITOR_USER "${EDITOR_USER}"
ensure_env_var EDITOR_PASS "${EDITOR_PASS}"
ensure_env_var COMPOSE_PROFILES "${COMPOSE_PROFILES}"
ensure_env_var AUTO_OPEN_UFW "${AUTO_OPEN_UFW}"

if [ "${AUTO_PRUNE_OLD}" = "yes" ]; then
  yellow "[二次覆盖] 清理旧容器/镜像/卷（安全可选）"
  if [ -f "$COMPOSE_FILE" ]; then
    docker compose -f "$COMPOSE_FILE" down -v || true
  fi
  docker image prune -f || true
  docker volume prune -f || true
fi

if [ "${AUTO_OPEN_UFW}" = "yes" ] && command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -q "Status: active"; then
    ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    ufw allow "${EDITOR_PORT}/tcp" >/dev/null 2>&1 || true
    info "✔ 已放行 UFW 端口 ${APP_PORT}, ${EDITOR_PORT}"
  fi
fi

info "构建并启动：${COMPOSE_PROFILES//,/ + }"
if [ ! -f "$COMPOSE_FILE" ]; then
  red "✘ 未找到编排文件：$COMPOSE_FILE"
  echo "tail -n 200 /var/log/${SERVICE_NAME}-bootstrap.log   # 查看安装日志"
  exit 1
fi

set +e
COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" build --progress=auto
BUILD_RC=$?
if [ $BUILD_RC -ne 0 ]; then
  red "✘ 构建失败（EXIT_CODE=$BUILD_RC）"
  echo "docker compose -f $COMPOSE_FILE logs --tail=200"
  exit $BUILD_RC
fi

COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" up -d
UP_RC=$?
set -e

if [ $UP_RC -ne 0 ]; then
  red "✘ 启动失败（EXIT_CODE=$UP_RC）"
  docker compose -f "$COMPOSE_FILE" ps
  docker compose -f "$COMPOSE_FILE" logs --tail=200
  echo
  echo "docker compose -f $COMPOSE_FILE logs backend --tail=200   # 查看后端日志"
  echo "docker compose -f $COMPOSE_FILE logs editor --tail=200    # 查看模板编辑器日志"
  exit $UP_RC
fi

green "✔ 服务已启动"
echo
echo "管理端： http://<服务器IP>:${APP_PORT}"
echo "模版编辑器： http://<服务器IP>:${EDITOR_PORT}  （账号：${EDITOR_USER}）"
echo
echo "docker compose -f $COMPOSE_FILE ps                        # 查看容器状态"
echo "docker compose -f $COMPOSE_FILE logs backend --tail=200   # 后端日志"
echo "docker compose -f $COMPOSE_FILE logs editor --tail=200    # 模版编辑器日志"
