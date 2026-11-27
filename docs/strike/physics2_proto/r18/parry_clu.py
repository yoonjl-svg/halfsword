#!/usr/bin/env python3
# 막기 맞대기 — 묶음(공격 이름 × 막는 무기 × 치는 무기) 단위 (11/27 읽기 지적: 간격 벌 · 간격은 씨앗 1 고정의 이웃 공격이라 서로 기대어 있음 → 한 공격 이름을 한 표본으로)
#  python3 parry_clu.py <폴더> <칸 A> <칸 B> [벌...]   (env ATKS=longsword,rapier,zweihander 이면 pp9_<칸>_<치는>_<벌>.json · 없으면 pp_<칸>_<벌>.json 의 롱 대 롱)
#  재는 것: 벰(cut · pushed · wind) 대 안 벰 — 모든 공격(안 닿음 = 안 벰 · 짝 안 버림)이 첫째. 둘째: 막음 = ok 이면서 atPh ≠ 4 (휘두름 끝난 뒤 닿음은 막음이 아님 — 두 칸 같게)
#  묶음마다 B − A (벰 수 · 막음 수) → 부호 검정(0 아닌 묶음) + 부호 뒤집기 순열 검정(합 · 2^n 다 셈 또는 20 만 번)
import json, sys, os, random
from math import comb
d, A, B = sys.argv[1:4]; sets = sys.argv[4:] or ['0', 'a', 'b']
atks = os.environ.get('ATKS')
def files(c, k):
    if atks: return [(a, f"{d}/pp9_{c}_{a}_{k}.json") for a in atks.split(',')]
    return [('longsword', f"{d}/pp_{c}_{k}.json")]
def load(c):
    out = {}
    for k in sets:
        for a, f in files(c, k):
            if not os.path.exists(f): continue
            j = json.load(open(f))
            for dw, rows in j['configs'].items():
                for name, res in rows.items():
                    for g, r in zip(j['gaps'], res): out[(a, dw, name, k, g)] = r
    return out
a, b = load(A), load(B)
keys = sorted(set(a) & set(b))
if not keys: sys.exit('짝 없음')
cut = lambda r: r['why'] not in ('ok', 'clear')
par = lambda r: r['why'] == 'ok' and r.get('atPh') != 4
late = lambda r: r['why'] == 'ok' and r.get('atPh') == 4
def binom2(x, y):
    n = x + y; k = min(x, y)
    return 1.0 if n == 0 else min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n)
def perm(ds):
    ds = [x for x in ds if x]; n = len(ds); obs = abs(sum(ds))
    if n == 0: return 1.0
    if n <= 20:
        hit = 0
        for m in range(1 << n): hit += abs(sum(x if m >> i & 1 else -x for i, x in enumerate(ds))) >= obs - 1e-9
        return hit / (1 << n)
    rnd = random.Random(1); N = 200000
    return sum(abs(sum(x if rnd.random() < .5 else -x for x in ds)) >= obs - 1e-9 for _ in range(N)) / N
print(f"{A} 대 {B} · 벌 {' '.join(sets)} · 공격 {len(keys)}" + (f" · 치는 {atks}" if atks else ' · 롱 대 롱'))
def table(label, f):
    clu = {}
    for kk in keys:
        c = kk[:3]; x = clu.setdefault(c, [0, 0, 0])
        x[0] += f(a[kk]); x[1] += f(b[kk]); x[2] += 1
    ds = [x[1] - x[0] for x in clu.values()]
    up, dn = sum(x > 0 for x in ds), sum(x < 0 for x in ds)
    nA, nB = sum(x[0] for x in clu.values()), sum(x[1] for x in clu.values())
    print(f"{label}: {A} {nA}/{len(keys)} = {100*nA/len(keys):.1f}% · {B} {nB}/{len(keys)} = {100*nB/len(keys):.1f}% | 묶음 {len(clu)}: {B} 쪽 많음 {up} · 적음 {dn} · 같음 {len(ds)-up-dn} → 부호 p = {binom2(up, dn):.3f} · 순열 p = {perm(ds):.3f}")
    return clu
table('벰 (첫째)', cut)
table('막음 (휘두름 끝 뒤 닿음 뺌)', par)
la, lb = sum(late(a[k]) for k in keys), sum(late(b[k]) for k in keys)
print(f"휘두름 끝 뒤 닿음(ok · atPh 4): {A} {la} · {B} {lb}")
by = {}
for kk in keys:
    if atks: by.setdefault((kk[0], kk[1]), [0, 0, 0])
    else: by.setdefault(('longsword', kk[1]), [0, 0, 0])
    x = by[(kk[0], kk[1])]; x[0] += cut(a[kk]); x[1] += cut(b[kk]); x[2] += 1
for (aw, dw), x in sorted(by.items()): print(f"  치는 {aw} · 막는 {dw}: 벰 {A} {x[0]}/{x[2]} · {B} {x[1]}/{x[2]}")
