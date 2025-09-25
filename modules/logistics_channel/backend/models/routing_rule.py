from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer
from app.db import Base

class RoutingRule(Base):
    __tablename__ = "routing_rules"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rule_code: Mapped[str] = mapped_column(String(50), unique=True)
    expr: Mapped[str] = mapped_column(String(500))
