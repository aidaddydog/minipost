# minipost · 导航聚合一键修复包（新 Schema）

本修复包做了**端到端**修复：
- 后端：递归扫描 `modules/**/config`，统一用 **新 Schema**（`menu`/`tabs` 对象映射）聚合；
- 接口：`/api/nav` 直接返回 **老前端需要的 `items[]`**（同时保留新结构 `menu/tabs`）；
- 预检：`scripts/validate_modules.py` 改为调用 `rebuild_nav` 统一校验并输出 `__SCHEMA_OK__`；
- 脚本：`scripts/reload_nav.sh` 更新为递归提示并调用；
- YAML：示例模块已改成新 Schema。

## 覆盖步骤

> 假设你的仓库在 `/opt/minipost`，服务方式为 systemd 或 docker compose。

```bash
# 1) 备份
sudo mkdir -p /opt/backup && sudo tar -C /opt -czf /opt/backup/minipost-backup.$(date +%F-%H%M).tgz minipost || true

# 2) 解压覆盖
unzip -o minipost_nav_full_fix_20250927.zip -d /opt/minipost

# 3) 确保启用真实导航
cd /opt/minipost
grep -q '^USE_REAL_NAV=' .deploy.env || echo "USE_REAL_NAV=true" >> .deploy.env
sed -i 's/^USE_REAL_NAV=.*/USE_REAL_NAV=true/' .deploy.env || true

# 4) 预检 + 生成缓存
python3 scripts/validate_modules.py | tail -n +1

# 5) 重启服务
# systemd：
sudo systemctl restart minipost
# 或 docker compose：
# docker compose -f deploy/docker-compose.yml up -d --build

# 6) 冒烟测试
bash scripts/smoke_nav.sh http://127.0.0.1:8000
```

**接口预期：**
```
items.len = 1
menu.keys = ['物流']
tabs.keys = ['/logistics/channel']
L1[0] = {'level': 1, 'title': '物流', 'path': '/logistics', 'order': 1}
```

## 注意事项

- 如果 `/api/nav` 返回 401/302，请先在浏览器完成登录；`curl` 默认没带 cookie。浏览器端会话正常时，前端能正常渲染。
- 如需变更缓存位置，设置环境变量：
  - `NAV_CACHE_DIR=/tmp` 或 `NAV_CACHE_FILE=/tmp/nav.json`；
- 若前端仍显示空，请在浏览器 DevTools → Network 勾选 *Disable cache* 后强制刷新；
- 三级目录要生效，务必将 `tabs.register.yaml` 写为：
  ```yaml
  "/<你的二级路径>":
    - key: <tab_key>
      text: <显示文案>
      href: /<你的二级路径>/<三级路径>
      order: 1
  ```
