#!/usr/bin/env bash
# 生成 /etc/minipost/install_key_scrypt.json（交互或环境变量 NEW_INSTALL_KEY）
# 用法：
#   交互：sudo bash scripts/setup_install_key.sh
#   非交互：sudo NEW_INSTALL_KEY='20240314AaA#' bash scripts/setup_install_key.sh
set -Eeuo pipefail

if ! command -v python3 >/dev/null 2>&1; then
  echo -e "\e[33m[提示]\e[0m 未检测到 python3，尝试自动安装。"
  if command -v bash >/dev/null 2>&1 && [[ -f "$(cd "$(dirname "$0")" && pwd)/preflight.sh" ]]; then
    # shellcheck disable=SC1091
    source "$(cd "$(dirname "$0")" && pwd)/preflight.sh"
  else
    echo -e "\e[31m[错误]\e[0m 需要 python3"
    exit 1
  fi
fi

python3 - <<'PY'
import os, json, base64, time, getpass, sys, stat

# 先尝试标准库 hashlib.scrypt，不行则退回 pyscrypt
try:
    import hashlib
    have_std = hasattr(hashlib, "scrypt")
except Exception:
    hashlib = None
    have_std = False

def kdf_scrypt(pwd: str, salt: bytes, n: int, r: int, p: int, dklen: int) -> bytes:
    if have_std:
        return hashlib.scrypt(pwd.encode("utf-8"), salt=salt, n=n, r=r, p=p, dklen=dklen)
    # fallback: pyscrypt
    try:
        import pyscrypt
    except Exception as e:
        print("[错误] Python 环境缺少 scrypt（hashlib 与 pyscrypt 均不可用）:", e)
        sys.exit(2)
    return pyscrypt.hash(password=pwd.encode("utf-8"), salt=salt, N=n, r=r, p=p, dkLen=dklen)

pwd = os.environ.get("NEW_INSTALL_KEY")
if not pwd:
    try:
        pwd = getpass.getpass("请输入新的安装密钥（不会回显）: ")
    except Exception:
        print("[错误] 无法读取输入")
        sys.exit(1)
if not pwd:
    print("[错误] 密钥不能为空")
    sys.exit(1)

import os
salt = os.urandom(16)
n, r, p, dklen = 32768, 8, 2, 32
dk = kdf_scrypt(pwd, salt, n, r, p, dklen)

data = {
  "kdf": "scrypt",
  "n": n, "r": r, "p": p, "dklen": dklen,
  "salt_b64": base64.b64encode(salt).decode(),
  "hash_hex": dk.hex(),
  "created_at": int(time.time())
}

os.makedirs("/etc/minipost", exist_ok=True)
path = "/etc/minipost/install_key_scrypt.json"
with open(path, "w") as f:
  json.dump(data, f, ensure_ascii=False, separators=(",",":"))
os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)  # 600
print(f"已生成：{path}")
PY
