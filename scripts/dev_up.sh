#!/usr/bin/env bash
set -euo pipefail
echo "[dev] 使用 deploy/docker-compose.yml 启动"
docker compose -f deploy/docker-compose.yml up -d --build
echo "[dev] 访问 http://localhost/  Swagger: http://localhost/docs"
