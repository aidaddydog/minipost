补丁内容（92 版导航样式修复）：

1) 调整 CSS 引入顺序（index.css）：
   - 将 @import "../../../../_themes/default/_63_vars_patch.css";
     与 @import "./_nav_effects.css";
     提前到文件顶部（root.css 导入之后），避免浏览器忽略底部 @import 导致导航变量与动效样式未生效。

2) 修正 TopNav.tsx 中 L1 分隔线变量名：
   - 从 var(--nav-l1-sep) 更正为 var(--nav-l1-border)，与主题 root.css 保持一致。

应用步骤（/opt/minipost 为仓库目录）：
   unzip -o /root/minipost_navfix_92.zip -d /opt/minipost
   docker compose -f /opt/minipost/deploy/docker-compose.yml build web
   systemctl restart minipost.service

验证：
   - 登录后访问 /
   - 顶部 L1 胶囊 Pill、L2 行、L3 Tabs 下划线 Ink 均正常显示、随 hover/点击联动。
   - 开发者工具 Network 查看 /static/assets/**.css 已成功加载，Elements 能看到 .nav-rail .pill / .tabs .tab-ink 样式。
