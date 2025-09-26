# 多阶段构建：确保最终镜像非 root 运行
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 基础依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# 应用目录
WORKDIR /app

# ★修复点：必须是一行，把整个仓库拷贝进镜像内的 /app
COPY . /app

# 直接安装依赖（固定核心包）
RUN pip install --no-cache-dir \
    fastapi==0.115.0 \
    uvicorn==0.30.6 \
    "sqlalchemy>=2.0,<2.1" \
    alembic==1.13.2 \
    passlib[bcrypt]==1.7.4 \
    PyJWT==2.8.0 \
    pydantic-settings==2.3.4 \
    jinja2==3.1.4 \
    pyyaml==6.0.2 \
    psycopg2-binary==2.9.9 \
    requests==2.32.3 \
    python-multipart==0.0.9

# 非 root 用户
RUN useradd -m appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
