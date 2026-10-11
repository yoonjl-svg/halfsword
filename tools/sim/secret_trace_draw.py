# 비기 길 흔적 그림 (10/12 — tools/sim/secret_trace.mjs 가 쓴 JSON 둘을 전/후 나란히). 읽기만.
#  칸 넷: 전 옆 · 전 앞 · 후 옆 · 후 앞. 옆 = x(앞) 가로 · y(위) 세로 / 앞 = 뒤에서 상대 쪽을 봄, z(칼 든 쪽) 가로 · y 세로.
#  회색 굵은 줄 = 상대 몸통(가슴 → 골반, 처음과 끝) · 엷은 → 짙은 선 = 칼(칼자루 끝 → 칼끝, 스텝 둘마다) · 빨강 = 칼끝 길 · 파랑 = 칼 팔(어깨 → 팔꿈치 → 손목, 처음·가운데·끝) · 초록 = 빈팔 (같은 때).
#  실행: python3 tools/sim/secret_trace_draw.py <전 json> <후 json> <열쇠 geojeong|pyodu|bongdu|iai> <나갈 png> [제목]
import json, sys
from PIL import Image, ImageDraw

before, after, key, out = sys.argv[1:5]
title = sys.argv[5] if len(sys.argv) > 5 else key
A = json.load(open(before)).get(key)
B = json.load(open(after)).get(key)
W, H, S = 260, 230, 95  # 칸 크기 · 1 m = S px
img = Image.new('RGB', (W * 4, H + 18), (255, 255, 255))
d = ImageDraw.Draw(img)
d.text((4, 2), f'{title}   [before: side | front]   [after: side | front]', fill=(0, 0, 0))


def panel(ox, run, view):
    d.rectangle([ox, 18, ox + W - 1, 18 + H - 1], outline=(200, 200, 200))
    if not run:
        d.text((ox + 6, 24), 'none', fill=(150, 0, 0))
        return
    fr = run['frames']
    if view == 'side':
        P = lambda p: (ox + 30 + p[0] * S, 18 + H * 0.62 - p[1] * S)
    else:
        P = lambda p: (ox + W * 0.5 + p[2] * S, 18 + H * 0.62 - p[1] * S)
    for f in (fr[0], fr[-1]):
        d.line([P(f['fc']), P(f['fp'])], fill=(170, 170, 170), width=7)
    n = len(fr)
    for i in range(0, n, 2):
        f = fr[i]
        g = int(215 - 175 * i / max(1, n - 1))
        d.line([P(f['hi']), P(f['tip'])], fill=(g, g, g), width=1)
    d.line([P(f['tip']) for f in fr], fill=(220, 30, 30), width=2)
    for f in (fr[0], fr[n // 2], fr[-1]):
        if 'osh' in f:
            d.line([P(f['osh']), P(f['oel']), P(f['owr'])], fill=(40, 170, 60), width=2)
        d.line([P(f['sh']), P(f['el']), P(f['wr'])], fill=(30, 80, 220), width=3)
    d.text((ox + 6, 22), f"{run['id']} {fr[-1]['t']:.2f}s", fill=(60, 60, 60))


panel(0, A, 'side')
panel(W, A, 'front')
panel(2 * W, B, 'side')
panel(3 * W, B, 'front')
img.save(out, optimize=True)
print('wrote', out)
