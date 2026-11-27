#!/usr/bin/env python3
# 마무리 찌르기 짝 맞댐 (11/27 — cb_250 에서 상처가 반으로 줆): fin_pair.py <mx 폴더> <칸 A> <칸 B> [파일 ...] (기본 fin_rows_1.txt fin_rows_2.txt)
#  판 = (판금 · 자세 · 거리 · 넘어진 쪽 · 씨앗) 으로 짝. 상처 엇갈림 정확 이항 · 묶음(자세 × 거리 · 판금) 부호 뒤집기 순열 검정
import json, sys, random
from math import comb
d, A, B = sys.argv[1:4]; fs = sys.argv[4:] or ['fin_rows_1.txt', 'fin_rows_2.txt']
def rows(c):
    o = {}
    for f in fs:
        for l in open(f'{d}/{c}/{f}'):
            if l.startswith('{'):
                j = json.loads(l); o[(f, j['plate'], j['guard'], j['dist'], j['fall'], j['seed'])] = bool(j['wound'])
    return o
a, b = rows(A), rows(B); ks = sorted(set(a) & set(b))
oa = sum(a[k] and not b[k] for k in ks); ob = sum(b[k] and not a[k] for k in ks)
def binom2(x, y):
    n = x + y; m = min(x, y); return 1.0 if n == 0 else min(1.0, 2 * sum(comb(n, i) for i in range(m + 1)) / 2 ** n)
clu = {}
for k in ks: x = clu.setdefault((k[0], k[1], k[2], k[3]), 0); clu[(k[0], k[1], k[2], k[3])] = x + b[k] - a[k]
ds = [x for x in clu.values() if x]; obs = abs(sum(ds)); rnd = random.Random(1); N = 100000
p = sum(abs(sum(x if rnd.random() < .5 else -x for x in ds)) >= obs for _ in range(N)) / N
print(f"{A} 대 {B}: 판 {len(ks)} · 상처 {sum(a[k] for k in ks)} → {sum(b[k] for k in ks)} | {A} 만 {oa} · {B} 만 {ob} → 이항 p = {binom2(oa, ob):.4f} | 묶음 {len(clu)} (0 아님 {len(ds)}) 순열 p = {p:.4f}")
