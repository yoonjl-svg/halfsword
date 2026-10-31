"""mordschlag_selfclip_shots.mjs 가 찍은 낱장을 눈마다 띠 그림으로 (칸마다 시각 · 토막 · 손목 앞뒤 · 팔 ↔ 머리 틈 — <tag>_frames.json).
사용: python3 tools/browser/mordschlag_selfclip_sheet.py <폴더> <tag 들 now_0.6,clip_0.6> [칸 수 12] [출력 폴더 = <폴더>]
 칸은 비기 동안(준비 wind · 내리침 cut · 다시 세우기 back) 장을 고르게 골라 — 칸 아래 글: t(실제 시작부터 s) · 토막 · 칼 든 손목이 내 머리 가운데보다 앞(+)/뒤(−) m · 팔 ↔ 머리 틈(음수 = 뚫음)
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1]
tags = sys.argv[2].split(',')
N = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else 12
OUT = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else D
os.makedirs(OUT, exist_ok=True)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 12)
    big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    font = big = ImageFont.load_default()
BOX = (172, 0, 672, 390)  # 844 × 390 가운데 (머리 둘레)
SC = 0.5
BOXES = {'game': (282, 40, 562, 390)}  # 게임 카메라(뒤 어깨 너머 · 멀리)는 가운데를 좁게 잘라 크게
SCS = {'game': 0.72}
VIEW = {'side': 'left side', 'q34': 'front-left 3/4', 'back': 'behind, over right shoulder', 'game': 'game camera'}
for tag in tags:
    meta = json.load(open(f'{D}/{tag}_frames.json'))
    shots = [s for s in meta['shots'] if s.get('ph')]
    pre = [s for s in meta['shots'] if not s.get('ph')]
    if not shots:
        continue
    pick = [x for x in meta['shots'] if x.get('pre')][-1:]  # 내기 바로 앞 한 장 (10/31 08:xx — 지금 판 순간이동 견줌)
    if len(shots) <= N:
        pick += shots
    else:
        pick += [shots[round(i * (len(shots) - 1) / (N - 1))] for i in range(N)]
    t0 = shots[0]['t']
    S = meta['summary']
    inf = S['info']
    clip = inf.get('noClip')
    name = 'FALLBACK pommel hammer (normal grip)' if inf.get('pommel') else ('BEST: regrip %.2f s + forced back burst + no self-clip' % inf['regrip']) if inf.get('regrip') and inf.get('burst') else ('regrip %.2f s' % inf['regrip']) if inf.get('regrip') else 'PROTOTYPE noSelfClip=1' if clip else 'CURRENT build'
    title = f"{name} - chest gap {inf['gap']} m - at {inf['at']}"
    stat = f"min arm-head gap {S['minArm']:.2f} m · min hand-head centre {S['minHandHead']:.2f} m · deepest wrist behind head centre {S['deepestBehind']:.2f} m · hilt-side vs own head {S['minHilt']:.2f} m · result {S['result']}"
    for view in [v for v in ('game', 'side', 'q34', 'back') if os.path.exists(f"{D}/{tag}_{v}_{pick[0]['k']}.png")]:
        bx, sc = BOXES.get(view, BOX), SCS.get(view, SC)
        tw, th = int((bx[2] - bx[0]) * sc), int((bx[3] - bx[1]) * sc)
        cols = min(len(pick), 7)
        rows = (len(pick) + cols - 1) // cols
        top, lab = 42, 30
        out = Image.new('RGB', (tw * cols, top + rows * (th + lab)), (22, 22, 24))
        d = ImageDraw.Draw(out)
        d.text((6, 4), f'{title} - {VIEW.get(view, view)} view', fill=(255, 220, 120), font=big)
        d.text((6, 23), stat, fill=(200, 200, 200), font=font)
        for i, s in enumerate(pick):
            im = Image.open(f"{D}/{tag}_{view}_{s['k']}.png").convert('RGB').crop(bx).resize((tw, th))
            x, y = (i % cols) * tw, top + (i // cols) * (th + lab)
            out.paste(im, (x, y))
            ph = 'pre (before fire)' if s.get('pre') else (s.get('ph') or 'after')
            behind = min(s['wristS'][0], s['wristO'][0])
            col = (255, 110, 110) if (s['arm'] < 0 or behind < 0) else (170, 230, 170)
            d.text((x + 4, y + th + 2), f"t {s['t'] - t0:+.3f} s  {ph}", fill=(230, 230, 230), font=font)
            d.text((x + 4, y + th + 15), f"wrist {behind:+.2f} m  arm gap {s['arm']:+.2f}", fill=col, font=font)
        out.save(f'{OUT}/{tag}_{view}_sheet.png')
        print(f'{OUT}/{tag}_{view}_sheet.png')
