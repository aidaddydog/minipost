#!/usr/bin/env bash
# =========================================================
# minipost 一键部署（Docker 统一版）
# 说明：
#  - 修复 set -u 下 BASE_DIR 未赋值导致的报错
#  - 加入：中文进度提示、二次覆盖/清理、UFW 放行、日志打印、失败时一行日志命令
#  - 默认使用 deploy/docker-compose.yml 启动 web + backend + postgres
# 适配：Ubuntu 24.04 LTS
# =========================================================

set -Eeuo pipefail

# ---------- 公用输出样式 ----------
green(){ echo -e "\033[32m$*\033[0m"; }
yellow(){ echo -e "\033[33m$*\033[0m"; }
red(){ echo -e "\033[31m$*\033[0m"; }
info(){ echo "[`date +%H:%M:%S`] $*"; }

# ---------- 宽松加载环境，再补默认，最后回到严格 ----------
set +u
if [ -f ".deploy.env" ]; then
  set -a; . ".deploy.env"; set +a
elif [ -f "/opt/minipost/.deploy.env" ]; then
  set -a; . "/opt/minipost/.deploy.env"; set +a
fi
# 关键变量默认值（如果 .deploy.env 已定义则不覆盖）
: "${BASE_DIR:=/opt/minipost}"
: "${REPO_URL:=https://github.com/aidaddydog/minipost.git}"
: "${SERVICE_NAME:=minipost}"
: "${APP_PORT:=8000}"
: "${COMPOSE_FILE:=${BASE_DIR}/deploy/docker-compose.yml}"
: "${COMPOSE_PROFILES:=web,backend,postgres}"
: "${AUTO_OPEN_UFW:=yes}"         # yes/no：自动放行端口
: "${AUTO_PRUNE_OLD:=no}"         # yes/no：二次覆盖时清理旧容器/镜像/卷
: "${GIT_AUTH_HEADER:=}"          # 可选：私仓时用
export BASE_DIR SERVICE_NAME APP_PORT COMPOSE_FILE COMPOSE_PROFILES
set -u

# ---------- 前置检查 ----------
require() { command -v "$1" >/dev/null 2>&1 || (red "✘ 缺少 $1" && exit 1); }
require curl
require git
require docker

# Docker Hub 访问检查（非致命）
if ! timeout 3 bash -lc 'docker pull --quiet hello-world >/dev/null 2>&1'; then
  yellow "⚠ 访问 Docker Hub 失败，后续构建可能较慢或失败，请准备镜像源"
else
  green "✔ Docker 可用"
fi

# ---------- 拉取/更新仓库 ----------
info "更新仓库：$BASE_DIR"
if [ ! -d "$BASE_DIR/.git" ]; then
  install -d -m 0755 "$BASE_DIR"
  if [ -n "$GIT_AUTH_HEADER" ]; then
    # 走 GitHub API 原始内容授权（可选）
    git clone "$REPO_URL" "$BASE_DIR"
  else
    git clone "$REPO_URL" "$BASE_DIR"
  fi
else
  git -C "$BASE_DIR" fetch --all
  git -C "$BASE_DIR" reset --hard origin/main
fi

# ---------- 可选二次覆盖清理 ----------
if [ "${AUTO_PRUNE_OLD}" = "yes" ]; then
  yellow "[二次覆盖] 清理旧容器/镜像/卷（安全可选）"
  if [ -f "$COMPOSE_FILE" ]; then
    docker compose -f "$COMPOSE_FILE" down -v || true
  fi
  docker image prune -f || true
  docker volume prune -f || true
fi

# ---------- UFW 放行 ----------
if [ "${AUTO_OPEN_UFW}" = "yes" ] && command -v ufw >/dev/null 2>&1; then
  if ufw status | grep -q "Status: active"; then
    ufw allow "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    info "✔ 已放行 UFW 端口 ${APP_PORT}"
  fi
fi

# ---------- 启动编排 ----------
info "启动编排：${COMPOSE_PROFILES//,/ + }"
if [ ! -f "$COMPOSE_FILE" ]; then
  red "✘ 未找到编排文件：$COMPOSE_FILE"
  echo "建议执行：tail -n 200 /var/log/${SERVICE_NAME}-bootstrap.log   # 查看安装日志"
  exit 1
fi

set +e
DOCKER_DEFAULT_PLATFORM=${DOCKER_DEFAULT_PLATFORM:-} COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" build --progress=auto
BUILD_RC=$?
if [ $BUILD_RC -ne 0 ]; then
  red "✘ 构建失败（EXIT_CODE=$BUILD_RC）"
  echo "快速查看构建日志：docker compose -f $COMPOSE_FILE logs --tail=200"
  exit $BUILD_RC
fi

COMPOSE_PROFILES="$COMPOSE_PROFILES" docker compose -f "$COMPOSE_FILE" up -d
UP_RC=$?
set -e

if [ $UP_RC -ne 0 ]; then
  red "✘ 编排启动失败（EXIT_CODE=$UP_RC）。以下为最近输出，便于快速定位："
  docker compose -f "$COMPOSE_FILE" ps
  docker compose -f "$COMPOSE_FILE" logs --tail=200
  echo
  echo "# 一键查看 backend 日志（复制执行）："
  echo "docker compose -f $COMPOSE_FILE logs backend --tail=200    # 查看后端容器日志"
  exit $UP_RC
fi

green "✔ 服务已启动"
echo
echo "# 常用检查命令："
echo "docker compose -f $COMPOSE_FILE ps                         # 查看容器状态"
echo "docker compose -f $COMPOSE_FILE logs backend --tail=200    # 查看后端日志"
echo "docker compose -f $COMPOSE_FILE logs db --tail=200         # 查看数据库日志"
echo
echo "打开 http://<你的服务器IP>:${APP_PORT} 访问管理端"
