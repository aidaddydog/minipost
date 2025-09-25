from __future__ import annotations
from typing import Iterable
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.deps import get_db, require_authenticated
from modules.core.backend.services.rbac_service import get_user_permissions

def require_perms(all_: Iterable[str] | None = None, any_: Iterable[str] | None = None):
    all_ = set(all_ or [])
    any_ = set(any_ or [])
    def _dep(user = Depends(require_authenticated), db: Session = Depends(get_db)):
        user_perms = get_user_permissions(db, user.id)
        if "superuser" in user_perms:
            return user
        if all_ and not all_.issubset(user_perms):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足（缺少全部权限）")
        if any_ and not (user_perms & any_):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足（缺少任意权限）")
        return user
    return _dep
