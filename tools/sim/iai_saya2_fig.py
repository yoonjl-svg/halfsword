# iai_saya2_fig.py — 원전과 다른 셋 맞춤 그림 (11/14 — 사장님 11/13 "원전과 다른 셋 이어서 맞춰" · 기록 docs/strike/iai_saya2_2026-11-14.md ·
#  JSON = tools/sim/mhz_draw.mjs shot --trace=1 --json= (전 = 바탕 cad6702b 같은 도구 · 후 = 이 가지) · 폰 가로 1080 px · iai_saya_fig.py 를 본뜸)
#  색: 주황 = 전(11/13) · 파랑 = 후(11/14) · 청록 = 원전 자리 — 모두 글 이름을 붙임 (색만으로 가르지 않음)
#  python3.12 tools/sim/iai_saya2_fig.py ready|biki|regrip <out.png> <제목> <라벨=전json|후json:자세:처음 손> ...
#  python3.12 tools/sim/iai_saya2_fig.py source <out.png> <제목> <후json:자세:처음 손> <전json:자세:처음 손>
import json
import sys
from PIL import Image, ImageDraw, ImageFont


def font(sz):
    for p in ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf']:
        try:
            return ImageFont.truetype(p, sz)
        except OSError:
            pass
    return ImageFont.load_default()


W = 1080
F1, F2, F3 = font(22), font(17), font(15)
INK, INK2, MUTED, GRID = (30, 30, 30), (70, 70, 70), (130, 130, 130), (232, 232, 232)
BEFORE, AFTER, SRC = (235, 104, 52), (42, 120, 214), (27, 175, 122)  # dataviz 분류 색 1 · 2 · 3 (밝은 바탕 검사 통과 · 청록은 글 이름을 늘 붙임)
LIGHT = {BEFORE: (248, 200, 180), AFTER: (170, 200, 240), SRC: (170, 225, 205)}
HIP = (0.0, 0.08, 0.2)  # SECRET.iaiSayaHip (골반 틀 [앞, 위, 빈손 쪽 바깥])
MOUTH = (0.14, 0.08, 0.06)  # SECRET.iaiSayaMouth (鞘戻し 점)


def P3(g):
    return [g[0], g[1], -g[2]]  # 골반 틀 기록([앞, 위, 칼 든 쪽 +])으로


def pick(rows, guard, start):
    for r in rows:
        if r['guard'] == guard and r['start'] == start:
            return r
    raise SystemExit(f'없음 {guard} {start}')


def load_pair(spec):
    lab, rest = spec.split('=', 1)
    files, guard, start = rest.split(':')
    a, b = files.split('|')
    return lab, pick(json.load(open(a))['rows'], guard, start), pick(json.load(open(b))['rows'], guard, start)


def dot(d, p, r, fill=None, outline=None, width=2):
    d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=fill, outline=outline, width=width)


def d3(a, b):
    return sum((a[i] - b[i]) ** 2 for i in range(3)) ** 0.5


def pelvis_box(d, P, top=True):
    if top:
        a, b = P([0.1, 0, -0.16]), P([-0.1, 0, 0.16])
    else:
        a, b = P([0, 0.085, -0.16]), P([0, -0.085, 0.16])
    d.rectangle([min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])], outline=(170, 170, 170), width=2)


def body(d, P, f, c, w, front):
    d.line([P(f['pel']), P(f['ch']), P(f['hd'])], fill=c, width=w + 1)
    dot(d, P(f['hd']), 9, outline=c, width=2)
    d.line([P(f['osh']), P(f['sh'])], fill=c, width=w)
    if front:
        d.line([P(f['pel']), P(f['kF']), P(f['fF'])], fill=c, width=max(1, w - 1))
        d.line([P(f['pel']), P(f['kB']), P(f['fB'])], fill=c, width=max(1, w - 1))
    d.line([P(f['hi']), P(f['tip'])], fill=(150, 150, 150), width=2)
    d.line([P(f['sh']), P(f['el']), P(f['wr'])], fill=c, width=w + 1)
    d.line([P(f['osh']), P(f['oel']), P(f['ohd'])], fill=c, width=w + 1)
    dot(d, P(f['ohd']), 6, fill=(255, 255, 255), outline=c, width=3)


def header(title, lines, n, RH):
    img = Image.new('RGB', (W, 40 + 24 * len(lines) + RH * n + 10), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=INK, font=F1)
    for i, t in enumerate(lines):
        d.text((8, 38 + 24 * i), t, fill=INK2, font=F2)
    return img, d, 40 + 24 * len(lines)


def ready_main(argv):
    out, title = argv[0], argv[1]
    specs = [load_pair(s) for s in argv[2:]]
    CW, CH = W // 3, 330
    RH = CH + 48
    img, d, top = header(title, ['주황 = 전(11/13 — 대기 동안 왼손이 칼자루 끝) · 파랑 = 후(왼손이 칼집 입 鯉口) — 몸은 발도를 낸 때 · 흰 동그라미 = 왼손',
                                 '셋째 칸: 골반 틀 위에서(위 = 앞 · 오른쪽 = 칼 든 쪽) — 상자 = 골반 · 네모 = 칼집 입 · 세모 = 왼 허리(鞘引き 끝)'], len(specs), RH)
    for i, (lab, rb, ra) in enumerate(specs):
        oy = top + i * RH
        for j, view in enumerate(('front', 'top', 'pelvis')):
            pane = Image.new('RGB', (CW, CH), (255, 255, 255))
            pd = ImageDraw.Draw(pane)
            pd.rectangle([0, 0, CW - 1, CH - 1], outline=(210, 210, 210))
            if view == 'front':
                SC = 116
                P = lambda p: (CW * 0.45 + p[2] * SC, CH - 12 - p[1] * SC)
                pd.line([(0, CH - 12), (CW, CH - 12)], fill=(200, 200, 200), width=1)
                name = '앞면 (뒤에서)'
            elif view == 'top':
                SC = 150
                P = lambda p: (CW * 0.45 + p[2] * SC, CH * 0.62 - p[0] * SC)
                name = '위에서 (위 = 상대 쪽)'
            else:
                SC = 300
                P = lambda p: (CW * 0.52 + p[2] * SC, CH * 0.74 - p[0] * SC)
                name = '골반 틀 위에서'
            pd.text((6, 4), f'{lab} · {name}' if j == 0 else name, fill=INK, font=F2)
            if view == 'pelvis':
                pelvis_box(pd, P)
                hx, hy = P(P3(HIP))
                pd.polygon([(hx, hy - 8), (hx - 7, hy + 6), (hx + 7, hy + 6)], outline=SRC, width=2)
                pd.text((hx + 8, hy - 2), '왼 허리', fill=INK2, font=F3)
                for r, c, nm in ((rb, BEFORE, '전 왼손'), (ra, AFTER, '후 왼손')):
                    x, y = P(r['sum']['preOff']['ohP'])
                    dot(pd, (x, y), 6, outline=c, width=3)
                    pd.text((x + 9, y - 8) if nm.startswith('전') else (x - 30, y - 30), nm, fill=INK, font=F3)
                x, y = P(ra['sum']['preOff']['koiP'])
                pd.rectangle([x - 8, y - 8, x + 8, y + 8], outline=AFTER, width=2)
                pd.text((x + 12, y + 2), '칼집 입', fill=INK2, font=F3)
            else:
                for r, c in ((rb, BEFORE), (ra, AFTER)):
                    body(pd, P, r['pre'], c, 3, view == 'front')
            img.paste(pane, (j * CW, oy))
        for k, (r, nm) in enumerate(((rb, '전'), (ra, '후'))):
            s = r['sum']
            po = s['preOff']
            t = f"{nm}: 왼손 골반 틀 [앞 {po['ohP'][0]:+.2f} · 위 {po['ohP'][1]:+.2f} · 바깥 {-po['ohP'][2]:.2f}] · 칼집 입 몫 {po['sayaW']:.0f} · 쥠 {'예' if s['preGrip'] else '아니오'} · 칼 손 [{po['AH'][0]:.2f}, {po['AH'][1]:.2f}, {po['AH'][2]:.2f}] · 먼 길 {'예' if s['far'] else '아니오'} · 맞음 {r['hit']['part']}"
            d.text((8, oy + CH + 3 + 20 * k), t, fill=INK, font=F3)
    img.save(out, optimize=True)
    print('wrote', out)


def biki_main(argv):
    out, title = argv[0], argv[1]
    specs = [load_pair(s) for s in argv[2:]]
    RH, LW = 320, 420
    img, d, top = header(title, ['왼쪽: 골반 틀 위에서 — 뽑는 동안 왼손 길(주황 = 전 · 파랑 = 후) · 점 = 칼이 칼집을 떠나는 스텝 · 세모 = 왼 허리',
                                 '오른쪽: 뽑은 몫(가로) 별 왼손 ↔ 왼 허리 거리(m) · 세로 선 = 칼이 칼집을 떠나는 몫(鞘放れ)'], len(specs), RH)
    for i, (lab, rb, ra) in enumerate(specs):
        oy = top + i * RH
        pane = Image.new('RGB', (LW, RH), (255, 255, 255))
        pd = ImageDraw.Draw(pane)
        pd.rectangle([0, 0, LW - 1, RH - 1], outline=(210, 210, 210))
        SC = 330
        P = lambda p: (LW * 0.55 + p[2] * SC, RH * 0.62 - p[0] * SC)
        pd.text((6, 4), f'{lab} · 골반 틀 위에서', fill=INK, font=F2)
        pelvis_box(pd, P)
        hx, hy = P(P3(HIP))
        pd.polygon([(hx, hy - 8), (hx - 7, hy + 6), (hx + 7, hy + 6)], outline=SRC, width=2)
        pd.text((hx - 60, hy + 6), '왼 허리', fill=INK2, font=F3)
        info = []
        for r, c, nm in ((rb, BEFORE, '전'), (ra, AFTER, '후')):
            F = [f for f in r['frames'] if f['ph'] == 'draw']
            pd.line([P(f['ohP']) for f in F], fill=c, width=3)
            uB = r['sum'].get('sayaUB')
            if uB is None:
                ab = 0.33 if r['sum']['far'] else 0.0
                uB = ab + (1 - ab) * 0.35
            fB = next((f for f in F if f['u'] is not None and f['u'] >= uB - 1e-9), F[-1])
            dot(pd, P(fB['ohP']), 6, fill=c)
            dB = d3(fB['ohP'], P3(HIP))
            info.append((c, f"{nm}: 칼집을 떠날 때 왼손 ↔ 왼 허리 {dB:.2f} m · 뽑기 끝 {d3(F[-1]['ohP'], P3(HIP)):.2f} m"))
        for k, (c, t) in enumerate(info):
            pd.rectangle([6, RH - 46 + k * 20 + 4, 16, RH - 46 + k * 20 + 14], fill=c)
            pd.text((22, RH - 46 + k * 20), t, fill=INK, font=F3)
        img.paste(pane, (0, oy))
        ox, GW = LW, W - LW
        d.rectangle([ox, oy, ox + GW - 1, oy + RH - 1], outline=(210, 210, 210))
        X = lambda u: ox + 50 + u * (GW - 70)
        gy0, gh = oy + RH - 40, RH - 80
        Y = lambda m: gy0 - min(m, 0.6) / 0.6 * gh
        for m in (0, 0.2, 0.4, 0.6):
            d.line([(ox + 46, Y(m)), (ox + GW - 14, Y(m))], fill=GRID, width=1)
            d.text((ox + 6, Y(m) - 8), f'{m:.1f}', fill=MUTED, font=F3)
        for u in (0, 0.25, 0.5, 0.75, 1.0):
            d.text((X(u) - 12, gy0 + 6), f'{u:.2f}', fill=MUTED, font=F3)
        d.text((ox + 50, oy + 6), f'{lab} · 왼손 ↔ 왼 허리 (m) — 가로 = 뽑은 몫', fill=INK, font=F2)
        for k, (r, c, nm) in enumerate(((rb, BEFORE, '전'), (ra, AFTER, '후'))):
            F = [f for f in r['frames'] if f['ph'] == 'draw' and f['u'] is not None]
            pts = [(X(f['u']), Y(d3(f['ohP'], P3(HIP)))) for f in F]
            if len(pts) > 1:
                d.line(pts, fill=c, width=3)
            d.text((pts[0][0] + 6, pts[0][1] - 20 - 18 * k), nm, fill=INK, font=F3)
        uB = ra['sum'].get('sayaUB')
        if uB is not None:
            d.line([(X(uB), oy + 30), (X(uB), gy0)], fill=(160, 160, 160), width=1)
            d.text((X(uB) + 4, oy + 30), '칼이 칼집을 떠남', fill=MUTED, font=F3)
    img.save(out, optimize=True)
    print('wrote', out)


def regrip_main(argv):
    out, title = argv[0], argv[1]
    specs = [load_pair(s) for s in argv[2:]]
    RH, LW = 320, 420
    img, d, top = header(title, ['왼쪽: 골반 틀 위에서 — 다시 쥐는 동안 빈손 목표(점) · 빈손(선) — 세모 = 왼 허리 · 동그라미 = 鞘戻し 점(배꼽 앞)',
                                 '오른쪽: 굳음 끝부터(가로 s) — 띠 = 풀기(振りかぶり) · 선 = 다시 쥐는 몫 0 → 1 · 점선 = 빈손 목표 이웃 스텝 옮김(cm ÷ 10)'], len(specs), RH)
    for i, (lab, rb, ra) in enumerate(specs):
        oy = top + i * RH
        pane = Image.new('RGB', (LW, RH), (255, 255, 255))
        pd = ImageDraw.Draw(pane)
        pd.rectangle([0, 0, LW - 1, RH - 1], outline=(210, 210, 210))
        SC = 420
        P = lambda p: (LW * 0.5 + p[2] * SC, RH * 0.66 - p[0] * SC)
        pd.text((6, 4), f'{lab} · 골반 틀 위에서', fill=INK, font=F2)
        pelvis_box(pd, P)
        hx, hy = P(P3(HIP))
        pd.polygon([(hx, hy - 8), (hx - 7, hy + 6), (hx + 7, hy + 6)], outline=SRC, width=2)
        mx, my = P(P3(MOUTH))
        dot(pd, (mx, my), 9, outline=SRC, width=3)
        pd.text((mx + 10, my + 4), '鞘戻し 점', fill=INK2, font=F3)
        info = []
        for r, c, nm in ((rb, BEFORE, '전'), (ra, AFTER, '후')):
            R = [f for f in r['frames'] if f.get('rgK') is not None]
            for f in R[::2]:
                if f.get('offP'):
                    dot(pd, P(f['offP']), 2, fill=c)
            pd.line([P(f['ohP']) for f in R], fill=LIGHT[c], width=3)
            s = r['sum']
            info.append((c, f"{nm}: 시작 {'풀기 동안' if (s.get('rgStart') or {}).get('ph') == 'fade' else '풀기 끝 뒤'} · 튐 {s['offJump']['d'] * 100:.1f} cm/스텝 · 다시 쥠 {s['regripGrip']} s"))
        for k, (c, t) in enumerate(info):
            pd.rectangle([6, RH - 46 + k * 20 + 4, 16, RH - 46 + k * 20 + 14], fill=c)
            pd.text((22, RH - 46 + k * 20), t, fill=INK, font=F3)
        img.paste(pane, (0, oy))
        ox, GW = LW, W - LW
        d.rectangle([ox, oy, ox + GW - 1, oy + RH - 1], outline=(210, 210, 210))
        ta, tb = -0.05, 0.6
        X = lambda t: ox + 50 + (t - ta) / (tb - ta) * (GW - 70)
        gy0, gh = oy + RH - 40, RH - 90
        Y = lambda v: gy0 - max(0, min(v, 1.0)) * gh
        d.text((ox + 50, oy + 6), f'{lab} · 굳음 끝부터 (s)', fill=INK, font=F2)
        for v in (0, 0.5, 1.0):
            d.line([(ox + 46, Y(v)), (ox + GW - 14, Y(v))], fill=GRID, width=1)
            d.text((ox + 8, Y(v) - 8), f'{v:.1f}', fill=MUTED, font=F3)
        for t in (0, 0.2, 0.4, 0.6):
            d.text((X(t) - 12, gy0 + 6), f'{t:.1f}', fill=MUTED, font=F3)
        for k, (r, c, nm) in enumerate(((rb, BEFORE, '전'), (ra, AFTER, '후'))):
            fr = r['frames']
            iH = next(k2 for k2, f in enumerate(fr) if f['ph'] == 'fade')
            t0 = fr[iH]['t']
            fa = [f for f in fr if f['ph'] == 'fade']
            if k == 0:
                by = oy + 34
                d.rectangle([X(fa[0]['t'] - t0), by, X(fa[-1]['t'] - t0), by + 10], fill=(225, 225, 225))
                d.text((X(fa[-1]['t'] - t0) + 6, by - 3), '풀기 (振りかぶり — 전 · 후 같음)', fill=INK2, font=F3)
            R = [f for f in fr if f.get('rgK') is not None and ta <= f['t'] - t0 <= tb]
            if len(R) > 1:
                d.line([(X(f['t'] - t0), Y(f['rgK'])) for f in R], fill=c, width=3)
            J = []
            for a, b in zip(fr[iH - 6:], fr[iH - 5:]):
                if a.get('offT') and b.get('offT') and ta <= b['t'] - t0 <= tb:
                    J.append((X(b['t'] - t0), Y(d3(a['offT'], b['offT']) * 10)))
            for q in range(0, len(J) - 1, 2):
                d.line([J[q], J[q + 1]], fill=c, width=1)
    img.save(out, optimize=True)
    print('wrote', out)


def source_main(argv):
    out, title = argv[0], argv[1]

    def one(spec):
        f, g, s = spec.split(':')
        return pick(json.load(open(f))['rows'], g, s)

    ra, rb = one(argv[2]), one(argv[3])
    H, SC = 560, 900
    img = Image.new('RGB', (W, 70 + H + 420), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=INK, font=F1)
    d.text((8, 38), '골반 틀 위에서 (위 = 앞 · 오른쪽 = 칼 든 쪽) · 청록 = 원전 차례 ①→⑤ · 파랑 = 후 잰 왼손 길 (대기 → 뽑기 → 잔심 → 다시 쥐기) · 주황 = 전', fill=INK2, font=F2)
    oy = 70
    P = lambda p: (W * 0.42 + p[2] * SC, oy + H * 0.72 - p[0] * SC)
    d.rectangle([0, oy, W - 1, oy + H - 1], outline=(210, 210, 210))
    pelvis_box(d, P)
    d.text((P([-0.1, 0, 0.16])[0] - 40, P([-0.1, 0, 0.16])[1] + 4), '골반', fill=MUTED, font=F3)
    for r, c in ((rb, BEFORE), (ra, AFTER)):
        fr = r['frames']
        pre = [r['sum']['preOff']['ohP']]
        path = pre + [f['ohP'] for f in fr if f['ph'] in ('draw', 'hold', 'fade') or (f['ph'] == 'free' and f.get('rgK') is not None)]
        d.line([P(p) for p in path], fill=c if c == AFTER else LIGHT[c], width=3 if c == AFTER else 2)
    koi = ra['sum']['preOff']['koiP']
    hip = P3(HIP)
    mouth = P3(MOUTH)
    tsuka = next(f['pmP'] for f in ra['frames'] if f['ph'] == 'free' and f.get('rgK') is None and f['grip'])
    pts = [(koi, '① 칼집 입(鯉口) — 대기 · 뽑기 전 (잰 자리)'), (hip, '② 鞘引き 끝 = 칼이 칼집을 떠날 때\n③ 잔심 — 왼 허리(左帯)'), (mouth, '④ 鞘戻し — 칼집 입을 배꼽 앞으로 (振りかぶり 끝)'), (tsuka, '⑤ 칼자루(柄) — 두 손 (잰 자리)')]
    off = [(14, -26), (14, 8), (14, 10), (14, -8)]
    for k, ((p, t), (dx, dy)) in enumerate(zip(pts, off)):
        x, y = P(p)
        if k < len(pts) - 1:
            d.line([P(p), P(pts[k + 1][0])], fill=LIGHT[SRC], width=2)
        dot(d, (x, y), 9, outline=SRC, width=3)
        d.multiline_text((x + dx, y + dy), t, fill=INK, font=F3, spacing=3)
    d.text((10, oy + H - 26), '주황 선 = 전(11/13): 대기 동안 칼자루 끝 → 뽑는 동안 빈팔 근육으로 왼 허리 → 풀기 끝 뒤 곧게 칼자루로', fill=INK2, font=F3)
    rows = [
        ('단계', '원전 (전일본검도연맹 거합)', '전 (11/13)', '후 (11/14)'),
        ('뽑기 전', '두 손을 칼에 — 오른손 柄 · 왼손 鯉口 (解説 1본)', '두 손 칼자루', '왼손 칼집 입 (칼집째 쥠)'),
        ('뽑아 냄 · 鞘放れ', '鞘引きとともに抜き出し — 鞘放れ 때 힘껏\n칼집 허리까지 (解説 1본 · 虎の巻)', '칼자루 → 왼 허리\n(근육 — 굳음 들어 닿음)', '칼집 입 → 왼 허리\n(칼집을 떠날 때 닿음)'),
        ('잔심', '왼손 鯉口 쥔 채 왼 허리 (1 · 5본)', '왼 허리', '왼 허리'),
        ('두 손으로', '鯉口をへそ前に戻しながら …\n振りかぶると同時に左手を柄にかけ (1본 · 留意点)', '풀기 끝 뒤 0.2 s 곧게', '풀기 동안 시작 · 鞘戻し 점\n= 풀기 끝 · 0.1 s 뒤 柄'),
    ]
    cx = [8, 140, 600, 820]
    y = oy + H + 10
    for k, row in enumerate(rows):
        hgt = 46 if any('\n' in t for t in row) else 30
        if k == 0:
            d.rectangle([0, y - 4, W, y + 26], fill=(244, 244, 244))
        for x, txt in zip(cx, row):
            d.multiline_text((x, y), txt, fill=INK if k else INK2, font=F3 if k else F2, spacing=3)
        y += hgt
        d.line([(0, y - 4), (W, y - 4)], fill=GRID, width=1)
    d.text((8, y + 2), '출처: 全剣連 居合 解説(制定 1본 前 · 5본 袈裟切り) · 「指導上の留意点」 2022 · 2025 — 글 · 쪽은 iai_saya_2026-11-13.md §1 · iai_saya2_2026-11-14.md §1', fill=MUTED, font=F3)
    img = img.crop((0, 0, W, y + 28))
    img.save(out, optimize=True)
    print('wrote', out)


def main():
    mode = sys.argv[1]
    fn = {'ready': ready_main, 'biki': biki_main, 'regrip': regrip_main, 'source': source_main}.get(mode)
    if not fn:
        raise SystemExit('mode: ready | biki | regrip | source')
    fn(sys.argv[2:])


main()
