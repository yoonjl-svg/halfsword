"""redondo_motion_shots.mjs 가 찍은 낱장을 감기 꼴 × 눈마다 띠 그림 한 장으로 (칸마다 이름 · 감기 시각 — _shots.json).
사용: python3 tools/browser/redondo_motion_strip.py <폴더> <꼴들 spin,slowSpin,shoulder · slowSpin:direct> [접미사 nofix] [적은 json 이름 (기본 _shots.json)]
 10/30 내려침 견줌 (꼴:길 — tag release_<길>): 띠 그림 이름 redondo_release_<길>_<눈>.png
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1]
modes = sys.argv[2].split(',')
suffix = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else ''
jname = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else '_shots.json'
meta = json.load(open(f'{D}/{jname}'))
by = {s['mode']: s for s in meta['summary']}
TITLE = {'spin': 'CURRENT spin (0.6 s/turn)', 'slowSpin': 'A slowSpin (1.2 s/turn, wider)', 'shoulder': 'B shoulder rest',
         'release_direct': 'NEW: A circle + direct diagonal cut (upper left -> lower right)', 'release_chamber': 'OLD: A circle + release over the left shoulder (extra loop)',
         'release_direct_60deg': 'A circle + direct cut, plane 60 deg from the ground (owner 10/30 01:3x)',
         'release_direct_shoulder': 'B (default, owner 10/31): sword rested on the right shoulder + direct 60 deg cut'}
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 13)
    big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    font = big = ImageFont.load_default()
box = {'side': (232, 0, 612, 390), 'q34': (232, 0, 612, 390)}  # 844×390 가운데 몸 둘레
sc = 0.52
for mode in modes:
    s = by.get(mode)
    if not s:
        continue
    for view in ('side', 'q34'):
        b = box[view]
        tw, th = int((b[2] - b[0]) * sc), int((b[3] - b[1]) * sc)
        n = len(s['shots'])
        top = 24
        out = Image.new('RGB', (tw * n, th + top + 18), (22, 22, 24))
        d = ImageDraw.Draw(out)
        tag = s.get('tag') or mode
        name = TITLE.get(tag, tag) + (' (before fix)' if suffix == 'nofix' else '')
        d.text((6, 4), f"{name} - {meta['weapon']} - {'side' if view == 'side' else '3/4'} view", fill=(255, 220, 120), font=big)
        for c, sh in enumerate(s['shots']):
            im = Image.open(f"{D}/_{mode}_{view}_{sh['k']}.png").convert('RGB').crop(b).resize((tw, th))
            out.paste(im, (c * tw, top))
            w = sh.get('w')
            lab = sh['label']
            sub = f"t {w['t'] / 1.1:.2f}s" if w else ''
            d.text((c * tw + 4, top + th + 2), f'{lab}  {sub}', fill=(235, 235, 235), font=font)
        fn = f"{D}/redondo_{tag}_{view}{'_' + suffix if suffix else ''}.png"
        out.save(fn, optimize=True)
        print(fn, out.size)
