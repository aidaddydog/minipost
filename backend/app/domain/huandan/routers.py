"""
FastAPI routes exposing huandan compatibility endpoints.

This router mirrors the public API of the standalone ``huandan.server`` so that
the desktop client can interact directly with the minipost backend.  It
provides endpoints for retrieving the current mapping version, the full
order/tracking mapping and downloading PDF labels by tracking number.

All endpoints derive the current tenant from the request state
(``request.state.tenant_id``), ensuring that data is always scoped
according to the multi‑tenant rules of the system.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from .services import (
    get_mapping_version,
    get_mapping,
    get_tracking_file,
)


router = APIRouter(prefix="/huandan", tags=["huandan"])


async def get_db() -> AsyncSession:
    """Dependency yielding a fresh async session per request."""
    async with AsyncSessionLocal() as session:
        yield session


@router.get("/version")
async def api_version(request: Request, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """Return the latest mapping version for the tenant.

    The desktop client polls this endpoint to determine whether it
    needs to refresh its local order‑to‑tracking mapping.  When no
    mappings exist yet, an empty string is returned.
    """
    tenant_id = getattr(request.state, "tenant_id", None)
    version = await get_mapping_version(db, tenant_id)
    return JSONResponse({"version": version})


@router.get("/mapping")
async def api_mapping(request: Request, db: AsyncSession = Depends(get_db)) -> JSONResponse:
    """Return the full order→tracking mapping for the tenant."""
    tenant_id = getattr(request.state, "tenant_id", None)
    mapping = await get_mapping(db, tenant_id)
    return JSONResponse({"items": mapping})


@router.get("/file/{tracking_no}")
async def api_file(
    tracking_no: str, request: Request, db: AsyncSession = Depends(get_db)
) -> FileResponse:
    """Return a PDF label file for the given tracking number.

    If the file does not exist a 404 HTTPException is raised.
    """
    tenant_id = getattr(request.state, "tenant_id", None)
    record = await get_tracking_file(db, tenant_id, tracking_no)
    if not record or not record.file_path:
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(
        record.file_path,
        filename=f"{tracking_no}.pdf",
        media_type="application/pdf",
    )
