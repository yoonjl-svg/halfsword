"""라트나 그림 묶기 (docs/import/ratna/*.webp) — tools/browser/ratna_shots.mjs 가 찍은 png 를 이름 붙여 한 장씩으로.

실행: python3 -I tools/browser/ratna_sheets.py <찍은 폴더> <출력 폴더>
  ratna_views.webp           정면 · 왼옆 · 뒤 — 위 줄 샛별 v3, 아래 줄 우리 v4
  ratna_duel_phone.webp      폰 가로 844×390 게임 화면(화면 배율 2를 1.5 로 줄임) — 판 시작 소개 글 · 싸우는 중
  ratna_duel_stages.webp     무대 셋에서 싸우는 중 (v3 · v4)
  ratna_trousers.webp        바지 색 전/후 (다리 가까이 + 색 견본, 곰 석상 가슴 무늬 #D98A3A 함께)
  ratna_face.webp            얼굴 전/후 (가까이 + 결투 거리 폰 화면 그대로의 얼굴 칸을 화소 그대로 4 배)
  ratna_monkey_check.webp    원숭이 겹침 검사 모음 — 위 줄 샛별 v3 자리(왼 어깨), 아래 줄 v4 자리(등 가방 위)
글꼴: 문천역 정흑(wqy-zenhei — 한글 있음), 없으면 PIL 기본.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'


def font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


INK, PAPER, DIM, MARK = (243, 233, 216), (27, 20, 16), (184, 168, 142), (217, 164, 65)


def img(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')


def label(im, text, size=18, pos=(8, 6), color=INK):
    d = ImageDraw.Draw(im)
    f = font(size)
    x, y = pos
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
        d.text((x + dx, y + dy), text, font=f, fill=(20, 13, 9))
    d.text((x, y), text, font=f, fill=color)
    return im


def sheet(rows, cell, gap=6, head=None, head_h=0):
    """rows: [[(png 또는 Image, 이름표)…]…] → 한 장"""
    w = len(rows[0]) * cell[0] + (len(rows[0]) + 1) * gap
    h = head_h + len(rows) * cell[1] + (len(rows) + 1) * gap
    out = Image.new('RGB', (w, h), PAPER)
    if head:
        label(out, head, 20, (gap + 4, 8), MARK)
    for r, row in enumerate(rows):
        for c, (src, text) in enumerate(row):
            im = src if isinstance(src, Image.Image) else img(src)
            im = im.resize(cell, Image.LANCZOS)
            if text:
                label(im, text, 17)
            out.paste(im, (gap + c * (cell[0] + gap), head_h + gap + r * (cell[1] + gap)))
    return out


def save(im, name, q=82):
    p = os.path.join(OUT, name)
    im.save(p, 'WEBP', quality=q, method=6)
    print(name, im.size, os.path.getsize(p), 'B')


# 1) 정면 · 옆 · 뒤
views = [[(f'views_{v}_{k}.png', f'{tag} · {ko}') for k, ko in (('front', '정면'), ('left', '왼옆'), ('back', '뒤'))] for v, tag in (('v3', '샛별 v3'), ('v4', '우리 v4'))]
save(sheet(views, (360, 450)), 'ratna_views.webp')

# 2) 폰 가로 게임 화면 (v4): 판 시작 소개 · 싸우는 중
duel = []
for k, ko in (('intro', '판 시작 1.0 s — 가운데 소개 글'), ('fight', '싸우는 중 6 s')):
    im = img(f'duel_sacred_grove_v4_{k}.png')
    duel.append(label(im.resize((1266, 585), Image.LANCZOS), f'844×390 폰 가로 · 신목의 숲 · {ko}', 22))
out = Image.new('RGB', (1266, 585 * 2 + 6), PAPER)
out.paste(duel[0], (0, 0))
out.paste(duel[1], (0, 591))
save(out, 'ratna_duel_phone.webp', 80)

# 3) 무대 셋 (싸우는 중, v3 · v4)
stages = [('sacred_grove', '신목의 숲'), ('corsair', '산호 항구'), ('castle', '눈 내리는 성 안뜰')]
rows = [[(f'duel_{s}_{v}_fight.png', f'{tag} · {ko}') for s, ko in stages] for v, tag in (('v3', '샛별 v3'), ('v4', '우리 v4'))]
save(sheet(rows, (562, 260)), 'ratna_duel_stages.webp', 78)


# 4) 바지 색 전/후 + 색 견본
def swatch(hexs, w=300, h=330):
    im = Image.new('RGB', (w, h), PAPER)
    d = ImageDraw.Draw(im)
    y = 10
    for hx, text in hexs:
        rgb = tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))
        d.rectangle((12, y, 92, y + 60), fill=rgb)
        d.text((104, y + 6), f'#{hx.upper()}', font=font(18), fill=INK)
        d.text((104, y + 32), text, font=font(15), fill=DIM)
        y += 78
    return im


legs = [img('close_v3_legs.png').crop((120, 150, 520, 560)), img('close_v4_legs.png').crop((120, 150, 520, 560))]
sw = swatch([('c29b45', '전 바지 (샛별 v2·v3) 41° · 채도 .51 · L* 66'), ('b68854', '후 바지 (v4) 32° · 채도 .40 · L* 60'),
             ('d98a3a', '곰 석상 가슴 무늬 (감독 기준 색)'), ('8d673f', '후 솔기 (전 #9D7936)')], 330, 330)
out = Image.new('RGB', (330 * 3 + 24, 330 + 12), PAPER)
for i, (im, t) in enumerate(zip(legs, ('전 · 샛별 v3', '후 · v4 — 채도 한 단계 · 무릎 띠 뺌'))):
    out.paste(label(im.resize((330, 330), Image.LANCZOS), t, 17), (6 + i * 336, 6))
out.paste(sw, (6 + 2 * 336, 6))
save(out, 'ratna_trousers.webp')

# 5) 얼굴 전/후: 가까이 + 결투 거리(폰 화면 화소 그대로, 4 배 키움 — 최근접)
face_near = [img('close_v3_face.png').crop((150, 160, 470, 480)), img('close_v4_face.png').crop((150, 160, 470, 480))]
crops = []
for v in ('v3', 'v4'):
    im = img(f'duel_sacred_grove_{v}_fight.png')
    box = open(os.path.join(SRC, f'duel_sacred_grove_{v}_fight.head')).read().split(',')
    cx, cy = float(box[0]) * 2, float(box[1]) * 2  # css px → 화면 배율 2 의 화소
    half = 40
    crops.append(im.crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half))).resize((320, 320), Image.NEAREST))
rows = [[(face_near[0], '전 · 샛별 v3 (가까이)'), (face_near[1], '후 · v4 (가까이)'), (crops[0], '전 · 결투 거리 화소 ×4'), (crops[1], '후 · 결투 거리 화소 ×4')]]
save(sheet(rows, (320, 320)), 'ratna_face.webp')

# 6) 원숭이 겹침 모음
scenes = [('guard_revez', '레베스 준비'), ('guard_talho', '탈류 준비'), ('guard_altibaxo', '머리 위'), ('guard_revezOriz', '가로 레베스'), ('tech_zornhauL', '분노의 베기 왼쪽'), ('tech_redondo', '머리 위 돌려 베기')]
rows = [[(f'monkey_{v}_{s}.png', f'{tag} · {ko}') for s, ko in scenes] for v, tag in (('v3', 'v3 왼 어깨'), ('v4', 'v4 등 가방 위'))]
save(sheet(rows, (240, 240)), 'ratna_monkey_check.webp')
