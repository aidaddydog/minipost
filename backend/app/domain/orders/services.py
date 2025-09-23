from typing import Optional, Iterable, List, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from app.domain.orders.models import Label, Waybill, Package, SalesOrder
from app.domain.integration.models import IntegrationJob
from app.domain.logistics.switch_models import SwitchRule, SwitchTask, SwitchAudit
from app.domain.orders.schemas import LabelRow, UploadLogRow
from app.domain.logistics.switch_schemas import ConditionExpr, ActionDef

# ----------- 面单列表 / 上传记录 -----------

def _status_text(label_file: Optional[str], has_order: bool, transfer_no: Optional[str]) -> str:
    if transfer_no: return "已换单"
    if not has_order: return "待映射订单号"
    if not label_file: return "待导入面单"
    return "已预报"

async def fetch_label_list(db: AsyncSession, tenant_id: str, kw: Optional[str], page: int, page_size: int):
    base = (
        select(
            Label.id,
            SalesOrder.order_no,
            Label.tracking_no,
            Label.transfer_waybill_no,
            Label.label_file,
            Label.created_at,
            Label.label_printed_at,
            func.count(SalesOrder.id).over(partition_by=Label.id)
        )
        .select_from(Label)
        .join(Package, Package.id == Label.package_id, isouter=True)
        .join(SalesOrder, SalesOrder.id == Package.sales_order_id, isouter=True)
        .where(Label.tenant_id == tenant_id)
        .order_by(Label.created_at.desc())
    )
    if kw:
        like = f"%{kw}%"
        base = base.where(
            or_(
                SalesOrder.order_no.ilike(like),
                Label.tracking_no.ilike(like),
                Label.transfer_waybill_no.ilike(like),
            )
        )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(base.offset((page-1)*page_size).limit(page_size))).all()
    items = []
    for r in rows:
        has_order = (r[7] or 0) > 0
        items.append(LabelRow(
            id=r[0], order_no=r[1], tracking_no=r[2], transfer_waybill_no=r[3],
            label_file=r[4], created_at=r[5], printed_at=r[6],
            status_text=_status_text(r[4], has_order, r[3])
        ).dict())
    return {"total": total, "items": items}

async def fetch_upload_logs(db: AsyncSession, tenant_id: str, page: int, page_size: int):
    stmt = (
        select(IntegrationJob)
        .where(IntegrationJob.tenant_id == tenant_id)
        .where(IntegrationJob.job_type.in_(["label_upload","order_map_upload"]))
        .order_by(IntegrationJob.created_at.desc())
    )
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.offset((page-1)*page_size).limit(page_size))).scalars().all()
    items = []
    for j in rows:
        p = j.payload or {}
        items.append(UploadLogRow(
            id=j.id, time=j.created_at, file=p.get("file_name") or p.get("object_key") or "unknown",
            type=p.get("upload_type") or ("运单号" if j.job_type=="order_map_upload" else "面单文件"),
            total=p.get("total", 0), success=p.get("success", 0), fail=p.get("fail", 0),
            operator=p.get("operator"), success_nos=p.get("success_nos"), fail_nos=p.get("fail_nos")
        ).dict())
    return {"total": total, "items": items}

# ----------- 换单规则引擎（最小可用） -----------

def eval_condition(ctx: dict, conds: List[ConditionExpr]) -> bool:
    for c in conds:
        val = ctx.get(c.field)
        if c.op == "exists":
            if val is None: return False
        elif c.op == "not_exists":
            if val is not None: return False
        elif c.op == "eq":
            if val != c.value: return False
        elif c.op == "neq":
            if val == c.value: return False
        elif c.op == "in":
            if val not in (c.value or []): return False
        elif c.op == "nin":
            if val in (c.value or []): return False
        elif c.op == "contains":
            if not (isinstance(val, str) and isinstance(c.value, str) and c.value in val): return False
        elif c.op == "prefix":
            if not (isinstance(val, str) and isinstance(c.value, str) and val.startswith(c.value)): return False
        else:
            return False
    return True

def suggest_transfer_no(tracking_no: str, action: ActionDef) -> str:
    suffix = (tracking_no or "")[-8:]
    prefix = action.set_prefix or "RW"
    return f"{prefix}{suffix}"

async def load_enabled_rules(db: AsyncSession, tenant_id: str) -> List[SwitchRule]:
    now = datetime.now(timezone.utc)
    stmt = (
        select(SwitchRule)
        .where(SwitchRule.tenant_id == tenant_id)
        .where(SwitchRule.status == "enabled")
        .where(or_(SwitchRule.effective_from.is_(None), SwitchRule.effective_from <= now))
        .where(or_(SwitchRule.effective_to.is_(None),   SwitchRule.effective_to   >= now))
        .order_by(SwitchRule.priority.asc(), SwitchRule.created_at.asc())
    )
    return (await db.execute(stmt)).scalars().all()

async def iter_label_contexts(db: AsyncSession, tenant_id: str, kw: Optional[str]) -> Iterable[Tuple[Label, dict]]:
    stmt = (
        select(Label, SalesOrder.order_no)
        .select_from(Label)
        .join(Package, Package.id == Label.package_id, isouter=True)
        .join(SalesOrder, SalesOrder.id == Package.sales_order_id, isouter=True)
        .where(Label.tenant_id == tenant_id)
        .order_by(Label.created_at.desc())
        .limit(5000)
    )
    if kw:
        like = f"%{kw}%"
        stmt = stmt.where(or_(SalesOrder.order_no.ilike(like), Label.tracking_no.ilike(like), Label.transfer_waybill_no.ilike(like)))
    rows = (await db.execute(stmt)).all()
    for label, order_no in rows:
        ctx = {
            "order_no": order_no,
            "tracking_no": label.tracking_no,
            "transfer_waybill_no": label.transfer_waybill_no,
            "label_file": label.label_file,
        }
        yield label, ctx

async def preview_switch(db: AsyncSession, tenant_id: str, kw: Optional[str]):
    rules = await load_enabled_rules(db, tenant_id)
    total, matched = 0, 0
    samples = []
    async for label, ctx in iter_label_contexts(db, tenant_id, kw):
        total += 1
        for r in rules:
            conds = [ConditionExpr(**c) for c in (r.condition or [])]
            if eval_condition(ctx, conds):
                action = ActionDef(**(r.action or {}))
                suggested = suggest_transfer_no(ctx["tracking_no"], action)
                matched += 1
                if len(samples) < 20:
                    samples.append({
                        "label_id": label.id,
                        "tracking_no": ctx["tracking_no"],
                        "matched_rule_id": r.id,
                        "suggested_transfer_no": suggested,
                        "action": action.model_dump()
                    })
                break
    return {"total_candidates": total, "matched": matched, "samples": samples}

async def commit_switch(db: AsyncSession, tenant_id: str, operator_id: Optional[str], kw: Optional[str]):
    rules = await load_enabled_rules(db, tenant_id)
    created=executed=failed=0
    async for label, ctx in iter_label_contexts(db, tenant_id, kw):
        matched_rule=None; action=None
        for r in rules:
            conds = [ConditionExpr(**c) for c in (r.condition or [])]
            if eval_condition(ctx, conds): matched_rule=r; action=ActionDef(**(r.action or {})); break
        if not matched_rule: continue
        suggested = suggest_transfer_no(ctx["tracking_no"], action)
        task = SwitchTask(
            tenant_id=tenant_id, rule_id=matched_rule.id, label_id=label.id,
            original_tracking_no=label.tracking_no, generated_transfer_no=None,
            action_snapshot=action.model_dump(), status="pending"
        )
        db.add(task); await db.flush(); created += 1
        try:
            label.transfer_waybill_no = suggested
            task.generated_transfer_no = suggested
            task.status="executed"; task.executed_at = datetime.now(timezone.utc)
            db.add(SwitchAudit(tenant_id=tenant_id, task_id=task.id, event="executed", detail={"operator_id": operator_id, "suggested": suggested}))
            executed += 1
        except Exception as e:
            task.status="failed"; task.error_message=str(e); failed += 1
            db.add(SwitchAudit(tenant_id=tenant_id, task_id=task.id, event="failed", detail={"error": str(e)}))
    await db.commit()
    return {"created": created, "executed": executed, "failed": failed}

# ----------- 任务 / 审计 -----------

async def fetch_switch_tasks(db: AsyncSession, tenant_id: str, kw: Optional[str], page: int, page_size: int):
    from app.domain.logistics.switch_models import SwitchRule, SwitchTask
    stmt = (
        select(
            SwitchTask.id, SwitchTask.rule_id, SwitchRule.name,
            SalesOrder.order_no, Label.tracking_no, Label.transfer_waybill_no,
            SwitchTask.status, SwitchTask.executed_at, SwitchTask.error_message
        )
        .select_from(SwitchTask)
        .join(Label, Label.id == SwitchTask.label_id)
        .join(Package, Package.id == Label.package_id, isouter=True)
        .join(SalesOrder, SalesOrder.id == Package.sales_order_id, isouter=True)
        .join(SwitchRule, SwitchRule.id == SwitchTask.rule_id, isouter=True)
        .where(SwitchTask.tenant_id == tenant_id)
        .order_by(SwitchTask.executed_at.desc().nullslast(), SwitchTask.created_at.desc())
    )
    if kw:
        like = f"%{kw}%"
        stmt = stmt.where(or_(SalesOrder.order_no.ilike(like), Label.tracking_no.ilike(like), Label.transfer_waybill_no.ilike(like)))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.offset((page-1)*page_size).limit(page_size))).all()
    items = []
    for r in rows:
        items.append({
            "id": r[0], "rule_id": r[1], "rule_name": r[2],
            "order_no": r[3], "tracking_no": r[4], "transfer_waybill_no": r[5],
            "status": r[6], "executed_at": r[7], "error_message": r[8],
        })
    return {"total": total, "items": items}

async def fetch_switch_audits(db: AsyncSession, tenant_id: str, task_id: Optional[str], kw: Optional[str], page: int, page_size: int):
    from app.domain.logistics.switch_models import SwitchAudit, SwitchTask
    stmt = (
        select(
            SwitchAudit.id, SwitchAudit.task_id, SwitchAudit.event, SwitchAudit.occurred_at,
            SalesOrder.order_no, Label.tracking_no, Label.transfer_waybill_no, SwitchAudit.detail
        )
        .select_from(SwitchAudit)
        .join(SwitchTask, SwitchTask.id == SwitchAudit.task_id)
        .join(Label, Label.id == SwitchTask.label_id)
        .join(Package, Package.id == Label.package_id, isouter=True)
        .join(SalesOrder, SalesOrder.id == Package.sales_order_id, isouter=True)
        .where(SwitchAudit.tenant_id == tenant_id)
        .order_by(SwitchAudit.occurred_at.desc(), SwitchAudit.created_at.desc())
    )
    if task_id:
        stmt = stmt.where(SwitchAudit.task_id == task_id)
    if kw:
        like = f"%{kw}%"
        stmt = stmt.where(or_(SalesOrder.order_no.ilike(like), Label.tracking_no.ilike(like), Label.transfer_waybill_no.ilike(like)))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.offset((page-1)*page_size).limit(page_size))).all()
    items = []
    for r in rows:
        items.append({
            "id": r[0], "task_id": r[1], "event": r[2], "occurred_at": r[3],
            "order_no": r[4], "tracking_no": r[5], "transfer_waybill_no": r[6],
            "detail": r[7],
        })
    return {"total": total, "items": items}
