"""redondo_trace.mjs 가 적은 몸 틀 칼끝 길을 그림 한 장으로 (사장님 10/30 00:1x '궤적이 8자 모양' — 기록 docs/strike/redondo_hold_2026-10-29.md §8-9).
줄 = 견줄 판(json 하나씩) · 칸 = 위에서(앞 ↑ · 칼 든 쪽 →) · 뒤에서(카메라 쪽 — 칼 든 쪽 → · 위 ↑) · 옆에서(앞 → · 위 ↑).
감기 마지막 한 바퀴 = 회색 · 드는 이음(맞힘 없음) = 주황 · 벰 = 빨강 굵게 · 뗀 자리 = 흰 점 · 몸 = 가슴 원점 · 머리 · 두 어깨.
사용: python3 tools/browser/redondo_trace_plot.py <out.png> <제목=json> [<제목=json> …] [--runs=0,1]
"""
import json
import math
import sys
from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--'))
out = args[0]
rows = [a.split('=', 1) for a in args[1:]]
runs_sel = [int(x) for x in opts['runs'].split(',')] if 'runs' in opts else None
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
    big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    font = small = big = ImageFont.load_default()

PW, PH = 330, 330
LBL = 46
# 칸: (이름, 가로 축 (i, 부호), 세로 축 (i, 부호), 범위 [가로 lo, hi, 세로 lo, hi])  — 점 = [몫, t, x, y, z, hx, hy, hz]
VIEWS = [
    ('top-down (fwd up, sword side right)', (4, 1), (2, 1), (-1.7, 1.7, -1.1, 2.3)),
    ('from behind (camera side)', (4, 1), (3, 1), (-1.7, 1.7, -0.9, 2.5)),
    ('side (fwd right)', (2, 1), (3, 1), (-1.2, 2.2, -0.9, 2.5)),
]
COL = {'wind': (150, 150, 160), 'blend': (100, 100, 110), 'lead': (255, 160, 40), 'cut': (255, 70, 70), 'after': (120, 70, 70)}

W = PW * len(VIEWS)
H = len(rows) * (PH + LBL) + 30
img = Image.new('RGB', (W, H), (22, 22, 24))
d = ImageDraw.Draw(img)
d.text((8, 6), 'Windmill cut (redondo) - tip path in body frame - grey: last wind turn, orange: lift (no hit), red: cut', fill=(255, 220, 120), font=big)


def tf(view, ox, oy):
    _, (hi, hs), (vi, vs), (h0, h1, v0, v1) = view

    def f(p):
        a = hs * p[hi] if isinstance(p, list) else p[0]
        b = vs * p[vi] if isinstance(p, list) else p[1]
        return (ox + (a - h0) / (h1 - h0) * PW, oy + PH - (b - v0) / (v1 - v0) * PH)

    return f


def body(view, f):
    # 몸 틀 점: 가슴 원점 · 머리(가슴 위 0.33) · 어깨(위 0.1 · 옆 ±0.2)
    name = view[0]
    pts = {'chest': [0, 0, 0], 'head': [0, 0.33, 0], 'shS': [0, 0.1, 0.2], 'shO': [0, 0.1, -0.2]}
    hi, vi = view[1][0] - 2, view[2][0] - 2
    for k, p in pts.items():
        x, y = f((p[hi], p[vi]))
        r = 13 if k == 'head' else 5
        d.ellipse((x - r, y - r, x + r, y + r), outline=(90, 140, 200), width=2)
    a = f((pts['shS'][hi], pts['shS'][vi]))
    b = f((pts['shO'][hi], pts['shO'][vi]))
    d.line((a, b), fill=(90, 140, 200), width=2)


def last_turn(wind):
    # 감기 마지막 한 바퀴: 뗀 자리에서 거꾸로, 위에서 본 칼끝이 가운데(감기 점 평균) 둘레로 360° 돌 때까지
    if not wind:
        return wind
    on = [p for p in wind if p[0] == 'wind'] or wind  # 가운데 = 다 섞인 감기 점만 (섞는 길은 쉼 자세 쪽으로 치우침)
    cx = sum(p[2] for p in on) / len(on)
    cz = sum(p[4] for p in on) / len(on)
    acc = 0.0
    k = len(wind) - 1
    prev = math.atan2(wind[k][4] - cz, wind[k][2] - cx)
    while k > 0 and acc < 2 * math.pi:
        k -= 1
        a = math.atan2(wind[k][4] - cz, wind[k][2] - cx)
        da = a - prev
        while da > math.pi:
            da -= 2 * math.pi
        while da < -math.pi:
            da += 2 * math.pi
        acc += abs(da)
        prev = a
    return wind[k:]


for ri, (title, path) in enumerate(rows):
    J = json.load(open(path))
    runs = J['runs']
    sel = [runs[i] for i in runs_sel] if runs_sel else runs
    kc = max(range(len(sel)), key=lambda i: sel[i]['release'])  # 회색 한 바퀴는 가장 오래 감은 판에서 (짧으면 섞는 길이 섞여 듦)
    oy = 30 + ri * (PH + LBL)
    for vi, view in enumerate(VIEWS):
        ox = vi * PW
        d.rectangle((ox + 2, oy + 2, ox + PW - 3, oy + PH - 3), outline=(60, 60, 66))
        f = tf(view, ox, oy)
        # 바닥 격자 (0.5 m)
        h0, h1, v0, v1 = view[3]
        g = -2.0
        while g <= 2.5:
            for (a0, b0, a1, b1) in (((g, v0), (g, v1), None, None), ((h0, g), (h1, g), None, None)):
                pa, pb = f(a0), f(b0)
                d.line((pa, pb), fill=(34, 34, 38) if abs(g) > 1e-6 else (52, 52, 58), width=1)
            g += 0.5
        body(view, f)
        for k, R in enumerate(sel):
            P = R['pts']
            wind = last_turn([p for p in P if p[0] in ('blend', 'wind')])
            if k == kc and wind:
                d.line([f(p) for p in wind], fill=COL['wind'], width=2)
            lead = [p for p in P if p[0] == 'lead']
            cut = [p for p in P if p[0] == 'cut']
            if wind and lead:
                lead = [wind[-1]] + lead
            if lead:
                d.line([f(p) for p in lead], fill=COL['lead'], width=2)
            if cut:
                c0 = [lead[-1]] if lead else ([wind[-1]] if wind else [])
                d.line([f(p) for p in c0 + cut], fill=COL['cut'], width=4)
                ex, ey = f(cut[-1])
                d.ellipse((ex - 4, ey - 4, ex + 4, ey + 4), fill=COL['cut'])
            if wind:
                sx, sy = f(wind[-1])
                d.ellipse((sx - 4, sy - 4, sx + 4, sy + 4), fill=(255, 255, 255))
        if ri == 0:
            d.text((ox + 8, oy + 6), view[0], fill=(200, 200, 210), font=small)
    rel = ', '.join(f"{r['release']:.1f}" for r in sel)

    def rng(get, fmt='{:.2f}'):
        v = [get(r) for r in sel if get(r) is not None]
        if not v:
            return '-'
        a, b = min(v), max(v)
        return fmt.format(a) if abs(b - a) < 1e-9 else f'{fmt.format(a)}~{fmt.format(b)}'

    d.text((8, oy + PH + 4), f'{title}', fill=(255, 235, 200), font=font)
    d.text((8, oy + PH + 22), f"released at {rel} s of winding | release->cut {rng(lambda r: r.get('tCut'))} s | lift: tip path {rng(lambda r: r['f8'].get('leadLen'))} m, lowest tip {rng(lambda r: r['f8'].get('leadLow'))} m above chest", fill=(200, 200, 200), font=small)
img.save(out, optimize=True)
print(out, img.size)
