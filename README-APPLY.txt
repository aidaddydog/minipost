# v95 前端覆盖补丁（导航 100% 复刻设计稿）

**放置到仓库根**，执行：
```bash
unzip -o minipost_nav_v95_full_override.zip -d /opt/minipost
docker compose -f deploy/docker-compose.yml build web
systemctl restart minipost.service
```
确保样式入口已被页面引入：
```
modules/navauth_shell/frontend/react/styles/index.css
```
