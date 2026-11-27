#!/usr/bin/env python3
# r26 덧셈: python3 extra.py <out> <A> <B> — (1) 막는 레이피어 판이 두 칸 같나 (빈손 비킴이 안 켜지는 대조) (2) 씨앗(간격 벌)마다 빈 팔 벰 (3) 빈 팔 벰 차가 큰 묶음
import json, glob, sys
from collections import defaultdict
d, A, B = sys.argv[1:4]; OFF = {'uarmO', 'farmO'}
def load(c):
    out = {}
    for f in glob.glob(f"{d}/pq_{c}_*_*.json"):
        j = json.load(open(f))
        for dw, rows in j['configs'].items():
            for n, res in rows.items():
                for g, r in zip(j['gaps'], res): out[(j['atk'], dw, n, str(j['seed']), g)] = r
    return out
a, b = load(A), load(B); keys = sorted(set(a) & set(b))
off = lambda r: r['why'] not in ('ok', 'clear') and r.get('bp') in OFF
rk = [k for k in keys if k[1] == 'rapier']
same = sum(json.dumps(a[k], sort_keys=True) == json.dumps(b[k], sort_keys=True) for k in rk)
print(f"막는 레이피어 판 {len(rk)} 중 두 칸 바이트 같음 {same}")
tk = [k for k in keys if k[1] != 'rapier']
same2 = sum(json.dumps(a[k], sort_keys=True) == json.dumps(b[k], sort_keys=True) for k in tk)
print(f"막는 두손 칼 판 {len(tk)} 중 두 칸 바이트 같음 {same2} · 결과(why·부위) 같음 {sum((a[k]['why'], a[k].get('bp')) == (b[k]['why'], b[k].get('bp')) for k in tk)}")
ps = defaultdict(lambda: [0, 0])
for k in keys: ps[k[3]][0] += off(a[k]); ps[k[3]][1] += off(b[k])
print('씨앗(간격 벌)마다 빈 팔 벰 A · B:', ' | '.join(f"{s}: {x[0]} · {x[1]}" for s, x in sorted(ps.items())))
cl = defaultdict(int)
for k in keys: cl[k[:3]] += off(b[k]) - off(a[k])
print('빈 팔 벰 B − A 가 0 아닌 묶음:', sorted(((v, '/'.join(c)) for c, v in cl.items() if v), reverse=True))
