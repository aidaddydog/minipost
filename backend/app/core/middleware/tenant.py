from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings
class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request.state.tenant_id = request.headers.get("X-Tenant-ID") or settings.default_tenant_id
        return await call_next(request)
