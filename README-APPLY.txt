minipost v93 — 新框架清理补丁（移除 items/children 兼容 + 修复导航聚合 + 构建错误）
=====================================================================

目标：
1) 前端只消费新 Schema（nav.menu 为对象，nav.tabs 为对象），彻底不再读取 items/children。
2) 修复 ShellLayout.tsx 构建错误（Unexpected "}"}）并保证胶囊导航/Ink 动效正常。
3) （可选）后端 /api/nav 仅输出 menu/tabs/stats，不再返回 items（彻底移除旧兼容）。

覆盖内容：
- modules/_themes/default/_63_vars_patch.css
- modules/navauth_shell/frontend/react/styles/_nav_effects.css
- modules/navauth_shell/frontend/react/styles/index.css
- modules/navauth_shell/frontend/react/app/ShellLayout.tsx
- modules/navauth_shell/frontend/react/app/YamlRouter.tsx
- modules/navauth_shell/frontend/react/app/components/TopNav.tsx
- modules/navauth_shell/frontend/react/app/components/SubNav.tsx
- modules/navauth_shell/frontend/react/app/components/PageTabs.tsx
- （可选覆盖）app/api/v1/nav.py  —— 去掉 items/children 兼容输出

应用步骤（服务器上）：
  # 1) 上传本 zip 到服务器（假设放在 /root/）
  cd /opt/minipost
  unzip -o /root/minipost_newframework_cleanup_v93.zip -d /opt/minipost

  # 2) 仅重建 web 并重启服务（不动数据库）
  docker compose -f deploy/docker-compose.yml build web
  systemctl restart minipost.service

  # 3) 刷新聚合（可选）
  bash scripts/reload_nav.sh

  # 4) 验证
  curl -s http://127.0.0.1:8000/api/nav | head -n 50
  docker compose -f deploy/docker-compose.yml logs web --tail=200

注意：如果你暂时不想改后端，只覆盖前端文件也能正常工作。
