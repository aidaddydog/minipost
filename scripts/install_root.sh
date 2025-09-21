#!/usr/bin/env bash
set -Eeuo pipefail

BASE="${BASE:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$BASE"
source .venv/bin/activate

mkdir -p logs pdfs updates runtime

# systemd 已由 bootstrap_online.sh 安装；此处仅确保可启动
echo "minipost 安装完成于 $BASE"
