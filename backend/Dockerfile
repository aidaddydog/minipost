FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# 应用 & 启动脚本
COPY app /app/app
RUN chmod +x /app/app/entrypoint.sh

# Alembic 配置与脚本
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

ENV PYTHONPATH=/app:$PYTHONPATH
EXPOSE 8000
CMD ["/app/app/entrypoint.sh"]
