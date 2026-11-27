#!/usr/bin/env python3
# 오늘 pole 의 두 축(+pole 늘어뜨린 팔 쪽 · −pole 손이 높고 안쪽) 가까이에 손 축 Dn 이 머무는 몫 (dn_rec 기록): python3 axis_share.py <폴더> <칸>
#  −pole 둘레를 한 바퀴 도는 길에서 오늘 pDir 은 한 바퀴 돌고, 특이점이 −pole 밖에 있는 매끈한 장(새 셈)은 안 돈다 → 그 둘레 어딘가에서 둘이 90° 넘게 어긋남이 피할 수 없음.
#  그 둘레에 기록이 많을수록 사람 쪽(오늘 pole 쪽) 어긋남 몫의 아래 끝이 큼
import sys, glob
import numpy as np
d, c = sys.argv[1:3]
X = np.concatenate([np.fromfile(f, dtype=np.float32).reshape(-1, 9).astype(float) for f in sorted(glob.glob(f'{d}/rec_{c}_*.f32'))])
D = X[:, :3] / np.linalg.norm(X[:, :3], axis=1, keepdims=True)
P = np.array([-0.25, -1, 0.5]); P /= np.linalg.norm(P)
a = np.degrees(np.arccos(np.clip(D @ P, -1, 1)))
for r in (10, 20, 30, 45):
    print(f'{c}: +pole {r}° 안 {(a < r).mean() * 100:.2f} % · −pole {r}° 안 {(a > 180 - r).mean() * 100:.2f} % (부름 {len(D)})')
