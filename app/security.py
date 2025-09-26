# -*- coding: utf-8 -*-
"""
安全基线：密码哈希与 Token
最小修复：将哈希方案切换为 passlib 的 bcrypt_sha256，以规避 bcrypt 的 72 字节输入上限。
保留对纯 bcrypt 的验证兼容，避免已有数据受影响。
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from passlib.context import CryptContext

from app.settings import settings

# 使用 bcrypt_sha256 作为默认写入方案；同时保留对 bcrypt 的读取/校验兼容
# bcrypt_sha256：先对明文做 SHA-256，再用 bcrypt，因此不受 72 字节限制
pwd_context = CryptContext(
    schemes=["bcrypt_sha256", "bcrypt"],
    default="bcrypt_sha256",
    deprecated="auto",
)

def hash_password(password: str) -> str:
    """
    将明文密码哈希为密文。
    - 默认写入 bcrypt_sha256，支持任意长度密码（先 SHA-256 再 bcrypt）
    - 不做额外截断/报错，避免 72 字节导致的 ValueError
    """
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    """
    校验明文与密文是否匹配。
    - 对旧数据（纯 bcrypt）依然可验证
    - 对新数据（bcrypt_sha256）按新方案验证
    """
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False

def create_access_token(subject: str, expires_seconds: int = 8 * 60 * 60) -> str:
    """
    生成访问 Token（HS256）
    - subject: 用户名/用户ID
    - expires_seconds: 有效期，默认 8 小时
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
