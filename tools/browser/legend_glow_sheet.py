# 레전드 기운 견줌 판 (10/24 — 사장님 확인용). legend_glow_measure.mjs 가 찍은 폰 가로(844 × 390 · 화면 배율 2) 사진에서
#  칼날 둘레를 잘라 무기 여섯을 한 줄에 나란히 — 줄 = 상황(보기 × 무대). 게임 보기(mine · foe)는 화면 px 150 × 110 을 폰 화소 그대로(2 배),
#  옆 가까이(side)는 400 × 290 을 절반으로. 켬 사진은 숨 가운데 견본(on<k>) 하나, --off 면 끔 사진.
#  실행: python3 -I tools/browser/legend_glow_sheet.py <사진 폴더[,폴더…]> <출력 .webp> [--sample=2] [--off] [--title=…] [--views=mine,foe,side]
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict((a[2:].split('=', 1) + [''])[:2] for a in sys.argv[1:] if a.startswith('--'))
out = Path(args[1])
meta, where = {}, {}  # 사진 폴더를 쉼표로 여럿 줄 수 있다
for fo in args[0].split(','):
    for k, v in json.loads((Path(fo) / 'meta.json').read_text()).items():
        if not k.startswith('_'):
            meta[k], where[k] = v, Path(fo)
sample = opts.get('sample', '2')
shot = 'off' if 'off' in opts else f'on{sample}'
LEGENDS = ['excalibur', 'kusanagi', 'moye', 'ganjiang', 'durandal', 'balisarda']
NAME = {'excalibur': '엑스칼리버 (기준)', 'kusanagi': '쿠사나기', 'moye': '막야', 'ganjiang': '간장', 'durandal': '뒤랑달', 'balisarda': '발리사르다'}
STAGE = {'poseidon': '포세이돈 신전 (밝은 낮)', 'castle': '성 안뜰 (낮)', 'cathedral': '대성당 (실내)', 'castle_night': '밤의 성 안뜰', 'poseidon_night': '밤의 포세이돈 신전', 'frozen_bay': '얼어붙은 만'}
VIEW = {'mine': '내 칼 · 게임 화면', 'foe': '상대 칼 · 게임 화면', 'side': '칼 옆 1.25 m', 'sidefar': '칼 옆 4.3 m (게임 거리)'}
CROP = {'mine': (150, 110, 2.0), 'foe': (150, 110, 2.0), 'side': (400, 290, 1.0), 'sidefar': (150, 110, 2.0)}  # 화면 px 폭 · 높이 · 타일 배율(화면 px → 그림 px)
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
TAG = {'before': ' 전', 'after': ' 후', 'ref': ''}  # 견줌 갈래 이름 → 칸 글 (예: durandal~after → 뒤랑달 후)


def label(w):
    base, _, v = w.partition('~')
    return (NAME.get(base, base) + TAG.get(v, f' {v}' if v else '')) if base in NAME else w


def font(n):
    try:
        return ImageFont.truetype(FONT, n)
    except OSError:
        return ImageFont.load_default()


weapons = opts['cols'].split(',') if opts.get('cols') else [w for w in LEGENDS if any(m.get('weapon') == w for k, m in meta.items() if not k.startswith('_'))]  # --cols= 로 견줌 갈래(무기~갈래)도
views = [v for v in opts.get('views', 'side,sidefar,mine,foe').split(',') if any(m.get('view') == v for k, m in meta.items() if not k.startswith('_'))]
stages = []
for k, m in meta.items():
    if not k.startswith('_') and m['stage'] not in stages:
        stages.append(m['stage'])
rows = [(v, s) for v in views for s in stages]
GAP, LAB_W, HEAD = 6, 190, 40
tile = {v: (round(CROP[v][0] * CROP[v][2]), round(CROP[v][1] * CROP[v][2])) for v in views}
width = LAB_W + max(len(weapons) * (tile[v][0] + GAP) for v in views)
height = HEAD + sum(tile[v][1] + GAP for v, s in rows) + 30
sheet = Image.new('RGB', (width, height), (24, 24, 28))
d = ImageDraw.Draw(sheet)
d.text((10, 8), opts.get('title', '') or f'레전드 기운 — {"끔" if shot == "off" else "켬"} · 폰 가로 844 × 390 화면에서 칼날 둘레', font=font(20), fill=(235, 235, 235))
y = HEAD
for v, s in rows:
    tw, th = tile[v]
    d.text((10, y + 8), VIEW[v], font=font(16), fill=(235, 235, 235))
    d.text((10, y + 32), STAGE.get(s, s), font=font(15), fill=(190, 190, 190))
    for i, w in enumerate(weapons):
        key = f'{w}_{v}_{s}'
        x = LAB_W + i * (tw + GAP)
        fk = meta.get(key, {}).get('offKey', key) if shot == 'off' else key  # 견줌 갈래의 끔 사진은 바탕 줄 것
        if key not in meta or not (where[key] / f'{fk}_{shot}.png').exists():
            continue
        p = where[key] / f'{fk}_{shot}.png'
        m = meta[key]
        cx, cy = (m['a'][0] + m['b'][0]) / 2, (m['a'][1] + m['b'][1]) / 2
        cw, ch, _ = CROP[v]
        cx = min(max(cx, cw / 2), 844 - cw / 2)
        cy = min(max(cy, ch / 2), 390 - ch / 2)
        k = m.get('dsf', 2)
        im = Image.open(p).convert('RGB').crop((round(k * (cx - cw / 2)), round(k * (cy - ch / 2)), round(k * (cx + cw / 2)), round(k * (cy + ch / 2))))
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
        if y == HEAD or (v, s) == rows[0] or s == stages[0]:
            d.text((x + 6, y + 4), label(w), font=font(15), fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
    y += th + GAP
d.text((10, y + 4), '같은 자세 · 같은 카메라 · 같은 순간(화면 시계 고정). 칼 · 몸은 판 시작 자세에서 멈춤', font=font(14), fill=(170, 170, 170))
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(out, 'WEBP', quality=86, method=6)
print(out, sheet.size)
