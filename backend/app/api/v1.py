from fastapi import APIRouter
from app.domain.orders.routers import router as orders_router
from app.domain.logistics.routers import router as logistics_router
api_router = APIRouter()
api_router.include_router(orders_router)
api_router.include_router(logistics_router)
