import sys, glob, os, json
from PIL import Image, ImageDraw, ImageFont
# 뒤돌아 뛰기 카메라 띠 (11/20 — tools/browser/run_cam_strip.mjs 가 찍은 장면을 한 장으로): 줄마다 한 안(이름) · 칸마다 판 시간 · 칸 아래 숫자(빠르기 · 카메라와 나 → 상대 사이 각 · 스틱이 화면에서 가리키는 쪽과 몸이 가는 쪽 사이 각)
#  실행: python3 tools/browser/run_cam_sheet.py <그림 폴더> <나갈 그림> <이름1> [이름2 …]
D = sys.argv[1]
OUT = sys.argv[2]
tags = sys.argv[3:]
sc = 0.25
pad = 40
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except Exception:
    font = small = ImageFont.load_default()
rows = []
for tag in tags:
    files = sorted(glob.glob(f'{D}/{tag}_[0-9][0-9]_u*.png'))
    log = json.load(open(f'{D}/{tag}_log.json'))['log'] if os.path.exists(f'{D}/{tag}_log.json') else []
    rows.append((tag, files, log))
im0 = Image.open(rows[0][1][0])
tw, th = int(im0.width * sc), int(im0.height * sc)
ncol = max(len(r[1]) for r in rows)
W = 120 + ncol * (tw + 4)
H = len(rows) * (th + pad + 18)
out = Image.new('RGB', (W, H), (24, 24, 24))
d = ImageDraw.Draw(out)
deg = lambda r: '-' if r is None else f'{r * 57.3:+.0f}°'
for ri, (tag, files, log) in enumerate(rows):
    y0 = ri * (th + pad + 18)
    d.text((8, y0 + 18 + th // 2 - 8), tag.upper(), fill=(255, 220, 120), font=font)
    for c, fn in enumerate(files):
        u = float(fn.rsplit('_u', 1)[1][:-4])
        im = Image.open(fn).convert('RGB').resize((tw, th))
        x = 120 + c * (tw + 4)
        out.paste(im, (x, y0 + 18))
        d.text((x + 4, y0 + 2), f'{u:.1f} s', fill=(255, 255, 255), font=font)
        s = min(log, key=lambda r: abs(r['u'] - u)) if log else None
        if s:
            txt = f"{s['v']:.1f} m/s  cam-foe {deg(s['camVsFoe'])}  stick-move {deg(s['stickVsVel'])}"
            d.text((x + 4, y0 + 20 + th), txt, fill=(200, 200, 200), font=small)
out.save(OUT, optimize=True)
print(out.size)
