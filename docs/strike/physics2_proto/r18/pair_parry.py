#!/usr/bin/env python3
# 막기 맞대기 표 (아홉 줄: ATK=<치는> DEF=<막는> — parry_pair.sh 의 pp9 파일): pair_parry.py <폴더> <칸 A> <칸 B> [벌...] — 공격 = (벌 · 공격 이름 · 간격) 로 짝지음 (씨앗 1 고정 · 막는 롱 · 치는 롱)
# 셈: ok = 막음 · cut/pushed/wind = 벰 · clear = 안 닿음(셈 밖). 엇갈린 짝으로 정확한 양쪽 이항 검정.
import json, sys, os
from math import comb
d, A, B = sys.argv[1:4]; sets = sys.argv[4:] or ['0', 'a', 'b']
def load(c, k):
    f = f"{d}/{os.environ.get('PFX', 'pp')}_{c}_{k}.json" if not os.environ.get('ATK') else f"{d}/pp9_{c}_{os.environ['ATK']}_{k}.json"
    if not os.path.exists(f): return None
    j = json.load(open(f)); rows = j['configs'][os.environ.get('DEF', 'longsword')]; out = {}
    for name, res in rows.items():
        for g, r in zip(j['gaps'], res): out[(k, name, g)] = r['why']
    return out
def binom2(b, c):
    n = b + c; k = min(b, c)
    if n == 0: return 1.0
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n)
tot = dict(both=0, onlyA=0, onlyB=0, neither=0, clrA=0, clrB=0, clr2=0, okA=0, nA=0, okB=0, nB=0)
disc = []; why = {}; cutAB = [0, 0, 0, 0]  # 벰 짝 (안 닿음 = 안 벰): A 만 벰 · B 만 벰 · 둘 다 · 모든 공격
for k in sets:
    a, b = load(A, k), load(B, k)
    if a is None or b is None: continue
    t = dict(both=0, onlyA=0, onlyB=0, neither=0, clrA=0, clrB=0, clr2=0)
    for key in a:
        wa, wb = a[key], b[key]
        ca, cb = wa not in ('ok', 'clear'), wb not in ('ok', 'clear')
        cutAB[0] += ca and not cb; cutAB[1] += cb and not ca; cutAB[2] += ca and cb; cutAB[3] += 1
        if wa == 'clear' and wb == 'clear': t['clr2'] += 1; continue
        if wb == 'clear': t['clrB'] += 1; why[('B clear', wa)] = why.get(('B clear', wa), 0) + 1; continue
        if wa == 'clear': t['clrA'] += 1; why[('A clear', wb)] = why.get(('A clear', wb), 0) + 1; continue
        pa, pb = wa == 'ok', wb == 'ok'
        if pa and pb: t['both'] += 1
        elif pa: t['onlyA'] += 1; disc.append((key, wa, wb))
        elif pb: t['onlyB'] += 1; disc.append((key, wa, wb))
        else: t['neither'] += 1
    okA = sum(1 for x in a.values() if x == 'ok'); nA = sum(1 for x in a.values() if x != 'clear')
    okB = sum(1 for x in b.values() if x == 'ok'); nB = sum(1 for x in b.values() if x != 'clear')
    npair = t['both'] + t['onlyA'] + t['onlyB'] + t['neither']
    print(f"벌 {k}: 짝 {npair} | 둘 다 막음 {t['both']} · {A} 만 {t['onlyA']} · {B} 만 {t['onlyB']} · 둘 다 벰 {t['neither']} | {A} 만 셈 {t['clrB']} · {B} 만 셈 {t['clrA']} · 둘 다 안 닿음 {t['clr2']} | 따로 셈 {okA}/{nA} · {okB}/{nB}")
    for x in t: tot[x] += t[x]
    tot['okA'] += okA; tot['nA'] += nA; tot['okB'] += okB; tot['nB'] += nB
npair = tot['both'] + tot['onlyA'] + tot['onlyB'] + tot['neither']
p = binom2(tot['onlyA'], tot['onlyB'])
print(f"합: 짝 {npair} | 둘 다 막음 {tot['both']} · {A} 만 {tot['onlyA']} · {B} 만 {tot['onlyB']} · 둘 다 벰 {tot['neither']} | {A} 만 셈 {tot['clrB']} · {B} 만 셈 {tot['clrA']} · 둘 다 안 닿음 {tot['clr2']}")
print(f"따로 셈: {A} {tot['okA']}/{tot['nA']} = {100*tot['okA']/max(1,tot['nA']):.1f}% · {B} {tot['okB']}/{tot['nB']} = {100*tot['okB']/max(1,tot['nB']):.1f}% · 짝 안 막음 {100*(tot['both']+tot['onlyA'])/max(1,npair):.1f}% → {100*(tot['both']+tot['onlyB'])/max(1,npair):.1f}%")
print(f"엇갈림 {tot['onlyA']} 대 {tot['onlyB']} → 양쪽 정확 이항 p = {p:.4f}")
print(f"벰 짝 (모든 공격 {cutAB[3]} · 안 닿음 = 안 벰): 둘 다 벰 {cutAB[2]} · {A} 만 벰 {cutAB[0]} · {B} 만 벰 {cutAB[1]} → p = {binom2(cutAB[0], cutAB[1]):.4f}")
print('한쪽만 셈 (안 닿은 쪽 · 다른 쪽 결과):', dict(sorted(why.items())))
if os.environ.get('DISC'):
    for key, wa, wb in disc: print('엇갈림', key, wa, wb)
