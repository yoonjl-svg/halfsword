# 고노센 한 손 잔심 그림 (10/12 08:2x — docs/strike/cn_combo_play_2026-10-12.md §13). 읽기만.
#  TRACE_STIFF=2.4 node tools/sim/secret_trace.mjs <json> 이 쓴 'iai' 프레임에서 한 때(초)를 골라 옆·앞 두 칸으로 그린다.
#  파랑 = 칼 팔(어깨 → 팔꿈치 → 손목) · 초록 = 빈팔 · 검정 = 칼(칼자루 끝 → 칼끝) · 엷은 파랑 = 내 몸통·머리 · 회색 = 상대.
#  실행: python3 tools/sim/iai_hold_draw.py <json> <때 초> <나갈 png> [제목]
import json, sys
from PIL import Image, ImageDraw

src, at, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
title = sys.argv[4] if len(sys.argv) > 4 else f't={at}'
fr = json.load(open(src))['iai']['frames']
f = min(fr, key=lambda x: abs(x['t'] - at))
W, H, S = 300, 300, 110
img = Image.new('RGB', (W * 2, H + 20), (255, 255, 255))
d = ImageDraw.Draw(img)
d.text((4, 3), f"{title}   t={f['t']:.2f}s  stiff={'yes' if f['stiff'] else 'no'}  left hand on hilt={'yes' if f['grip'] else 'no'}", fill=(0, 0, 0))


def panel(ox, view):
    d.rectangle([ox, 20, ox + W - 1, 20 + H - 1], outline=(200, 200, 200))
    d.text((ox + 6, 24), view, fill=(90, 90, 90))
    if view == 'side':
        P = lambda p: (ox + 90 + p[0] * S, 20 + H * 0.45 - p[1] * S)
    else:
        P = lambda p: (ox + W * 0.5 + p[2] * S, 20 + H * 0.45 - p[1] * S)
    hoff = [f['fh'][i] - f['fc'][i] for i in range(3)]
    gy = f['fp'][1] - 0.95
    for c, p, col, w in ((f['fc'], f['fp'], (175, 175, 175), 10), (f['mc'], f['mp'], (150, 180, 235), 8)):
        h = [c[0] + (hoff[0] if c is f['fc'] else 0), c[1] + hoff[1], c[2] + (hoff[2] if c is f['fc'] else 0)]
        x, y = P(h)
        r = 0.11 * S
        d.ellipse([x - r, y - r, x + r, y + r], outline=col, width=2)
        d.line([P(c), P(p)], fill=col, width=w)
        for s in (-0.1, 0.1):
            ft = list(p)
            ft[1] = gy
            ft[0 if view == 'side' else 2] += s
            d.line([P(p), P(ft)], fill=col, width=4)
    d.line([P(f['hi']), P(f['tip'])], fill=(20, 20, 20), width=3)
    if 'osh' in f:
        d.line([P(f['osh']), P(f['oel']), P(f['owr'])], fill=(40, 170, 60), width=4)
        x, y = P(f['owr'])
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(40, 170, 60))
    d.line([P(f['sh']), P(f['el']), P(f['wr'])], fill=(30, 80, 220), width=5)
    x, y = P(f['wr'])
    d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(30, 80, 220))


panel(0, 'side')
panel(W, 'front')
img.save(out, optimize=True)
print('wrote', out)
