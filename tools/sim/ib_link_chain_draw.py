# ib_link_chain_draw.py — 이어 돌리기 사슬 칼 개입 그림 (11/15 기록 docs/strike/ib_link_2026-11-15.md)
#  python3.12 tools/sim/ib_link_chain_draw.py strip <out.png> <제목> <이름=json> ...
#    한 줄에 한 판(전 · 후 …) · 칸마다 사슬의 둘째 · 셋째 · 넷째 칼: 옆(앞 x · 위 y) · 앞(옆 z · 위 y) 몸 틀(가슴 원점)의 칼끝 길 + 손 목표(패드)
#    짙은 빨강 = 사슬에서 실제로 나간 칼(다시 긋기 시작부터 그은 시간 + 0.1 s) · 칼 줄(손 → 칼끝) 0.05 s 마다 · 주황 점선 = 그 앞 넘기기 ·
#    파랑 = 같은 손가락 긋기를 그 시작 자리에 손을 두고 새로 그은 칼 · 패드 칸: 파랑 = 그은 몫(그 자리에서 손 목표 반지름으로 자름) · 빨강 = 실제 손 목표
#  json = tools/sim/ib_link_chain.mjs one --json=…
import json, math, sys
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
F_T = ImageFont.truetype(FONT, 26)
F_H = ImageFont.truetype(FONT, 19)
F_S = ImageFont.truetype(FONT, 15)
BG = (250, 248, 244)
INK = (40, 38, 36)
GRID = (222, 218, 210)
RED = (176, 40, 36)
BLUE = (52, 104, 176)
ORANGE = (226, 140, 40)
REACH = 0.62


def load(p):
    with open(p) as f:
        return json.load(f)


def lerp(a, b, u):
    return tuple(int(a[i] + (b[i] - a[i]) * u) for i in range(3))


def view(d, box, label, pts_sets, axes, rng):
    x0, y0, w, h = box
    d.rectangle([x0, y0, x0 + w, y0 + h], outline=GRID)
    d.text((x0 + 5, y0 + 3), label, fill=INK, font=F_S)
    (ax0, ax1), (ay0, ay1) = rng
    sx = w / (ax1 - ax0)
    sy = h / (ay1 - ay0)
    s = min(sx, sy)

    def S(p):
        return (x0 + (p[axes[0]] - ax0) * s + (w - (ax1 - ax0) * s) / 2, y0 + h - (p[axes[1]] - ay0) * s - (h - (ay1 - ay0) * s) / 2)

    # 가슴 · 땅 줄
    c = S([0, 0, 0])
    d.ellipse([c[0] - 4, c[1] - 4, c[0] + 4, c[1] + 4], outline=INK)
    for kind, pts, col, width in pts_sets:
        if kind == 'line' and len(pts) > 1:
            d.line([S(p) for p in pts], fill=col, width=width)
        elif kind == 'dash' and len(pts) > 1:
            for i in range(0, len(pts) - 1, 2):
                d.line([S(pts[i]), S(pts[i + 1])], fill=col, width=width)
        elif kind == 'blades':
            n = len(pts)
            for i, (hd, tp) in enumerate(pts):
                u = 0.25 + 0.75 * (i / max(1, n - 1))
                d.line([S(hd), S(tp)], fill=lerp((235, 225, 225), col, u), width=width)
        elif kind == 'dot':
            for p in pts:
                q = S(p)
                d.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], fill=col)


def pad(d, box, label, drawn, exe):
    x0, y0, w, h = box
    d.rectangle([x0, y0, x0 + w, y0 + h], outline=GRID)
    d.text((x0 + 5, y0 + 3), label, fill=INK, font=F_S)
    s = min(w, h) / 2 / 0.7
    cx = x0 + w / 2
    cy = y0 + h / 2

    def S(p):
        return (cx + p[0] * s, cy - p[1] * s)

    d.ellipse([cx - REACH * s, cy - REACH * s, cx + REACH * s, cy + REACH * s], outline=GRID)
    if len(drawn) > 1:
        d.line([S(p) for p in drawn], fill=BLUE, width=5)
    if len(exe) > 1:
        d.line([S(p) for p in exe], fill=RED, width=2)
    if exe:
        q = S(exe[0])
        d.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], fill=RED)


def cut_sets(r, c, fresh):
    rec = r['rec']
    spf = r['spf']
    step = r['step']
    st = next(s for s in r['strokes'] if s['k'] + 1 == c['k'])
    dur = st['n'] * spf
    W = dur + round(0.1 / step)
    t0 = c['t0']
    exe = [rec[t0 + s] for s in range(0, W + 1) if t0 + s < len(rec) and rec[t0 + s]]
    # 넘기기: t0 앞 'link' 스텝
    hinge = []
    s = t0 - 1
    while s > 0 and rec[s] and rec[s]['ph'] == 'link':
        hinge.append(rec[s])
        s -= 1
    hinge = hinge[::-1]
    fr = fresh[:W + 1]
    every = max(1, round(0.05 / step))
    blades_c = [(x['hd'], x['tip']) for i, x in enumerate(exe) if i % every == 0]
    blades_f = [(x['hd'], x['tip']) for i, x in enumerate(fr) if i % every == 0]
    # 패드: 그은 몫 (손 목표 반지름으로 자름)
    h0 = exe[0]['h'] if exe else [0, 0]
    drawn = [list(h0)]
    cx, cy = h0
    for dd in st['d']:
        cx += dd[0]
        cy += dd[1]
        n = math.hypot(cx, cy)
        if n > REACH:
            cx, cy = cx * REACH / n, cy * REACH / n
        drawn.append([cx, cy])
    return exe, hinge, fr, blades_c, blades_f, drawn


def strip(out, title, runs):
    cols = max(len(r['cuts']) for _, r in runs)
    cw, chh = 560, 316
    W = 30 + cols * (cw + 20)
    H = 70 + len(runs) * (chh + 60)
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((20, 14), title, fill=INK, font=F_T)
    for ri, (name, r) in enumerate(runs):
        y = 60 + ri * (chh + 60)
        d.text((20, y), f"{name} — {' → '.join(r['seq'])} · 쉼 {r['gap']} s", fill=INK, font=F_H)
        for ci, c in enumerate(r['cuts']):
            x = 20 + ci * (cw + 20)
            exe, hinge, fr, bc, bf, drawn = cut_sets(r, c, r['fresh'][ci])
            r2 = lambda v: '—' if v is None else f'{v:.2f}'
            d.text((x, y + 24), f"{c['k']}째 칼 {c['name']} · 넘김 {c['link'] or '없음'}", fill=INK, font=F_S)
            d.text((x, y + 42), f"받아 둔 {r2(c['hold'])} s · 시작 칼날 {r2(c['blade0'])}° · 칼끝 꼴 {r2(c['tipShape'])} m · 손 목표 {r2(c['hErr'])}", fill=INK, font=F_S)
            yy = y + 64
            sets = lambda ax: [
                ('dash', [p['tip'] for p in hinge], ORANGE, 2),
                ('blades', bf, BLUE, 2),
                ('blades', bc, RED, 2),
                ('line', [p['tip'] for p in fr], BLUE, 3),
                ('line', [p['tip'] for p in exe], RED, 3),
                ('dot', [exe[0]['tip']] if exe else [], RED, 0),
                ('dot', [fr[0]['tip']] if fr else [], BLUE, 0),
            ]
            view(d, (x, yy, 220, chh - 50), '옆 (앞 →)', sets(0), (0, 1), ((-1.2, 2.0), (-1.4, 2.0)))
            view(d, (x + 225, yy, 220, chh - 50), '앞 (칼 든 쪽 →)', sets(0), (2, 1), ((-2.0, 2.0), (-1.4, 2.0)))
            pad(d, (x + 450, yy, 110, 110), '손 목표', drawn, [p['h'] for p in exe[: len(drawn) * r['spf']]])
    d.text((20, H - 26), '빨강 = 사슬에서 나간 칼 · 파랑 = 같은 긋기를 그 시작 자리에서 새로 · 주황 점선 = 넘기기 · 칼 줄 0.05 s 마다 (옅음 → 짙음)', fill=INK, font=F_S)
    img.save(out)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'strip':
        out, title = sys.argv[2], sys.argv[3]
        runs = []
        for a in sys.argv[4:]:
            k, p = a.split('=', 1)
            runs.append((k, load(p)))
        strip(out, title, runs)
