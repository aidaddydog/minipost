from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LabelRow(BaseModel):
    id: int
    orderNo: Optional[str] = None
    waybill: str
    transNo: Optional[str] = None
    ship: Optional[str] = None
    file: Optional[str] = None
    status: str
    createdAt: Optional[datetime] = None
    printedAt: Optional[datetime] = None
    voided: bool = False

class Paged(BaseModel):
    total: int
    page: int
    size: int
    items: list

class UploadLogItem(BaseModel):
    id: int
    time: str
    file: str
    type: str
    total: int
    success: int
    fail: int
    operator: str
