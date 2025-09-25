from __future__ import annotations
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.deploy.env', env_file_encoding='utf-8', extra='ignore')

    APP_NAME: str = "minipost"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    APP_WORKERS: int = 2
    APP_DEBUG: bool = False
    APP_COOKIE_SECURE: bool = False
    NAV_SHELL_WS: bool = False

    DB_HOST: str = "postgres"
    DB_PORT: int = 5432
    DB_NAME: str = "minipost"
    DB_USER: str = "minipost"
    DB_PASS: str = "minipost"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    REDIS_URL: str | None = None

    DATA_ROOT: str = "/opt/minipost/data"
    LOG_ROOT: str = "/opt/minipost/logs"

    INIT_ADMIN_USER: str = "admin"
    INIT_ADMIN_PASS: str | None = None
    INIT_ADMIN_EMAIL: str = "admin@example.com"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASS}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

@lru_cache
def get_settings() -> Settings:
    return Settings()
