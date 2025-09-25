# -*- coding: utf-8 -*-
"""应用配置（基于 pydantic-settings）。
- 读取 compose/.deploy.env 中的环境变量作为运行参数
- 注：部署脚本会生成/更新 .deploy.env
"""
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    APP_NAME: str = "minipost"
    APP_PORT: int = 8000
    SECRET_KEY: str = Field(default="ChangeMe_SecretKey_0123456789")
    DATABASE_URL: str = Field(default="postgresql+psycopg2://minipost:ChangeMe123@postgres:5432/minipost")
    TIMEZONE: str = "UTC"

    class Config:
        env_file = "compose/.deploy.env"
        env_file_encoding = "utf-8"

settings = Settings()
