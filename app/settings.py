# -*- coding: utf-8 -*-
import os
from dotenv import load_dotenv
load_dotenv(".deploy.env")

APP_HOST=os.getenv("APP_HOST","0.0.0.0")
APP_PORT=int(os.getenv("APP_PORT","8000"))
APP_WORKERS=int(os.getenv("APP_WORKERS","2"))

DB_HOST=os.getenv("DB_HOST","postgres")
DB_PORT=int(os.getenv("DB_PORT","5432"))
DB_NAME=os.getenv("DB_NAME","minipost")
DB_USER=os.getenv("DB_USER","minipost")
DB_PASS=os.getenv("DB_PASS","minipost_pass")
DATABASE_URL=os.getenv("DATABASE_URL") or f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

SESSION_SECRET=os.getenv("SESSION_SECRET","CHANGE_ME_SECRET")
DATA_ROOT=os.getenv("DATA_ROOT","/app/data")
LOG_ROOT=os.getenv("LOG_ROOT","/app/logs")

NAV_SHELL_WS=int(os.getenv("NAV_SHELL_WS","0"))
ADMIN_USER=os.getenv("ADMIN_USER","admin")
ADMIN_PASS=os.getenv("ADMIN_PASS","")
APP_INIT_ADMIN=os.getenv("APP_INIT_ADMIN","1")=="1"
