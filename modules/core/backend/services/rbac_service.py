from __future__ import annotations
from typing import Set, Iterable
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, status
from app.deps import get_db, get_current_user
from modules.core.backend.models.rbac import CoreUser, CorePerm, CoreRole, CoreRolePerm

def get_user_perms(db: Session, user_id: str) -> Set[str]:
    # 通过角色获取权限集合
    rows = (
        db.query(CorePerm.perm_key)
          .join(CoreRolePerm, CoreRolePerm.perm_id==CorePerm.id)
          .join(CoreRole, CoreRole.id==CoreRolePerm.role_id)
          .join(CoreUser, CoreUser.id==CoreRole.users.property.secondary.c.user_id)  # type: ignore
          .filter(CoreUser.id==user_id)
    )
    return set(r[0] for r in rows)

def require_perms(all_: Iterable[str] | None = None, any_: Iterable[str] | None = None):
    all_set = set(all_ or [])
    any_set = set(any_ or [])
    def _dep(user: CoreUser = Depends(get_current_user), db: Session = Depends(get_db)):
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
        perms = get_user_perms(db, user.id)
        if all_set and not all_set.issubset(perms):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
        if any_set and not (any_set & perms):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
        return user
    return _dep
