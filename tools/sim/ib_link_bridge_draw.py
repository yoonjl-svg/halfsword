# ib_link_bridge_draw.py — 이어 돌리기 전 → 후 그림 (11/15 기록 docs/strike/ib_link_2026-11-14.md §12)
#  python3.12 tools/sim/ib_link_bridge_draw.py motion <out.png> <제목> <전.json> <후.json> [<끔.json>]
#    한 줄에 한 판(전 원 · 후 넘기기 · 끔): 앞(상대 쪽에서 본 — 옆 z · 위 y) · 옆(앞 x · 위 y) · 위(앞 x · 옆 z) — 앞 칼 손가락 끝부터 다음 칼이 맞을 때까지 0.05 s 칸마다
#    몸(뼈대) · 칼(손 → 칼끝) 색 = 때(옅음 → 짙음) · 칼끝 길(가는 줄) · 손 길(점선) · 넘기는 동안 칼은 빨강
#  python3.12 tools/sim/ib_link_bridge_draw.py curve <out.png> <제목> <이름=json> ...   (칼끝 빠르기 · 가슴 · 골반 돎 — 앞 칼 손가락 끝 = 0)
#  json = tools/sim/ib_link_bridge.mjs one --json=… (steps 줄)
import json, math, sys
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
F_T = ImageFont.truetype(FONT, 26)
F_H = ImageFont.truetype(FONT, 20)
F_S = ImageFont.truetype(FONT, 16)
BG = (250, 248, 244)
INK = (40, 38, 36)
GRID = (222, 218, 210)
BONES = [('head', 'chest'), ('chest', 'pelvis'), ('chest', 'uarmS'), ('uarmS', 'farmS'), ('chest', 'uarmO'), ('uarmO', 'farmO'), ('pelvis', 'thighF'), ('thighF', 'shinF'), ('shinF', 'footF'), ('pelvis', 'thighB'), ('thighB', 'shinB'), ('shinB', 'footB')]


def load(p):
    with open(p) as f:
        return json.load(f)


def frames(r, dt=0.05):
    st = r['steps']
    t0 = r['tEndA']
    t1 = (r['hitB'] or {}).get('t') or (t0 + 0.9)
    out = []
    k = 0
    while True:
        tt = t0 - 0.05 + k * dt
        if tt > t1 + 0.051:
            break
        s = min(st, key=lambda x: abs(x['t'] - tt))
        out.append(s)
        k += 1
    return out, t0, t1


def view_pts(r, axes):
    # 몸 틀: 첫 줄의 골반 자리 원점 · 플레이어는 +x 를 봄 (harness newRound heading 0)
    o = r['steps'][0]['body']['pelvis']
    def P(p):
        return (p[axes[0]] - o[axes[0]], p[axes[1]] - o[axes[1]])
    return P


def panel(d, box, r, axes, label, flip=False):
    x0, y0, w, h = box
    d.rectangle([x0, y0, x0 + w, y0 + h], outline=GRID)
    d.text((x0 + 6, y0 + 4), label, fill=INK, font=F_S)
    P = view_pts(r, axes)
    sc = h / 3.0
    cx = x0 + w * 0.42
    cy = y0 + h * 0.72

    def S(p):
        a, b = P(p)
        if flip:
            a = -a
        return (cx + a * sc, cy - b * sc)
    fr, t0, t1 = frames(r)
    n = max(1, len(fr) - 1)
    # 손 길 · 칼끝 길 (모든 스텝)
    st = [s for s in r['steps'] if t0 - 0.05 <= s['t'] <= t1 + 0.05]
    for key, col, wd in (('hand', (120, 120, 200), 1), ('tip', (90, 90, 90), 1)):
        pts = [S(s[key]) for s in st]
        for i in range(len(pts) - 1):
            if key == 'hand' and i % 2:
                continue
            d.line([pts[i], pts[i + 1]], fill=col, width=wd)
    for i, s in enumerate(fr):
        a = i / n
        c = int(200 - 170 * a)
        body = (c, c, c)
        for b0, b1 in BONES:
            p, q = s['body'].get(b0), s['body'].get(b1)
            if p and q:
                d.line([S(p), S(q)], fill=body, width=2)
        blade = (210, 40, 40) if s['link'] else (int(60 + 120 * (1 - a)), int(90 + 100 * (1 - a)), int(200 - 40 * a))
        d.line([S(s['hand']), S(s['tip'])], fill=blade, width=3)
    # 다음 칼 맞음
    if r.get('hitB'):
        s = min(r['steps'], key=lambda x: abs(x['t'] - r['hitB']['t']))
        tx, ty = S(s['tip'])
        d.ellipse([tx - 6, ty - 6, tx + 6, ty + 6], outline=(220, 120, 0), width=3)


def motion(out, title, paths):
    rs = [(p.split('=')[0], load(p.split('=')[1])) for p in paths]
    W, Hh = 1500, 300
    img = Image.new('RGB', (W, 70 + Hh * len(rs) + 40), BG)
    d = ImageDraw.Draw(img)
    d.text((16, 12), title, fill=INK, font=F_T)
    for k, (name, r) in enumerate(rs):
        y = 70 + k * Hh
        hb = r.get('hitB') or {}
        lk = r.get('link') or {}
        d.text((16, y + 4), f"{name}", fill=INK, font=F_H)
        pk = r.get('peak') or {}
        d.text((16, y + 32), f"① {pk.get('dt', '—')} s · ② {pk.get('vt', '—')} m/s · 맞음 {hb.get('e', '없음')} J · ③ {r['vmin']} m/s", fill=INK, font=F_S)
        d.text((16, y + 54), f"넘김 {lk.get('T', '—')} s · 튐 칼끝 {r['jumpTip']} · 손 {r['jumpHand']} 스텝 · 가장 {round((r['maxTip'] or 0) * 100)} · {round((r['maxHand'] or 0) * 100)} cm", fill=INK, font=F_S)
        bw = (W - 330) // 3
        panel(d, (320, y + 4, bw - 8, Hh - 12), r, (2, 1), '앞 (상대 쪽에서)', flip=True)
        panel(d, (320 + bw, y + 4, bw - 8, Hh - 12), r, (0, 1), '옆')
        panel(d, (320 + 2 * bw, y + 4, bw - 8, Hh - 12), r, (0, 2), '위')
    d.text((16, img.height - 30), '0.05 s 칸 · 몸 = 회색(옅음 → 짙음) · 칼 = 파랑(넘기는 동안 빨강) · 가는 줄 = 칼끝 길 · 점선 = 손 길 · 주황 원 = 다음 칼 맞음', fill=(110, 105, 100), font=F_S)
    img.save(out)


def curve(out, title, paths):
    rs = [(p.split('=')[0], load(p.split('=')[1])) for p in paths]
    W, H = 1400, 760
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((16, 12), title, fill=INK, font=F_T)
    cols = [(200, 60, 40), (30, 110, 200), (120, 120, 120), (40, 150, 80), (160, 90, 170)]
    # 위: 칼끝 빠르기 · 아래: 가슴 돎
    boxes = [(80, 70, W - 120, 380, '칼끝 빠르기 m/s', 'vt', 0, 30), (80, 500, W - 120, 200, '가슴 돎 ° (앞 칼 끝 기준)', 'yawC', -60, 60)]
    tmin, tmax = -0.1, 1.4
    for (x0, y0, w, h, lab, key, vlo, vhi) in boxes:
        d.rectangle([x0, y0, x0 + w, y0 + h], outline=GRID)
        d.text((x0, y0 - 24), lab, fill=INK, font=F_H)
        for tt in [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2]:
            X = x0 + (tt - tmin) / (tmax - tmin) * w
            d.line([X, y0, X, y0 + h], fill=GRID)
            d.text((X - 10, y0 + h + 4), f'{tt:.1f}', fill=INK, font=F_S)
        for v in range(int(vlo), int(vhi) + 1, 10 if key == 'vt' else 30):
            Y = y0 + h - (v - vlo) / (vhi - vlo) * h
            d.line([x0, Y, x0 + w, Y], fill=GRID)
            d.text((x0 - 36, Y - 8), str(v), fill=INK, font=F_S)
        for i, (name, r) in enumerate(rs):
            c = cols[i % len(cols)]
            t0 = r['tEndA']
            st = r['steps']
            y00 = st[0][key] if key != 'vt' else 0
            pts = []
            for s in st:
                tt = s['t'] - t0
                if tt < tmin or tt > tmax:
                    continue
                v = s[key] if key == 'vt' else math.degrees(math.atan2(math.sin(s[key] - y00), math.cos(s[key] - y00)))
                pts.append((x0 + (tt - tmin) / (tmax - tmin) * w, y0 + h - (min(vhi, max(vlo, v)) - vlo) / (vhi - vlo) * h))
            for j in range(len(pts) - 1):
                d.line([pts[j], pts[j + 1]], fill=c, width=2)
            # 넘기는 동안 띠 · 맞음
            lk = r.get('link')
            if lk and lk.get('t1') and key == 'vt':
                a = x0 + (lk['t0'] - t0 - tmin) / (tmax - tmin) * w
                b = x0 + (lk['t1'] - t0 - tmin) / (tmax - tmin) * w
                d.line([a, y0 + 6 + 8 * i, b, y0 + 6 + 8 * i], fill=c, width=5)
            if (r.get('peak') or r.get('hitB')) and key == 'vt':
                X = x0 + ((r.get('peak') or r['hitB'])['t'] - t0 - tmin) / (tmax - tmin) * w
                d.line([X, y0, X, y0 + h], fill=c, width=1)
            if key == 'vt':
                pk = r.get('peak') or {}
                d.text((x0 + w - 560, y0 + 10 + 22 * i), f"{name}: ① 가장 빠른 때 {pk.get('dt', '—')} s · ② {pk.get('vt', '—')} m/s · 맞음 {(r.get('hitB') or {}).get('e', '없음')} J · ③ {r['vmin']}", fill=c, font=F_S)
    d.text((16, H - 30), '가로 = 앞 칼 손가락 끝 뒤 실제 s · 굵은 띠 = 넘기는 동안 · 세로 줄 = 다음 칼이 가장 빠른 때(치는 순간)', fill=(110, 105, 100), font=F_S)
    img.save(out)


if __name__ == '__main__':
    mode, out, title, *paths = sys.argv[1:]
    (motion if mode == 'motion' else curve)(out, title, paths)
