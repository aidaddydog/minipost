import os
from functools import lru_cache

class Settings:
    PORT: int = int(os.environ.get("PORT", "8000"))
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    DB_URL: str = os.environ.get("DB_URL", "sqlite:///./huandan.sqlite3")
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "minipost-secret")
    LOG_LEVEL: str = os.environ.get("LOG_LEVEL", "info")
    AUTO_CLEAN_DAYS: int = int(os.environ.get("AUTO_CLEAN_DAYS", "30"))
    BASE_DIR: str = os.path.abspath(os.environ.get("MINIPOST_BASE", os.path.join(os.path.dirname(__file__), "..","..")))

@lru_cache
def get_settings() -> Settings:
    return Settings()
