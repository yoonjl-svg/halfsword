# 풍차 베기(싱지르) 차례 그림 (11/12 — tools/sim/windmill.mjs --trace 가 쓴 JSON 을 그림으로 · 폰에서 보기 좋게 가로 1080). 읽기만.
#  frames 판: JSON 하나 → 컷 여덟 장 (두 칸씩 네 줄). 컷마다 위 = 위에서 본 발 자리 · 몸 · 칼 (오른쪽 = 상대 쪽 · 아래 = 처음 몸의 오른쪽(칼 든 쪽) · 눈금 0.5 m) /
#   아래 = 옆에서 본 몸 · 칼 (오른쪽 = 상대 쪽).
#   발: 빨강 = 오른발(칼 든 쪽) · 파랑 = 왼발 · 칠한 발 = 디딤 · 빈 발 = 들림 · 세모 = 발끝 · 엷은 회색 발 = 처음 자리
#   몸: 검은 점 = 골반 · 굵은 줄 = 어깨 · 고리 = 머리 · 짧은 화살 = 몸이 보는 쪽 · 엷은 회색 줄 = 골반이 지나온 길 / 칼: 짙은 줄 = 칼 · 엷은 빨강 = 칼끝이 지난 0.3 s 길 · 회색 = 상대
#  feet 판: JSON 둘(전 · 후) → 위에서 본 발 자리 한 장씩 (딛은 자리에 차례 번호 · 들린 발의 길 · 골반 길 · 디딘 채 돈 각) — 걸음이 언제 · 어디로 나가는지 한눈에
#  실행: python3 tools/sim/windmill_draw.py frames <trace.json> <나갈 png> <제목> [before|after]
#        python3 tools/sim/windmill_draw.py feet <전 json> <후 json> <나갈 png> <제목>
import json, math, sys
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
F_T = ImageFont.truetype(FONT, 34)
F_H = ImageFont.truetype(FONT, 26)
F_S = ImageFont.truetype(FONT, 21)
F_N = ImageFont.truetype(FONT, 24)
RED, BLUE, INK = (215, 40, 40), (40, 90, 215), (30, 30, 30)


class Trace:
    def __init__(self, path):
        self.D = json.load(open(path))
        self.FR = self.D['frames']
        f0 = self.FR[0]
        self.p0, self.h0 = f0['pel'], f0['hd']
        t = [0.0]
        for i in range(1, len(self.FR)):
            d = self.FR[i]['hd'] - self.FR[i - 1]['hd']
            t.append(t[-1] + math.atan2(math.sin(d), math.cos(d)))
        self.deg = [abs(x) * 180 / math.pi for x in t]

    def loc(self, p):
        """월드 → 처음 몸 틀 (x 앞 · y 위 · z 오른쪽)"""
        x, z = p[0] - self.p0[0], p[2] - self.p0[2]
        fx, fz = math.cos(self.h0), -math.sin(self.h0)
        rx, rz = math.sin(self.h0), math.cos(self.h0)
        return (x * fx + z * fz, p[1], x * rx + z * rz)

    def first(self, pred):
        return next((i for i, f in enumerate(self.FR) if pred(i, f)), None)

    def last(self, pred):
        j = None
        for i, f in enumerate(self.FR):
            if pred(i, f):
                j = i
        return j

    def picks(self, kind):
        FR, deg = self.FR, self.deg
        hit_t = (self.D.get('first') or {}).get('t')
        i_hit = self.first(lambda i, f: hit_t is not None and f['t'] >= hit_t - 1e-6)
        i_prep = self.last(lambda i, f: f['ph'] == 'prep')
        i_spin = self.last(lambda i, f: f['ph'] == 'spin')
        steps = [i for i, f in enumerate(FR) if f['ph'] == 'step']
        i_after = self.first(lambda i, f: f['ph'] == 'after')
        i_end = i_after if i_after is not None else len(FR) - 1
        if kind == 'after':
            p = [
                (0, '낼 때 (자세)'),
                (self.first(lambda i, f: f['ph'] == 'spin'), '앞발 틀어 딛음'),
                (self.first(lambda i, f: f['ph'] == 'spin' and deg[i] >= 150), '돌기 (150°)'),
                (self.first(lambda i, f: f['ph'] == 'spin' and deg[i] >= 220), '돌기 (220° · 등이 상대 쪽)'),
                (self.first(lambda i, f: f['ph'] == 'step'), '돌기 끝 · 뒷발 딛음'),
                (steps[len(steps) // 2] if steps else None, '앞발 내딛는 중 · 칼이 옴'),
                (i_hit if i_hit is not None else (steps[-1] if steps else None), '벰 (앞발이 딛는 순간)'),
                (i_end, '끝'),
            ]
        else:
            p = [
                (0, '낼 때 (자세)'),
                (i_prep, '칼 감기 끝'),
                (self.first(lambda i, f: deg[i] >= 90), '돌기 ¼ (90°)'),
                (self.first(lambda i, f: deg[i] >= 180), '돌기 ½ (180° · 등이 상대 쪽)'),
                (self.first(lambda i, f: deg[i] >= 270), '돌기 ¾ (270°)'),
                (self.first(lambda i, f: deg[i] >= 345), '돌기 끝 무렵'),
                (i_hit, '벰'),
                (i_end, '끝'),
            ]
        return [(i, l) for i, l in p if i is not None]


def foot_poly(T, xy, fc, yaw, L=0.24, Wd=0.10):
    x, y, z = T.loc(fc)
    a = yaw - T.h0
    fx, fz = math.cos(a), -math.sin(a)
    rx, rz = math.sin(a), math.cos(a)
    pts = [xy(x + fx * u + rx * v, z + fz * u + rz * v) for u, v in ((L / 2, Wd / 2), (L / 2, -Wd / 2), (-L / 2, -Wd / 2), (-L / 2, Wd / 2))]
    tri = [xy(x + fx * (L / 2 + 0.08), z + fz * (L / 2 + 0.08)), xy(x + fx * L / 2 + rx * 0.05, z + fz * L / 2 + rz * 0.05), xy(x + fx * L / 2 - rx * 0.05, z + fz * L / 2 - rz * 0.05)]
    return pts, tri


def draw_foot(d, T, xy, ft, faint=False, width=4):
    colr = RED if ft['side'] == 1 else BLUE
    pts, tri = foot_poly(T, xy, ft['c'], ft['yaw'])
    if faint:
        d.polygon(pts, outline=(195, 195, 195))
        return
    if ft['st']:
        d.polygon(pts, fill=colr, outline=INK)
    else:
        d.polygon(pts, outline=colr, width=width)
    d.polygon(tri, fill=colr)


def frames(src, out, title, kind):
    T = Trace(src)
    FR = T.FR
    picks = T.picks(kind)
    W, PW = 1080, 540
    TOP_H, SIDE_H, LAB_H = 430, 300, 46
    PH = LAB_H + TOP_H + SIDE_H + 10
    HEAD = 250
    TS, X0 = 170, 0.45  # 위 칸 1 m = px · 왼쪽 끝 = 처음 골반 뒤 X0 m
    SS = 150
    rows = (len(picks) + 1) // 2
    img = Image.new('RGB', (W, HEAD + rows * PH + 10), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((24, 14), title, font=F_T, fill=(20, 20, 20))
    for k, t in enumerate([
        '위 칸 = 위에서 본 모습 (오른쪽이 상대 쪽 · 눈금 0.5 m) · 아래 칸 = 옆에서 본 모습',
        '빨강 발 = 오른발(칼 든 쪽) · 파랑 발 = 왼발 · 칠한 발 = 딛고 있음 · 빈 발 = 들림 · 세모 = 발끝',
        '검은 점 = 골반 · 굵은 줄 = 어깨 · 짧은 화살 = 몸이 보는 쪽 · 엷은 회색 발 = 처음 자리',
        '짙은 줄 = 칼 · 엷은 빨강 = 칼끝이 지난 0.3 s 길 · 회색 = 상대 · 엷은 회색 줄 = 골반이 지나온 길',
    ]):
        d.text((24, 66 + k * 34), t, font=F_S, fill=(60, 60, 60))
    for n, (i, label) in enumerate(picks):
        f = FR[i]
        P = Image.new('RGB', (PW, PH), (255, 255, 255))
        g = ImageDraw.Draw(P)
        g.rectangle([4, 2, PW - 5, PH - 5], outline=(190, 190, 190), width=2)
        ty = LAB_H
        txy = lambda x, z: ((x + X0) * TS + 10, ty + TOP_H * 0.5 + z * TS)
        tp = lambda p: txy(T.loc(p)[0], T.loc(p)[2])
        for gx in range(-1, 7):
            X = txy(gx * 0.5, 0)[0]
            g.line([(X, ty + 4), (X, ty + TOP_H - 4)], fill=(236, 236, 236), width=1)
        for gz in range(-3, 4):
            Y = txy(0, gz * 0.5)[1]
            g.line([(8, Y), (PW - 8, Y)], fill=(236, 236, 236), width=1)
        fc = tp(f['foe']['ch'])
        g.ellipse([fc[0] - 30, fc[1] - 46, fc[0] + 30, fc[1] + 46], fill=(205, 205, 205), outline=(150, 150, 150))
        g.text((min(fc[0] - 22, PW - 70), fc[1] + 50), '상대', font=F_S, fill=(120, 120, 120))
        for ft in FR[0]['feet']:
            draw_foot(g, T, txy, ft, faint=True)
        path = [tp(FR[k]['pel']) for k in range(0, i + 1, 2)]
        if len(path) > 1:
            g.line(path, fill=(185, 185, 185), width=4)
        tips = [tp(FR[k]['tip']) for k in range(0, i + 1) if FR[k]['t'] >= f['t'] - 0.3]
        if len(tips) > 1:
            g.line(tips, fill=(245, 165, 165), width=4)
        for ft in f['feet']:
            draw_foot(g, T, txy, ft)
        ch = T.loc(f['ch'])
        a = f['hd'] - T.h0
        fx, fz, rx, rz = math.cos(a), -math.sin(a), math.sin(a), math.cos(a)
        g.line([txy(ch[0] + rx * 0.2, ch[2] + rz * 0.2), txy(ch[0] - rx * 0.2, ch[2] - rz * 0.2)], fill=INK, width=8)
        nose = txy(ch[0] + fx * 0.32, ch[2] + fz * 0.32)
        g.line([txy(ch[0], ch[2]), nose], fill=INK, width=3)
        g.polygon([nose, (nose[0] - fx * 16 + rx * 9, nose[1] - fz * 16 + rz * 9), (nose[0] - fx * 16 - rx * 9, nose[1] - fz * 16 - rz * 9)], fill=INK)
        pe = tp(f['pel'])
        g.ellipse([pe[0] - 9, pe[1] - 9, pe[0] + 9, pe[1] + 9], fill=(0, 0, 0))
        hp = tp(f['hdp'])
        g.ellipse([hp[0] - 15, hp[1] - 15, hp[0] + 15, hp[1] + 15], outline=INK, width=3)
        g.line([tp(f['hilt']), tp(f['tip'])], fill=(60, 50, 40), width=7)
        # 옆 칸
        sy = ty + TOP_H
        g.line([(8, sy), (PW - 8, sy)], fill=(215, 215, 215), width=1)
        gy = sy + SIDE_H - 22
        sxy = lambda p: ((T.loc(p)[0] + X0) * SS + 10, gy - T.loc(p)[1] * SS)
        g.line([(8, gy), (PW - 8, gy)], fill=(150, 150, 150), width=2)
        fcs, fps, fhs = sxy(f['foe']['ch']), sxy(f['foe']['pel']), sxy(f['foe']['hd'])
        g.line([fps, fcs], fill=(200, 200, 200), width=18)
        g.line([fps, (fps[0], gy)], fill=(210, 210, 210), width=9)
        g.ellipse([fhs[0] - 12, fhs[1] - 12, fhs[0] + 12, fhs[1] + 12], fill=(200, 200, 200))
        for k, colr in (('thighB', BLUE), ('shinB', BLUE), ('thighF', RED), ('shinF', RED), ('uarmO', (130, 130, 130)), ('farmO', (130, 130, 130)), ('uarmS', (60, 60, 60)), ('farmS', (60, 60, 60))):
            s = f['seg'].get(k)
            if s:
                g.line([sxy(s[0:3]), sxy(s[3:6])], fill=colr, width=8)
        g.line([sxy(f['pel']), sxy(f['ch'])], fill=INK, width=12)
        h2 = sxy(f['hdp'])
        g.ellipse([h2[0] - 15, h2[1] - 15, h2[0] + 15, h2[1] + 15], outline=INK, width=3)
        for ft in f['feet']:
            colr = RED if ft['side'] == 1 else BLUE
            q = sxy(ft['c'])
            box = [q[0] - 11, q[1] - 7, q[0] + 11, q[1] + 7]
            if ft['st']:
                g.ellipse(box, fill=colr)
            else:
                g.ellipse(box, outline=colr, width=3)
        g.line([sxy(f['hilt']), sxy(f['tip'])], fill=(60, 50, 40), width=7)
        g.rectangle([6, 4, PW - 7, LAB_H - 2], fill=(255, 255, 255))  # 이름 줄은 맨 위에 (칼끝 길이 덮지 않게)
        g.text((16, 8), f'{n + 1}. {label}', font=F_H, fill=(10, 10, 10))
        g.text((PW - 110, 12), f"{f['t']:.2f} s", font=F_S, fill=(90, 90, 90))
        img.paste(P, ((n % 2) * PW, HEAD + (n // 2) * PH))
    img.save(out, optimize=True)
    print('wrote', out, [(i, round(FR[i]['t'], 3)) for i, _ in picks])


def feet(src_a, src_b, out, title):
    W, PH, HEAD = 1080, 700, 170
    TS, X0 = 330, 0.7
    img = Image.new('RGB', (W, HEAD + 2 * PH + 10), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((24, 14), title, font=F_T, fill=(20, 20, 20))
    for k, t in enumerate([
        '위에서 본 발 자리 · 오른쪽이 상대 쪽 · 눈금 0.5 m · 빨강 = 오른발(칼 든 쪽) · 파랑 = 왼발',
        '칠한 발 = 딛은 자리 (번호 = 딛은 차례) · 가는 줄 = 발이 들려 지나간 길 · 굵은 회색 줄 = 골반 길',
    ]):
        d.text((24, 66 + k * 34), t, font=F_S, fill=(60, 60, 60))
    names = {1: '오른발', -1: '왼발'}
    for row, (src, lab) in enumerate(((src_a, '전 — 11/11 판 (돌며 나아감)'), (src_b, '후 — 11/12 안 (앞발 틀기 → 제자리 돌기 → 내디디며 벰)'))):
        T = Trace(src)
        FR = [f for f in T.FR if f['ph'] != 'after']
        P = Image.new('RGB', (W, PH), (255, 255, 255))
        g = ImageDraw.Draw(P)
        g.rectangle([4, 2, W - 5, PH - 5], outline=(190, 190, 190), width=2)
        g.text((16, 8), lab, font=F_H, fill=(10, 10, 10))
        oy, oh = 50, 470
        xy = lambda x, z: ((x + X0) * TS + 20, oy + oh * 0.5 + z * TS)
        tp = lambda p: xy(T.loc(p)[0], T.loc(p)[2])
        for gx in range(-2, 7):
            X = xy(gx * 0.5, 0)[0]
            g.line([(X, oy), (X, oy + oh)], fill=(236, 236, 236), width=1)
        for gz in range(-2, 3):
            Y = xy(0, gz * 0.5)[1]
            g.line([(8, Y), (W - 8, Y)], fill=(236, 236, 236), width=1)
        g.text((W - 150, oy + 4), '상대 쪽 →', font=F_S, fill=(120, 120, 120))
        g.line([tp(f['pel']) for f in FR[::2]], fill=(175, 175, 175), width=7)
        # 발마다: 들린 길 · 딛은 자리 (처음 · 딛을 때마다) · 디딘 채 돈 각
        events = []
        for side in (1, -1):
            colr = RED if side == 1 else BLUE
            seq = [next(ft for ft in f['feet'] if ft['side'] == side) | {'t': f['t']} for f in FR]
            g.line([tp(x['c']) for x in seq], fill=tuple(min(255, c + 90) for c in colr), width=3)
            grind = 0.0
            for k in range(len(seq)):
                x = seq[k]
                if k == 0 or (x['st'] and not seq[k - 1]['st']):
                    events.append((x['t'], side, x))
                if k and x['st'] and seq[k - 1]['st']:
                    dy = x['yaw'] - seq[k - 1]['yaw']
                    grind += abs(math.atan2(math.sin(dy), math.cos(dy)))
            events.append((None, side, {'grind': grind * 180 / math.pi}))
        steps = sorted([e for e in events if e[0] is not None], key=lambda e: (e[0], -e[1]))
        notes = []
        for n, (t, side, x) in enumerate(steps):
            colr = RED if side == 1 else BLUE
            pts, tri = foot_poly(T, xy, x['c'], x['yaw'])
            g.polygon(pts, fill=colr, outline=INK)
            g.polygon(tri, fill=colr)
            c = tp(x['c'])
            g.ellipse([c[0] - 15, c[1] - 15, c[0] + 15, c[1] + 15], fill=(255, 255, 255), outline=colr, width=3)
            g.text((c[0] - 7, c[1] - 14), str(n + 1), font=F_N, fill=colr)
            notes.append(f"{n + 1} {t:.2f} s {names[side]}{' (처음)' if t == 0 else ' 딛음'}")
        grinds = [f"{names[s]} 디딘 채 돈 각 {x['grind']:.0f}°" for t, s, x in events if t is None]
        p0, p1 = tp(FR[0]['pel']), tp(FR[-1]['pel'])
        for q in (p0, p1):
            g.ellipse([q[0] - 9, q[1] - 9, q[0] + 9, q[1] + 9], fill=(0, 0, 0))
        travel = math.dist(T.loc(FR[0]['pel'])[::2], T.loc(FR[-1]['pel'])[::2])
        y = oy + oh + 12
        for k in range(0, len(notes), 3):
            g.text((20, y), ' · '.join(notes[k:k + 3]), font=F_S, fill=(40, 40, 40))
            y += 32
        g.text((20, y), ' · '.join(grinds) + f' · 골반 옮김 {travel:.2f} m', font=F_S, fill=(40, 40, 40))
        img.paste(P, (0, HEAD + row * PH))
    img.save(out, optimize=True)
    print('wrote', out)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'frames':
        frames(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else 'after')
    elif mode == 'feet':
        feet(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    else:
        raise SystemExit('첫 인자: frames | feet')
