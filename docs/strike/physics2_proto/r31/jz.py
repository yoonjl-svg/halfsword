#!/usr/bin/env python3
# jump_zone 출력 가름: python3 jz.py <json> <안 각> <바깥 각> → 띠별 셈 자체 뜀 수 · 가장 큰 · m 띠 · 실제 팔꿈치 쪽 한 스텝 돎
import sys, json, statistics as st
rows = json.load(open(sys.argv[1])); zi, zo = float(sys.argv[2]), float(sys.argv[3])
band = lambda th: '안 (따라감)' if th < zi else '사이 (넘김)' if th < zo else '밖 (오늘 셈)'
for b in ('안 (따라감)', '사이 (넘김)', '밖 (오늘 셈)'):
    r = [x for x in rows if band(x[1]) == b]
    if not r: print(f'{b}: 0'); continue
    print(f'{b}: {len(r)} · > 20° {sum(x[0] > 20 for x in r)} · 가장 큰 {max(x[0] for x in r):.1f}° · m 가운데 {st.median(x[3] for x in r):.3f} (m < 0.15 {sum(x[3] < 0.15 for x in r)}) · 실제 쪽 한 스텝 돎 가운데 {st.median(x[5] for x in r):.1f}°')
print(f'모두 {len(rows)}')
