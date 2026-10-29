"""풍차 베기 휘청 고치기 전 · 뒤 한 장 (redondo_motion_shots.mjs TIMED=1 KEEP=1 두 번 — 같은 감기 시각 · 옆 눈). 칸마다 감기 시각 · 가슴 기울기.
사용: python3 tools/browser/redondo_motion_pair.py <고치기 전 폴더> <고친 뒤 폴더> <나갈 그림>
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

before, after, out_fn = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
    big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    font = big = ImageFont.load_default()
box = (232, 0, 612, 390)
sc = 0.52
tw, th = int((box[2] - box[0]) * sc), int((box[3] - box[1]) * sc)
rows = [(before, 'BEFORE fix (rdSteady=0): wind start staggers back'), (after, 'AFTER fix (default)')]
metas = [json.load(open(f'{d}/_shots.json'))['summary'][0] for d, _ in rows]
n = len(metas[0]['shots'])
top, gap = 22, 18
out = Image.new('RGB', (tw * n, (th + top + gap) * 2), (22, 22, 24))
d = ImageDraw.Draw(out)
for r, ((D, title), meta) in enumerate(zip(rows, metas)):
    y0 = r * (th + top + gap)
    d.text((6, y0 + 3), f"{title} - zweihander - side view - chest tilt max {meta.get('tiltMax', '?')} deg", fill=(255, 220, 120), font=big)
    for c, sh in enumerate(meta['shots']):
        im = Image.open(f"{D}/_spin_side_{sh['k']}.png").convert('RGB').crop(box).resize((tw, th))
        out.paste(im, (c * tw, y0 + top))
        tl = sh.get('tilt')
        d.text((c * tw + 4, y0 + top + th + 1), f"{sh['label']}  tilt {tl:.0f}" if tl is not None else sh['label'], fill=(235, 235, 235), font=font)
out.save(out_fn, optimize=True)
print(out_fn, out.size)
