#!/usr/bin/env python3
# 조건 ④ 사람 쪽 (게임이 낸 팔꿈치 쪽 — side_rec.mjs 기록): python3 side_chk.py <폴더> <칸>
#  부름마다 게임 pDir · 옛 pole(−0.25, −1, 0.5 맞춤 틀) < 0 인 몫 (팔이 곧게 펴져 쪽이 안 보이는 부름은 뺌) · 손이 어깨 아래(D.y < 0)인데 위팔 u.y > 0 인 부름 수
import sys, glob, os
import numpy as np
d, cell = sys.argv[1:3]
POLE = np.array([-0.25, -1, 0.5]); POLE /= np.linalg.norm(POLE)
tot = [0, 0, 0, 0, 0]; ymax = -9
for f in sorted(glob.glob(f'{d}/rec_{cell}_*.f32')):
    X = np.fromfile(f, dtype=np.float32).reshape(-1, 8).astype(np.float64)
    seen = np.linalg.norm(X[:, 3:6], axis=1) > 0.5
    bad = seen & (X[:, 3:6] @ POLE < 0)
    low = X[:, 6] < 0; up = low & (X[:, 7] > 0)
    if low.any(): ymax = max(ymax, X[low, 7].max())
    r = [len(X), int(seen.sum()), int(bad.sum()), int(low.sum()), int(up.sum())]
    tot = [a + b for a, b in zip(tot, r)]
    print(f'{os.path.basename(f)}: 부름 {r[0]} · 쪽 보임 {r[1]} · 사람 쪽 어긋남 {r[2]} ({r[2] / max(1, r[1]) * 100:.3f} %) · 손 어깨 아래 {r[3]} · 그중 팔꿈치 어깨 위 {r[4]}')
print(f'모두 {cell}: 부름 {tot[0]} · 사람 쪽 어긋남 {tot[2]} / {tot[1]} = {tot[2] / max(1, tot[1]) * 100:.3f} % (과녁 < 0.5 %) · 손 어깨 아래 {tot[3]} 에서 팔꿈치 어깨 위 {tot[4]} (위팔 u.y 가장 큰 {ymax:.3f})')
print(f'판정 ④ {cell}: {"맞음" if tot[2] / max(1, tot[1]) < 0.005 and tot[4] == 0 else "아님"}')
