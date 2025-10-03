minipost v94 — 导航卡死“加载导航中…” 热修复补丁
================================================

问题根因（v94）：
1) 前端只显示“加载导航中…”是因为 /api/nav 返回异常或结构不合规，前端一直停在 skeleton。
2) v1 nav 接口依赖了不存在的 load_nav()，导致 500。前端 fetch 失败但没有跳转，故停留在 skeleton。

修复内容：
- app/api/v1/nav.py：不再使用 load_nav()，改为使用 app.common.utils.get_nav_cache/refresh_nav_cache，
  仅输出新框架 {menu, tabs, stats, ts}。彻底移除 items/children 兼容。
- 前端：YamlRouter/ShellLayout/TopNav/SubNav/PageTabs 全量覆盖，确保仅消费新 Schema；
  并在 /api/nav 拉取失败时显示明确错误提示（而不是一直“加载导航中…”）。
- 样式：确保 index.css 顶部引入 root.css/_63_vars_patch.css/_nav_effects.css。

应用步骤：
1) 上传本补丁到服务器（假设放在 /root/）
   cd /opt/minipost
   unzip -o /root/minipost_nav_hotfix_v94.zip -d /opt/minipost

2) 重建 Web 并重启
   docker compose -f deploy/docker-compose.yml build web
   systemctl restart minipost.service

3) 验证
   curl -s http://127.0.0.1:8000/api/nav | jq .   # 仅有 menu/tabs/stats/ts，无 items
   访问系统，登录后应看到完整胶囊导航与页签 Ink 动效。

