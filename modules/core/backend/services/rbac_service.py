# -*- coding: utf-8 -*-
from __future__ import annotations
from typing import Set
from sqlalchemy.orm import Session
from sqlalchemy import select
from modules.core.backend.models.rbac import CoreUser, CoreRole, CorePerm, CoreUserRole, CoreRolePerm

def get_user_by_username(db: Session, username: str) -> CoreUser | None:
    return db.execute(select(CoreUser).where(CoreUser.username==username)).scalar_one_or_none()

def get_user_permissions(db: Session, user_id: int) -> Set[str]:
    q = (select(CorePerm.perm_key)
         .join(CoreRolePerm, CoreRolePerm.perm_id==CorePerm.id)
         .join(CoreUserRole, CoreUserRole.role_id==CoreRolePerm.role_id)
         .where(CoreUserRole.user_id==user_id))
    return {r[0] for r in db.execute(q).all()}
