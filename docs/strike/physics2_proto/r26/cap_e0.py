#!/usr/bin/env python3
# 빈 팔꿈치 쪽 새 셈의 r0 · e0 찾기 (게임 기록에서 셈 — 눈으로 안 맞춤): python3 cap_e0.py <기록 폴더> <칸> [--r0=x,y,z --e0deg=ψ]
#  기록 = dn_rec.mjs 의 rec_<칸>_*.f32 (부름마다 9 칸: Dn' · 오늘 pDir' · m · 손 높이 · 거리 — 가슴 틀 · 빈손 쪽 맞춤 z' = 바깥)
#  ① 빈 머리(cap): 같은 넓이 칸(y 띠 90 × 방위 180 = 16 200 칸 · 칸 지름 약 2°)에 Dn 을 넣고 몫 > 0.01 % 인 칸을 '차 있음' 으로.
#     후보 가운데 c (피보나치 공 200 000 점)마다 차 있는 칸 가운데까지 가장 작은 각 → 가장 큰 것이 빈 머리. −r0 = c.
#     뽑은 c 에서 차 있는 칸의 기록 점 전부 · 모든 기록 점까지 가장 작은 각도 따로 셈 (칸 크기 몫 보정).
#  ② e0: r0 에 곧은 면에서 각 ψ (0.1° 간격). 새 pDir = Rmin(r0 → Dn) e0.
#     (a) 사람 쪽 pDir · pole ≥ 0 인 부름 몫이 가장 큰 ψ (어긋난 부름 수가 가장 작은 것 — 같은 수 모두) 가운데
#     (b) 오늘 투영 m > 0.3 인 부름에서 오늘 pDir 과의 평균 각이 가장 작은 ψ.
#  ③ 그 r0 · e0 로 사람 쪽 몫 · 손이 어깨 아래인데 팔꿈치가 어깨 위인 부름 수 · 열 자세 표.
import sys, glob, os
import numpy as np
d, cell = sys.argv[1], sys.argv[2]
opt = dict(a[2:].split('=', 1) for a in sys.argv[3:] if a.startswith('--'))
fs = sorted(glob.glob(f'{d}/rec_{cell}_*.f32'))
parts = {os.path.basename(f)[len(f'rec_{cell}_'):-4]: np.fromfile(f, dtype=np.float32).reshape(-1, 9).astype(np.float64) for f in fs}
X = np.concatenate(list(parts.values()))
N = len(X)
print(f'기록 {cell}: 부름 {N} · ' + ' · '.join(f'{k} {len(v)}' for k, v in parts.items()))
Dn = X[:, 0:3] / np.linalg.norm(X[:, 0:3], axis=1, keepdims=True)
P0 = X[:, 3:6]; M = X[:, 6]; HY = X[:, 7]; DL = X[:, 8]
POLE = np.array([-0.25, -1, 0.5]); POLE /= np.linalg.norm(POLE)
A, B = 0.3, 0.275
# ── ① 같은 넓이 칸 ──
NY, NP = 90, 180
iy = np.clip(((Dn[:, 1] + 1) / 2 * NY).astype(int), 0, NY - 1)
ip = np.clip(((np.arctan2(Dn[:, 2], Dn[:, 0]) + np.pi) / (2 * np.pi) * NP).astype(int), 0, NP - 1)
bid = iy * NP + ip
cnt = np.bincount(bid, minlength=NY * NP)
occ = np.nonzero(cnt > 1e-4 * N)[0]
anyocc = np.nonzero(cnt > 0)[0]
def centre(b):
    y = -1 + (b // NP + 0.5) * 2 / NY; ph = -np.pi + (b % NP + 0.5) * 2 * np.pi / NP; r = np.sqrt(1 - y * y)
    return np.stack([r * np.cos(ph), y, r * np.sin(ph)], axis=1)
Cocc = centre(occ)
print(f'칸 {NY * NP} · 기록 있는 칸 {len(anyocc)} · 몫 > 0.01 % ({1e-4 * N:.0f} 부름 넘음) 칸 {len(occ)} (그 칸 부름 몫 {cnt[occ].sum() / N * 100:.2f} %)')
K = 200000
i = np.arange(K) + 0.5; y = 1 - 2 * i / K; r = np.sqrt(1 - y * y); th = np.pi * (1 + 5 ** 0.5) * i
C = np.stack([r * np.cos(th), y, r * np.sin(th)], axis=1)
best = np.full(K, -1.0)
for s in range(0, len(Cocc), 512):
    best = np.maximum(best, (C @ Cocc[s:s + 512].T).max(axis=1))
k = int(np.argmin(best))
c = C[k]
if 'r0' in opt: c = -np.array([float(v) for v in opt['r0'].split(',')]); c /= np.linalg.norm(c)
cap_bins = np.degrees(np.arccos(np.clip((Cocc @ c).max(), -1, 1)))
inocc = np.isin(bid, occ)
cap_pts = np.degrees(np.arccos(np.clip((Dn[inocc] @ c).max(), -1, 1)))
cap_all = np.degrees(np.arccos(np.clip((Dn @ c).max(), -1, 1)))
r0 = -c
print(f'빈 머리 가운데 −r0 = ({c[0]:.4f}, {c[1]:.4f}, {c[2]:.4f}) [앞 · 위 · 바깥] → r0 = ({r0[0]:.4f}, {r0[1]:.4f}, {r0[2]:.4f})')
print(f'빈 머리 반지름: 차 있는 칸 가운데까지 {cap_bins:.1f}° · 그 칸의 기록 점까지 {cap_pts:.1f}° · 모든 기록 점까지 {cap_all:.1f}° (조건 ≥ 40°: {"맞음" if cap_pts >= 40 else "아님"})')
# 둘째로 큰 빈 머리 (첫째에서 60° 넘게 떨어진 것) — 머리가 하나뿐인지 봄
far = C @ c < np.cos(np.radians(60))
k2 = np.nonzero(far)[0][np.argmin(best[far])]
print(f'둘째 빈 머리 (첫째에서 60° 밖): 가운데 ({C[k2][0]:.3f}, {C[k2][1]:.3f}, {C[k2][2]:.3f}) · 반지름 {np.degrees(np.arccos(best[k2])):.1f}°')
# ── ② e0 ──
b1 = np.cross(r0, [0, 1, 0]); b1 /= np.linalg.norm(b1); b2 = np.cross(r0, b1)
def transport(v, D):
    # 가장 짧은 돌림 r0 → D 로 v (r0 에 곧은 단위) 옮김: v c + k × v + k (k·v)/(1 + c) · k = r0 × D
    cc = D @ r0; kk = np.cross(r0, D)
    return v * cc[:, None] + np.cross(kk, v) + kk * ((kk @ v) / (1 + cc))[:, None]
V1, V2 = transport(b1, Dn), transport(b2, Dn)
ps = np.radians(np.arange(0, 360, 0.1))
pd1, pd2 = V1 @ POLE, V2 @ POLE
bad = np.array([int(((np.cos(p) * pd1 + np.sin(p) * pd2) < 0).sum()) for p in ps])
wd = M > 0.3
q1, q2 = (V1[wd] * P0[wd]).sum(1), (V2[wd] * P0[wd]).sum(1)
mang = np.array([np.degrees(np.arccos(np.clip(np.cos(p) * q1 + np.sin(p) * q2, -1, 1))).mean() for p in ps])
if 'e0deg' in opt: j = int(round(float(opt['e0deg']) / 0.1)) % len(ps)
else:
    tie = np.nonzero(bad == bad.min())[0]; j = int(tie[np.argmin(mang[tie])])
psi = ps[j]; e0 = np.cos(psi) * b1 + np.sin(psi) * b2
print(f'e0: ψ = {np.degrees(psi):.1f}° (b1 = r0 × 위 · b2 = r0 × b1) → e0 = ({e0[0]:.4f}, {e0[1]:.4f}, {e0[2]:.4f})')
print(f'  (a) 사람 쪽 어긋남 (새 pDir · pole < 0): {bad[j]} / {N} 부름 = {bad[j] / N * 100:.3f} % (ψ 가운데 가장 작은 수 {bad.min()} · 같은 수 ψ {int((bad == bad.min()).sum())} 개 · 오늘 셈 0)')
print(f'  (b) m > 0.3 부름 {int(wd.sum())} 에서 오늘 pDir 과 평균 각 {mang[j]:.2f}° (모든 ψ 가운데 가장 작은 값 {mang.min():.2f}° @ ψ {np.degrees(ps[np.argmin(mang)]):.1f}°)')
for lo, hi in [(0, 0.05), (0.05, 0.3), (0.3, 0.488), (0.488, 9)]:
    s = (M >= lo) & (M < hi)
    if s.any():
        pn = np.cos(psi) * V1[s] + np.sin(psi) * V2[s]
        a = np.degrees(np.arccos(np.clip((pn * P0[s]).sum(1), -1, 1)))
        print(f'    m {lo} ~ {hi}: 부름 {int(s.sum())} · 오늘 pDir 과 각 평균 {a.mean():.1f}° · 90 백분위 {np.percentile(a, 90):.1f}° · 가장 큰 {a.max():.1f}°')
# ── ③ 사람 쪽 · 팔꿈치 높이 ──
PN = np.cos(psi) * V1 + np.sin(psi) * V2
dd = np.clip(DL, 0.08, A + B - 0.005)
al = np.arccos(np.clip((A * A + dd * dd - B * B) / (2 * A * dd), -1, 1))
U = Dn * np.cos(al)[:, None] + PN * np.sin(al)[:, None]
U0 = Dn * np.cos(al)[:, None] + P0 * np.sin(al)[:, None]
low = HY < 0
print(f'손이 어깨 아래인 부름 {int(low.sum())}: 팔꿈치가 어깨 위 (위팔 방향 y > 0) 새 {int(((U[:, 1] > 0) & low).sum())} · 오늘 {int(((U0[:, 1] > 0) & low).sum())} · 새 위팔 y 가장 큰 {U[low, 1].max():.3f}')
print(f'사람 쪽 어긋남 줄별: ' + ' · '.join(f'{kk} {int(((PN[o:o + len(v)] @ POLE) < 0).sum())}/{len(v)}' for kk, v, o in zip(parts, parts.values(), np.cumsum([0] + [len(v) for v in parts.values()]))))
# ── 열 자세 (가슴 틀 손 자리 [앞, 위, 바깥] m · 빈 어깨 (0, 0.1, 0.2)) ──
POSES = [('손 낮게 앞', [0.35, -0.35, 0.0]), ('빈손 쪽 허리', [0.05, -0.45, 0.22]), ('칼 쪽 허리', [0.1, -0.45, -0.2]), ('뻗은 찌르기 (두손 칼자루 끝)', [0.55, 0.05, -0.05]),
         ('머리 위 높은 자세', [0.1, 0.55, -0.05]), ('빈손 쪽 어깨', [0.15, 0.15, 0.2]), ('칼 쪽 어깨', [0.15, 0.15, -0.2]), ('늘어뜨림', [0.0, -0.47, 0.2]),
         ('유파 자세 (이탈리아 guard)', [0.35, 0.18, 0.12]), ('유파 런지 (이탈리아 lunge)', [0.3, 0.36, 0.04])]
S0 = np.array([0, 0.1, 0.2])
print('| 자세 | 손 [앞 · 위 · 바깥] | Dn 과 −r0 각 | 오늘 m | 오늘 위팔 (아래 · 뒤 · 바깥) | 새 위팔 (아래 · 뒤 · 바깥) | 두 위팔 각 |')
print('|---|---|---|---|---|---|---|')
for nm, h in POSES:
    D = np.array(h) - S0; dl = np.linalg.norm(D); Dv = D / dl
    p0 = POLE - (POLE @ Dv) * Dv; m = np.linalg.norm(p0); p0 /= m
    pn = (np.cos(psi) * transport(b1, Dv[None])[0] + np.sin(psi) * transport(b2, Dv[None])[0])
    dd = min(max(dl, 0.08), A + B - 0.005); a_ = np.arccos(np.clip((A * A + dd * dd - B * B) / (2 * A * dd), -1, 1))
    u0 = Dv * np.cos(a_) + p0 * np.sin(a_); un = Dv * np.cos(a_) + pn * np.sin(a_)
    f = lambda u: f'{-u[1]:.2f} · {-u[0]:.2f} · {u[2]:.2f}'
    print(f'| {nm} | {h[0]} · {h[1]} · {h[2]} | {np.degrees(np.arccos(np.clip(Dv @ c, -1, 1))):.0f}° | {m:.2f} | {f(u0)} | {f(un)} | {np.degrees(np.arccos(np.clip(u0 @ un, -1, 1))):.1f}° |')
print(f'JS 상수: OFF_ELB_R0 = [{r0[0]:.4f}, {r0[1]:.4f}, {r0[2]:.4f}] · OFF_ELB_E0 = [{e0[0]:.4f}, {e0[1]:.4f}, {e0[2]:.4f}]')
