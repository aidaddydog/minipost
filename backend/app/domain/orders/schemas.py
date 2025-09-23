from pydantic import BaseModel
from datetime import datetime

class LabelRow(BaseModel):
    id: str
    order_no: str | None
    tracking_no: str
    transfer_waybill_no: str | None
    label_file: str | None
    status_text: str
    created_at: datetime | None
    printed_at: datetime | None

class UploadLogRow(BaseModel):
    id: str
    time: datetime
    file: str
    type: str
    total: int
    success: int
    fail: int
    operator: str | None
    success_nos: list[str] | None = None
    fail_nos: list[str] | None = None

class SwitchTaskRow(BaseModel):
    id: str
    rule_id: str | None
    rule_name: str | None
    order_no: str | None
    tracking_no: str | None
    transfer_waybill_no: str | None
    status: str
    executed_at: datetime | None
    error_message: str | None = None

class SwitchAuditRow(BaseModel):
    id: str
    task_id: str
    event: str
    occurred_at: datetime
    order_no: str | None
    tracking_no: str | None
    transfer_waybill_no: str | None
    detail: dict | None = None
