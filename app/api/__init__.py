from fastapi import APIRouter
from .v1 import labels, orders, templates_api, misc

router = APIRouter(prefix="/api/v1")
router.include_router(misc.router)
router.include_router(labels.router)
router.include_router(orders.router)
router.include_router(templates_api.router)
