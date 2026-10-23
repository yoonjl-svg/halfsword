"""베르나르도 v2 사자 빛깔 · 망토 두께 전 · 후 그림 묶기 (10/24 00:3x 사장님 — '사자 색이 너무 튄다. 그냥 검게 하거나 금색으로. 굵은 주름 표현은 좋은데 망토가 너무 두꺼워보여').

tools/browser/bernardo_look_shots.mjs 가 같은 카메라 · 같은 씨앗(--seed=1 — 같은 겨눔)으로 찍은 png 를 묶어 webp 로 낸다.
  전 = 고치기 전 v2(보랏빛 사자 · 안감 5 mm 안쪽 두 겹 망토 · 굵은 단) · 접두어 before
  후 = 고친 v2(검은 사자 · 한 장 두 면 망토 · 가는 단 · 앞 끝 아랫단 덜 벌어짐) · 접두어 after
  금 = 금빛 사자 미리보기(?look=bernardo:v2-gold — 망토는 후와 같음) · 접두어 gold

실행 (저장소 뿌리에서): python3 -I tools/browser/bernardo_v2c_sheets.py <찍은 폴더> <출력 폴더> [전 삼각형] [후 삼각형] [금 삼각형]
  bernardo_v2c_front.webp       정면 전 · 후 (내 인물 감춤 · 상대 칼 티소나 그대로)
  bernardo_v2c_angle.webp       앞 3/4(40°) 전 · 후
  bernardo_v2c_back.webp        뒤 전 · 후 — 긴 망토
  bernardo_v2c_side.webp        옆 전 · 후 — 위: 망토 쪽(인물 오른쪽) · 아래: 반대쪽 (망토 두께 · 실루엣)
  bernardo_v2c_chest.webp       가슴 가까이(팔 · 칼 감춤) 전 · 후 — 사자
  bernardo_v2c_gold_front.webp  정면 검은 사자(기본) · 금빛 사자
  bernardo_v2c_gold_chest.webp  가슴 가까이 검은 사자(기본) · 금빛 사자
삼각형 수는 tools/sim/look_tris.mjs 의 몸 하나(칼 뺌) 값. 글꼴: 문천역 정흑(wqy-zenhei), 없으면 PIL 기본.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
BEFORE = int(sys.argv[3]) if len(sys.argv) > 3 else 22662
AFTER = int(sys.argv[4]) if len(sys.argv) > 4 else 22534
GOLD = int(sys.argv[5]) if len(sys.argv) > 5 else 22680
os.makedirs(OUT, exist_ok=True)
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
INK, PAPER = (243, 233, 216), (27, 20, 16)
GAP, QUALITY = 8, 88
TAG_BEFORE = f'전 · 10/23 밤 · 보랏빛 사자 · 두 겹 망토 · 삼각형 {BEFORE:,}'
TAG_AFTER = f'후 · 10/24 · 검은 사자 · 얇은 망토 · 삼각형 {AFTER:,}'
TAG_BLACK = f'검은 사자 (기본) · 삼각형 {AFTER:,}'
TAG_GOLD = f'금빛 사자 (고르실 것) · 삼각형 {GOLD:,}'


def font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


def label(im, text, size=18, pos=(10, 8)):
    d = ImageDraw.Draw(im)
    f = font(size)
    x, y = pos
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
        d.text((x + dx, y + dy), text, font=f, fill=(20, 13, 9))
    d.text((x, y), text, font=f, fill=INK)
    return im


def grid(rows, tags, size=18):
    """rows = [[왼쪽 그림, 오른쪽 그림], …] — 모두 같은 크기 · 맨 윗줄에만 이름표"""
    w, h = rows[0][0].size
    out = Image.new('RGB', (w * 2 + GAP * 3, (h + GAP) * len(rows) + GAP), PAPER)
    for r, pair in enumerate(rows):
        for i, im in enumerate(pair):
            im = label(im.copy(), tags[i], size) if r == 0 else im
            out.paste(im, (GAP + i * (w + GAP), GAP + r * (h + GAP)))
    return out


def save(im, name):
    im.save(os.path.join(OUT, name), 'WEBP', quality=QUALITY, method=6)
    print(name, im.size)


def img(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')


for view in ('front', 'angle', 'back', 'chest'):
    save(grid([[img(f'before_{view}.png'), img(f'after_{view}.png')]], (TAG_BEFORE, TAG_AFTER)), f'bernardo_v2c_{view}.webp')
save(grid([[img(f'before_side{s}.png'), img(f'after_side{s}.png')] for s in 'RL'], (TAG_BEFORE, TAG_AFTER)), 'bernardo_v2c_side.webp')
for view in ('front', 'chest'):
    save(grid([[img(f'after_{view}.png'), img(f'gold_{view}.png')]], (TAG_BLACK, TAG_GOLD)), f'bernardo_v2c_gold_{view}.webp')
