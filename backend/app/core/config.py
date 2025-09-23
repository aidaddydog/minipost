from pydantic import BaseModel
import os
class Settings(BaseModel):
    app_name: str = os.getenv("MINIPOST_APP_NAME", "Minipost ERP")
    api_prefix: str = os.getenv("MINIPOST_API_PREFIX", "/api/v1")
    cors_origins: str = os.getenv("MINIPOST_CORS_ORIGINS", "*")
    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://minipost:minipost@db:5432/minipost")
    default_tenant_id: str | None = os.getenv("MINIPOST_DEFAULT_TENANT_ID", "demo-tenant")
settings = Settings()
