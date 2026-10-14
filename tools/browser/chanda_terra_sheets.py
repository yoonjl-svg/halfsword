"""찬다 · 병마용 그림 묶기 (docs/import/chanda_terra/*.webp) — tools/browser/chanda_terra_shots.mjs 가 찍은 png 를 이름 붙여 한 장씩으로.

실행: python3 -I tools/browser/chanda_terra_sheets.py <찍은 폴더> <출력 폴더>
  chanda_views.webp        찬다 정면 · 왼옆 · 뒤 — 위 줄 샛별 v1, 아래 줄 우리 v2(무릎)
  chanda_knee.webp         무릎 전/후 — 겨눔 정면 · 겨눔 3/4 · 무릎 꿇기 (위 v1 · 아래 v2)
  terracotta_views.webp    병마용 정면 · 왼옆 · 뒤 — 위 샛별 v1, 아래 우리 v2(잔선 덜기)
  terracotta_detail.webp   잔선 덜기 전/후 가까이 — 머리 · 가슴 · 다리
  duel.webp                결투 거리 게임 화면(844×390, 화면 배율 1) — 판 시작 · 싸우는 중 (찬다 · 병마용)
  terracotta_line.webp     병마용 대사와 출처 — 판 시작 소개 · 결과 창
  clay_stumps.webp         같은 판 사람 · 병마용 목 단면 — 피 켬 · 끔 (+ 실전이 끝난 뒤 병마용 가까이)
글꼴: 문천역 정흑(wqy-zenhei — 한글 있음), 없으면 PIL 기본.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
INK, PAPER, DIM, MARK = (243, 233, 216), (27, 20, 16), (184, 168, 142), (217, 164, 65)


def font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


def img(name):
    return Image.open(os.path.join(SRC, name)).convert('RGB')


def label(im, text, size=16, pos=(6, 5), color=INK):
    d = ImageDraw.Draw(im)
    f = font(size)
    x, y = pos
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)):
        d.text((x + dx, y + dy), text, font=f, fill=(20, 13, 9))
    d.text((x, y), text, font=f, fill=color)
    return im


def sheet(rows, cell, gap=5, strip=0):
    """rows: [[(png 이름 또는 Image, 이름표)…]…] → 한 장. strip > 0 이면 이름표를 그림 아래 띠에 (게임 화면 글과 겹치지 않게)"""
    w = len(rows[0]) * cell[0] + (len(rows[0]) + 1) * gap
    ch = cell[1] + strip
    h = len(rows) * ch + (len(rows) + 1) * gap
    out = Image.new('RGB', (w, h), PAPER)
    for r, row in enumerate(rows):
        for c, (src, text) in enumerate(row):
            im = src if isinstance(src, Image.Image) else img(src)
            im = im.resize(cell, Image.LANCZOS)
            x, y = gap + c * (cell[0] + gap), gap + r * (ch + gap)
            if text and not strip:
                label(im, text)
            out.paste(im, (x, y))
            if text and strip:
                ImageDraw.Draw(out).text((x + 4, y + cell[1] + 3), text, font=font(14), fill=INK)
    return out


def save(im, name, q=70):
    p = os.path.join(OUT, name)
    im.save(p, 'WEBP', quality=q, method=6)
    print(name, im.size, os.path.getsize(p), 'B')


VIEWS = (('front', '정면'), ('left', '왼옆'), ('back', '뒤'))
crop_v = lambda n: img(n).crop((150, 40, 490, 760))  # 640×800 에서 인물 칸
# 1) 찬다 정면 · 옆 · 뒤
rows = [[(crop_v(f'views_chanda_{v}_{k}.png'), f'{tag} · {ko}') for k, ko in VIEWS] for v, tag in (('v1', '샛별 v1'), ('v2', '우리 v2'))]
save(sheet(rows, (186, 394)), 'chanda_views.webp', 56)
# 2) 무릎 전/후
KNEE = (('guard_front', '탄복세 겨눔 · 정면'), ('guard_34', '겨눔 · 오른 앞 35°'), ('kneel_front', '무릎 꿇기 · 정면'))
rows = [[(img(f'knee_{v}_{k}.png').crop((80, 40, 560, 600)), f'{tag} · {ko}') for k, ko in KNEE] for v, tag in (('v1', '전 v1'), ('v2', '후 v2'))]
save(sheet(rows, (200, 234)), 'chanda_knee.webp', 60)
# 3) 병마용 정면 · 옆 · 뒤
rows = [[(crop_v(f'views_terracotta_{v}_{k}.png'), f'{tag} · {ko}') for k, ko in VIEWS] for v, tag in (('v1', '샛별 v1'), ('v2', '우리 v2'))]
save(sheet(rows, (186, 394)), 'terracotta_views.webp', 56)
# 4) 잔선 덜기 가까이
DET = (('head', '머리 홈 · 새김'), ('chest', '엮은 끈'), ('legs', '솔기'))
rows = [[(img(f'detail_{v}_{k}.png').crop((70, 70, 570, 570)), f'{tag} · {ko}') for k, ko in DET] for v, tag in (('v1', '전 v1'), ('v2', '후 v2'))]
save(sheet(rows, (214, 214)), 'terracotta_detail.webp', 60)
# 5) 결투 거리 (게임 화면 그대로)
rows = [[(f'duel_{i}_{k}.png', f'{nm} · {ko}') for k, ko in (('start', '판 시작 — 소개'), ('fight', '싸우는 중 6 s'))] for i, nm in (('chanda', '찬다 (막야)'), ('terracotta', '병마용 (간장 — 임시)'))]
save(sheet(rows, (456, 211), strip=20), 'duel.webp', 56)
# 6) 병마용 대사 · 출처
rows = [[('line_intro_1.png', '판 시작 소개 — 대사 아래 줄 출처 (12 px · 보조 색 #B8A88E · 400)'), ('line_result.png', '결과 창 부제 — 대사 아래 줄 출처')]]
save(sheet(rows, (562, 260), strip=20), 'terracotta_line.webp', 72)
# 7) 단면 색 — 사람 · 흙 몸, 피 켬 · 끔 + 실전 장면
cells = [[(f'clay_blood_{b}_{w}.png', f'피 {bk} · {wk}') for w, wk in (('human', '사람 목 단면'), ('clay', '병마용 목 단면'))] for b, bk in (('on', '켬'), ('off', '끔'))]
grid = sheet(cells, (205, 205))
fight = img('clay_fight.png')
fight = fight.resize((int(fight.width * grid.height / fight.height), grid.height), Image.LANCZOS)
out = Image.new('RGB', (grid.width + fight.width + 5, grid.height), PAPER)
out.paste(grid, (0, 0))
out.paste(label(fight, '실전 뒤 병마용 — 흙 목 단면 · 피 없음'), (grid.width, 0))
save(out, 'clay_stumps.webp', 62)
