# 贡献指南（简体中文）

非常欢迎你参与 minipost 的建设！

## 开发环境
- 操作系统：Ubuntu 24.04（推荐）
- 运行时：Python 3.11+
- 容器化：Docker + Compose

```bash
# 后端本地运行
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8080
```

## 提交规范
- 提交信息：`<type>: <subject>`，例如 `feat: 新增换单草稿接口`
- PR 检查：必须通过 CI（单元测试 + 构建）

## 分支策略
- `main`：稳定分支
- `feat/*`：功能开发
- `fix/*`：问题修复
- `docs/*`：文档更改
