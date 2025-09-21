#!/usr/bin/env bash
set -Eeuo pipefail
read -r -p "确认卸载 minipost（会停止服务并删除 /opt/minipost*）? [y/N] " ans
if [[ "$ans" != "y" && "$ans" != "Y" ]]; then echo "取消"; exit 0; fi
systemctl stop minipost.service 2>/dev/null || true
systemctl disable minipost.service 2>/dev/null || true
rm -f /etc/systemd/system/minipost.service
systemctl daemon-reload
rm -rf /opt/minipost /opt/minipost-data
echo "已卸载（备份保留于 /opt/minipost-backups，如需手动清理请谨慎操作）"
