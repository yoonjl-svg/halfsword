# iai_saya_fig.py — 한 손 발도 왼손(칼집 손) 자리 원전대로 · 우치가타나 등 다시 쥐기 부드럽게 그림 (11/13 사장님 결정 "… 우치가타나 부드럽게. … 욍손자리 원전대로." —
#  기록 docs/strike/iai_saya_2026-11-13.md · JSON = tools/sim/mhz_draw.mjs shot --trace=1 --json= · 폰 가로 1080 px · mhz_draw_fig.py 를 본뜸)
#  색: 주황 = 전(바탕 — 10/14 배 앞 · 우치가타나 곧장) · 파랑 = 후(원전 왼 허리 · 다시 쥐기 0.2 s) · 청록 = 원전 자리 — 모두 글로 이름을 붙임(색만으로 가르지 않음)
#  regrip: 줄 = 자세 하나 · 왼쪽 = 가슴 앞면(뒤에서 — 오른쪽 = 칼 든 쪽) 빈손 목표 점(스텝마다) · 빈손 길 · 오른쪽 = 굳음 끝 앞 0.1 s ~ 풀기 끝 뒤 0.8 s 빈손 목표 이웃 스텝 옮김(cm) · 쥠 띠
#   python3.12 tools/sim/iai_saya_fig.py regrip <out.png> <제목> <라벨=전json|후json:자세:처음 손> ...
#  saya: 줄 = 자세 하나 · 칸 셋 = 앞면(뒤에서) · 위에서(위 = 상대 쪽) · 골반 틀 위에서(빈손 길 — 뽑기 · 굳음) — 전 · 후 겹침
#   python3.12 tools/sim/iai_saya_fig.py saya <out.png> <제목> <라벨=전json|후json:자세:처음 손> ...
#  source: 원전 견줌 — 골반 틀 위에서 · 앞면 그림(원전 자리 · 전 · 후 잰 자리 · 다시 쥐는 길) + 단계 표
#   python3.12 tools/sim/iai_saya_fig.py source <out.png> <제목> <후json:자세:처음 손> <전json:자세:처음 손>
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
SAYA_OLD = (0.24, -0.28, 0.0)  # 10/14 배 앞 (가슴 틀)
SAYA_HIP = (0.0, 0.08, 0.2)  # 원전 왼 허리 (골반 틀 — SECRET.iaiSayaHip)


def pick(rows, guard, start):
    for r in rows:
        if (guard is None or r['guard'] == guard) and (start is None or r['start'] == start):
            return r
    raise SystemExit(f'없음 {guard} {start}')


def load_pair(spec):
    lab, rest = spec.split('=', 1)
    files, guard, start = rest.split(':')
    a, b = files.split('|')
    return lab, pick(json.load(open(a))['rows'], guard, start), pick(json.load(open(b))['rows'], guard, start)


def window(fr, before=0.1, after=0.8):
    iH = next((k for k, f in enumerate(fr) if f['ph'] == 'fade'), 0)
    iF = next((k for k, f in enumerate(fr) if f['ph'] == 'free'), len(fr) - 1)
    t0 = fr[iF]['t']
    return [f for f in fr[max(0, iH - round(before * 120)):] if f['t'] <= t0 + after], t0


def jumps(win):
    out = []
    for k in range(1, len(win)):
        a, b = win[k - 1].get('offT'), win[k].get('offT')
        if a and b:
            out.append((win[k]['t'], sum((a[q] - b[q]) ** 2 for q in range(3)) ** 0.5))
    return out


def dot(d, p, r, fill=None, outline=None, width=2):
    d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=fill, outline=outline, width=width)


def regrip_main(argv):
    out, title = argv[0], argv[1]
    specs = [load_pair(s) for s in argv[2:]]
    RH, LW = 300, 400
    img = Image.new('RGB', (W, 100 + RH * len(specs) + 16), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=INK, font=F1)
    d.text((8, 38), '왼쪽: 가슴 앞면(뒤에서 — 오른쪽 = 칼 든 쪽) — 점 = 빈손 목표(스텝마다) · 선 = 빈손 · 네모 = 칼집 손 자리', fill=INK2, font=F2)
    d.text((8, 62), '오른쪽: 굳음 끝 앞 0.1 s ~ 풀기 끝 뒤 0.8 s 빈손 목표 이웃 스텝 옮김(cm) · 아래 띠 = 빈손이 칼자루를 쥠', fill=INK2, font=F2)
    for i, (lab, rb, ra) in enumerate(specs):
        oy0 = 100 + i * RH
        pane = Image.new('RGB', (LW, RH), (255, 255, 255))  # 왼쪽 칸은 따로 그려 붙임 (칸 밖으로 넘친 점은 잘림)
        d = ImageDraw.Draw(pane)
        oy = 0
        d.rectangle([0, oy, LW - 1, oy + RH - 1], outline=(210, 210, 210))
        S2 = 330
        P = lambda p: (LW * 0.55 + p[2] * S2, oy + RH * 0.42 - (p[1] + 0.05) * S2)
        d.text((6, oy + 4), f'{lab} · 가슴 앞면', fill=INK, font=F2)
        info = []
        for r, c, name in ((rb, BEFORE, '전'), (ra, AFTER, '후')):
            win, t0 = window(r['frames'])
            oh = [f['ohL'] for f in win]
            d.line([P(p) for p in oh], fill=LIGHT[c], width=3)
            for f in win:
                if f.get('offT') and f['ph'] == 'free':
                    dot(d, P(f['offT']), 2.5, fill=c)
            hold = [f for f in r['frames'] if f['ph'] == 'hold' and f.get('offT')]
            sx, sy = P(hold[-1]['offT'])
            d.rectangle([sx - 7, sy - 7, sx + 7, sy + 7], outline=c, width=3)
            d.text((sx + 10, sy - 2) if name == '전' else (sx - 30, sy + 10), f'{name} 칼집 손', fill=INK2, font=F3)
            s = r['sum']
            info.append((c, f"{name}: 튐 {s['offJump']['d'] * 100:.1f} cm/스텝 · 다시 쥠 {s['regripGrip']:.2f} s · 자리 {s['regripSeat']:.2f} s"))
        for k, (c, t) in enumerate(info):
            d.rectangle([6, oy + RH - 46 + k * 20 + 4, 16, oy + RH - 46 + k * 20 + 14], fill=c)
            d.text((22, oy + RH - 46 + k * 20), t, fill=INK, font=F3)
        img.paste(pane, (0, oy0))
        d = ImageDraw.Draw(img)
        oy = oy0
        # 오른쪽 그래프 — 풀기 끝을 0 으로 맞춤
        ox, GW = LW, W - LW
        d.rectangle([ox, oy, ox + GW - 1, oy + RH - 1], outline=(210, 210, 210))
        ta, tb = -0.35, 0.8
        X = lambda t: ox + 44 + (t - ta) / (tb - ta) * (GW - 64)
        gy0, gh = oy + RH - 44, RH - 84
        Y = lambda cm: gy0 - min(cm, 50) / 50 * gh
        for cm in (0, 10, 20, 30, 40, 50):
            d.line([(ox + 40, Y(cm)), (ox + GW - 14, Y(cm))], fill=GRID, width=1)
            d.text((ox + 6, Y(cm) - 8), f'{cm}', fill=MUTED, font=F3)
        d.text((ox + 6, gy0 + 8), 'cm', fill=MUTED, font=F3)
        d.line([(X(0), oy + 30), (X(0), gy0)], fill=(200, 200, 200), width=1)
        d.text((X(0) - 54, oy + 30), '풀기 끝', fill=MUTED, font=F3)
        for t in (-0.2, 0.2, 0.4, 0.6, 0.8):
            d.text((X(t) - 12, gy0 + 26), f'{t:+.1f}', fill=MUTED, font=F3)
        for k, (r, c, name) in enumerate(((rb, BEFORE, '전'), (ra, AFTER, '후'))):
            win, t0 = window(r['frames'])
            pts = [(X(t - t0), Y(dd * 100)) for t, dd in jumps(win) if ta <= t - t0 <= tb]
            if len(pts) > 1:
                d.line(pts, fill=c, width=2)
            top = max(jumps(win), key=lambda q: q[1])
            px, py = X(top[0] - t0), Y(top[1] * 100)
            d.text((px + 6, py - 4 if k == 0 else py - 22), f'{name} {top[1] * 100:.1f} cm', fill=INK, font=F3)
            for f in win:
                if f['grip'] and ta <= f['t'] - t0 <= tb:
                    x0 = X(f['t'] - t0)
                    d.rectangle([x0, gy0 + 4 + k * 10, x0 + 3, gy0 + 11 + k * 10], fill=c)
        d.text((ox + 44, oy + 6), f'{lab} · 빈손 목표 이웃 스텝 옮김 (가로 = 풀기 끝부터 s)', fill=INK, font=F2)
    img.save(out, optimize=True)
    print('wrote', out)


def moments(fr):
    draw = [f for f in fr if f['ph'] == 'draw']
    hold = [f for f in fr if f['ph'] == 'hold']
    m = [('pre', fr[0])]
    if draw:
        m.append(('end', draw[-1]))
    if hold:
        m.append(('hold', hold[min(len(hold) - 1, 36)]))
        m.append(('late', hold[-1]))
    return m


def body(d, P, f, c, w, front):
    d.line([P(f['pel']), P(f['ch']), P(f['hd'])], fill=c, width=w + 1)
    x, y = P(f['hd'])
    dot(d, (x, y), 9, outline=c, width=2)
    d.line([P(f['osh']), P(f['sh'])], fill=c, width=w)
    if front:
        d.line([P(f['pel']), P(f['kF']), P(f['fF'])], fill=c, width=max(1, w - 1))
        d.line([P(f['pel']), P(f['kB']), P(f['fB'])], fill=c, width=max(1, w - 1))
    d.line([P(f['hi']), P(f['tip'])], fill=(150, 150, 150), width=2)
    d.line([P(f['sh']), P(f['el']), P(f['wr'])], fill=c, width=w + 1)
    d.line([P(f['osh']), P(f['oel']), P(f['ohd'])], fill=c, width=w + 1)
    x, y = P(f['ohd'])
    dot(d, (x, y), 6, fill=(255, 255, 255), outline=c, width=3)


def saya_main(argv):
    out, title = argv[0], argv[1]
    specs = [load_pair(s) for s in argv[2:]]
    CW, CH = W // 3, 340
    RH = CH + 50
    img = Image.new('RGB', (W, 100 + RH * len(specs) + 10), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=INK, font=F1)
    d.text((8, 38), '주황 = 전(10/14 배 앞) · 파랑 = 후(원전 왼 허리) — 몸은 굳음 0.3 s · 엷은 선 = 빈손 길(뽑기 · 굳음) · 흰 동그라미 = 빈손', fill=INK2, font=F2)
    d.text((8, 62), '셋째 칸: 골반 틀 위에서(위 = 앞 · 오른쪽 = 칼 든 쪽) — 상자 = 골반 · 네모 = 빈손 목표 · 동그라미 = 굳음 뒤 반 빈손', fill=INK2, font=F2)
    for i, (lab, rb, ra) in enumerate(specs):
        oy = 100 + i * RH
        for j, view in enumerate(('front', 'top', 'pelvis')):
            pane = Image.new('RGB', (CW, CH), (255, 255, 255))
            pd = ImageDraw.Draw(pane)
            pd.rectangle([0, 0, CW - 1, CH - 1], outline=(210, 210, 210))
            if view == 'front':
                SC = 116
                P = lambda p: (CW * 0.45 + p[2] * SC, CH - 12 - p[1] * SC)
                name = '앞면 (뒤에서)'
                pd.line([(0, CH - 12), (CW, CH - 12)], fill=(200, 200, 200), width=1)
            elif view == 'top':
                SC = 150
                P = lambda p: (CW * 0.45 + p[2] * SC, CH * 0.62 - p[0] * SC)
                name = '위에서 (위 = 상대 쪽)'
            else:
                SC = 520
                P = lambda p: (CW * 0.5 + p[2] * SC, CH * 0.5 - p[0] * SC)
                name = '골반 틀 위에서'
            pd.text((6, 4), f'{lab} · {name}' if j == 0 else name, fill=INK, font=F2)
            if view == 'pelvis':
                pd.rectangle([P([0.1, 0, -0.16])[0], P([0.1, 0, -0.16])[1], P([-0.1, 0, 0.16])[0], P([-0.1, 0, 0.16])[1]], outline=(160, 160, 160), width=2)
                pd.text((P([0.1, 0, 0.16])[0] - 40, P([0.1, 0, 0.16])[1] - 20), '골반', fill=MUTED, font=F3)
                pd.line([P([0.3, 0, 0]), P([-0.25, 0, 0])], fill=GRID, width=1)
                pd.text((CW - 60, CH - 24), '↑ 앞', fill=MUTED, font=F3)
                for r, c, nm in ((rb, BEFORE, '전'), (ra, AFTER, '후')):
                    F = [f for f in r['frames'] if f['ph'] in ('draw', 'hold')][1:]
                    pd.line([P(f['ohP']) for f in F], fill=LIGHT[c], width=3)
                    H = [f for f in r['frames'] if f['ph'] == 'hold']
                    late = H[len(H) // 2:]
                    for f in late[::12]:
                        dot(pd, P(f['ohP']), 4, outline=c, width=2)
                    tg = late[-1]['offP']
                    x, y = P(tg)
                    pd.rectangle([x - 7, y - 7, x + 7, y + 7], outline=c, width=3)
                    pd.text((x - 70 if nm == '후' else x + 10, y - 26 if nm == '후' else y - 8), f'{nm} 목표', fill=INK2, font=F3)
            else:
                for r, c in ((rb, BEFORE), (ra, AFTER)):
                    F = [f for f in r['frames'] if f['ph'] in ('draw', 'hold')][1:]
                    pd.line([P(f['ohd']) for f in F], fill=LIGHT[c], width=3)
                pre = moments(ra['frames'])[0][1]
                body(pd, P, pre, (205, 205, 205), 2, view == 'front')
                for r, c in ((rb, BEFORE), (ra, AFTER)):
                    h = dict(moments(r['frames']))['hold']
                    body(pd, P, h, c, 3, view == 'front')
            img.paste(pane, (j * CW, oy))
        info = []
        for r, nm in ((rb, '전'), (ra, '후')):
            s = r['sum']
            hp = s['ohPHold']
            info.append(f"{nm}: 굳음 0.3 s 빈손 골반 틀 [앞 {hp[0]:+.2f} · 위 {hp[1]:+.2f} · 바깥 {-hp[2]:.2f}] m · 맞음 {r['hit']['part']} {r['hit']['E']:.0f} J · 굳음 칼 {s['hold']['elev']:.0f}° · 팔꿈치 {s['hold']['flex']:.0f}°")
        d.text((8, oy + CH + 4), info[0], fill=INK, font=F3)
        d.text((8, oy + CH + 24), info[1], fill=INK, font=F3)
    img.save(out, optimize=True)
    print('wrote', out)


def source_main(argv):
    out, title = argv[0], argv[1]

    def one(spec):
        f, g, s = spec.split(':')
        return pick(json.load(open(f))['rows'], g, s)

    ra, rb = one(argv[2]), one(argv[3])
    H, CW, SC = 520, W // 2, 640
    img = Image.new('RGB', (W, 70 + H + 370), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=INK, font=F1)
    d.text((8, 38), '골반 틀 · 청록 = 원전 자리(①②③ — ① 은 추정) · 주황 = 전 잰 빈손(굳음 뒤 반) · 파랑 = 후 잰 빈손 · 파랑 선 ④ = 후 두 손으로 돌아오는 길', fill=INK2, font=F2)
    koi = [0.13, 0.08, -0.06]  # 차인 칼집 입 — 鍔がへそ前 (帯刀) 곁 [추정 자리]
    hip = [SAYA_HIP[0], SAYA_HIP[1], -SAYA_HIP[2]]
    win, t0 = window(ra['frames'], 0.0, 0.45)
    path = [f['ohP'] for f in win if f['ph'] == 'free']
    for j, view in enumerate(('top', 'front')):
        ox, oy = j * CW, 70
        pane = Image.new('RGB', (CW, H), (255, 255, 255))
        pd = ImageDraw.Draw(pane)
        pd.rectangle([0, 0, CW - 1, H - 1], outline=(210, 210, 210))
        if view == 'top':
            P = lambda p: (CW * 0.55 + p[2] * SC, H * 0.62 - p[0] * SC)
            pd.text((6, 4), '위에서 (위 = 앞 · 상대 쪽 · 오른쪽 = 칼 든 쪽)', fill=INK, font=F2)
            a, b = P([0.1, 0, -0.16]), P([-0.1, 0, 0.16])
            pd.rectangle([a[0], a[1], b[0], b[1]], outline=(170, 170, 170), width=2)
            pd.text((b[0] - 40, b[1] + 4), '골반', fill=MUTED, font=F3)
        else:
            P = lambda p: (CW * 0.55 + p[2] * SC, H * 0.66 - p[1] * SC)
            pd.text((6, 4), '앞면 (뒤에서 본 꼴 · 오른쪽 = 칼 든 쪽)', fill=INK, font=F2)
            a, b = P([0, 0.085, -0.16]), P([0, -0.085, 0.16])
            pd.rectangle([a[0], a[1], b[0], b[1]], outline=(170, 170, 170), width=2)
            pd.text((b[0] - 40, b[1] + 4), '골반', fill=MUTED, font=F3)
            a, b = P([0, 0.30, -0.15]), P([0, 0.09, 0.15])
            pd.rectangle([a[0], a[1], b[0], b[1]], outline=(205, 205, 205), width=1)
            pd.text((b[0] - 30, a[1] + 4), '배', fill=MUTED, font=F3)
            a, b = P([0, 0.08, -0.36]), P([0, 0.08, 0.2])
            pd.line([a, b], fill=(230, 220, 170), width=7)
            pd.text((a[0] + 2, a[1] + 8), '허리띠(帯)', fill=MUTED, font=F3)
        x0, y0 = P(koi)
        x1, y1 = P(hip)
        pd.line([(x0, y0), (x1, y1)], fill=LIGHT[SRC], width=6)
        if len(path) > 1:
            pd.line([P(p) for p in path], fill=AFTER, width=3)
            ex, ey = P(path[-1])
            pd.text((ex + 6, ey - 20), '④', fill=INK, font=F2)
        for r, c, nm in ((rb, BEFORE, '전'), (ra, AFTER, '후')):
            Hh = [f for f in r['frames'] if f['ph'] == 'hold']
            late = Hh[len(Hh) // 2:]
            for f in late[::10]:
                dot(pd, P(f['ohP']), 5, outline=c, width=2)
            px, py = P(late[-1]['ohP'])
            pd.text((px + 9, py - 8) if nm == '전' else (px - 30, py + 10), nm, fill=INK, font=F2)
        dot(pd, (x0, y0), 9, outline=SRC, width=3)
        dot(pd, (x1, y1), 9, outline=SRC, width=3)
        pd.text((x0 + 12, y0 - 26), '①', fill=INK, font=F2)
        pd.text((x1 - 46, y1 - 28), '②③', fill=INK, font=F2)
        leg = ['① 칼집 입(鯉口) — 차인 자리 (鍔 배꼽 앞 곁) [추정]', '②③ 鞘引き 끝 · 잔심 = 왼 허리(左帯) — iaiSayaHip', '④ 후 두 손으로 — 왼 허리 → 칼자루 끝 (풀기 끝 뒤 0.45 s)']
        for k, t in enumerate(leg):
            pd.text((8, H - 70 + k * 21), t, fill=INK2, font=F3)
        img.paste(pane, (ox, oy))
    rows = [
        ('단계', '원전 (전일본검도연맹 거합)', '전 (10/14)', '후 (11/13)'),
        ('뽑아 냄', '왼손 鯉口 쥠 · 칼집을 뒤로 당김(鞘引き) · 칼집을 왼(아래)로 틂\n(解説 1본 · 5본)', '칼자루 → 배 앞', '칼자루 → 왼 허리'),
        ('벰 (鞘放れ)', '鞘放れ 때 힘껏 鞘引き — 왼 주먹 왼 허리 쪽\n(虎の巻 · 留意点 12본 左手で充分に鞘引き)', '배 앞', '왼 허리로 가는 중'),
        ('잔심 (굳음)', '왼손 鯉口 쥔 채 — 두 손은 내려 벨 때부터 (1 · 5본)', '배 앞', '왼 허리 옆 (몸 옆 줄)'),
        ('두 손으로', '振りかぶり와 함께 鯉口를 배꼽 앞으로(鞘戻し) · 柄에 손 얹고\n(まだ握らない) 내려 베며 쥠 (留意点 2025 1본)', '곧장 쥠 (튐)', '0.2 s 에 칼자루로'),
        ('血振り · 納刀', '왼손 左帯 → 鯉口 (1본) · 鯉口 쥠 (5본) — 게임엔 없음', '—', '—'),
    ]
    cx = [8, 116, 690, 830]
    y = 70 + H + 8
    for k, row in enumerate(rows):
        hgt = 46 if any('\n' in t for t in row) else 30
        if k == 0:
            d.rectangle([0, y - 4, W, y + 26], fill=(244, 244, 244))
        for x, txt in zip(cx, row):
            d.multiline_text((x, y), txt, fill=INK if k else INK2, font=F3 if k else F2, spacing=3)
        y += hgt
        d.line([(0, y - 4), (W, y - 4)], fill=GRID, width=1)
    d.text((8, y + 2), '출처: 全剣連 居合 解説(制定 1본 前 · 5본 袈裟切り) · 「指導上の留意点」 2022 · 2024 · 2025 — 글 · 쪽은 iai_saya_2026-11-13.md §1', fill=MUTED, font=F3)
    img = img.crop((0, 0, W, y + 28))
    img.save(out, optimize=True)
    print('wrote', out)


def main():
    mode = sys.argv[1]
    if mode == 'regrip':
        return regrip_main(sys.argv[2:])
    if mode == 'saya':
        return saya_main(sys.argv[2:])
    if mode == 'source':
        return source_main(sys.argv[2:])
    raise SystemExit('mode: regrip | saya | source')


main()
