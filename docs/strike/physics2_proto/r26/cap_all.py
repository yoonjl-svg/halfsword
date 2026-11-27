#!/usr/bin/env python3
# 빈 머리 조건(≥ 40°)을 두 잣대로 같이 셈 (읽은 이 지적 — 판정이 칸 몫 문턱에 달렸는지): python3 cap_all.py <폴더> <칸> <한 부름 칸 수 9|8> [이름]
#  −r0 = 소스 상수 OFF_ELB_R0 의 반대 (fighter.js 와 같은 값). 기록 Dn 은 앞 세 칸 (가슴 틀 · 빈손 쪽 맞춤).
#  (가) 몫 > 0.01 % 칸(cap_e0.py 와 같은 90 × 180 같은 넓이 칸)의 기록 점까지 가장 작은 각 · (나) 모든 기록 점까지 가장 작은 각 · 40° 안 부름 수 · 각 띠별 부름 수
import sys, glob, os
import numpy as np
d, cell, ncol = sys.argv[1], sys.argv[2], int(sys.argv[3])
name = sys.argv[4] if len(sys.argv) > 4 else d
R0 = np.array([0.5849, 0.1207, -0.8021]); R0 /= np.linalg.norm(R0)
c = -R0
fs = sorted(f for f in glob.glob(f'{d}/rec_{cell}_*.f32'))
X = np.concatenate([np.fromfile(f, dtype=np.float32).reshape(-1, ncol)[:, :3].astype(np.float64) for f in fs])
N = len(X)
Dn = X / np.linalg.norm(X, axis=1, keepdims=True)
ang = np.degrees(np.arccos(np.clip(Dn @ c, -1, 1)))
NY, NP = 90, 180
iy = np.clip(((Dn[:, 1] + 1) / 2 * NY).astype(int), 0, NY - 1)
ip = np.clip(((np.arctan2(Dn[:, 2], Dn[:, 0]) + np.pi) / (2 * np.pi) * NP).astype(int), 0, NP - 1)
bid = iy * NP + ip
cnt = np.bincount(bid, minlength=NY * NP)
inocc = cnt[bid] > 1e-4 * N
a_occ = ang[inocc].min(); a_all = ang.min()
print(f'{name} {cell}: 파일 {len(fs)} · 부름 {N}')
print(f'  (가) 몫 > 0.01 % ({1e-4 * N:.0f} 부름 넘는) 칸의 기록 점까지 가장 작은 각 {a_occ:.1f}° → ≥ 40° {"맞음" if a_occ >= 40 else "아님"}')
print(f'  (나) 모든 기록 점까지 가장 작은 각 {a_all:.1f}° → ≥ 40° {"맞음" if a_all >= 40 else "아님"} · 40° 안 부름 {int((ang < 40).sum())}')
for lo, hi in [(0, 40), (40, 45), (45, 50), (50, 60), (60, 75), (75, 90)]:
    print(f'    −r0 에서 {lo} ~ {hi}°: {int(((ang >= lo) & (ang < hi)).sum())} 부름')
