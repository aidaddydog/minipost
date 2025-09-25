# 基于 Python 3.11 slim
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1         PYTHONUNBUFFERED=1         PIP_NO_CACHE_DIR=1

# 时区与基础依赖
RUN apt-get update && apt-get install -y --no-install-recommends         curl ca-certificates build-essential libpq-dev tzdata tini         && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 非 root 用户
RUN useradd -ms /bin/bash appuser
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
