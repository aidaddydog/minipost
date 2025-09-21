#!/usr/bin/env bash
set -Eeuo pipefail
read -p "确认卸载 minipost 并清理 systemd? (y/N) " -r ans
[[ "$ans" == "y" || "$ans" == "Y" ]] || exit 0
systemctl disable --now minipost.service || true
rm -f /etc/systemd/system/minipost.service
systemctl daemon-reload
echo "完成卸载（数据目录未删除）。"
