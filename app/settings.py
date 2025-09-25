# -*- coding: utf-8 -*-
"""
应用设置（读取 .env/.deploy.env 环境变量），统一输出中文注释；默认生产取向。
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path

class Settings(BaseSettings):
    APP_NAME: str = "minipost"
    APP_VERSION: str = "0.1.0"
    ENV: str = Field(default="prod", description="环境：dev/prod")
    SECRET_KEY: str = Field(default="changeme-please", description="JWT/签名密钥")
    JWT_EXPIRE_MINUTES: int = 720
    
    # 数据库（PostgreSQL 16）
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "minipost"
    POSTGRES_USER: str = "minipost"
    POSTGRES_PASSWORD: str = "minipost"
    DB_ECHO: bool = False

    # 日志目录（容器内挂载到 /var/log/minipost）
    LOG_DIR: Path = Path("/var/log/minipost")

    # CORS：开发期放开，生产可收紧
    CORS_ALLOW_ORIGINS: str = "*"

    class Config:
        env_file = "compose/.deploy.env"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
settings.LOG_DIR.mkdir(parents=True, exist_ok=True)
