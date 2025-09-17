#!/usr/bin/env bash
# ------------------------------------------------------------
# bootstrap_github.sh
# 新手友好的 GitHub 仓库创建与初次推送辅助脚本
#
# 功能：
# 1) 检测/安装 git、curl、ssh-keygen、jq（若可用）
# 2) 生成 SSH 密钥（若不存在），引导添加到 GitHub
# 3) 以两种方式创建仓库并推送：
#    - A: 使用 gh CLI（交互式登录，最省心）
#    - B: 使用 GitHub API + 个人访问令牌（GITHUB_TOKEN）
# 4) 进度提示、中文注释、日志记录
# ------------------------------------------------------------

set -euo pipefail
LOG_FILE="/var/log/minipost_bootstrap.log"
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

# ---------- UI ----------
green(){ printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
red(){ printf "\033[31m%s\033[0m\n" "$*"; }
step(){ green "\n==> $*"; }
info(){ echo " • $*"; }

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    yellow "未检测到 $1，正在安装..."
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update -y
      sudo apt-get install -y "$1" || true
    fi
  fi
}

step "环境检测"
need_cmd git
need_cmd curl
need_cmd ssh-keygen
need_cmd jq || true

step "准备 SSH 密钥（若不存在）"
SSH_DIR="$HOME/.ssh"
PUB="$SSH_DIR/id_ed25519.pub"
KEY="$SSH_DIR/id_ed25519"
if [ ! -f "$PUB" ]; then
  info "生成新的 Ed25519 SSH 密钥..."
  mkdir -p "$SSH_DIR"
  ssh-keygen -t ed25519 -C "${USER:-minipost}@bootstrap" -f "$KEY" -N ""
  info "已生成：$PUB"
else
  info "已存在 SSH 公钥：$PUB"
fi

PUBKEY_CONTENT=$(cat "$PUB")
yellow "请将以下公钥添加到 GitHub → Settings → SSH and GPG keys："
echo "----------------------------------------------------------------"
echo "$PUBKEY_CONTENT"
echo "----------------------------------------------------------------"
read -r -p "已完成添加？(回车继续)" _

# 仓库名
REPO_NAME="minipost"

step "选择创建方式"
cat <<'EOF'
A) 使用 GitHub CLI（推荐）：
   1. 安装 gh： sudo apt-get install -y gh
   2. 登录：     gh auth login
   3. 创建推送： gh repo create minipost --private --source . --push --remote origin

B) 使用 GitHub API：
   需要环境变量 GITHUB_TOKEN（scopes: repo, admin:public_key），以及 GitHub 用户名 GITHUB_USER。

EOF

read -r -p "请输入方式 (A/B，默认A): " METHOD
METHOD=${METHOD:-A}

if [[ "$METHOD" =~ ^[Aa]$ ]]; then
  need_cmd gh
  step "gh 登录（如未登录会提示）"
  gh auth status || gh auth login
  step "创建或使用现有仓库：$REPO_NAME"
  # 若仓库已存在，gh 会给予提示；首次会创建并推送
  gh repo create "$REPO_NAME" --private --source . --push --remote origin || true
  green "完成：已尝试使用 gh 创建并推送。"
else
  : "${GITHUB_TOKEN:?请先导出 GITHUB_TOKEN，例如：export GITHUB_TOKEN=xxxx }"
  : "${GITHUB_USER:?请先导出 GITHUB_USER，例如：export GITHUB_USER=yourname }"

  step "通过 API 创建仓库（若已存在会失败可忽略）"
  CREATE_REPO_RESP=$(curl -sS -X POST "https://api.github.com/user/repos" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -d "{\"name\":\"$REPO_NAME\",\"private\":true}")
  echo "$CREATE_REPO_RESP" | jq .name 2>/dev/null || true

  step "设置 git 远端并推送"
  git init
  git add .
  git commit -m "feat: 初始化 minipost 骨架" || true
  git branch -M main
  git remote remove origin 2>/dev/null || true
  git remote add origin "git@github.com:$GITHUB_USER/$REPO_NAME.git"
  git push -u origin main
  green "完成：仓库已推送到 https://github.com/$GITHUB_USER/$REPO_NAME"
fi

green "Bootstrap 结束。日志：$LOG_FILE"
