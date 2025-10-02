#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/../frontend"
if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node；请先安装 Node 18+ 再试（或直接用 Docker 构建）" >&2
  exit 1
fi
npm install --no-audit --no-fund
npm run build
echo "✅ 前端构建完成：已写入 ../static/assets"
