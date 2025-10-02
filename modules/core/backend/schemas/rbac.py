# -*- coding: utf-8 -*-
from pydantic import BaseModel, Field
from typing import List

class RoleCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=64)
    name: str = Field(..., min_length=2, max_length=128)

class PermissionCreate(BaseModel):
    key: str
    name: str

class GrantRolePermissions(BaseModel):
    role_code: str
    permission_keys: List[str]

class BindUserRole(BaseModel):
    username: str
    role_code: str
