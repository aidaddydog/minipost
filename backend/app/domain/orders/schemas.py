from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class LabelRow(BaseModel):
    id: str
    order_no: Optional[str] = None
    tracking_no: str
    transfer_waybill_no: Optional[str] = None
    label_file: Optional[str] = None
    status_text: str
    created_at: Optional[datetime] = None
    printed_at: Optional[datetime] = None
    # 新增：运输方式
    transport_mode: Optional[str] = None
    class LabelRow(BaseModel):
    # ...
    transport_mode: str | None = None


class UploadLogRow(BaseModel):
    id: str
    time: datetime
    file: str
    type: str
    total: int
    success: int
    fail: int
    operator: str
