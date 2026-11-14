# 이베리아 B7 '이어 돌리기' 그림 (11/14 — tools/sim/ib_link.mjs trace 가 쓴 JSON 을 그림으로 · 폰에서 보기 좋게 가로 1080). 읽기만.
#  JSON 하나 → 한 장: 위 줄 = 이어 돌리기 하나(가장 크게 돈 것)를 앞 · 옆 · 위에서 본 몸 · 칼 / 아래 줄 = 같은 자리에서 다른 이어 돌리기 하나(가장 작게 돈 것).
#   몸: 엷은 회색 = 원을 부른 때 · 짙은 회색 = 원이 끝난 때 (머리 고리 · 어깨 · 팔 · 몸통 · 다리) / 칼: 원 동안 여덟 자리(파랑 → 빨강 = 시간) · 칼끝이 지난 길(굵은 선 — 같은 색) ·
#   앞 칼 끝 0.15 s 의 칼끝 길(엷은 회색 점선) · 원 뒤 다시 그은 칼 0.25 s 의 칼끝 길(검은 점선). 눈금 0.5 m · 틀 = 원을 부른 때의 몸(x 앞 · y 위 · z 칼 든 쪽)
#  실행: python3.12 tools/sim/ib_link_draw.py <trace.json> <나갈 png> <제목>
import json, math, sys
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
F_T = ImageFont.truetype(FONT, 28)
F_H = ImageFont.truetype(FONT, 24)
F_S = ImageFont.truetype(FONT, 19)
INK = (30, 30, 30)
W = 1080


def col(u):
    """시간 몫 u (0 ~ 1) → 파랑 → 보라 → 빨강"""
    u = max(0.0, min(1.0, u))
    return (int(40 + 190 * u), int(70 - 30 * u), int(215 - 175 * u))


class Frame:
    def __init__(self, rows, i0):
        r0 = rows[i0]
        self.o = r0['chest']
        fx, fz = r0['fwd']
        n = math.hypot(fx, fz) or 1
        self.f = (fx / n, fz / n)
        self.s = 1 if r0.get('side', 1) >= 0 else -1

    def loc(self, p):
        """월드 → 틀 (x 앞 · y 위(땅 0) · z 칼 든 쪽)"""
        if p is None:
            return None
        x, z = p[0] - self.o[0], p[2] - self.o[2]
        fx, fz = self.f
        # 몸 오른쪽(+z 쪽 — 앞 x 를 보고 위 y 일 때) = (−fz, fx) 의 반대? three.js: 앞 (1,0,0) 일 때 오른쪽 = (0,0,1)
        rx, rz = -fz, fx
        return (x * fx + z * fz, p[1], self.s * (x * rx + z * rz))


VIEWS = [
    ('앞 (상대 쪽에서 봄)', lambda p: (-p[2], p[1])),  # 가로 = 칼 든 쪽이 그림 왼쪽 (마주 봄) · 세로 = 위
    ('옆 (칼 든 쪽에서 봄)', lambda p: (p[0], p[1])),  # 가로 = 앞(상대 쪽 →) · 세로 = 위
    ('위 (하늘에서 봄)', lambda p: (p[0], -p[2])),  # 가로 = 앞 → · 세로 = 칼 든 쪽이 아래
]
BONES = [('head', 'chest'), ('chest', 'abdomen'), ('abdomen', 'pelvis'), ('chest', 'uarmS'), ('uarmS', 'farmS'), ('chest', 'uarmO'), ('uarmO', 'farmO'),
         ('pelvis', 'thighR'), ('thighR', 'shinR'), ('shinR', 'footR'), ('pelvis', 'thighL'), ('thighL', 'shinL'), ('shinL', 'footL')]


KO = {'zornhau': '오른 위 사선(탈류)', 'zornhauL': '왼 위 사선(레베스)', 'oberhau': '정수리', 'zwerch': '오른쪽 가로', 'zwerchL': '왼쪽 가로'}


def links_of(rows):
    out, cur = [], None
    for i, r in enumerate(rows):
        if r['link'] and cur is None:
            cur = [i, None]
        if not r['link'] and cur is not None:
            cur[1] = i - 1
            out.append(tuple(cur))
            cur = None
    return out


def draw_panel(d, box, title, proj, F, rows, a, b, pre, post):
    x0, y0, w, h = box
    d.rectangle([x0, y0, x0 + w, y0 + h], outline=(200, 200, 200), width=1)
    d.text((x0 + 10, y0 + 6), title, font=F_H, fill=INK)
    pts = []
    for i in range(pre, post + 1):
        r = rows[i]
        for k in ('b0', 'b1', 'head', 'chest', 'pelvis', 'footL', 'footR'):
            if r.get(k):
                pts.append(proj(F.loc(r[k])))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    span = max(max(xs) - min(xs), max(ys) - min(ys), 1.0) * 1.08
    sc = min(w - 20, h - 50) / span

    def P(p):
        q = proj(F.loc(p))
        return (x0 + w / 2 + (q[0] - cx) * sc, y0 + 30 + (h - 30) / 2 - (q[1] - cy) * sc)

    # 눈금 0.5 m
    g = 0.5 * sc
    gx = x0 + w / 2 - (cx % 0.5) * sc
    gy = y0 + 30 + (h - 30) / 2 + (cy % 0.5) * sc
    k = -10
    while k <= 10:
        X = gx + k * g
        if x0 < X < x0 + w:
            d.line([X, y0 + 30, X, y0 + h], fill=(238, 238, 238))
        Y = gy + k * g
        if y0 + 30 < Y < y0 + h:
            d.line([x0, Y, x0 + w, Y], fill=(238, 238, 238))
        k += 1
    # 몸 (부른 때 · 끝난 때)
    for i, c, wd in ((a, (190, 190, 190), 4), (b, (90, 90, 90), 5)):
        r = rows[i]
        for u, v in BONES:
            if r.get(u) and r.get(v):
                d.line([P(r[u]), P(r[v])], fill=c, width=wd)
        if r.get('head'):
            hx, hy = P(r['head'])
            rr = 0.11 * sc
            d.ellipse([hx - rr, hy - rr, hx + rr, hy + rr], outline=c, width=3)
    # 앞 칼 · 다음 칼 칼끝 길
    def dashed(seq, c, wd):
        for j in range(0, len(seq) - 1, 2):
            d.line([seq[j], seq[j + 1]], fill=c, width=wd)
    dashed([P(rows[i]['b1']) for i in range(pre, a + 1)], (170, 170, 170), 3)
    dashed([P(rows[i]['b1']) for i in range(b, post + 1)], INK, 3)
    # 원 동안 칼끝 길 · 칼 여덟 자리
    n = max(1, b - a)
    for i in range(a, b):
        d.line([P(rows[i]['b1']), P(rows[i + 1]['b1'])], fill=col((i - a) / n), width=5)
    for k in range(8):
        i = a + round(k * n / 7)
        r = rows[i]
        d.line([P(r['b0']), P(r['b1'])], fill=col((i - a) / n), width=3)
        tx, ty = P(r['b1'])
        d.ellipse([tx - 4, ty - 4, tx + 4, ty + 4], fill=col((i - a) / n))


def main():
    src, out, title = sys.argv[1], sys.argv[2], sys.argv[3]
    D = json.load(open(src))
    rows = D['rows']
    L = links_of(rows)
    info = D.get('links', [])
    if not L:
        raise SystemExit('이어 돌리기 없음')
    # 가장 크게 돈 것 · 가장 작게 돈 것 (links 의 dpsi 순서 = L 순서)
    order = sorted(range(len(L)), key=lambda k: -abs(info[k]['dpsi']) if k < len(info) else 0)
    pick = [order[0]] + ([order[-1]] if len(order) > 1 else [])
    H = 400
    img = Image.new('RGB', (W, 90 + len(pick) * (H + 70) + 150), 'white')
    d = ImageDraw.Draw(img)
    d.text((20, 18), title, font=F_T, fill=INK)
    y = 80
    dt = rows[1]['t'] - rows[0]['t'] if len(rows) > 1 else 1 / 132
    for k in pick:
        a, b = L[k]
        pre = max(0, a - round(0.15 / dt))
        post = min(len(rows) - 1, b + round(0.25 / dt))
        F = Frame(rows, a)
        li = info[k] if k < len(info) else {}
        cap = f"{k + 1}번째 이어 돌리기 → {KO.get(li.get('tech'), li.get('tech', '?'))} 시작 자리 · 머리 위 {abs(li.get('dpsi', 0)):.0f}° · {li.get('dur', 0):.2f} s · 칼끝 {li.get('v0', 0):.0f} → {li.get('v1', 0):.0f} m/s"
        d.text((20, y), cap, font=F_H, fill=INK)
        y += 36
        pw = (W - 40) // 3
        for j, (vt, proj) in enumerate(VIEWS):
            draw_panel(d, (20 + j * pw, y, pw - 8, H), vt, proj, F, rows, a, b, pre, post)
        y += H + 30
    for j, line in enumerate(['칼 · 칼끝 길: 파랑(원을 부른 때) → 빨강(원이 끝난 때)', '엷은 회색 점선 = 앞 칼 끝 0.15 s · 검은 점선 = 원 뒤 다시 그은 칼 0.25 s', '몸: 엷은 회색 = 원을 부른 때 · 짙은 회색 = 원이 끝난 때 · 눈금 0.5 m', '틀 = 원을 부른 때의 몸 · 앞 그림은 마주 본 꼴(칼 든 쪽이 왼쪽)', '몸은 상대를 본 채(돌지 않음) — 칼만 머리 위로 돌아 다음 칼 시작 자리로']):
        d.text((20, y + j * 26), line, font=F_S, fill=INK)
    img.save(out)
    print(out, img.size)


if __name__ == '__main__':
    main()
