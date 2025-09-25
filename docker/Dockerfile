# syntax=docker/dockerfile:1.6
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=on PIP_NO_CACHE_DIR=on
RUN apt-get update && apt-get install -y --no-install-recommends curl tzdata build-essential gcc libpq-dev ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt
RUN useradd -m appuser
USER appuser
COPY . /app
EXPOSE 8000
CMD ["bash", "-lc", "python -m app.bootstrap rebuild-nav || true; gunicorn -w ${APP_WORKERS:-2} -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 app.main:app"]
