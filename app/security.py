# -*- coding: utf-8 -*-
from passlib.context import CryptContext
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(raw: str) -> str: return _pwd.hash(raw)
def verify_password(raw: str, hashed: str) -> bool:
    try: return _pwd.verify(raw, hashed)
    except Exception: return False
