#!/usr/bin/env python3
# 조건 ① ② ③ (파일에서 셈): python3 judge_arm.py <폴더 $S/r26> <바탕 칸> <새 칸>
#  ① 빈 팔 명령 한 스텝 > 8° 수 (두 묶음 합) 반 넘게 줆 · 가장 큰 ≤ 60° (j12 · j12b — r9b arm_cmd2 '팔 명령2' 줄)
#  ② 칼 팔 > 8° · > 20° 수가 손 안 댄 칸의 흔들림 (r18 노트 §2: > 8° 합 213 ~ 256 · > 20° 12 ~ 13) 안 — 바탕 칸 값도 같이 찍음
#  ③ arm_real D 여섯 자리 frac.arms 모두 0.000 (armsD — r9b arms_d_probe)
import sys, re
d, A, B = sys.argv[1:4]
pat = re.compile(r'칼 팔 (\d+) · >8° (\d+) · >20° (\d+) · 가장 큰 ([\d.]+)° \| 빈 팔 (\d+) · >8° (\d+) · >20° (\d+) · 가장 큰 ([\d.]+)°')
def j(c):
    out = []
    for f in (f'{d}/j12_{c}.txt', f'{d}/j12b_{c}.txt'):
        m = [pat.search(l) for l in open(f) if '팔 명령2' in l][-1]
        out.append([float(x) for x in m.groups()])
    return out
def arms(c):
    return [float(x) for x in re.findall(r'frac\.arms ([\d.]+)', open(f'{d}/armsD_{c}.txt').read())]
a, b = j(A), j(B)
o8a, o8b = a[0][5] + a[1][5], b[0][5] + b[1][5]
o20a, o20b = a[0][6] + a[1][6], b[0][6] + b[1][6]
omx = max(b[0][7], b[1][7])
p1 = o8b <= 0.5 * o8a and omx <= 60
print(f'① 빈 팔 > 8°: {A} {a[0][5]:.0f} + {a[1][5]:.0f} = {o8a:.0f} → {B} {b[0][5]:.0f} + {b[1][5]:.0f} = {o8b:.0f} ({(o8b / o8a - 1) * 100:+.1f} %) · > 20° {o20a:.0f} → {o20b:.0f} · 가장 큰 {max(a[0][7], a[1][7]):.1f} → {omx:.1f}° (묶음별 {b[0][7]:.1f} · {b[1][7]:.1f}) → {"맞음" if p1 else "아님"}')
s8a, s8b = a[0][1] + a[1][1], b[0][1] + b[1][1]
s20a, s20b = a[0][2] + a[1][2], b[0][2] + b[1][2]
p2 = 213 <= s8b <= 256 and 12 <= s20b <= 13
print(f'② 칼 팔 > 8° 합 {A} {s8a:.0f} → {B} {s8b:.0f} (흔들림 213 ~ 256) · > 20° {s20a:.0f} → {s20b:.0f} (12 ~ 13) · 가장 큰 {max(a[0][3], a[1][3]):.1f} → {max(b[0][3], b[1][3]):.1f}° → {"맞음" if p2 else "흔들림 밖 (바탕 칸 값과 맞대 볼 것)"}')
aa, ab = arms(A), arms(B)
p3 = len(ab) == 6 and max(ab) == 0
print(f'③ arm_real D frac.arms {A} {aa} → {B} {ab} → {"맞음" if p3 else "아님"}')
