#!/usr/bin/env python3
# 조건 ④ 를 오늘 투영 m 띠로 나눠 셈 (읽은 이 지적 — −pole 가까이(m 작음)는 옛 pDir 자체가 안 정해지는 곳이라 옛 pole 과 견줌이 뜻이 약함): python3 side_split.py <폴더> <칸>...
#  기록 = side_rec.mjs 의 rec_<칸>_*.f32 (부름마다 8 칸: Dn' · 게임 pDir' · 손 높이 · 위팔 u.y). m = |pole − (pole·Dn) Dn| (옛 셈의 투영 길이 — 기록 Dn 에서 셈).
#  띠마다 부름 수 · 어긋남(게임 pDir · 옛 pole < 0) 수와 몫 · 묶음(f 싸움 · p 막기 · t 마무리 찌르기)별 m > 0.3 몫.
import sys, glob, os
import numpy as np
d, cells = sys.argv[1], sys.argv[2:]
POLE = np.array([-0.25, -1, 0.5]); POLE /= np.linalg.norm(POLE)
BANDS = [(0, 0.05), (0.05, 0.3), (0.3, 0.6), (0.6, 1.01)]
for cell in cells:
    rows = {}
    for f in sorted(glob.glob(f'{d}/rec_{cell}_*.f32')):
        X = np.fromfile(f, dtype=np.float32).reshape(-1, 8).astype(np.float64)
        Dn = X[:, 0:3] / np.linalg.norm(X[:, 0:3], axis=1, keepdims=True)
        m = np.linalg.norm(POLE - (Dn @ POLE)[:, None] * Dn, axis=1)
        bad = X[:, 3:6] @ POLE < 0
        rows[os.path.basename(f)[len(f'rec_{cell}_'):-4]] = (m, bad)
    m = np.concatenate([v[0] for v in rows.values()]); bad = np.concatenate([v[1] for v in rows.values()])
    print(f'## {cell}: 부름 {len(m)} · 어긋남 {int(bad.sum())} ({bad.mean() * 100:.3f} %)')
    print('| m 띠 | 부름 | 어긋남 | 몫 % |'); print('|---|---|---|---|')
    for lo, hi in BANDS:
        s = (m >= lo) & (m < hi)
        print(f'| {lo} ~ {min(hi, 1):g} | {int(s.sum())} | {int(bad[s].sum())} | {bad[s].mean() * 100 if s.any() else 0:.3f} |')
    s = m > 0.3
    print(f'| m > 0.3 모두 | {int(s.sum())} | {int(bad[s].sum())} | {bad[s].mean() * 100:.3f} | (과녁 < 0.5 %)')
    for grp in ['f', 'p', 't']:
        ks = [k for k in rows if k.startswith(grp + '_')]
        if not ks: continue
        mm = np.concatenate([rows[k][0] for k in ks]); bb = np.concatenate([rows[k][1] for k in ks]); s = mm > 0.3
        print(f'  묶음 {grp}: m > 0.3 부름 {int(s.sum())} · 어긋남 {int(bb[s].sum())} ({bb[s].mean() * 100:.3f} %) · 모두 {bb.mean() * 100:.3f} %')
    print(f'판정 ④ (m > 0.3 만) {cell}: {"맞음" if bad[m > 0.3].mean() < 0.005 else "아님"}')
