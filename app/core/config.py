
# -*- coding: utf-8 -*-
import os
from functools import lru_cache

class Settings:
    # 兼容旧版环境变量名，优先使用 MINIPOST_*，回退 HUANDAN_*
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    DATA_DIR = os.environ.get("MINIPOST_DATA") or os.environ.get("HUANDAN_DATA") or "/opt/huandan-data"
    SECRET_KEY = os.environ.get("SECRET_KEY", "minipost-secret-key")
    TZ = os.environ.get("TZ", "Asia/Shanghai")

    # DB
    SQLITE_PATH = os.path.join(DATA_DIR, "minipost.sqlite3")
    SQLALCHEMY_URL = os.environ.get("DATABASE_URL") or f"sqlite:///{SQLITE_PATH}"

    # UI
    STATIC_URL = "/static"
    TEMPLATES_DIR = os.path.join(BASE_DIR, "app", "templates")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
