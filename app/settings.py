# minipost · 应用配置加载（.deploy.env）
# - 读取环境变量，构造数据库与会话相关配置
from __future__ import annotations
import os
from pydantic import BaseModel

class Settings(BaseModel):
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", "8000"))
    app_workers: int = int(os.getenv("APP_WORKERS", "2"))
    app_log_level: str = os.getenv("APP_LOG_LEVEL", "info")

    db_host: str = os.getenv("DB_HOST", "postgres")
    db_port: int = int(os.getenv("DB_PORT", "5432"))
    db_name: str = os.getenv("DB_NAME", "minipost")
    db_user: str = os.getenv("DB_USER", "minipost")
    db_pass: str = os.getenv("DB_PASS", "minipost123")

    redis_url: str | None = os.getenv("REDIS_URL") or None

    data_root: str = os.getenv("DATA_ROOT", "/data")
    log_root: str = os.getenv("LOG_ROOT", "/logs")

    secret_key: str = os.getenv("SECRET_KEY", "change-this-in-prod")
    session_expire_seconds: int = int(os.getenv("SESSION_EXPIRE_SECONDS", "86400"))

    nav_shell_ws: bool = os.getenv("NAV_SHELL_WS", "0") == "1"

    admin_username: str = os.getenv("ADMIN_USERNAME", "admin")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "ChangeMe123!")
    admin_full_name: str = os.getenv("ADMIN_FULL_NAME", "系统管理员")
    admin_email: str = os.getenv("ADMIN_EMAIL", "admin@example.com")

    @property
    def database_url(self) -> str:
        return f"postgresql+psycopg://{self.db_user}:{self.db_pass}@{self.db_host}:{self.db_port}/{self.db_name}"

settings = Settings()
