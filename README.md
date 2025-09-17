# minipost

> 面向跨境电商“换单服务器/客户端”场景的 **极简起步仓库**（支持一键部署、Docker、UFW 放行、日志、二次覆盖更新）。  
> 适配 **Ubuntu 24.04 LTS**，默认使用 **1Panel + Docker Compose** 运维。

---

## 零基础快跑（5 步）
1. **注册 GitHub 账号**（若已注册跳过）。  
   打开 GitHub，按页面提示注册并完成邮箱验证。
2. **在本地或服务器生成 SSH 密钥**（推荐）：  
   运行 `ssh-keygen -t ed25519 -C "你的邮箱"`，一路回车；将输出的公钥（`~/.ssh/id_ed25519.pub`）添加到 GitHub 的 *SSH Keys* 中。
3. **创建仓库 `minipost`**（推荐私有）：  
   打开 GitHub → 右上角 **+** → **New repository** → Repository name 填写 `minipost` → 勾选 *Add a README* → Create。
4. **上传本仓库骨架代码**（两选一）：  
   - **A. 直接在服务器推送（SSH）**  
     ```bash
     # 克隆你的空仓库（把 <你的用户名> 替换为 GitHub 用户名）
     git clone git@github.com:<你的用户名>/minipost.git
     cd minipost

     # 将本地骨架代码（本 README 所在压缩包解压后的目录）拷贝进来后提交：
     git add .
     git commit -m "feat: 初始化 minipost 骨架"
     git push origin main
     ```
   - **B. 网页上传**：在 GitHub 仓库页面 → “Add file” → “Upload files”，把解压后的所有文件拖进去并提交。
5. **一键部署（Ubuntu 服务器）**  
   ```bash
   cd /opt && sudo mkdir -p /opt/minipost && sudo chown -R $USER:$USER /opt/minipost
   # 将仓库克隆/同步到 /opt/minipost 后
   cd /opt/minipost
   bash scripts/deploy_onekey.sh
   ```
   *脚本会自动安装 Docker/Compose、放行 80/443 端口、启动反向代理与后端服务，并记录日志到 `/var/log/minipost_deploy.log`。*

> ⚠️ **安全提示**：切勿把任何服务器密码/密钥提交到 GitHub！本仓库 `.gitignore` 已排除常见敏感文件，但仍请谨慎。

---

## 仓库结构
```
minipost/
├─ docs/                      # 文档区（含“换单服务器/客户端”规范占位）
│  ├─ 服务器.md
│  ├─ 客户端.md
│  └─ 架构总览.md
├─ server/                    # 后端（FastAPI）
│  ├─ app/main.py
│  ├─ requirements.txt
│  ├─ Dockerfile
│  └─ tests/test_health.py
├─ client/                    # 前端（极简静态页，反代到 /api）
│  └─ index.html
├─ reverse-proxy/             # Caddy 反向代理（默认仅 HTTP，域名后再开 HTTPS）
│  └─ Caddyfile
├─ docker-compose.yml         # 一键编排（server + caddy）
├─ scripts/
│  ├─ deploy_onekey.sh        # 一键部署（带进度、日志、UFW 放行、二次覆盖）
│  └─ bootstrap_github.sh     # 新手用“创建仓库并推送”的辅助脚本
├─ .github/workflows/ci.yml   # CI：后端测试 + 镜像构建
├─ .gitignore
├─ CONTRIBUTING.md
├─ SECURITY.md
└─ LICENSE
```

## 快速验证
- 本机/服务器访问：`http://<服务器IP>` → 前端欢迎页  
- 健康检查：`curl http://<服务器IP>/api/v1/health`

## 下一步
- 将你的业务蓝图与 **最新 MD 文档** 内容粘贴到 `docs/服务器.md`、`docs/客户端.md`。  
- 在 `server/app/main.py` 中逐步补全“换单”接口逻辑；在 `client/index.html` 中对接后端 API。  
- 若有域名，参考 `reverse-proxy/Caddyfile` 注释开启 **HTTPS**。

---

## 许可证
本项目采用 **MIT License**，可自由商用与二次开发。
