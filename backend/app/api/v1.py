"""
API v1 entry point for minipost with huandan integration.

This module aggregates all API routers to be included in the FastAPI
application.  In addition to the existing orders and logistics routers
provided by the base project, the huandan router is imported and
included to expose the desktop client compatible endpoints.

If you add more domain routers in the future, include them here so
they are automatically registered when the application starts.
"""

from fastapi import APIRouter

from app.domain.orders.routers import router as orders_router
from app.domain.logistics.routers import router as logistics_router

# Import the huandan router to expose `/huandan/*` endpoints
from app.domain.huandan.routers import router as huandan_router


api_router = APIRouter()

# Register built‑in routes
api_router.include_router(orders_router)
api_router.include_router(logistics_router)

# Register huandan routes
api_router.include_router(huandan_router)
