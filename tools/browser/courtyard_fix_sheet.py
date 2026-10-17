"""봉인의 중정 고침 그림 묶기 (docs/design/courtyard_fix_2026-10-17/) — 고치기 전 빌드판(1930074) ↔ 고친 빌드판의 사진과 잰 값으로.
  python3 -I tools/browser/courtyard_fix_sheet.py <작업 폴더> <출력 폴더>
작업 폴더(점검 도구 결과를 모은 곳 — 문서 §9 의 명령으로 만든다):
  rev_before/ · rev_final/        tools/browser/courtyard_review.mjs --modes=compare (고친 쪽은 --stages=corsair,courtyard,sluice,dayr)
  rev_before_pp/ · rev_final_pp/  tools/browser/courtyard_review.mjs --modes=positions,phones
  fix_before/ · fix_after/        tools/browser/courtyard_fix_shots.mjs --layout=before|after (문 · 우물 · 위에서 · 돌풍 · 카드 고르기 · 그늘 · 비스듬히 위에서)
  cammap_before_d2.json · cammap_final_d2.json   tools/sim/courtyard_camera_map.mjs --d=2.0 (고치기 전 · 고친 코드)
  numbers.json                    글로 적는 것(무대 빛 · 분리 · 소리 · 부담 — 다른 도구가 잰 값)
나오는 것: 01_camera.jpg … 10_layout.jpg · courtyard_fix_sheet.jpg (한 장 요약). 색 수치(CIE L*a*b*)와 쓴 값은 화면에 찍는다
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
CARDBACKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'ui', 'cardbacks')
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
PAPER, INK, DIM, MARK, BAD, GOOD = (24, 19, 17), (236, 226, 212), (170, 156, 140), (236, 170, 96), (232, 92, 72), (130, 200, 120)
_fonts = {}


def font(size):
    if size not in _fonts:
        _fonts[size] = ImageFont.truetype(FONT, size)
    return _fonts[size]


def text(d, xy, s, size=18, color=INK):
    d.text(xy, s, font=font(size), fill=color)


def img(rel, w=None):
    im = rel if isinstance(rel, Image.Image) else Image.open(os.path.join(SRC, rel))
    im = im.convert('RGB')
    if w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    return im


def load(rel):
    with open(os.path.join(SRC, rel), encoding='utf-8') as f:
        return json.load(f)


def grid(title, rows, cell_w, note=None, label_h=26):
    """rows = [[(사진 경로 | Image, 아래 글, 색), …], …]"""
    cells = [[(img(c[0], cell_w), c[1], c[2] if len(c) > 2 else INK) for c in r] for r in rows]
    cols = max(len(r) for r in cells)
    row_h = [max(c[0].height for c in r) + label_h for r in cells]
    W = cols * (cell_w + 8) + 8
    H = 46 + sum(row_h) + 8 * len(cells) + (30 * len(note) if note else 0) + 8
    out = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(out)
    text(d, (10, 10), title, 21, MARK)
    y = 46
    for r, h in zip(cells, row_h):
        x = 8
        for im, label, color in r:
            out.paste(im, (x, y))
            text(d, (x + 2, y + im.height + 3), label, 16, color)
            x += cell_w + 8
        y += h + 8
    for line in note or []:
        text(d, (10, y), line, 16, DIM)
        y += 30
    return out


def save(im, name, q=82):
    im.save(os.path.join(OUT, name), quality=q, optimize=True)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')


def lab_of(im, box=None):
    """화소 평균 CIE L*a*b* (D65) → (L*, C*, 색상각°) — 리뷰 표와 같은 잣대(가로세로 반으로 줄여 셈)"""
    im = im.convert('RGB')
    if box:
        im = im.crop(box)
    im = im.resize((max(1, im.width // 2), max(1, im.height // 2)))

    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    L = A = B = 0.0
    n = 0
    data = im.tobytes()
    for i in range(0, len(data), 3):
        r, g, b = data[i], data[i + 1], data[i + 2]
        R, G, Bb = lin(r), lin(g), lin(b)
        X = (0.4124 * R + 0.3576 * G + 0.1805 * Bb) / 0.95047
        Y = 0.2126 * R + 0.7152 * G + 0.0722 * Bb
        Z = (0.0193 * R + 0.1192 * G + 0.9505 * Bb) / 1.08883
        fx, fy, fz = f(X), f(Y), f(Z)
        L += 116 * fy - 16
        A += 500 * (fx - fy)
        B += 200 * (fy - fz)
        n += 1
    L, A, B = L / n, A / n, B / n
    return round(L, 1), round(math.hypot(A, B), 1), round(math.degrees(math.atan2(B, A)) % 360)


def colours(folder, stage):
    """경기 화면 전체 · 넓은 각 A 위 22 % = 하늘 · 아래 30 % = 바닥"""
    fight = Image.open(os.path.join(SRC, folder, f'cmp_fight_{stage}.png'))
    wide = Image.open(os.path.join(SRC, folder, f'cmp_wideA_{stage}.png'))
    w, h = wide.size
    return {'fight': lab_of(fight), 'sky': lab_of(wide, (0, 0, w, int(h * 0.22))), 'floor': lab_of(wide, (0, int(h * 0.70), w, h))}


num = load('numbers.json')
# ── 잰 값 (도구 결과에서) ──
LAB = {'courtyard 전': colours('rev_before', 'courtyard')}
for st in ('corsair', 'courtyard', 'sluice', 'dayr'):
    LAB[st] = colours('rev_final', st)
for k, v in LAB.items():
    print('색', k, '경기 화면 L* C* h', v['fight'], '하늘', v['sky'], '바닥', v['floor'])
POS_B = {p['name']: p for p in load('rev_before_pp/review.json')['positions']}
POS_A = {p['name']: p for p in load('rev_final_pp/review.json')['positions']}
SHADE_B, SHADE_A = load('fix_before/fix_shots.json')['shade'], load('fix_after/fix_shots.json')['shade']
GUST_B, GUST_A = load('fix_before/fix_shots.json')['gust'], load('fix_after/fix_shots.json')['gust']
CMB, CMA = load('cammap_before_d2.json'), load('cammap_final_d2.json')


def pct(v):
    return round(100 * v, 2)


print('그늘 전', SHADE_B, '뒤', SHADE_A)
print('돌풍 소리 전', GUST_B, '뒤', GUST_A)
for st in ('courtyard', 'sluice'):
    b, a = CMB['stages'][st], CMA['stages'][st]
    print('카메라 지도', st, {k: (pct(b[k]), pct(a[k])) for k in ('camNear', 'camLow', 'meOut', 'meHidden', 'anyHalf', 'coverHalf', 'bodyHalf', 'swung')}, '돌린 각 최대', a['swingMax'])
for name in ('back_to_well', 'back_to_well_side', 'bear_back', 'bear_back_side'):
    print('자리', name, '전', POS_B[name]['camToMe'], POS_B[name]['cam'][1], '뒤', POS_A[name]['camToMe'], POS_A[name]['cam'][1])

# ── 01 카메라 ──
P = ['back_to_well', 'back_to_well_side', 'bear_back', 'bear_back_side']
LB = ['중정 · 긴 면에 등', '중정 · 짧은 면에 등', '습지 · 석상에 등', '습지 · 석상 옆에 등']


def dist(q):
    return f"{q['camToMe']} m · 높이 {q['cam'][1]} m"


save(grid('장애물 곁 카메라 — 위: 고치기 전(카메라가 내 몸 안 · 허리 높이) · 아래: 고친 뒤(거리 · 높이 그대로, 옆으로 돌아 봄)',
          [[(f'rev_before_pp/pos_{p}.png', f'{l} — {dist(POS_B[p])}', BAD) for p, l in zip(P, LB)],
           [(f'rev_final_pp/pos_{p}.png', f'{l} — {dist(POS_A[p])}', GOOD) for p, l in zip(P, LB)]], 420,
          note=['m = 카메라 ↔ 내 무게중심 거리(평소 3.04 m · 높이 2.3 m). 같은 자리 · 같은 상대 · 같은 시계(가짜 시계 · AI 멈춤).',
                '습지(이미 여정에 있는 무대)도 같은 함수라 함께 고쳐졌다.']), '01_camera.jpg')


# ── 02 바닥 지도 ──
def heat(cm, stage, title, mode, size=360):
    st = cm['stages'][stage]
    R = 9.19
    s = (size / 2 - 14) / R
    im = Image.new('RGB', (size, size + 30), PAPER)
    d = ImageDraw.Draw(im)
    cx, cy = size / 2, size / 2 + 4
    d.ellipse([cx - R * s, cy - R * s, cx + R * s, cy + R * s], fill=(58, 48, 40), outline=(120, 104, 84))
    for c in st['cells']:
        x, z = c[0], c[1]
        sx, sy = cx + z * s, cy - x * s  # 화면 위 = +x (마야 쪽), 오른쪽 = +z
        if mode == 'collapse':
            v = c[6]
            k = min(1, v * 2)
            col = (88, 76, 62) if v <= 0 else (int(110 + 145 * k), int(80 - 30 * k), int(60 - 20 * k))
        else:
            v = c[10] if len(c) > 10 else 0
            k = min(1, v / 60)
            col = (88, 76, 62) if v <= 0.5 else (int(80 - 30 * k), int(110 + 60 * k), int(130 + 110 * k))
        d.rectangle([sx - 0.25 * s, sy - 0.25 * s, sx + 0.25 * s - 1, sy + 0.25 * s - 1], fill=col)
    if stage == 'courtyard':
        d.rectangle([cx - 1.1 * s, cy - 0.85 * s, cx + 1.1 * s, cy + 0.85 * s], fill=(200, 160, 130))
    else:
        d.ellipse([cx - 0.86 * s, cy - 0.86 * s, cx + 0.86 * s, cy + 0.86 * s], fill=(70, 70, 70), outline=(200, 140, 60))
    z0 = 1.85 if stage == 'courtyard' else 0.5
    for (x, col) in ((-2.8, (110, 170, 240)), (2.8, (230, 70, 70))):
        sx, sy = cx + z0 * s, cy - x * s
        d.ellipse([sx - 5, sy - 5, sx + 5, sy + 5], fill=col)
    text(d, (6, size + 6), title, 15, INK)
    return im


cb, ca, sb, sa = CMB['stages']['courtyard'], CMA['stages']['courtyard'], CMB['stages']['sluice'], CMA['stages']['sluice']
panes = [heat(CMB, 'courtyard', f"중정 전 — 무너짐 {pct(cb['camNear'])} %", 'collapse'),
         heat(CMA, 'courtyard', f"중정 뒤 — 무너짐 {pct(ca['camNear'])} · 돌아 봄 {pct(ca['swung'])} %", 'swing'),
         heat(CMB, 'sluice', f"습지 전 — 무너짐 {pct(sb['camNear'])} %", 'collapse'),
         heat(CMA, 'sluice', f"습지 뒤 — 무너짐 {pct(sa['camNear'])} · 돌아 봄 {pct(sa['swung'])} %", 'swing')]
W = sum(p.width for p in panes) + 10 * (len(panes) + 1)
out = Image.new('RGB', (W, panes[0].height + 46 + 96), PAPER)
d = ImageDraw.Draw(out)
text(d, (10, 10), '바닥 지도: 이 칸에 서서 칼 거리(2 m) 상대를 볼 때 — 빨강 = 카메라가 내 몸 1.6 m 안으로 무너진 방향 몫 · 파랑 = 카메라를 옆으로 돌린 각', 18, MARK)
x = 10
for p in panes:
    out.paste(p, (x, 40))
    x += p.width + 10
yl = panes[0].height + 48
text(d, (12, yl), f"카메라 2 m 아래: 중정 {pct(cb['camLow'])} % → {pct(ca['camLow'])} · 습지 {pct(sb['camLow'])} % → {pct(sa['camLow'])}   내 가슴이 화면 밖: 중정 {pct(cb['meOut'])} % → {pct(ca['meOut'])} · 습지 {pct(sb['meOut'])} % → {pct(sa['meOut'])}   내 몸이 돌에 가림: {pct(ca['meHidden'])}", 15, INK)
text(d, (12, yl + 26), f"상대가 무엇에든 절반 넘게 가림: 중정 {pct(cb['anyHalf'])} % → {pct(ca['anyHalf'])} % · 습지 {pct(sb['anyHalf'])} % → {pct(sa['anyHalf'])} %   돌린 각 가장 큼: 중정 {ca['swingMax']}° · 습지 {sa['swingMax']}°", 15, INK)
text(d, (12, yl + 52), '파란 점 = 판 시작 나 · 빨간 점 = 마야 · 화면 위 = 마야 쪽 · 칸 0.5 m · 열두 방향 × 바닥 칸 (tools/sim/courtyard_camera_map.mjs)', 15, DIM)
save(out, '02_camera_map.jpg')

# ── 03 2 막 차례 ──
lb, lc, lco, ld = LAB['courtyard 전'], LAB['courtyard'], LAB['corsair'], LAB['dayr']


def fmt(t):
    return f'{t[0]} · {t[1]} · {t[2]}°'


save(grid('2 막 차례 그대로 — 산호 항구 → 봉인의 중정 → 잠든 습지 (844×390 · 같은 경기 카메라 · 화면 글자 숨김)',
          [[('rev_final/cmp_fight_corsair.png', '산호 항구 (2 막 처음)'), ('rev_before/cmp_fight_courtyard.png', '봉인의 중정 — 고치기 전 (흐린 한낮 회베이지)', BAD), ('rev_final/cmp_fight_sluice.png', '잠든 습지 (다음 판)')],
           [('rev_final/cmp_wideA_corsair.png', '산호 항구 — 넓은 각'), ('rev_final/cmp_fight_courtyard.png', '봉인의 중정 — 고친 뒤 (장마 앞 늦은 오후 · 모래폭풍)', GOOD), ('rev_final/cmp_wideA_sluice.png', '잠든 습지 — 넓은 각')],
           [('rev_before/cmp_wideA_courtyard.png', '중정 넓은 각 — 전', BAD), ('rev_final/cmp_wideA_courtyard.png', '중정 넓은 각 — 뒤', GOOD), ('rev_final/cmp_horizon_courtyard.png', '중정 지평선 — 뒤 (다가오는 모래폭풍)', GOOD)]], 560,
          note=[num['act2Notes'][0],
                f"넓은 각 바닥 밝기 L* · 채도 · 빛깔: {fmt(lb['floor'])} → {fmt(lc['floor'])} (산호 항구 모래 {fmt(lco['floor'])} · 소금 사막 회갈색 {fmt(ld['floor'])})",
                f"하늘(넓은 각 위쪽): {fmt(lb['sky'])}(회베이지) → {fmt(lc['sky'])}(주황 모래 안개) — 소금 사막 분홍 {ld['sky'][2]}° · 산호 항구 청회 {lco['sky'][2]}°"]), '03_act2.jpg')

# ── 04 소금 사막과 견주기 ──
save(grid('소금 사막과 갈라졌나 — 같은 틀 (경기 카메라 · 넓은 각 A · 반대쪽 B)',
          [[('rev_before/cmp_fight_courtyard.png', '중정 — 전 (아치 회랑 안뜰 · 상대 뒤 큰 문)', BAD), ('rev_final/cmp_fight_courtyard.png', '중정 — 뒤 (마야 뒤 계단 우물 · 붉은 봉인 문 · 차트리)', GOOD), ('rev_final/cmp_fight_dayr.png', '소금 사막')],
           [('rev_before/cmp_wideA_courtyard.png', '넓은 각 A — 전', BAD), ('rev_final/cmp_wideA_courtyard.png', '넓은 각 A — 뒤', GOOD), ('rev_final/cmp_wideA_dayr.png', '소금 사막 — 넓은 각 A')],
           [('rev_before/cmp_wideB_courtyard.png', '반대쪽 B — 전', BAD), ('rev_final/cmp_wideB_courtyard.png', '반대쪽 B — 뒤 (북쪽 회랑 · 동쪽 채)', GOOD), ('rev_final/cmp_wideB_dayr.png', '소금 사막 — 반대쪽 B')]], 560,
          note=['문은 계단 우물 너머 서쪽 담으로 옮기고(문 앞엔 우물 · 양옆엔 차트리 · 위엔 자로카 창), 북쪽 회랑은 세 칸을 이어 메웠다.',
                '급수정 · 충돌체 · 시작 자리 · 총수 우회는 세상 좌표 그대로 — 배경만 반 바퀴 돌았다.']), '04_vs_dayr.jpg')

# ── 05 빛 · 그늘 ──
save(grid('급수정 실제 그림자 — 그린 그늘을 지우고 실제 해 그림자 · 그늘에 든 몸은 해 빛을 덜 받는다',
          [[('fix_before/topside.png', '전: 바닥에 그린 급수정 그늘(기둥 · 틈 없는 덩어리)', BAD), ('fix_after/topside.png', '뒤: 실제 그림자(기둥 · 처마 · 돔 꼴 그대로)', GOOD)],
           [('fix_before/maya_in.png', f"전: 그린 그늘 안 마야 — 몸 밝기 {SHADE_B['in']['mayaY']}", BAD), ('fix_after/maya_in.png', f"뒤: 그늘 안 마야 — 몸 밝기 {SHADE_A['in']['mayaY']}", GOOD)],
           [('fix_before/maya_out.png', f"전: 그늘 밖 마야 — {SHADE_B['out']['mayaY']} (그늘 안과 거의 같음)"), ('fix_after/maya_out.png', f"뒤: 햇빛 마야 — 몸 밝기 {SHADE_A['out']['mayaY']}", GOOD)]], 640,
          note=num['shadeNotes']), '05_light_shadow.jpg')

# ── 06 붉은 봉인 · 문 ──
save(grid("'봉인'이 보이게 — 큰 문의 붉은 봉인 (가까이 · 판 시작 경기 카메라 자리에서 좁은 시야)",
          [[('fix_before/gate_close.png', '전: 봉인 표시 없는 닫힌 문', BAD), ('fix_after/gate_close.png', '뒤: 붉은 천 띠 X · 지름 1.4 m 밀랍 봉인 · 붉은 깃발', GOOD)],
           [('fix_before/gate_from_fight_zoom.png', '전: 경기 카메라 자리에서 문 쪽', BAD), ('fix_after/gate_from_fight_zoom.png', '뒤: 경기 카메라 자리에서 문 쪽', GOOD)]], 640,
          note=['작은 밀랍 조각 · 전령 가방은 그대로 두고 결투장 띠 가까운 우물가(약 10.5 m)로 옮겼다. 바닥에서 2 cm 뜬 항아리 · 가방도 바닥에 붙였다.']), '06_seal_gate.jpg')

# ── 07 바람 ──
save(grid('바람이 보이게 — 같은 경기 카메라, 잔잔할 때 ↔ 돌풍 한가운데',
          [[('fix_before/wind_calm.png', '전: 잔잔할 때'), ('fix_before/wind_gust.png', '전: 돌풍 한가운데 — 먼지 얼룩만', BAD)],
           [('fix_after/wind_calm.png', '뒤: 잔잔할 때'), ('fix_after/wind_gust.png', '뒤: 돌풍 — 땅을 스치는 모래 줄 · 깃발 · 천 · 먼 안개', GOOD)]], 640,
          note=num['windNotes'] + [f"바탕 소리 돌풍 한가운데(같은 소리를 두 번 그려 뺌): 전 +{GUST_B['riseDb']} dB → 뒤 +{GUST_A['riseDb']} dB"]), '07_wind.jpg')

# ── 08 폰 화면 ──
save(grid('폰 화면 — 글자 · 단추와 겹치지 않나 (고친 뒤)',
          [[('rev_final_pp/phone_844x390.png', '844×390 (폰 가로)'), ('rev_final_pp/phone_667x375.png', '667×375 (작은 폰 가로)')],
           [('rev_final_pp/phone_sweep_start.png', '판 시작 훑기 처음'), ('rev_final_pp/phone_sweep_mid.png', '판 시작 훑기 가운데')]], 640,
          note=num['phoneNotes']), '08_phones.jpg')


# ── 09 카드 뒷면 ──
def cardback(theme, foe=''):
    """저장소 조각(public/ui/cardbacks/px_<무대>_*)을 index.html 처럼 붙여 본 어림 — 비율 2:3, 한 칸 = 5 px"""
    S, W, H, B = 5, 40, 60, 7

    def part(k):
        return Image.open(os.path.join(CARDBACKS, f'px_{theme}_{k}{foe}.png')).convert('RGBA')
    tile, frame, center, plaque = part('tile'), part('frame'), part('center'), part('plaque')
    card = Image.new('RGBA', (W, H), tile.getpixel((0, 0)))
    tw, th = tile.size
    for y in range(0, H, th):
        for x in range(0, W, tw):
            card.alpha_composite(tile, (x, y))
    fw = frame.size[0]
    for sx, sy, dx, dy in [(0, 0, 0, 0), (fw - B, 0, W - B, 0), (0, fw - B, 0, H - B), (fw - B, fw - B, W - B, H - B)]:
        card.alpha_composite(frame.crop((sx, sy, sx + B, sy + B)), (dx, dy))
    top, bottom = frame.crop((B, 0, fw - B, B)), frame.crop((B, fw - B, fw - B, fw))
    for x in range(B, W - B, top.size[0]):
        wpart = min(top.size[0], W - B - x)
        card.alpha_composite(top.crop((0, 0, wpart, B)), (x, 0))
        card.alpha_composite(bottom.crop((0, 0, wpart, B)), (x, H - B))
    left, right = frame.crop((0, B, B, fw - B)), frame.crop((fw - B, B, fw, fw - B))
    for y in range(B, H - B, left.size[1]):
        hpart = min(left.size[1], H - B - y)
        card.alpha_composite(left.crop((0, 0, B, hpart)), (0, y))
        card.alpha_composite(right.crop((0, 0, B, hpart)), (W - B, y))
    card.alpha_composite(center, (W // 2 - center.size[0] // 2, H // 2 - center.size[1] // 2))
    card.alpha_composite(plaque, (W // 2 - plaque.size[0] // 2, H - B - 12))
    card.alpha_composite(plaque, (W // 2 - plaque.size[0] // 2, B + 2))
    return card.resize((W * S, H * S), Image.NEAREST)


cards = [cardback(t, f) for t in ('courtyard', 'dayr', 'loggia') for f in ('', '_foe')]
prev = Image.new('RGB', ((cards[0].width + 10) * len(cards) - 10, cards[0].height), PAPER)
for i, c in enumerate(cards):
    prev.paste(c, (i * (c.width + 10), 0), c)
save(grid('카드 뒷면 — 전: 옛 기본 뒷면 · 뒤: 봉인의 중정 뒷면(위에서 본 계단 우물 · 붉은 밀랍 봉인 · 차트리 돔 띠)',
          [[('fix_before/cardback_draw.png', '전: 카드 고르기 — 옛 기본 뒷면(classic)', BAD), ('fix_after/cardback_draw.png', '뒤: 카드 고르기 — px_courtyard', GOOD)],
           [(prev, '조각 붙여 보기(어림): 중정 · 회색 상대 칸 | 소금 사막 · 회색 | 붉은 회랑 · 회색')]], 640), '09_cardback.jpg')

# ── 10 계단 우물 · 짜임 ──
save(grid('짜임 — 마야 뒤(화면 위 = 마야 쪽)로 계단 우물 · 차트리 · 봉인된 문',
          [[('fix_before/plan.png', '전: 위에서 (우물은 왼쪽 21 m — 경기 화면 밖)', BAD), ('fix_after/plan.png', '뒤: 위에서 (우물 · 문이 마야 뒤)', GOOD)],
           [('fix_before/stepwell.png', '전: 계단 우물'), ('fix_after/stepwell.png', '뒤: 계단 우물 너머 봉인된 문루 · 두 귀퉁이 차트리', GOOD)]], 640), '10_layout.jpg')

# ── 한 장 요약 ──
pairs = [
    ('rev_before_pp/pos_back_to_well.png', 'rev_final_pp/pos_back_to_well.png', '① 급수정에 등: 카메라 무너짐 → 옆으로 돌아 봄'),
    ('rev_before_pp/pos_bear_back.png', 'rev_final_pp/pos_bear_back.png', '① 습지 석상에 등: 같은 함수 — 함께 고침'),
    ('rev_before/cmp_fight_courtyard.png', 'rev_final/cmp_fight_courtyard.png', '②⑤⑥ 경기 화면: 때 · 색 · 마야 뒤 우물과 붉은 봉인 문'),
    ('rev_before/cmp_wideA_courtyard.png', 'rev_final/cmp_wideA_courtyard.png', '② 넓은 각: 주황 모래 안개 · 다가오는 모래폭풍'),
    ('fix_before/topside.png', 'fix_after/topside.png', '③ 급수정: 그린 그늘 → 실제 그림자'),
    ('fix_before/gate_close.png', 'fix_after/gate_close.png', '⑥ 문: 붉은 천 띠 X · 밀랍 봉인 · 깃발'),
    ('fix_before/wind_gust.png', 'fix_after/wind_gust.png', '⑦ 돌풍 한가운데: 모래 줄 · 깃발 · 천'),
    ('fix_before/cardback_draw.png', 'fix_after/cardback_draw.png', '④ 카드 뒷면: 옛 기본 → 중정 뒷면'),
]
cw = 420
rows = [(img(b, cw), img(a, cw), label) for b, a, label in pairs]
lines = num['sheetLines']
head = 52 + 30 * len(lines) + 12
row_h = max(r[0].height for r in rows) + 30
W = 2 * (2 * cw + 30) + 20  # 쌍 둘씩 한 줄
H = head + ((len(rows) + 1) // 2) * (row_h + 8) + 30 * len(num['sheetFoot']) + 20
sheet = Image.new('RGB', (W, H), PAPER)
d = ImageDraw.Draw(sheet)
text(d, (12, 10), num['sheetTitle'], 26, MARK)
y = 52
for line in lines:
    text(d, (12, y), line, 17, INK)
    y += 30
for i, (b, a, label) in enumerate(rows):
    x = 10 + (i % 2) * (2 * cw + 30)
    yy = head + (i // 2) * (row_h + 8)
    sheet.paste(b, (x, yy))
    sheet.paste(a, (x + cw + 6, yy))
    text(d, (x + 2, yy + b.height + 4), '전', 15, BAD)
    text(d, (x + cw + 8, yy + a.height + 4), '뒤 — ' + label, 15, GOOD)
y = head + ((len(rows) + 1) // 2) * (row_h + 8) + 6
for line in num['sheetFoot']:
    text(d, (12, y), line, 15, DIM)
    y += 30
save(sheet, 'courtyard_fix_sheet.jpg', 80)
