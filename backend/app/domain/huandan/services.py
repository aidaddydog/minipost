"""
Service functions for the huandan integration.

These helpers encapsulate the database operations required by the
huandan API endpoints. They provide asynchronous functions for
computing the current mapping version, retrieving the full
order‑tracking mapping and returning a tracking file record.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Dict, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from .models import HuandanOrderMapping, HuandanTrackingFile


async def get_mapping_version(db: AsyncSession, tenant_id: str) -> str:
    """Return the ISO timestamp of the most recent mapping update.

    If no records exist for the tenant, an empty string is returned.

    Args:
        db: SQLAlchemy async session.
        tenant_id: Current tenant identifier.

    Returns:
        ISO 8601 formatted string representing the latest ``updated_at``.
    """
    stmt = select(func.max(HuandanOrderMapping.updated_at)).where(
        HuandanOrderMapping.tenant_id == tenant_id
    )
    result: Optional[datetime] = await db.scalar(stmt)
    return result.isoformat() if result else ""


async def get_mapping(db: AsyncSession, tenant_id: str) -> List[Dict[str, str]]:
    """Retrieve the entire order→tracking mapping for a tenant.

    Args:
        db: SQLAlchemy async session.
        tenant_id: Current tenant identifier.

    Returns:
        A list of dictionaries with ``order_no`` and ``tracking_no`` keys.
    """
    stmt = select(
        HuandanOrderMapping.order_no,
        HuandanOrderMapping.tracking_no,
    ).where(HuandanOrderMapping.tenant_id == tenant_id)
    rows = (await db.execute(stmt)).all()
    return [
        {"order_no": order_no, "tracking_no": tracking_no}
        for order_no, tracking_no in rows
    ]


async def get_tracking_file(
    db: AsyncSession, tenant_id: str, tracking_no: str
) -> Optional[HuandanTrackingFile]:
    """Return the tracking file record by tracking number.

    Args:
        db: SQLAlchemy async session.
        tenant_id: Current tenant identifier.
        tracking_no: Normalised tracking/waybill number.

    Returns:
        A ``HuandanTrackingFile`` instance if found, otherwise ``None``.
    """
    stmt = select(HuandanTrackingFile).where(
        HuandanTrackingFile.tenant_id == tenant_id,
        HuandanTrackingFile.tracking_no == tracking_no,
    )
    result = await db.scalar(stmt)
    return result
