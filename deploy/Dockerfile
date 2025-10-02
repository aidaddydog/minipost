# 多阶段构建：Node 构建前端（扫描 modules/**/frontend/react），Python 运行后端
FROM node:20-bullseye AS frontend
WORKDIR /workspace
COPY . /workspace
RUN npm install --no-audit --no-fund && npm run build

FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY . /app
COPY --from=frontend /workspace/static/assets /app/static/assets
RUN useradd -m appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
