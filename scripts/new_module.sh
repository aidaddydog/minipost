#!/usr/bin/env bash
# 新增模块脚手架：scripts/new_module.sh <mod_name_snake>
set -e
MOD=${1:?用法：scripts/new_module.sh <mod_name_snake>}
BASE="modules/${MOD}"
echo "[脚手架] 创建模块：$MOD"
mkdir -p "$BASE/config" "$BASE/backend/models" "$BASE/backend/services" "$BASE/backend/routers" "$BASE/frontend/templates" "$BASE/frontend/static" "migrations/versions-${MOD}"
cat > "$BASE/config/module.meta.yaml" <<EOF
name: "${MOD}"
title: "${MOD}"
version: "0.1.0"
api_prefix: "/api/${MOD}"
enabled: true
permissions:
  - "${MOD}:page:view"
  - "${MOD}:data:list"
migrations_path: "migrations/versions-${MOD}/"
EOF
cat > "$BASE/config/menu.register.yaml" <<EOF
/${MOD}:
  - text: "${MOD}"
    href: "/${MOD}"
    order: 100
    icon: ""
EOF
cat > "$BASE/config/tabs.register.yaml" <<EOF
"/${MOD}":
  - {{ key: "list", text: "列表", href: "/${MOD}/list", order: 10 }}
EOF
cat > "$BASE/config/permissions.register.yaml" <<EOF
"${MOD}:page:view": "访问页面"
"${MOD}:data:list": "查看列表"
EOF
echo "[脚手架] 完成。请执行：scripts/reload_nav.sh  # 热重载导航"
