"""봉인의 중정 디자인 리뷰 그림 묶기 (docs/design/courtyard_review_2026-10-17/) — courtyard_review.mjs · courtyard_camera_map.mjs 결과로.

실행: python3 -I tools/browser/courtyard_review_sheet.py <리뷰 작업 폴더> <출력 폴더>
  작업 폴더 안: shots/(compare) · shots2/(phones · positions) · details/(details · mask) · pave/(판석 1536 ↔ 1024 — 스크래치 사본) ·
               cammap_d2.json(courtyard_camera_map.mjs) · numbers.json(positions · gust · sheetLines · sheetNumbers — 시트 글)
  나오는 것 (jpg):
    01_act2_sequence.jpg   산호 항구 → 봉인의 중정 → 잠든 습지 — 경기 카메라 · 넓은 각 (같은 틀)
    02_vs_desert.jpg       봉인의 중정 ↔ 소금 사막 · 밤의 소금 사막 · 붉은 회랑 (같은 틀)
    03_camera_dive.jpg     평소 경기 카메라 ↔ 급수정에 등을 붙였을 때 (카메라가 내 몸 안 · 허리 높이로)
    04_camera_map.jpg      바닥 지도: 내가 어디 서면 카메라가 무너지나 — 중정 ↔ 잠든 습지 석상
    05_shade_hide.jpg      구운 그늘 안의 햇빛 몸 · 돌 너머로 사라진 마야
    06_phones.jpg          667×375 · 844×390 · 1280×720 · 판 시작 훑기
    07_story_props.jpg     위에서 본 짜임 · 붉은 밀랍(가까이 ↔ 경기 카메라 자리에서) · 봉인된 문 · 계단 우물 · 지평선
    08_paving.jpg          판석 무늬 1536² ↔ 1024² (폰 배율 2, 바닥 가까이)
    09_gust.jpg            잔잔할 때 ↔ 돌풍 한가운데 (같은 경기 카메라)
    courtyard_review_sheet.jpg  한 장 요약
글꼴: 문천역 정흑(wqy-zenhei — 한글 있음), 없으면 PIL 기본.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
INK, PAPER, DIM, MARK, BAD, GOOD = (243, 233, 216), (27, 20, 16), (184, 168, 142), (217, 164, 65), (232, 104, 84), (140, 200, 128)


def font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


def img(rel):
    return Image.open(os.path.join(SRC, rel)).convert('RGB')


def text(d, xy, s, size=17, color=INK):
    d.text(xy, s, font=font(size), fill=color)


def grid(rows, cell, head, gap=8, strip=26, head_h=40, note=None):
    """rows: [[(그림 경로 또는 Image, 이름표[, 색])…]…] → 한 장 (이름표는 그림 아래 띠)"""
    cols = max(len(r) for r in rows)
    w = cols * cell[0] + (cols + 1) * gap
    note_h = 26 * len(note) + 8 if note else 0
    h = head_h + len(rows) * (cell[1] + strip) + (len(rows) + 1) * gap + note_h
    out = Image.new('RGB', (w, h), PAPER)
    d = ImageDraw.Draw(out)
    text(d, (gap + 2, 9), head, 21, MARK)
    for r, row in enumerate(rows):
        for c, item in enumerate(row):
            src, label = item[0], item[1]
            color = item[2] if len(item) > 2 else INK
            im = src if isinstance(src, Image.Image) else img(src)
            im = im.resize(cell, Image.LANCZOS)
            x, y = gap + c * (cell[0] + gap), head_h + gap + r * (cell[1] + strip + gap)
            out.paste(im, (x, y))
            text(d, (x + 2, y + cell[1] + 3), label, 16, color)
    if note:
        y0 = h - note_h
        for i, line in enumerate(note):
            text(d, (gap + 2, y0 + 4 + 26 * i), line, 16, DIM)
    return out


def save(im, name, q=82):
    im.save(os.path.join(OUT, name), quality=q, optimize=True)
    return os.path.join(OUT, name)


num = json.load(open(os.path.join(SRC, 'numbers.json'))) if os.path.exists(os.path.join(SRC, 'numbers.json')) else {}

# ── 01 · 02 같은 틀 견주기 ──
NAMES = {'corsair': '산호 항구 (2막 · 앞)', 'courtyard': '봉인의 중정 (들어올 자리)', 'sluice': '잠든 습지 (2막 · 뒤)', 'dayr': '소금 사막 (해 질 녘)', 'dayr_night': '밤의 소금 사막', 'loggia': '붉은 회랑 (마야의 지금 자리)'}
short = lambda s: NAMES[s].split(' (')[0]
save(grid([[(f'shots/cmp_fight_{s}.png', f'{NAMES[s]} — 경기 카메라') for s in ('corsair', 'courtyard', 'sluice')],
           [(f'shots/cmp_wideA_{s}.png', f'{short(s)} — 넓은 각 (같은 자리)') for s in ('corsair', 'courtyard', 'sluice')]],
          (560, 259), '2막 차례 그대로: 산호 항구 → 봉인의 중정 → 잠든 습지 (844×390 · 같은 카메라 · 화면 글자 숨김)'), '01_act2_sequence.jpg')
cols = ('courtyard', 'dayr', 'dayr_night', 'loggia')
save(grid([[(f'shots/cmp_fight_{s}.png', NAMES[s]) for s in cols], [(f'shots/cmp_wideA_{s}.png', f'{short(s)} — 넓은 각') for s in cols], [(f'shots/cmp_wideB_{s}.png', f'{short(s)} — 반대쪽') for s in cols]],
          (420, 194), '겹침 점검: 아치 회랑이 둘러싼 포장 안뜰 · 상대 뒤 큰 문 · 왼쪽 우물 — 중정 ↔ 소금 사막(낮 · 밤) ↔ 붉은 회랑'), '02_vs_desert.jpg')

# ── 03 카메라 무너짐 ──
pos = {p['name']: p for p in num.get('positions', [])}
dist = lambda k: f"{pos[k]['camToMe']:.2f} m · 높이 {pos[k]['cam'][1]:.2f} m" if k in pos else ''
bear = [('shots2/pos_bear_back.png', f'(비교) 잠든 습지 석상에 등: {dist("bear_back")}', BAD)] if os.path.exists(os.path.join(SRC, 'shots2/pos_bear_back.png')) else []
save(grid([[('shots2/phone_844x390.png', '평소: 카메라 ↔ 내 몸 3.04 m · 높이 2.3 m', GOOD), ('shots2/pos_back_to_well.png', f'급수정에 등(긴 면): {dist("back_to_well")}', BAD)],
           [('shots2/pos_back_to_well_side.png', f'급수정에 등(짧은 면): {dist("back_to_well_side")}', BAD), *bear]],
          (640, 296), '카메라가 장애물을 피하려다 내 몸 안 · 허리 높이로 들어간다 (내 캐릭터가 사라지고 상대만 크게)',
          note=['까닭: 카메라 길이 보호 원에 막히면 그 앞으로 당기며 높이도 같은 비로 내 몸 높이까지 내린다(arena_obstacle.js clampStageCamera).',
                '중정은 원(1.73 m)이 돌(긴 면 반폭 0.85 m)보다 훨씬 커 돌과 원 사이 약 0.6 m 띠에도 설 수 있다 — 습지 석상은 띠 0.07 m 라 드물 뿐 같은 일이 생긴다.']), '03_camera_dive.jpg')

# ── 04 바닥 지도 ──
cm = json.load(open(os.path.join(SRC, 'cammap_d2.json')))


def heat(stage, title, key_index=6, size=380):
    st = cm['stages'][stage]
    R = 9.19
    s = (size / 2 - 14) / R
    im = Image.new('RGB', (size, size + 30), PAPER)
    d = ImageDraw.Draw(im)
    cx, cy = size / 2, size / 2 + 4
    d.ellipse([cx - R * s, cy - R * s, cx + R * s, cy + R * s], fill=(58, 48, 40), outline=(120, 104, 84))
    for c in st['cells']:
        x, z, v = c[0], c[1], c[key_index]
        sx, sy = cx + z * s, cy - x * s  # 화면 위 = +x (마야 · 봉인된 문 쪽), 화면 오른쪽 = +z
        k = min(1, v * 2)
        col = (88, 76, 62) if v <= 0 else (int(110 + 145 * k), int(80 - 30 * k), int(60 - 20 * k))
        d.rectangle([sx - 0.25 * s, sy - 0.25 * s, sx + 0.25 * s - 1, sy + 0.25 * s - 1], fill=col)
    if stage == 'courtyard':
        d.rectangle([cx - 1.1 * s, cy - 0.85 * s, cx + 1.1 * s, cy + 0.85 * s], fill=(200, 184, 150))  # 급수정 받침 (세상 x ±0.85 · z ±1.1)
    else:
        d.ellipse([cx - 0.86 * s, cy - 0.86 * s, cx + 0.86 * s, cy + 0.86 * s], fill=(60, 60, 60), outline=(200, 140, 60))  # 석상 받침 반지름 0.86
    r = st['nav']['radius'] + 0.28
    d.ellipse([cx - r * s, cy - r * s, cx + r * s, cy + r * s], outline=(120, 200, 230), width=2)
    z0 = 1.85 if stage == 'courtyard' else 0.5
    for (x, col) in ((-2.8, (110, 170, 240)), (2.8, (230, 70, 70))):
        sx, sy = cx + z0 * s, cy - x * s
        d.ellipse([sx - 5, sy - 5, sx + 5, sy + 5], fill=col)
    text(d, (6, size + 6), title, 16, INK)
    return im


pane = [heat('courtyard', f"봉인의 중정 — 무너짐 {cm['stages']['courtyard']['camNear'] * 100:.1f} %"), heat('sluice', f"잠든 습지 석상 — {cm['stages']['sluice']['camNear'] * 100:.1f} %")]
w = sum(p.width for p in pane) + 30
out = Image.new('RGB', (max(w, 900), pane[0].height + 46 + 120), PAPER)
d = ImageDraw.Draw(out)
text(d, (10, 10), '내가 이 칸에 서서 칼 거리(2 m) 상대를 볼 때 카메라가 내 몸 1.6 m 안으로 무너지는 방향 몫', 18, MARK)
x = 10
for p in pane:
    out.paste(p, (x, 40))
    x += p.width + 10
yl = pane[0].height + 50
for i, (col, label) in enumerate((((88, 76, 62), '0 (괜찮음)'), ((230, 50, 40), '절반 넘는 방향에서 무너짐'), ((120, 200, 230), '카메라 보호 원(장애물 길잡이 + 0.28 m)'))):
    d.rectangle([12, yl + 26 * i, 30, yl + 26 * i + 16], fill=col)
    text(d, (38, yl + 26 * i - 2), label, 15, INK)
text(d, (12, yl + 80), '파란 점 = 판 시작 나 · 빨간 점 = 마야 · 화면 위 = 봉인된 문 쪽 · 칸 0.5 m. 습지 석상은 원이 돌에 거의 딱 맞아 띠가 좁다.', 15, DIM)
save(out, '04_camera_map.jpg')

# ── 05 구운 그늘 · 숨은 마야 ──
save(grid([[('shots2/pos_in_baked_shade.png', '바닥에 그린 급수정 그늘 위의 마야 — 몸은 햇빛 그대로 (급수정은 실제 그림자를 안 드리움)', BAD), ('shots2/pos_across_well_gun.png', '돌 너머 — 마야가 통째로 가려지고 화면 가운데가 급수정으로 참')]],
          (700, 323), '빛 · 가림'), '05_shade_hide.jpg')

# ── 06 폰 ──
save(grid([[('shots2/phone_667x375.png', '667×375 (작은 폰 가로)'), ('shots2/phone_844x390.png', '844×390 (폰 가로)')], [('shots2/phone_1280x720.png', '1280×720 (PC)'), ('shots2/phone_sweep_mid.png', '판 시작 훑기 가운데 — 계단 우물은 여기서만 잘 보인다')]],
          (600, 278), '화면 크기별 경기 화면 (글자 · 단추 그대로)'), '06_phones.jpg')

# ── 07 이야기 소품 · 짜임 ──
seal_far = img('details/detail_seal_from_fight.png')
dd = ImageDraw.Draw(seal_far)
cx, cy = seal_far.width // 2, seal_far.height // 2
dd.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], outline=(255, 60, 60), width=3)
save(grid([[('details/detail_plan.png', '위에서 본 짜임 (위 = 봉인된 문)'), ('details/detail_seal_close.png', '붉은 밀랍 두 조각 · 전령 가방 (가까이)'), (seal_far, '같은 소품을 경기 카메라 자리에서 (빨간 원 — 20 m 밖)', BAD)],
           [('details/detail_gate.png', '봉인된 문 — 마야 뒤 (봉인 표시는 없음)'), ('details/detail_stepwell.png', '계단 우물(바오리) — 결투장 21 m 옆'), ('shots/cmp_horizon_courtyard.png', '지평선 쪽 — 모래폭풍 띠')]],
          (520, 240), '이야기 · 짜임'), '07_story_props.jpg')

# ── 08 판석 ──
if os.path.exists(os.path.join(SRC, 'pave/p1536_floor.png')):
    a, b = img('pave/p1536_floor.png'), img('pave/p1024_floor.png')
    box = (300, 420, 1100, 780)  # 폰 배율 2 화면(1688×780)에서 발밑 바닥
    save(grid([[(a.crop(box), '1536² (지금) — 발밑 가까이 · 폰 배율 2'), (b.crop(box), '1024² (스크래치 사본) — 같은 자리')], [(a, '1536² 경기 화면 가까이'), (b, '1024² 같은 화면')]],
              (640, 300), '판석 무늬 크기 — 밝기 8 넘게 다른 화소 0.3~0.4 % · GPU 12.6 MB ↔ 5.6 MB'), '08_paving.jpg')

# ── 09 돌풍 ──
if os.path.exists(os.path.join(SRC, 'details/detail_gust.png')):
    g = num.get('gust', {})
    save(grid([[('details/detail_calm.png', f"잔잔할 때 (땅 먼지 투명도 {g.get('calmOpacity', 0.1):.2f})"), ('details/detail_gust.png', f"돌풍 한가운데 ({g.get('gustOpacity', 0.4):.2f}) — 천만 펄럭이고 먼지는 거의 안 보임")]],
              (700, 323), '새 날씨(바람 · 모래)가 경기 화면에서 읽히나'), '09_gust.jpg')


# ── 한 장 요약 ──
def fit(im, w):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


W = 1800
blocks = []
lines = num.get('sheetLines', [])
head = Image.new('RGB', (W, 124 + 30 * len(lines)), PAPER)
d = ImageDraw.Draw(head)
text(d, (24, 18), '봉인의 중정 디자인 리뷰 · 2026-10-17', 34, MARK)
text(d, (24, 70), '판정: 고쳐서 넣기', 30, BAD)
for i, line in enumerate(lines):
    text(d, (24, 116 + 30 * i), line, 20, INK)
blocks.append(head)
pairs = [('03_camera_dive.jpg', '04_camera_map.jpg'), ('01_act2_sequence.jpg', None), ('02_vs_desert.jpg', None), ('05_shade_hide.jpg', '09_gust.jpg'), ('07_story_props.jpg', '06_phones.jpg')]
for a, b in pairs:
    A = Image.open(os.path.join(OUT, a)).convert('RGB')
    if b and os.path.exists(os.path.join(OUT, b)):
        B = Image.open(os.path.join(OUT, b)).convert('RGB')
        wa = round((W - 30) * A.width / (A.width + B.width * A.height / B.height))
        A2 = fit(A, wa)
        B2 = B.resize((W - 30 - wa, A2.height), Image.LANCZOS)
        row = Image.new('RGB', (W, A2.height + 10), PAPER)
        row.paste(A2, (10, 5))
        row.paste(B2, (20 + wa, 5))
    else:
        A2 = fit(A, W - 20)
        row = Image.new('RGB', (W, A2.height + 10), PAPER)
        row.paste(A2, (10, 5))
    blocks.append(row)
foot_lines = num.get('sheetNumbers', [])
foot = Image.new('RGB', (W, 30 + 30 * len(foot_lines)), PAPER)
d = ImageDraw.Draw(foot)
for i, line in enumerate(foot_lines):
    text(d, (24, 12 + 30 * i), line, 19, MARK if i == 0 else DIM)
blocks.append(foot)
H = sum(b.height for b in blocks)
sheet = Image.new('RGB', (W, H), PAPER)
y = 0
for b in blocks:
    sheet.paste(b, (0, y))
    y += b.height
save(sheet, 'courtyard_review_sheet.jpg', 78)
print('ok', OUT)
