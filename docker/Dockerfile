# syntax=docker/dockerfile:1
FROM python:3.11-slim

RUN set -eux;     apt-get update;     apt-get install -y --no-install-recommends curl ca-certificates netcat-openbsd tini;     rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1

RUN useradd -ms /bin/bash appuser
WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

RUN mkdir -p /logs /data && chown -R appuser:appuser /app /logs /data
USER appuser

EXPOSE 8000
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["bash","-lc","scripts/entrypoint.sh"]
