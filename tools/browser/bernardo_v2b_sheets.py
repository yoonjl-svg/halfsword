"""베르나르도 v2 밤 다듬기 전 · 후 그림 묶기 (10/23 23:4x ~ 23:5x 사장님 — 수염 · 머리 · 목깃 / 긴 망토 · 겉옷 · 금테 · 머리띠).

tools/browser/bernardo_look_shots.mjs 가 같은 카메라로 찍은 png(전 = 다듬기 전 v2 · 접두어 before / 후 = 다듬은 v2 · 접두어 after)를
왼쪽 전 · 오른쪽 후 한 장씩 webp 로 묶는다. 자세는 찍을 때마다 AI 가 처음 고른 겨눔이라 전 · 후가 조금 다를 수 있다(카메라는 같음).

실행 (저장소 뿌리에서): python3 -I tools/browser/bernardo_v2b_sheets.py <찍은 폴더> <출력 폴더> [전 삼각형] [후 삼각형]
  bernardo_v2b_front.webp  정면        (내 인물 감춤 · 상대 칼 티소나 그대로)
  bernardo_v2b_angle.webp  앞 3/4(40°)
  bernardo_v2b_back.webp   뒤 — 긴 망토
  bernardo_v2b_face.webp   얼굴 · 목 가까이(30° · 0.95 m) — 수염 · 머리 · 쇠 깃 · 머리띠
  bernardo_v2b_fight.webp  결투 거리 — 위: 게임 화면 그대로(폰 가로 844 × 390 · 화면 배율 2 를 반으로) · 아래: 상대만 잘라 화소 그대로 세 배
삼각형 수는 tools/sim/look_tris.mjs 의 몸 하나(칼 뺌) 값. 글꼴: 문천역 정흑(wqy-zenhei), 없으면 PIL 기본.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
BEFORE = int(sys.argv[3]) if len(sys.argv) > 3 else 21567
AFTER = int(sys.argv[4]) if len(sys.argv) > 4 else 22662
os.makedirs(OUT, exist_ok=True)
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
INK, PAPER = (243, 233, 216), (27, 20, 16)
GAP, QUALITY = 8, 88
TAGS = (f'전 · v2 (10/23 낮) · 삼각형 {BEFORE:,}', f'후 · v2 다듬음 (10/23 밤) · 삼각형 {AFTER:,}')
FIGHT_BOX = (790, 180, 990, 460)  # 화면 배율 2 그림에서 상대(베르나르도) 자리 — 두 판 다 이 상자 안


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


for view in ('front', 'angle', 'back', 'face'):
    save(pair(img(f'before_{view}.png'), img(f'after_{view}.png'), 18), f'bernardo_v2b_{view}.webp')

full = [img(f'{v}_fight.png') for v in ('before', 'after')]
crops = [im.crop(FIGHT_BOX) for im in full]
crops = [c.resize((c.width * 3 // 2, c.height * 3 // 2), Image.NEAREST) for c in crops]
small = [im.resize((im.width // 2, im.height // 2), Image.LANCZOS) for im in full]
w, h = small[0].size
ch = crops[0].height
sheet = Image.new('RGB', (w * 2 + GAP * 3, h + ch + GAP * 3), PAPER)
for i in range(2):
    x = GAP + i * (w + GAP)
    sheet.paste(label(small[i].copy(), TAGS[i], 16, (10, 34)), (x, GAP))
    sheet.paste(label(crops[i].copy(), '가까이 자름 (화면 배율 2 그림 × 1.5)', 14), (x + (w - crops[i].width) // 2, h + GAP * 2))
save(sheet, 'bernardo_v2b_fight.webp')
