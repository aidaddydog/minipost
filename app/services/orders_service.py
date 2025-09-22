from typing import List, Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_, func, desc, asc
from datetime import datetime
from app.models.order import Order

# 将 UI 的状态顺序转为排序权重（与前端一致）
STATUS_ORDER = {"已预报":0, "待换单":1, "待导入面单":2, "待映射订单号":3, "已换单":4}

def seed_demo_if_empty(db: Session, n: int = 120):
    # 仅首次填充演示数据，方便开箱即用
    exists = db.execute(select(func.count(Order.id))).scalar()
    if exists and exists > 0:
        return
    import random, string
    now = datetime.utcnow()
    statuses = list(STATUS_ORDER.keys())
    ships = ["USPS", "JC", ""]
    def rnd(n=6): return "".join(random.choices(string.ascii_uppercase + string.digits, k=n))
    for i in range(1, n+1):
        created = now
        printed = None if random.random() < 0.4 else now
        o = Order(
            order_no=f"OD{now.year}{now.month:02d}{now.day:02d}{i:04d}",
            waybill_no=f"1Z{rnd(8)}{random.randint(100000,999999)}",
            trans_no=f"TR{i:06d}",
            ship=random.choice(ships),
            file=("" if random.random() < 0.12 else f"label_{i:04d}.pdf"),
            status=random.choice(statuses),
            created_at=created,
            printed_at=printed,
            voided=False
        )
        db.add(o)
    db.commit()

def list_orders(
    db: Session,
    page: int = 1, size: int = 50,
    time_field: str = "created",  # created/printed
    start: Optional[datetime] = None, end: Optional[datetime] = None,
    status: Optional[str] = None, ship: Optional[str] = None, kw: Optional[str] = None,
    sort_key: str = "status", sort_dir: str = "asc"
) -> Tuple[int, List[Order]]:
    q = select(Order)
    # 时间过滤
    if start:
        q = q.where((Order.printed_at if time_field == "printed" else Order.created_at) >= start)
    if end:
        q = q.where((Order.printed_at if time_field == "printed" else Order.created_at) <= end)
    # 状态/运输方式
    if status:
        if status == "已作废":
            q = q.where(Order.voided.is_(True))
        else:
            q = q.where(Order.status == status)
    if ship:
        q = q.where(Order.ship == ship)
    # 关键字（订单号/运单号/转单号）
    if kw:
        ks = [k for k in kw.split() if k.strip()]
        if ks:
            like = [Order.order_no.like(f"%{k}%") for k in ks] + \
                   [Order.waybill_no.like(f"%{k}%") for k in ks] + \
                   [Order.trans_no.like(f"%{k}%") for k in ks]
            q = q.where(or_(*like))

    # 排序
    if sort_key == "time":
        col = Order.printed_at if time_field == "printed" else Order.created_at
        q = q.order_by(asc(col) if sort_dir == "asc" else desc(col))
    else:
        # 用 case when 模拟状态顺序排序
        from sqlalchemy import case
        order_expr = case(STATUS_ORDER, value=Order.status, else_=99)
        q = q.order_by(asc(order_expr) if sort_dir == "asc" else desc(order_expr))

    total = db.execute(select(func.count()).select_from(q.subquery())).scalar()
    rows = db.execute(q.offset((page-1)*size).limit(size)).scalars().all()
    return total or 0, rows

def toggle_void(db: Session, ids: List[int], voided: bool):
    if not ids: return 0
    rows = db.query(Order).filter(Order.id.in_(ids)).all()
    for r in rows:
        r.voided = voided
    db.commit()
    return len(rows)

def delete_orders(db: Session, ids: List[int]) -> int:
    if not ids: return 0
    rows = db.query(Order).filter(Order.id.in_(ids)).all()
    n = len(rows)
    for r in rows:
        db.delete(r)
    db.commit()
    return n
