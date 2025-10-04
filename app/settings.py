# -*- coding: utf-8 -*-
"""
应用配置（环境变量）
- 所有部署相关由 .deploy.env 注入
- 本服务仅支持 PostgreSQL（16.x），不支持 SQLite
"""
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # 宿主机侧端口/主题/开关
    APP_HOST: str = Field(default="0.0.0.0")
    APP_PORT: int = Field(default=8000)
    THEME_NAME: str = Field(default="default")

    # DB（强制 Postgres）
    DB: str = Field(default="postgres")
    PG_HOST: str = Field(default="postgres")
    PG_PORT: int = Field(default=5432)
    PG_DB: str = Field(default="minipost")
    PG_USER: str = Field(default="minipost")
    PG_PASSWORD: str = Field(default="changeme")  # 部署脚本会写强口令

    # 其它
    USE_REAL_NAV: bool = Field(default=False)
    UFW_OPEN: bool = Field(default=True)
    JWT_SECRET: str = Field(default="change-me-by-bootstrap")
    JWT_EXPIRES_MINUTES: int = Field(default=8 * 60)  # 8 小时
    ENVIRONMENT: str = Field(default="production")

    class Config:
        env_file = ".deploy.env"
        case_sensitive = True

settings = Settings()
