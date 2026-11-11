# arm_reach_draw.py — 팔 뻗음 점검 그림 (11/12 — tools/sim/arm_reach_audit.mjs --pic 가 쓴 JSON → PNG · 폰에서 보기 쉽게 가로 1080 px)
#  칸 = 여덟 방향(나침반 자리 — 가운데 칸은 범례). 칸마다 왼쪽 '앞면'(몸 앞면에 비춘 꼴 — 화면 오른쪽 = 칼 든 오른쪽 · 내 화면과 같은 쪽) · 오른쪽 '위에서'(위 = 상대 쪽).
#  선: 굵은 = 칼 팔(어깨 → 팔꿈치 ● → 손목) · 가는 = 빈팔 · 회색 = 칼(손 → 칼끝 쪽 0.8 m 까지) · × = 손 목표 · 상자 = 가슴 · 배 · 골반 (위에서는 가슴만 — 어깨선으로 돈 몸) · ○ = 머리.
#  python3.12 tools/sim/arm_reach_draw.py <pic.json> <out.png>   (PIL — 이 상자의 python3 3.11 은 PIL 이 깨져 있어 3.12 로 · 글꼴 wqy-zenhei)
import json
import math
import sys
from PIL import Image, ImageDraw, ImageFont

ORDER = [['upLeft', 'up', 'upRight'], ['left', None, 'right'], ['downLeft', 'down', 'downRight']]
KO = {'up': '상', 'upRight': '우상', 'right': '우', 'downRight': '우하', 'down': '하', 'downLeft': '좌하', 'left': '좌', 'upLeft': '좌상'}
CW, CH = 360, 330
HEAD = 64
SC = 118  # px / m
SWORD_DRAW = 0.8  # 칼은 손에서 이만큼만 그림 (방향만 보이게 — 그림 값)
BOX = {'chest': (0.11, 0.13, 0.18), 'abdomen': (0.1, 0.07, 0.15), 'pelvis': (0.1, 0.085, 0.16)}  # fighter.js partDefs 반 크기 [앞, 위, 옆]


def font(sz):
    for p in ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
        try:
            return ImageFont.truetype(p, sz)
        except OSError:
            pass
    return ImageFont.load_default()


def yaw_of(pose):
    # 어깨선(빈 어깨 → 칼 어깨)이 옆(+z)에서 앞(+x)으로 돈 각 — 위에서 본 몸 돌림
    a, b = pose.get('shO'), pose.get('shS')
    if not a or not b:
        return 0.0
    return math.atan2(b[0] - a[0], b[2] - a[2])


def view(d, ox, oy, pose, col, which, solid):
    def P(p):
        if p is None:
            return None
        return (ox + p[2] * SC, oy - (p[1] if which == 'front' else p[0]) * SC)

    def line(a, b, w, c):
        if a is not None and b is not None:
            d.line([P(a), P(b)], fill=c, width=w)

    trunk = '#b8bcc2' if not solid else '#80868b'
    yaw = yaw_of(pose)
    if which == 'front':
        for n, (hx, hy, hz) in BOX.items():
            c = pose.get(n)
            if not c:
                continue
            w = hz * abs(math.cos(yaw)) + hx * abs(math.sin(yaw))
            x0, y0 = P([c[0], c[1] + hy, c[2] - w])
            x1, y1 = P([c[0], c[1] - hy, c[2] + w])
            d.rectangle([x0, y0, x1, y1], outline=trunk, width=2)
    else:
        c = pose.get('chest')
        if c:
            hx, _, hz = BOX['chest']
            cs, sn = math.cos(yaw), math.sin(yaw)
            pts = []
            for ux, uz in [(hx, hz), (hx, -hz), (-hx, -hz), (-hx, hz)]:
                # 몸 틀 (앞 ux, 옆 uz) 을 yaw 만큼 돌림: 옆 축 (sin, cos) · 앞 축 (cos, −sin)
                x = c[0] + ux * cs + uz * sn
                z = c[2] - ux * sn + uz * cs
                pts.append(P([x, 0, z]))
            d.polygon(pts, outline=trunk, width=2)
    h = P(pose.get('head'))
    if h:
        r = 0.1 * SC
        d.ellipse([h[0] - r, h[1] - r, h[0] + r, h[1] + r], outline=trunk, width=2)
    # 칼 (손 → 칼끝 방향 SWORD_DRAW m)
    hl, tp = pose.get('hilt'), pose.get('tip')
    if hl and tp:
        v = [tp[i] - hl[i] for i in range(3)]
        L = math.sqrt(sum(x * x for x in v)) or 1
        e = [hl[i] + v[i] / L * min(L, SWORD_DRAW) for i in range(3)]
        line(hl, e, 3 if solid else 2, '#3c4043' if solid else '#9aa0a6')
    # 빈팔
    line(pose.get('shO'), pose.get('elO'), 2, col)
    line(pose.get('elO'), pose.get('wrO'), 2, col)
    # 칼 팔
    line(pose.get('shS'), pose.get('elS'), 6, col)
    line(pose.get('elS'), pose.get('wrS'), 6, col)
    e = P(pose.get('elS'))
    if e:
        d.ellipse([e[0] - 5, e[1] - 5, e[0] + 5, e[1] + 5], fill=col)
    t = P(pose.get('target'))
    if t:
        d.line([t[0] - 6, t[1] - 6, t[0] + 6, t[1] + 6], fill=col, width=3)
        d.line([t[0] - 6, t[1] + 6, t[0] + 6, t[1] - 6], fill=col, width=3)


def main():
    src, out = sys.argv[1], sys.argv[2]
    J = json.load(open(src))
    rows = J.get('order', ORDER)
    W, H = CW * 3, HEAD + CH * len(rows)
    img = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(img)
    f1, f2, f3 = font(24), font(17), font(15)
    d.text((12, 8), J['title'], fill='black', font=f1)
    d.text((12, 40), J.get('sub', ''), fill='#444', font=f3)
    sets = J['sets']  # [{ name, color, poses: { 칸: pose }, cells: { 칸: 글 } }]
    order = J.get('order', ORDER)  # 칸 차례 (기본 나침반 — 다른 칸 열쇠면 labels 로 이름)
    labels = J.get('labels', {})
    def wrap(text, fnt, width):
        # 칸 너비에 맞춰 줄 바꿈 (' · ' 마디에서 끊음)
        parts = text.split(' · ')
        lines, cur = [], ''
        for p in parts:
            nxt = p if not cur else cur + ' · ' + p
            if cur and fnt.getlength(nxt) > width:
                lines.append(cur)
                cur = '   ' + p
            else:
                cur = nxt
        if cur:
            lines.append(cur)
        return lines

    for ri, row in enumerate(order):
        for ci, dr in enumerate(row):
            x0, y0 = ci * CW, HEAD + ri * CH
            cell = Image.new('RGB', (CW, CH), 'white')  # 칸마다 따로 그려 붙임 — 칼 선이 옆 칸으로 넘지 않게
            c = ImageDraw.Draw(cell)
            c.rectangle([0, 0, CW - 1, CH - 1], outline='#dadce0')
            if dr is None:
                yy = 14
                c.text((12, yy), '범례', fill='black', font=f2)
                yy += 28
                for s in sets:
                    c.line([14, yy + 10, 46, yy + 10], fill=s['color'], width=6)
                    c.text((54, yy), s['name'], fill='black', font=f3)
                    yy += 26
                for tline in J.get('legend', []) + ['굵은 = 칼 팔 (● 팔꿈치) · 가는 = 빈팔', '× = 손 목표 · 짙은 회색 = 칼 (0.8 m 까지)', '왼쪽 그림 = 앞면 (오른쪽 = 칼 든 쪽)', '오른쪽 그림 = 위에서 (위 = 상대 쪽)', '칸 글: 뻗음 (어깨→손목 ÷ 팔 길이)', '  · 팔꿈치 굽힘° · 이상 꼴']:
                    c.text((14, yy), tline, fill='#444', font=f3)
                    yy += 22
                img.paste(cell, (x0, y0))
                continue
            c.text((10, 6), labels.get(dr) or f"{KO.get(dr, dr)} ({dr})", fill='black', font=f2)
            yy = 30
            for s in sets:
                t = s.get('cells', {}).get(dr)
                if t:
                    for ln in wrap(t, f3, CW - 20):
                        c.text((10, yy), ln, fill=s['color'], font=f3)
                        yy += 18
            for k, which in enumerate(['front', 'top']):
                ox = 80 + k * 180
                oy = 205 if which == 'front' else 255
                for si, s in enumerate(sets):
                    p = s['poses'].get(dr)
                    if p:
                        view(c, ox, oy, p, s['color'], which, si == len(sets) - 1)
                c.text((ox - 70, CH - 22), '앞면' if which == 'front' else '위에서', fill='#888', font=f3)
            c.rectangle([0, 0, CW - 1, CH - 1], outline='#dadce0')
            img.paste(cell, (x0, y0))
    img.save(out, optimize=True)


if __name__ == '__main__':
    main()
