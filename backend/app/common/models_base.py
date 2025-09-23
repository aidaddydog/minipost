from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import text
from datetime import datetime
import uuid
class Base(DeclarativeBase): pass
def gen_id() -> str: return str(uuid.uuid4())
class CommonBase:
    id: Mapped[str] = mapped_column(primary_key=True, default=gen_id, comment="主键UUID")
    tenant_id: Mapped[str] = mapped_column(index=True, comment="多租户ID")
    org_id: Mapped[str | None] = mapped_column(nullable=True, index=True, comment="组织ID")
    status: Mapped[str] = mapped_column(default="active", comment="状态")
    version: Mapped[int] = mapped_column(default=1, comment="乐观锁版本")
    created_at: Mapped[datetime] = mapped_column(server_default=text("CURRENT_TIMESTAMP"), comment="创建UTC")
    updated_at: Mapped[datetime] = mapped_column(server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP"), comment="更新UTC")
