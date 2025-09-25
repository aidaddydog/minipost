# -*- coding: utf-8 -*-
import os
SECRET_KEY = os.getenv("SECRET_KEY", "minipost-dev-secret")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://minipost:minipost@postgres:5432/minipost")
