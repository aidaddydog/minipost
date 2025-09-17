# 轻量 Python 后端镜像
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 非 root 运行更安全
RUN useradd -m appuser
WORKDIR /app

COPY server/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY server /app

EXPOSE 8080
USER appuser

# 使用 uvicorn 启动
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
