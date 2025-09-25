#!/usr/bin/env bash
# 离线合并导航缓存：modules/*/config/menu.register.yaml → modules/nav-shell/cache/nav.json
set -euo pipefail
cd "$(dirname "$0")/.."

PYBIN=${PYBIN:-python3}
$PYBIN - <<'PY'
import os, json, glob, sys
from collections import defaultdict, OrderedDict

try:
    import yaml
except Exception as e:
    sys.stderr.write("需要 PyYAML，请确保镜像 requirements 已包含 pyyaml\n")
    raise

ROOT = os.getcwd()
files = sorted(glob.glob(os.path.join(ROOT, 'modules', '*', 'config', 'menu.register.yaml')))
acc_l1 = []
acc_l2 = defaultdict(list)
acc_l3 = defaultdict(list)

def sk(x): return (x.get('order', 9999), x.get('text',''))

for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        data = yaml.safe_load(fp) or {}
    for item in data.get('l1', []) or []:
        acc_l1.append(item)
    for k, arr in (data.get('l2') or {}).items():
        acc_l2[k].extend(arr or [])
    for k, arr in (data.get('l3') or {}).items():
        acc_l3[k].extend(arr or [])

def dedup_sort(items):
    seen = set(); out = []
    for it in items:
        key = (it.get('key'), it.get('href'))
        if key in seen: continue
        seen.add(key); out.append(it)
    out.sort(key=sk)
    return out

l1 = dedup_sort(acc_l1)
l2 = {k: dedup_sort(v) for k, v in acc_l2.items()}
l3 = {k: dedup_sort(v) for k, v in acc_l3.items()}

out = {'l1': l1, 'l2': l2, 'l3': l3}
cache_dir = os.path.join(ROOT, 'modules', 'nav-shell', 'cache')
os.makedirs(cache_dir, exist_ok=True)
out_path = os.path.join(cache_dir, 'nav.json')
with open(out_path, 'w', encoding='utf-8') as fp:
    json.dump(out, fp, ensure_ascii=False, indent=2)

print(f"[nav] merged {len(files)} menu.register.yaml → modules/nav-shell/cache/nav.json")
PY
