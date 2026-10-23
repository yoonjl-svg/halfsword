"""백린의 전사 줄이기 전 · 후 그림 묶기 (10/23 — tools/browser/white_scale_shots.mjs 가 찍은 png 를 왼쪽 전 · 오른쪽 후 한 장씩 webp 로).

실행 (저장소 뿌리에서): python3 -I tools/browser/white_scale_sheets.py <찍은 폴더> <출력 폴더> [전 삼각형] [후 삼각형]
  white_scale_front.webp   정면        — 왼쪽 v1(전달본) · 오른쪽 v2(줄인 판), 같은 자세 · 같은 카메라 (칼 감춤)
  white_scale_angle.webp   앞 3/4
  white_scale_back.webp    뒤
  white_scale_detail.webp  가까이(가슴 · 치마 3/4) — 결투 거리보다 훨씬 가까운 자리(작게 줄인 몫이 드러나는 곳)
  white_scale_fight.webp   결투 거리 — 위: 게임 화면 그대로(폰 가로 844 × 390 · 화면 배율 2 를 반으로) · 아래: 상대만 잘라 화소 그대로 두 배
삼각형 수는 tools/sim/look_tris.mjs 의 몸 하나(칼 뺌) 값. 글꼴: 문천역 정흑(wqy-zenhei), 없으면 PIL 기본.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
BEFORE = int(sys.argv[3]) if len(sys.argv) > 3 else 121398
AFTER = int(sys.argv[4]) if len(sys.argv) > 4 else 26648
os.makedirs(OUT, exist_ok=True)
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
INK, PAPER = (243, 233, 216), (27, 20, 16)
GAP, QUALITY = 8, 88
TAGS = (f'전 · v1 (전달본) · 삼각형 {BEFORE:,}', f'후 · v2 (줄인 판) · 삼각형 {AFTER:,}')


def font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


def label(im, text, size=20, pos=(10, 8)):
    d = ImageDraw.Draw(im)
    f = font(size)
    x, y = pos
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
        d.text((x + dx, y + dy), text, font=f, fill=(20, 13, 9))
    d.text((x, y), text, font=f, fill=INK)
    return im


def pair(a, b, size=20):
    """왼쪽 전 · 오른쪽 후 (같은 크기)"""
    w, h = a.size
    out = Image.new('RGB', (w * 2 + GAP * 3, h + GAP * 2), PAPER)
    for i, im in enumerate((a, b)):
        out.paste(label(im.copy(), TAGS[i], size), (GAP + i * (w + GAP), GAP))
    return out


def save(im, name):
    im.save(os.path.join(OUT, name), 'WEBP', quality=QUALITY, method=6)
    print(name, im.size)


def img(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')


for view in ('front', 'angle', 'back', 'detail'):
    save(pair(img(f'views_v1_{view}.png'), img(f'views_v2_{view}.png')), f'white_scale_{view}.webp')

# 결투 거리: 위 = 게임 화면(반으로 줄여 CSS 화소 크기) · 아래 = 같은 상자로 자른 상대(화면 배율 2 그대로 · 화소를 두 배로 키움)
full = [img(f'fight_{v}.png') for v in ('v1', 'v2')]
box = json.load(open(os.path.join(SRC, 'fight_v1.json'), encoding='utf8'))
k = full[0].width / box['W']
crop_box = tuple(int(round(v * k)) for v in (box['x0'], box['y0'], box['x1'], box['y1']))
crops = [im.crop(crop_box) for im in full]
crops = [c.resize((c.width * 2, c.height * 2), Image.NEAREST) for c in crops]
small = [im.resize((im.width // 2, im.height // 2), Image.LANCZOS) for im in full]
w, h = small[0].size
ch = crops[0].height
sheet = Image.new('RGB', (w * 2 + GAP * 3, h + ch + GAP * 3), PAPER)
for i in range(2):
    x = GAP + i * (w + GAP)
    sheet.paste(label(small[i].copy(), TAGS[i], 16, (10, 34)), (x, GAP))
    sheet.paste(label(crops[i].copy(), '가까이 자름 (화소 그대로 × 2)', 16), (x + (w - crops[i].width) // 2, h + GAP * 2))
save(sheet, 'white_scale_fight.webp')
