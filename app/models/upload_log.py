from sqlalchemy import Column, Integer, String, DateTime, JSON
from datetime import datetime
from app.core.db import Base

class UploadLog(Base):
    __tablename__ = "upload_logs"
    id = Column(Integer, primary_key=True, index=True)
    time = Column(DateTime, default=datetime.utcnow)
    file = Column(String(255), default="")
    type = Column(String(32), default="面单文件")  # 面单文件 / 运单号
    total = Column(Integer, default=0)
    success = Column(Integer, default=0)
    fail = Column(Integer, default=0)
    operator = Column(String(64), default="系统")
    success_nos = Column(JSON, default=[])
    fail_nos = Column(JSON, default=[])
