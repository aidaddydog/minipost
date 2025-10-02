# 多阶段构建：先前端（Node 20）再后端（Python 3.11）
FROM node:20-bullseye AS frontend
WORKDIR /frontend
COPY frontend/ ./
RUN npm install --no-audit --no-fund && npm run build

FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Python 依赖优先缓存
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
# 应用源码
COPY . /app
# 前端产物注入到静态目录
COPY --from=frontend /frontend/dist /app/static/assets
# 非 root 用户
RUN useradd -m appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
