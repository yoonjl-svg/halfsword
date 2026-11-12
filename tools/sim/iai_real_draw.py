# iai_real_draw.py — 사람 고노센 발도 몸 · 칼끝 길 그림 (11/13 — tools/sim/iai_real.mjs gns --trace=1 --json= 이 쓴 JSON 여럿 → PNG · 폰에서 보기 쉽게 가로 1080 px)
#  줄 = JSON 하나(판 · 갈래)의 한 자세 · 칸 셋 = 앞면(뒤에서 본 꼴 — 화면 오른쪽 = 칼 든 오른쪽) · 옆(오른쪽 = 상대 쪽) · 위에서(위 = 상대 쪽).
#  사람 꼴: 엷은 회색 = 뽑기 전(허리 대기) · 파랑 = 뽑는 가운데 · 짙은 파랑 = 뽑기 끝 · 보라 = 굳음 0.3 s(잔심) · 굵은 = 칼 팔 · 초록 = 빈팔 · 회색 막대 = 칼(칼자루 → 칼끝)
#  빨강 = 칼끝 길(뽑는 동안 — 잔상과 같은 몫) · 주황 = 굳음 동안 칼끝 · 점선 회색 = 상대 몸 가운데 줄 자리(x)
#  python3.12 tools/sim/iai_real_draw.py <out.png> <제목> <라벨=json[:자세[:처음 손]]> ...   (PIL · 글꼴 wqy-zenhei)
#  원전 견줌: python3.12 tools/sim/iai_real_draw.py ref <out.png> <제목> <라벨=json:자세:처음 손> ...  (앞면 · 위에서 — 끝 · 굳음 0.3 s 꼴에 원전 표시:
#   초록 띠 = 거합 5본 袈裟切り 7 시 → 1 시 올려 베는 줄(60°) · 연두 칸 = 끝 오른 주먹 자리(오른 어깨 위 · 오른쪽) · 위에서 회색 화살 = 1본 前 윗몸 왼쪽 45° 엶)
#  제비 베기: python3.12 tools/sim/iai_real_draw.py tsu <out.png> <제목> <라벨=json:가슴 사이:씨앗> ...  (iai_real.mjs tsu --json — 끔 빨강 · 켬 파랑 · 굵은 = 베는 토막 칼끝 · 가는 회색 = 손(칼자루) · 점선 = 곧은 줄)
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
CW = W // 3
CH = 300
SC = 120  # px / m
F1, F2 = font(22), font(17)
COL = {'pre': (175, 175, 175), 'mid': (90, 140, 235), 'end': (20, 50, 170), 'hold': (150, 60, 170)}


def pick(rows, guard, start):
    for r in rows:
        if (guard is None or r['guard'] == guard) and (start is None or r['start'] == start):
            return r
    return rows[0]


def moments(fr):
    draw = [f for f in fr if f['ph'] == 'draw']
    hold = [f for f in fr if f['ph'] == 'hold']
    out = []
    if fr:
        out.append(('pre', fr[0]))
    if draw:
        out.append(('mid', draw[len(draw) // 2]))
        out.append(('end', draw[-1]))
    if hold:
        out.append(('hold', hold[min(len(hold) - 1, 36)]))
    return out


def panel(d, ox, oy, fr, view, label):
    d.rectangle([ox, oy, ox + CW - 1, oy + CH - 1], outline=(210, 210, 210))
    if view == 'front':
        P = lambda p: (ox + CW * 0.45 + p[2] * SC, oy + CH - 12 - p[1] * SC)
        name = '앞면'
    elif view == 'side':
        P = lambda p: (ox + 70 + p[0] * SC, oy + CH - 12 - p[1] * SC)
        name = '옆'
    else:
        P = lambda p: (ox + CW * 0.45 + p[2] * SC, oy + CH * 0.72 - p[0] * SC)
        name = '위에서'
    d.text((ox + 6, oy + 4), f'{label} · {name}', fill=(40, 40, 40), font=F2)
    if view != 'top':
        d.line([(ox, oy + CH - 12), (ox + CW, oy + CH - 12)], fill=(200, 200, 200), width=1)
    # 칼끝 길 — 뽑기(빨강) · 굳음(주황)
    dr = [f['tip'] for f in fr if f['ph'] == 'draw']
    ho = [f['tip'] for f in fr if f['ph'] == 'hold']
    if len(ho) > 1:
        d.line([P(p) for p in ho], fill=(240, 150, 40), width=2)
    if len(dr) > 1:
        d.line([P(p) for p in dr], fill=(220, 30, 30), width=3)
    for key, f in moments(fr):
        c = COL[key]
        w = 2 if key == 'pre' else 3
        d.line([P(f['pel']), P(f['ch']), P(f['hd'])], fill=c, width=w + 1)
        x, y = P(f['hd'])
        d.ellipse([x - 9, y - 9, x + 9, y + 9], outline=c, width=2)
        d.line([P(f['osh']), P(f['sh'])], fill=c, width=w)
        d.line([P(f['pel']), P(f['kF']), P(f['fF'])], fill=c, width=w - 1)
        d.line([P(f['pel']), P(f['kB']), P(f['fB'])], fill=c, width=w - 1)
        d.line([P(f['hi']), P(f['tip'])], fill=(120, 120, 120) if key != 'pre' else (200, 200, 200), width=2)
        d.line([P(f['osh']), P(f['oel']), P(f['ohd'])], fill=(40, 160, 70) if key != 'pre' else (170, 210, 180), width=w - 1)
        d.line([P(f['sh']), P(f['el']), P(f['wr'])], fill=c, width=w + 2)
        x, y = P(f['el'])
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=c)


def tsu_main(argv):
    out, title = argv[0], argv[1]
    specs = []
    for sp in argv[2:]:
        lab, rest = sp.split('=', 1)
        path, gap, seed = rest.split(':')
        rows = [r for r in json.load(open(path))['rows'] if abs(r['gap'] - float(gap)) < 1e-6 and r['seed'] == int(seed)]
        specs.append((lab, rows))
    img = Image.new('RGB', (W, 70 + CH * len(specs) + 20), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=(0, 0, 0), font=F1)
    d.text((8, 38), '빨강 = 끔(11/13 전 — 손 곧은 줄) · 파랑 = 켬(칼끝 곧은 줄) · 굵은 = 베는 토막 칼끝 · 회색 = 칼자루 · 점선 = 처음 → 끝 곧은 줄', fill=(70, 70, 70), font=F2)
    for i, (lab, rows) in enumerate(specs):
        oy = 70 + i * CH
        for j, v in enumerate(['front', 'side', 'top']):
            ox = j * CW
            d.rectangle([ox, oy, ox + CW - 1, oy + CH - 1], outline=(210, 210, 210))
            if v == 'front':
                P = lambda p, ox=ox: (ox + CW * 0.55 + p[3] * SC, oy + CH - 12 - (p[2] - 0.2) * SC * 0.9)
                nm = '앞면'
            elif v == 'side':
                P = lambda p, ox=ox: (ox + 30 + p[1] * SC, oy + CH - 12 - (p[2] - 0.2) * SC * 0.9)
                nm = '옆'
            else:
                P = lambda p, ox=ox: (ox + CW * 0.55 + p[3] * SC, oy + CH * 0.9 - p[1] * SC)
                nm = '위에서'
            d.text((ox + 6, oy + 4), f'{lab} · {nm}', fill=(40, 40, 40), font=F2)
            for r in rows:
                col = (220, 40, 40) if r['tsuTip'] == 0 else (40, 80, 220)
                cut = [p for p in r['tip'] if p[4] and p[5]]
                hand = [r['hand'][k] for k, p in enumerate(r['tip']) if p[4] and p[5]]
                if len(hand) > 1:
                    d.line([P(p) for p in hand], fill=(150, 150, 150), width=1)
                if len(cut) > 1:
                    a, b = P(cut[0]), P(cut[-1])
                    n = 24
                    for k in range(0, n, 2):
                        d.line([(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n), (a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n)], fill=col, width=1)
                    d.line([P(p) for p in cut], fill=col, width=4)
                    for p in cut:
                        x, y = P(p)
                        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=col)
            if j == 0:
                yy = oy + 26
                for r in rows:
                    c = r['cut']
                    d.text((ox + 6, yy), f"{'켬' if r['tsuTip'] else '끔'} 휨 {c['devShare']:.3f} · 꺾임 {c['kinkDeg']:.0f}°", fill=(220, 40, 40) if r['tsuTip'] == 0 else (40, 80, 220), font=F2)
                    yy += 20
    img.save(out, optimize=True)
    print('wrote', out)


def ref_main(argv):
    import math
    out, title = argv[0], argv[1]
    specs = []
    for sp in argv[2:]:
        lab, rest = sp.split('=', 1)
        parts = rest.split(':')
        rows = json.load(open(parts[0]))['rows']
        specs.append((lab, pick(rows, parts[1] or None, parts[2] or None)))
    RW, RH = W // 2, 380
    img = Image.new('RGB', (W, 96 + RH * len(specs) + 20), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=(0, 0, 0), font=F1)
    d.text((8, 38), '짙은 파랑 뽑기 끝 · 보라 굳음 0.3 s · 빨강 칼끝 길(베는 몫) · 회색 그 앞 · 초록 줄 袈裟切り 7 → 1 시(60°) · 연두 칸 끝 주먹 자리', fill=(70, 70, 70), font=F2)
    d.text((8, 62), '위에서: 회색 화살 = 1본 前 끝 윗몸 왼쪽 45° 엶 · 굵은 선 = 어깨선 (출처: 전일본검도연맹 거합 지도상 유의점 2022)', fill=(70, 70, 70), font=F2)
    for i, (lab, r) in enumerate(specs):
        oy = 96 + i * RH
        fr = r['frames']
        draw = [f for f in fr if f['ph'] == 'draw']
        hold = [f for f in fr if f['ph'] == 'hold']
        end, h1 = draw[-1], hold[min(len(hold) - 1, 36)]
        S2 = 150
        # 앞면
        ox = 0
        d.rectangle([ox, oy, ox + RW - 1, oy + RH - 1], outline=(210, 210, 210))
        P = lambda p: (ox + RW * 0.42 + p[2] * S2, oy + RH - 10 - (p[1] - 0.3) * S2 * 0.95)
        d.text((ox + 6, oy + 4), f"{lab} · 앞면", fill=(40, 40, 40), font=F2)
        sh = end['sh']
        a = P([0, sh[1] + 0.05, sh[2] + 0.05])
        b = P([0, sh[1] + 0.6, sh[2] + 0.6])
        d.rectangle([a[0], b[1], b[0], a[1]], fill=(215, 240, 200))
        cut = [f['tip'] for f in fr if f.get('cut')]
        if cut:
            c = min(cut, key=lambda p: abs(p[2]))
            L = 1.2
            p0 = [0, c[1] - L * math.sin(math.radians(60)), c[2] - L * math.cos(math.radians(60))]
            p1 = [0, c[1] + L * math.sin(math.radians(60)), c[2] + L * math.cos(math.radians(60))]
            d.line([P(p0), P(p1)], fill=(60, 170, 80), width=5)
        dr = [f['tip'] for f in draw]
        dc = [f['tip'] for f in draw if f.get('cut')]
        d.line([P(p) for p in dr], fill=(200, 200, 200), width=2)
        if len(dc) > 1:
            d.line([P(p) for p in dc], fill=(220, 30, 30), width=3)
        for key, f in (('end', end), ('hold', h1)):
            col = COL[key]
            d.line([P(f['pel']), P(f['ch']), P(f['hd'])], fill=col, width=4)
            x, y = P(f['hd'])
            d.ellipse([x - 12, y - 12, x + 12, y + 12], outline=col, width=2)
            d.line([P(f['osh']), P(f['sh'])], fill=col, width=3)
            d.line([P(f['pel']), P(f['kF']), P(f['fF'])], fill=col, width=2)
            d.line([P(f['pel']), P(f['kB']), P(f['fB'])], fill=col, width=2)
            d.line([P(f['hi']), P(f['tip'])], fill=(110, 110, 110), width=3)
            d.line([P(f['osh']), P(f['oel']), P(f['ohd'])], fill=(40, 160, 70), width=2)
            d.line([P(f['sh']), P(f['el']), P(f['wr'])], fill=col, width=6)
        d.text((ox + 6, oy + 26), f"끝 주먹: 어깨보다 위 {end['wr'][1] - end['sh'][1]:+.2f} m · 오른쪽 {end['wr'][2] - end['sh'][2]:+.2f} m", fill=(20, 50, 170), font=F2)
        d.text((ox + 6, oy + 48), f"굳음 팔꿈치 {h1['flex']:.0f}° · 숙임 {h1['pitch']:.0f}°", fill=(150, 60, 170), font=F2)
        # 위에서
        ox = RW
        d.rectangle([ox, oy, ox + RW - 1, oy + RH - 1], outline=(210, 210, 210))
        Q = lambda p: (ox + RW * 0.45 + p[2] * S2, oy + RH * 0.62 - p[0] * S2)
        d.text((ox + 6, oy + 4), f"{lab} · 위에서 (위 = 상대 쪽)", fill=(40, 40, 40), font=F2)
        o = Q([0, 0, 0])
        ang = math.radians(45)
        d.line([o, (o[0] + 110 * math.sin(-ang), o[1] - 110 * math.cos(ang))], fill=(150, 150, 150), width=3)
        d.line([o, (o[0], o[1] - 110)], fill=(220, 220, 220), width=1)
        d.line([Q(p) for p in dr], fill=(200, 200, 200), width=2)
        if len(dc) > 1:
            d.line([Q(p) for p in dc], fill=(220, 30, 30), width=3)
        for key, f in (('end', end), ('hold', h1)):
            col = COL[key]
            d.line([Q(f['osh']), Q(f['sh'])], fill=col, width=6)
            d.line([Q(f['sh']), Q(f['el']), Q(f['wr'])], fill=col, width=4)
            d.line([Q(f['hi']), Q(f['tip'])], fill=(110, 110, 110), width=2)
            d.line([Q(f['osh']), Q(f['oel']), Q(f['ohd'])], fill=(40, 160, 70), width=2)
            x, y = Q(f['hd'])
            d.ellipse([x - 10, y - 10, x + 10, y + 10], outline=col, width=2)
        d.text((ox + 6, oy + 26), f"끝 가슴 돌림 {end['chestYaw']:+.0f}° · 굳음 {h1['chestYaw']:+.0f}° (음수 = 왼쪽으로 엶)", fill=(20, 50, 170), font=F2)
    img.save(out, optimize=True)
    print('wrote', out)


def main():
    if sys.argv[1] == 'ref':
        return ref_main(sys.argv[2:])
    if sys.argv[1] == 'tsu':
        return tsu_main(sys.argv[2:])
    out, title = sys.argv[1], sys.argv[2]
    specs = []
    for s in sys.argv[3:]:
        lab, rest = s.split('=', 1)
        parts = rest.split(':')
        rows = json.load(open(parts[0]))['rows']
        r = pick(rows, parts[1] if len(parts) > 1 and parts[1] else None, parts[2] if len(parts) > 2 and parts[2] else None)
        specs.append((lab, r))
    img = Image.new('RGB', (W, 70 + CH * len(specs) + 40), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=(0, 0, 0), font=F1)
    d.text((8, 38), '회색 뽑기 전 · 파랑 뽑는 가운데 · 짙은 파랑 뽑기 끝 · 보라 굳음 0.3 s · 빨강 칼끝 길 · 주황 굳음 칼끝 · 초록 빈팔', fill=(70, 70, 70), font=F2)
    for i, (lab, r) in enumerate(specs):
        oy = 70 + i * CH
        sub = f"{lab} ({r['guard']} · {r['start']})"
        for j, v in enumerate(['front', 'side', 'top']):
            panel(d, j * CW, oy, r['frames'], v, sub if j == 0 else lab)
    img.save(out, optimize=True)
    print('wrote', out)


main()
