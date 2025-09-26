# 多阶段简化：实际只需一层即可；确保容器内非 root 运行
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 安装基础依赖（尽量精简）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates build-essential \
  && rm -rf /var/lib/apt/lists/*

# 工作目录
WORKDIR /app

# 复制整个仓库（修复原 COPY 断行问题）
COPY . /app

# 安装后端依赖（固定核心版本以提升可预期性）
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

# 创建最小权限用户并切换（满足“容器内进程非 root”）
RUN useradd -m appuser
USER appuser

EXPOSE 8000

# 直接启动 uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
