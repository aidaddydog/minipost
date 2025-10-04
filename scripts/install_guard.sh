#!/usr/bin/env bash
# 安装密钥守卫（scrypt 或 pyscrypt 后备）：作为一键脚本的第 1 步执行
set -Eeuo pipefail

# 若已通过一次校验（例如离线脚本 exec 在线脚本），避免重复提示
if [[ "${MINIPOST_INSTALL_GUARD_OK:-}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

CONF="${MINIPOST_SCRYPT_FILE:-/etc/minipost/install_key_scrypt.json}"

if ! command -v python3 >/dev/null 2>&1; then
  echo -e "\e[31m[错误]\e[0m 需要 python3（用于 scrypt 校验）。"
  return 1 2>/dev/null || exit 1
fi
if [[ ! -r "$CONF" ]]; then
  echo -e "\e[31m[错误]\e[0m 未找到或无法读取密钥校验文件：$CONF"
  echo "请先运行 scripts/setup_install_key.sh 生成 /etc/minipost/install_key_scrypt.json"
  return 1 2>/dev/null || exit 1
fi

verify_with_python() {  # $1 = 用户输入
INSTALL_KEY_INPUT="$1" MINIPOST_SCRYPT_FILE="$CONF" python3 - <<'PY'
import json, os, base64, hmac, sys

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

path = os.environ.get("MINIPOST_SCRYPT_FILE")
try:
    with open(path, "r") as f:
        cfg = json.load(f)
except Exception as e:
    print(f"[错误] 读取 {path} 失败：{e}")
    sys.exit(2)

pwd = os.environ.get("INSTALL_KEY_INPUT", "")
try:
    import base64
    salt = base64.b64decode(cfg["salt_b64"])
    n = int(cfg.get("n", 32768))
    r = int(cfg.get("r", 8))
    p = int(cfg.get("p", 2))
    dklen = int(cfg.get("dklen", 32))
except Exception as e:
    print("[错误] 配置文件字段不合法：", e)
    sys.exit(2)

dk = kdf_scrypt(pwd, salt, n, r, p, dklen)
hexv = dk.hex()
ok = False
try:
    import hmac
    ok = hmac.compare_digest(hexv, cfg["hash_hex"].lower())
except Exception:
    ok = (hexv == cfg["hash_hex"].lower())

sys.exit(0 if ok else 1)
PY
}

for try in 1 2 3; do
  if [[ -n "${INSTALL_KEY:-}" ]]; then
    input="$INSTALL_KEY"
  else
    read -rsp "请输入安装密钥: " input; echo
  fi
  if verify_with_python "$input"; then
    unset input
    export MINIPOST_INSTALL_GUARD_OK=1
    break
  else
    echo -e "\e[31m[错误]\e[0m 安装密钥错误（第 ${try}/3 次）"
    sleep 1
    unset INSTALL_KEY
    if [[ $try -eq 3 ]]; then
      echo -e "\e[31m[错误]\e[0m 多次失败，退出。"
      return 1 2>/dev/null || exit 1
    fi
  fi
done

unset -f verify_with_python
unset CONF
