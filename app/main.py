import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from .core.config import get_settings
from .core.deps import get_engine
from .models.base import Base
from .models import tables  # ensure model classes imported
from .api import router as api_router
from .api.admin_pages import router as admin_router

SET = get_settings()
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# 初始化数据库（若不存在则建表）
engine = get_engine()
Base.metadata.create_all(bind=engine, checkfirst=True)

app = FastAPI(title="minipost（换单服务端-新UI）")

# session
app.add_middleware(SessionMiddleware, secret_key=SET.SECRET_KEY)

# 静态资源与模板
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
RUNTIME_DIR = os.path.join(BASE_DIR, "runtime")
os.makedirs(RUNTIME_DIR, exist_ok=True)
app.mount("/static",  StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/updates", StaticFiles(directory=os.path.join(BASE_DIR, "..", "updates")), name="updates")

templates = Jinja2Templates(directory=TEMPLATES_DIR)
app.state.templates = templates

# 路由
app.include_router(admin_router)
app.include_router(api_router)
