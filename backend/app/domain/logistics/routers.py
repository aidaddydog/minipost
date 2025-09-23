from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.domain.logistics.switch_models import SwitchRule

router = APIRouter(prefix="/logistics", tags=["logistics"])
async def get_db():
    async with AsyncSessionLocal() as s: yield s

@router.get("/switch-rules")
async def list_rules(request: Request, db: AsyncSession = Depends(get_db)):
    tenant_id = request.state.tenant_id
    rows = (await db.execute(select(SwitchRule).where(SwitchRule.tenant_id==tenant_id).order_by(SwitchRule.priority.asc()))).scalars().all()
    return [dict(id=r.id, name=r.name, status=r.status, priority=r.priority, condition=r.condition or [], action=r.action or {}) for r in rows]

@router.post("/switch-rules")
async def create_rule(payload: dict, request: Request, db: AsyncSession = Depends(get_db)):
    r = SwitchRule(
        tenant_id=request.state.tenant_id,
        name=payload.get("name","新规则"),
        status=payload.get("status","enabled"),
        priority=payload.get("priority",100),
        condition=payload.get("condition") or [],
        action=payload.get("action") or {}
    )
    db.add(r); await db.commit(); await db.refresh(r)
    return dict(id=r.id, name=r.name, status=r.status, priority=r.priority, condition=r.condition, action=r.action)

@router.post("/switch-rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    r = (await db.execute(select(SwitchRule).where(SwitchRule.id==rule_id, SwitchRule.tenant_id==request.state.tenant_id))).scalar_one()
    r.status = "disabled" if r.status=="enabled" else "enabled"
    await db.commit()
    return {"id": r.id, "status": r.status}
