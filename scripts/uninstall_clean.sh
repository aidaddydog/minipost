#!/usr/bin/env bash
set -Eeuo pipefail
systemctl stop minipost.service || true
systemctl disable minipost.service || true
rm -f /etc/systemd/system/minipost.service
systemctl daemon-reload
echo "已卸载 minipost systemd 单元（数据与代码未删除）。"
