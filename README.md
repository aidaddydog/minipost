# minipost（模块化 UI + FastAPI）
- UI 从 `minipost-ui.html` 精准拆分，像素级复刻。
- 仅在接口层适配；目录结构与模块命名严格对齐你的清单。
- 一键部署：带进度提示、日志、端口自动放行与简易回滚脚本。

## 一键部署（ZIP 已上传到服务器）
```bash
sudo bash -c 'unzip -o minipost.zip -d /opt && cd /opt/minipost && ./scripts/bootstrap_online.sh'
```
> 如果已存在 `/opt/minipost`：`sudo bash /opt/minipost/scripts/bootstrap_online.sh`

访问：`http://<服务器IP>:8000/admin`
