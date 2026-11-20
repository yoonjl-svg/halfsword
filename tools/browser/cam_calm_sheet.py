import sys, glob, os, json, math
from PIL import Image, ImageDraw, ImageFont
# 뛰기 카메라 띠 (11/21 — tools/browser/cam_calm_strip.mjs 가 찍은 장면을 한 장으로): 줄마다 한 판본(이름 — 이름=보일 글 로 바꿔 적을 수 있음) · 칸마다 판 시간 ·
#  칸 아래 숫자: 빠르기(실제 m/s) · 뛰나(RUN · 버팀 몫 %) · 카메라 방위가 도는 빠르기(실제 °/s — 그 장면 앞뒤 0.2 s) · 상대가 화면 가운데에서 벗어난 몫(NDC x)
#  실행: python3.12 tools/browser/cam_calm_sheet.py <그림 폴더> <나갈 그림> <제목> <이름1[=글]> [이름2[=글] …]
D = sys.argv[1]
OUT = sys.argv[2]
TITLE = sys.argv[3]
tags = [a.split('=', 1) if '=' in a else (a, a) for a in sys.argv[4:]]
sc = 0.3
pad = 40
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except Exception:
    font = small = ImageFont.load_default()
TK = 1.1
w = lambda a: math.atan2(math.sin(a), math.cos(a))
rows = []
for tag, label in tags:
    files = sorted(glob.glob(f'{D}/{tag}_[0-9][0-9]_u*.png'))
    log = json.load(open(f'{D}/{tag}_log.json'))['log'] if os.path.exists(f'{D}/{tag}_log.json') else []
    rows.append((label, files, log))
im0 = Image.open(rows[0][1][0])
tw, th = int(im0.width * sc), int(im0.height * sc)
ncol = max(len(r[1]) for r in rows)
LW = 170
W = LW + ncol * (tw + 4)
H = 30 + len(rows) * (th + pad + 18)
out = Image.new('RGB', (W, H), (24, 24, 24))
d = ImageDraw.Draw(out)
d.text((8, 6), TITLE, fill=(255, 255, 255), font=font)


def yaw_rate(log, u):
    a = [r for r in log if u - 0.15 <= r['u'] <= u + 0.15]
    if len(a) < 2 or a[-1]['u'] - a[0]['u'] < 0.05:
        return None
    return abs(w(a[-1]['camYaw'] - a[0]['camYaw'])) / ((a[-1]['u'] - a[0]['u']) / TK) * 57.3


for ri, (label, files, log) in enumerate(rows):
    y0 = 30 + ri * (th + pad + 18)
    for li, line in enumerate(label.split('|')):
        d.text((8, y0 + 18 + th // 2 - 16 + li * 18), line, fill=(255, 220, 120), font=font)
    for c, fn in enumerate(files):
        u = float(fn.rsplit('_u', 1)[1][:-4])
        im = Image.open(fn).convert('RGB').resize((tw, th))
        x = LW + c * (tw + 4)
        out.paste(im, (x, y0 + 18))
        s = min(log, key=lambda r: abs(r['u'] - u)) if log else None
        st = ''
        if s:
            st = 'RUN' if s['run'] else (f"hold {s.get('hold', 0) / (2.0 * TK) * 100:.0f}%" if s.get('hold') else 'walk')
        d.text((x + 4, y0 + 2), f'{u:.1f} s  {st}', fill=(255, 255, 255), font=font)
        if s:
            yr = yaw_rate(log, u)
            txt = f"{s['v']:.1f} m/s  turn {'-' if yr is None else f'{yr:.0f}'}°/s  foe x {s['foeX']:+.2f}"
            d.text((x + 4, y0 + 20 + th), txt, fill=(200, 200, 200), font=small)
out.save(OUT, optimize=True)
print(out.size)
