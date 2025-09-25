from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    # 基础
    app_env: str = "prod"
    app_host: str = "0.0.0.0"
    app_port: int = 8080

    # 数据库
    database_url: str = "postgresql+psycopg2://minipost:minipost@db:5432/minipost"

    # 安全
    jwt_secret: str = "CHANGE_ME_SECRET"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 7200

    # 初始化超级管理员
    first_superuser: str = "admin"
    first_superuser_password: str = "Admin@123456"

    # CORS
    allow_origins: str = "*"

    class Config:
        env_file = None  # docker compose 中使用 env_file 载入
        extra = "ignore"

settings = Settings()
