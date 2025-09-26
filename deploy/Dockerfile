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

# 先装依赖，加速缓存命中
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# 再复制应用源码
COPY . /app

# 创建最小权限用户并切换（满足“容器内进程非 root”）
RUN useradd -m appuser
USER appuser

EXPOSE 8000

# 直接启动 uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
