# 중국 연환 칼끝 길 그림 — 수 번호·물러남 (10/12 08:2x 사장님 '지금 연환 길의 궤적과 네가 변경하려는 길의 궤적을 보여줄래?' —
#  docs/strike/cn_combo_play_2026-10-12.md §12). tools/sim/secret_trace.mjs 가 쓴 JSON 둘(전 두 수 · 후 세 수)을 나란히. 읽기만.
#  칸 넷: 전 옆 · 전 앞 · 후 옆 · 후 앞. 옆 = x(앞) 가로 · y(위) 세로 / 앞 = 내 뒤에서 상대 쪽을 봄, z(칼 든 쪽) 가로.
#  회색 실루엣 = 상대(머리·몸통·다리) · 엷은 파랑 실루엣 = 나(처음 · 끝) · 칼끝 길: 수 1 빨강 · 2 주황 · 3 보라 (굵은 선 = 맞힘 토막, 가는 선 = 굴림·준비) ·
#  동그라미 숫자 = 그 수가 시작하는 자리 · 초록 화살 = 마지막 수 동안 내 가슴이 움직인 길(물러남이면 뒤로).
#  실행: python3 tools/sim/cn_combo_trace_draw.py <전 json> <후 json> <열쇠 geojeong|pyodu|bongdu> <나갈 png> [제목]
import json, sys
from PIL import Image, ImageDraw

before, after, key, out = sys.argv[1:5]
title = sys.argv[5] if len(sys.argv) > 5 else key
A = json.load(open(before)).get(key)
B = json.load(open(after)).get(key)
W, H, S = 250, 250, 80  # 칸 크기 · 1 m = S px
COL = [(220, 30, 30), (240, 140, 0), (140, 40, 200)]
img = Image.new('RGB', (W * 4, H + 34), (255, 255, 255))
d = ImageDraw.Draw(img)
d.text((4, 2), f'{title}', fill=(0, 0, 0))
d.text((4, 16), 'BEFORE (2 moves): side | front            AFTER (3 moves): side | front      1 red  2 orange  3 purple  thick = cutting, thin = roll  green arrow = my chest (back step)', fill=(70, 70, 70))
TOP = 34


def panel(ox, run, view, label):
    d.rectangle([ox, TOP, ox + W - 1, TOP + H - 1], outline=(200, 200, 200))
    d.text((ox + 6, TOP + 4), label, fill=(60, 60, 60))
    if not run:
        d.text((ox + 6, TOP + 20), 'none', fill=(150, 0, 0))
        return
    fr = run['frames']
    if view == 'side':
        P = lambda p: (ox + 50 + p[0] * S, TOP + H * 0.42 - p[1] * S)
    else:
        P = lambda p: (ox + W * 0.5 + p[2] * S, TOP + H * 0.42 - p[1] * S)
    gy = fr[0]['fp'][1] - 0.95  # 바닥 (골반 아래 0.95 m 어림)

    def body(c, p, h, col, w):
        hx, hy = P(h)
        r = 0.11 * S
        d.ellipse([hx - r, hy - r, hx + r, hy + r], outline=col, width=2)
        d.line([P(c), P(p)], fill=col, width=w)
        for s in (-0.1, 0.1):
            foot = list(p)
            foot[1] = gy
            if view == 'side':
                foot[0] += s
            else:
                foot[2] += s
            d.line([P(p), P(foot)], fill=col, width=max(2, w // 2))

    f0, f1 = fr[0], fr[-1]
    hoff = [f0['fh'][i] - f0['fc'][i] for i in range(3)]
    body(f0['fc'], f0['fp'], f0['fh'], (160, 160, 160), 9)
    for f, col in ((f0, (150, 180, 235)), (f1, (90, 130, 210))):
        body(f['mc'], f['mp'], [f['mc'][i] + hoff[i] * (1 if i == 1 else 0) for i in range(3)], col, 5)
    # 칼끝 길 — 수마다 색
    moves = sorted({f['mi'] for f in fr if f['mi'] >= 0})
    for k in range(1, len(fr)):
        a, b = fr[k - 1], fr[k]
        if b['mi'] < 0:
            continue
        col = COL[min(b['mi'], 2)]
        d.line([P(a['tip']), P(b['tip'])], fill=col, width=4 if b['cut'] else 1)
    for m in moves:
        first = next(f for f in fr if f['mi'] == m)
        x, y = P(first['tip'])
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(255, 255, 255), outline=COL[min(m, 2)], width=2)
        d.text((x - 3, y - 6), str(m + 1), fill=(0, 0, 0))
    last = max(moves) if moves else -1
    seg = [f for f in fr if f['mi'] == last]
    if seg:
        a, b = P(seg[0]['mc']), P(seg[-1]['mc'])
        d.line([a, b], fill=(30, 160, 60), width=3)
        d.ellipse([b[0] - 4, b[1] - 4, b[0] + 4, b[1] + 4], fill=(30, 160, 60))
        dx = (seg[-1]['mc'][0] - seg[0]['mc'][0]) * 100
        d.text((ox + 6, TOP + H - 16), f'move {last + 1} chest fwd {dx:+.0f} cm   total {fr[-1]["t"]:.2f}s', fill=(30, 120, 50))


panel(0, A, 'side', 'before side')
panel(W, A, 'front', 'before front')
panel(2 * W, B, 'side', 'after side')
panel(3 * W, B, 'front', 'after front')
img.save(out, optimize=True)
print('wrote', out)
