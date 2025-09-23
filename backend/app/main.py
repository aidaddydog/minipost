from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.middleware.tenant import TenantMiddleware
from app.api.v1 import api_router

app = FastAPI(title=settings.app_name)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.add_middleware(TenantMiddleware)
app.include_router(api_router, prefix=settings.api_prefix)

@app.get("/api/health")
async def health(): return {"ok": True}
