from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from ...core.deps import get_db

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("/import")
async def import_orders(file: UploadFile = File(...), order_col: str = "订单号", tracking_col: str = "运单号", db: Session = Depends(get_db)):
    from ...services.orders_service import import_orders_mapping
    try:
        res = import_orders_mapping(db, await file.read(), file.filename, order_col, tracking_col)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return res
