#!/usr/bin/env bash
# 依赖预检 + 自动安装（第 0 步）
# 目标：确保 python3 / pip 可用；若 hashlib.scrypt 缺失，则安装 pyscrypt 作为后备
set -Eeuo pipefail

# 避免重复执行
if [[ "${MINIPOST_PREFLIGHT_OK:-}" == "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

# 要求 root
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo -e "\e[31m[错误]\e[0m 请以 root 权限运行（例如：sudo bash ...）"
  return 1 2>/dev/null || exit 1
fi

# 选择包管理器
PM=""
if command -v apt-get >/dev/null 2>&1; then PM="apt";
elif command -v apt >/dev/null 2>&1; then PM="apt";
elif command -v dnf >/dev/null 2>&1; then PM="dnf";
elif command -v yum >/dev/null 2>&1; then PM="yum";
elif command -v zypper >/dev/null 2>&1; then PM="zypper";
elif command -v pacman >/dev/null 2>&1; then PM="pacman";
elif command -v apk >/dev/null 2>&1; then PM="apk";
else PM=""; fi

ensure_python() {
  if command -v python3 >/dev/null 2>&1; then
    return 0
  fi
  if [[ -z "$PM" ]]; then
    echo -e "\e[31m[错误]\e[0m 未识别包管理器，且系统未安装 python3，请手动安装后重试。"
    return 1
  fi
  echo "[信息] 正在安装 python3 与 pip（包管理器：$PM）..."
  case "$PM" in
    apt)
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -y
      apt-get install -y python3 python3-pip ca-certificates
      ;;
    dnf)
      dnf install -y python3 python3-pip ca-certificates || dnf install -y python3 python3-pip
      ;;
    yum)
      yum install -y python3 python3-pip ca-certificates || yum install -y python3
      ;;
    zypper)
      zypper -n refresh || true
      zypper -n install -y python3 python3-pip ca-certificates || zypper -n install -y python3
      ;;
    pacman)
      pacman -Sy --noconfirm python python-pip ca-certificates || pacman -Syu --noconfirm python python-pip ca-certificates
      ;;
    apk)
      apk add --no-cache python3 py3-pip ca-certificates
      ;;
    *)
      echo -e "\e[31m[错误]\e[0m 未支持的包管理器：$PM"
      return 1
      ;;
  esac
}

ensure_pip() {
  if python3 -m pip --version >/dev/null 2>&1; then
    return 0
  fi
  if command -v pip3 >/dev/null 2>&1; then
    return 0
  fi
  # 尝试安装 pip 组件
  if [[ -n "$PM" ]]; then
    echo "[信息] 正在安装 pip..."
    case "$PM" in
      apt) apt-get install -y python3-pip || true;;
      dnf) dnf install -y python3-pip || true;;
      yum) yum install -y python3-pip || true;;
      zypper) zypper -n install -y python3-pip || true;;
      pacman) pacman -Sy --noconfirm python-pip || true;;
      apk) apk add --no-cache py3-pip || true;;
    esac
  fi
}

ensure_scrypt_support() {
  if python3 - <<'PY' >/dev/null 2>&1; then
import hashlib, sys
sys.exit(0 if hasattr(hashlib, "scrypt") else 1)
PY
  then
    return 0
  fi
  echo "[信息] hashlib.scrypt 不可用，尝试安装 pyscrypt 作为后备..."
  if python3 -m pip install --no-cache-dir -q pyscrypt; then
    return 0
  fi
  if command -v pip3 >/dev/null 2>&1; then
    if pip3 install --no-cache-dir -q pyscrypt; then
      return 0
    fi
  fi
  echo -e "\e[31m[错误]\e[0m 无法为 Python 准备 scrypt 功能（hashlib.scrypt 不可用且安装 pyscrypt 失败）。"
  return 1
}

ensure_python
ensure_pip || true
ensure_scrypt_support

export MINIPOST_PREFLIGHT_OK=1
