from fastapi import APIRouter
from .labels import router as labels_router
from .logs import router as logs_router
from .templates_api import router as templates_router

api_router = APIRouter()
api_router.include_router(labels_router, prefix="/labels", tags=["labels"])
api_router.include_router(logs_router, prefix="/logs", tags=["logs"])
api_router.include_router(templates_router, prefix="/templates", tags=["templates"])

