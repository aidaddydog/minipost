from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer
from app.db import Base

class Carrier(Base):
    __tablename__ = "carriers"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    carrier_code: Mapped[str] = mapped_column(String(50), unique=True)
    carrier_name: Mapped[str] = mapped_column(String(100))
