#!/usr/bin/env python3
# 빈팔 선 자세 지문 흔들림 (11/27 읽기 지적): fp_spread.py <폴더> <칸 A> <칸 B> — 칸마다 fp_<칸>.json · fp_<칸>_g3.001.json · fp_<칸>_g2.999.json (간격 1 mm 옮김)
#  자리마다: 마지막 1 초 위팔 흔들림 A 셋 [작음 ~ 큼] · B 셋 · 자세 차(위팔 °) = A 안 셋끼리 가장 큰 · B 안 · A 와 B 사이 가장 작은
#  바뀜 = A ↔ B 가장 작은 차가 A 안 · B 안 흔들림보다 큼 / 흔들림 셋의 범위가 안 겹침
import json, sys, math, itertools
d, A, B = sys.argv[1:4]
def runs(c): return [json.load(open(f"{d}/fp_{c}{s}.json")) for s in ('', '_g3.001', '_g2.999')]
ra, rb = runs(A), runs(B)
ang = lambda p, q: 2 * math.degrees(math.acos(min(1, abs(sum(x * y for x, y in zip(p, q))))))
nch = nwob = 0
for k in ra[0]:
    wa = [r[k]['sp'] for r in ra]; wb = [r[k]['sp'] for r in rb]
    ia = max(ang(x[k]['u'], y[k]['u']) for x, y in itertools.combinations(ra, 2))
    ib = max(ang(x[k]['u'], y[k]['u']) for x, y in itertools.combinations(rb, 2))
    ab = min(ang(x[k]['u'], y[k]['u']) for x in ra for y in rb)
    ch = ab > max(ia, ib); wo = min(wb) > max(wa) or max(wb) < min(wa)
    nch += ch; nwob += wo
    print(f"{k:22s} 흔들림 {A} [{min(wa):.2f} ~ {max(wa):.2f}] · {B} [{min(wb):.2f} ~ {max(wb):.2f}]°{' 안 겹침' if wo else ''} | 위팔 자세 차 {A} 안 {ia:.2f} · {B} 안 {ib:.2f} · 사이 가장 작은 {ab:.2f}°{' 바뀜' if ch else ''}")
print(f"자리 {len(ra[0])}: 자세 바뀜(사이 > 안) {nch} · 흔들림 범위 안 겹침 {nwob}")
