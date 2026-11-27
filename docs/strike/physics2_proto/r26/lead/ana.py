#!/usr/bin/env python3
# r26 빈손 비킴 갈래 셈: python3 ana.py <out 폴더> <칸 A> <칸 B> [씨앗...]
#  판 열쇠 = (치는 · 막는 · 공격 이름 · 씨앗 · 간격) — 두 칸 짝. 벰 = why 가 ok · clear 아님 (parry_clu.py 와 같음).
#  부위 = 처음 벤 부위 bp (combat.js 가 applyWound 에 넣는 pr.v.part) — 빈 팔 = uarmO · farmO (손은 farmO 몸에 붙음 · 따로 몸 없음), 칼 팔 = uarmS · farmS.
#  긋는 중 = 처음 벤 때 단계 cph 3 · 긋기 끝 뒤 = cph 4 · 준비 = cph < 3 (wind).
#  짝 검정: 한 칸만 참인 판 수 → 정확 이항(양쪽). 묶음 검정: 묶음 = 치는 × 막는 × 공격 이름, 묶음마다 B − A 합 → 부호 뒤집기 순열 (parry_clu.py 와 같은 셈).
import json, sys, os, glob, random
from math import comb
d, A, B = sys.argv[1:4]; seeds = sys.argv[4:] or None
OFF, SW = {'uarmO', 'farmO'}, {'uarmS', 'farmS'}
def load(c):
    out = {}
    for f in sorted(glob.glob(f"{d}/pq_{c}_*_*.json")):
        j = json.load(open(f)); s = str(j['seed'])
        if seeds and s not in seeds: continue
        for dw, rows in j['configs'].items():
            for name, res in rows.items():
                for g, r in zip(j['gaps'], res): out[(j['atk'], dw, name, s, g)] = r
    return out
a, b = load(A), load(B)
keys = sorted(set(a) & set(b))
if not keys: sys.exit('짝 없음')
cut = lambda r: r['why'] not in ('ok', 'clear')
sw = lambda r: cut(r) and r.get('cph') == 3
late = lambda r: cut(r) and r.get('cph') == 4
off = lambda r: cut(r) and r.get('bp') in OFF
off_sw = lambda r: sw(r) and r.get('bp') in OFF
off_late = lambda r: late(r) and r.get('bp') in OFF
swa = lambda r: cut(r) and r.get('bp') in SW
els = lambda r: cut(r) and r.get('bp') not in OFF | SW
off_any = lambda r: any(p in OFF for p, ph in r.get('wp', []))
def binom2(x, y):
    n = x + y; k = min(x, y)
    return 1.0 if n == 0 else min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n)
def perm(ds):
    ds = [x for x in ds if x]; n = len(ds); obs = abs(sum(ds))
    if n == 0: return 1.0
    if n <= 20:
        return sum(abs(sum(x if m >> i & 1 else -x for i, x in enumerate(ds))) >= obs - 1e-9 for m in range(1 << n)) / (1 << n)
    rnd = random.Random(1); N = 200000
    return sum(abs(sum(x if rnd.random() < .5 else -x for x in ds)) >= obs - 1e-9 for _ in range(N)) / N
N = len(keys)
print(f"{A} 대 {B} · 씨앗 {' '.join(sorted({k[3] for k in keys}))} · 짝 판 {N} · 묶음 {len({k[:3] for k in keys})}")
print(f"| 셈 | {A} | {B} | {A} 만 | {B} 만 | 짝 이항 p | 묶음 {B} 많음/적음/같음 | 묶음 순열 p |")
print("|---|---|---|---|---|---|---|---|")
def row(label, f):
    nA = sum(f(a[k]) for k in keys); nB = sum(f(b[k]) for k in keys)
    oa = sum(f(a[k]) and not f(b[k]) for k in keys); ob = sum(f(b[k]) and not f(a[k]) for k in keys)
    clu = {}
    for k in keys: clu[k[:3]] = clu.get(k[:3], 0) + f(b[k]) - f(a[k])
    ds = list(clu.values()); up, dn = sum(x > 0 for x in ds), sum(x < 0 for x in ds)
    print(f"| {label} | {nA} ({100*nA/N:.1f}%) | {nB} ({100*nB/N:.1f}%) | {oa} | {ob} | {binom2(oa, ob):.3f} | {up}/{dn}/{len(ds)-up-dn} | {perm(ds):.3f} |")
row('벰 (모두)', cut)
row('벰 긋는 중 (cph 3)', sw)
row('벰 긋기 끝 뒤 (cph 4)', late)
row('벰 준비 동작 (wind)', lambda r: r['why'] == 'wind')
row('**빈 팔 벰 (처음 벤 부위)**', off)
row('빈 팔 벰 · 긋는 중', off_sw)
row('빈 팔 벰 · 긋기 끝 뒤', off_late)
row('칼 팔 벰', swa)
row('그 밖 부위 벰', els)
row('빈 팔 칼날 상처 하나라도 (모든 상처)', off_any)
print("\n치는 × 막는 (빈 팔 벰 / 벰 / 판):")
by = {}
for k in keys:
    x = by.setdefault(k[:2], [0, 0, 0, 0, 0]); x[0] += off(a[k]); x[1] += off(b[k]); x[2] += cut(a[k]); x[3] += cut(b[k]); x[4] += 1
for (aw, dw), x in sorted(by.items()): print(f"  치는 {aw:10} 막는 {dw:10}: 빈 팔 {A} {x[0]} · {B} {x[1]} | 벰 {x[2]} · {x[3]} / {x[4]}")
for c, rr in ((A, a), (B, b)):
    from collections import Counter
    print(f"{c} 처음 벤 부위:", dict(Counter(rr[k].get('bp') for k in keys if cut(rr[k])).most_common()))
# 빈손 비킴 켜짐 몫 (막는 쪽 스텝 — 스텝 뒤 몸 상태로 읽음: _clrOn && !armsPlaced() && near − armClrGap > 0 · 옛 꼴 armClrGap < gap)
print("\n빈손 비킴 켜짐 몫 (막는 쪽 스텝):")
for c, rr in ((A, a), (B, b)):
    for dw in ('longsword', 'rapier', 'zweihander'):
        g = [0] * 5
        for k in keys:
            if k[1] == dw:
                for i, v in enumerate(rr[k].get('gc', [0] * 5)): g[i] += v
        if g[0]: print(f"  {c} 막는 {dw:10}: 새 꼴 켜짐 {g[1]}/{g[0]} = {100*g[1]/g[0]:.1f}% · 옛 꼴 {100*g[2]/g[0]:.1f}% · 긋는 중 새 꼴 {g[4]}/{g[3]} = {100*g[4]/max(1,g[3]):.1f}%")
