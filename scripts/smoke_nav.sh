#!/usr/bin/env bash
set -euo pipefail
URL="${1:-http://127.0.0.1:8000}"
echo "[*] GET $URL/api/nav"
code=$(curl -s -o /tmp/nav.out -w "%{http_code}" "$URL/api/nav" || true)
echo "HTTP $code"
head -c 300 /tmp/nav.out | sed 's/[[:cntrl:]]//g'; echo
python3 - <<'PY' /tmp/nav.out || true
import sys, json
try:
    d=json.load(open(sys.argv[1],"r",encoding="utf-8",errors="ignore"))
    print("items.len =", len(d.get("items",[])))
    print("menu.keys =", list((d.get("menu") or {}).keys()))
    print("tabs.keys =", list((d.get("tabs") or {}).keys()))
    if d.get("items"):
        print("L1[0] =", {k:d["items"][0].get(k) for k in ("level","title","path","order")})
except Exception as e:
    print("JSON parse failed:", e)
PY
