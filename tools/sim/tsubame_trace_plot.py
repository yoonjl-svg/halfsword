# 제비 베기 칼끝 길 그림 (tools/sim/tsubame_trace.mjs --json 결과) — 갈래마다 옆(상대 쪽 x · 높이 y) · 앞(내 등 뒤에서 — 칼 든 쪽 z · 높이 y) 두 칸
#  굵은 파란 점 = 운동학 칼이 끄는 스텝 · 가는 노란 점 = 그 뒤 손가락 몫 · 회색 = 칼자루(손) 길 · 숫자 = 첫 맞음 부위
#  python3.12 tools/sim/tsubame_trace_plot.py <json> <png>   (PIL — 이 컨테이너는 python3.12 에 있음)
import json, sys
from PIL import Image, ImageDraw

J = json.load(open(sys.argv[1]))
runs = {}
for r in J['runs']:
    runs.setdefault(r['variant'], r)  # 갈래마다 첫 씨앗
W, H, PAD = 380, 300, 30
img = Image.new('RGB', (W * 2 + 20, (H + 40) * len(runs)), (24, 22, 20))
d = ImageDraw.Draw(img)


def axes(ox, oy, title, xl):
    d.rectangle([ox, oy, ox + W, oy + H], outline=(90, 90, 90))
    d.text((ox + 6, oy + 4), title, fill=(230, 220, 200))
    d.text((ox + W - 60, oy + H - 14), xl, fill=(150, 150, 150))
    d.text((ox + 6, oy + H - 14), 'y up', fill=(150, 150, 150))


for row, (name, r) in enumerate(runs.items()):
    oy = row * (H + 40) + 30
    pts = r['tip'] + r['hand']
    for k, (ix, title, xl) in enumerate([(1, f'{name}: side (x toward foe)', 'x ->'), (3, f'{name}: from behind (z sword side)', 'z ->')]):
        ox = k * (W + 20)
        axes(ox, oy, title, xl)
        xs = [p[ix] for p in pts]
        ys = [p[2] for p in pts]
        x0, x1 = min(xs) - 0.1, max(xs) + 0.1
        y0, y1 = min(ys) - 0.1, max(ys) + 0.1
        s = min((W - 2 * PAD) / max(1e-6, x1 - x0), (H - 2 * PAD) / max(1e-6, y1 - y0))
        P = lambda p: (ox + PAD + (p[ix] - x0) * s, oy + H - PAD - (p[2] - y0) * s)
        prev = None
        for p in r['hand']:
            q = P(p)
            if prev:
                d.line([prev, q], fill=(110, 110, 110), width=1)
            prev = q
        prev = None
        for p in r['tip']:
            q = P(p)
            col = (120, 200, 255) if p[4] else (255, 200, 90)
            if prev:
                d.line([prev, q], fill=col, width=3 if p[4] else 1)
            rr = 3 if p[4] else 1.5
            d.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=col)
            prev = q
        b = r.get('bend') or {}
        d.text((ox + 6, oy + 18), f"dev {b.get('dev')} m ({b.get('devShare')})  kink {b.get('kinkDeg')} deg  kin {b.get('dur')} s", fill=(200, 200, 200))
        hits = r.get('hits') or []
        d.text((ox + 6, oy + 32), 'hit ' + (','.join(h['zone'] for h in hits[:3]) or '-'), fill=(255, 120, 120))
img.save(sys.argv[2])
print('saved', sys.argv[2])
