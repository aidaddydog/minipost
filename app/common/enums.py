# -*- coding: utf-8 -*-
from enum import Enum

class PermissionKey(str, Enum):
    RBAC_MANAGE = "rbac:manage"
    VIEW_SHELL = "nav:shell:view"

