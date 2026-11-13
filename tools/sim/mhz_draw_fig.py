# mhz_draw_fig.py — 모노호시자오 고노센 발도 전(두 손) · 후(한 손) 그림 (11/13 — tools/sim/mhz_draw.mjs shot --trace=1 --json= 이 쓴 JSON 여럿 → PNG · 폰 가로 1080 px ·
#  iai_real_draw.py 를 본뜸)
#  body: 줄 = JSON 하나의 한 자세 · 칸 셋 = 앞면(뒤에서 본 꼴 — 화면 오른쪽 = 칼 든 오른쪽) · 위에서(위 = 상대 쪽) · 칼끝 길(옆 — 오른쪽 = 상대 쪽)
#   사람 꼴: 엷은 회색 = 뽑기 전 · 파랑 = 뽑는 가운데 · 짙은 파랑 = 뽑기 끝 · 보라 = 굳음 0.3 s(잔심) · 청록 = 다시 쥔 뒤(풀기 끝 + 0.6 s) · 굵은 = 칼 팔 · 초록 = 빈팔
#   빈손 동그라미: 채움 = 칼자루를 쥠 · 빈 = 놓음 · 노랑 네모 = 칼집 손 자리(iaiSayaHand)
#   칼끝 길 칸: 회색 = 칼집 안(뽑아 냄) · 빨강 = 베는 몫(잔상) · 주황 = 굳음 · 청록 = 풀기 · 다시 쥐기 · 짙은 회색 막대 = 끝 · 굳음 0.3 s 칼
#  python3.12 tools/sim/mhz_draw_fig.py body <out.png> <제목> <라벨=json[:자세[:처음 손]]> ...
#  regrip: 돌아올 때 빈손 목표(가슴 몸체 틀 — 앞면 [칼 든 쪽, 위]) 점 · 빈손 길 · 이웃 스텝 옮김 그래프 · 쥠 띠
#  python3.12 tools/sim/mhz_draw_fig.py regrip <out.png> <제목> <라벨=json[:자세[:처음 손]]> ...
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
CH = 340
SC = 116  # px / m
F1, F2, F3 = font(22), font(17), font(15)
COL = {'pre': (175, 175, 175), 'mid': (90, 140, 235), 'end': (20, 50, 170), 'hold': (150, 60, 170), 'back': (20, 150, 150)}
SAYA = (0.24, -0.28, 0.0)


def pick(rows, guard, start):
    for r in rows:
        if (guard is None or r['guard'] == guard) and (start is None or r['start'] == start):
            return r
    return rows[0]


def load(spec):
    lab, rest = spec.split('=', 1)
    parts = rest.split(':')
    rows = json.load(open(parts[0]))['rows']
    return lab, pick(rows, parts[1] if len(parts) > 1 and parts[1] else None, parts[2] if len(parts) > 2 and parts[2] else None)


def moments(fr):
    draw = [f for f in fr if f['ph'] == 'draw']
    hold = [f for f in fr if f['ph'] == 'hold']
    free = [f for f in fr if f['ph'] == 'free']
    out = []
    if fr:
        out.append(('pre', fr[0]))
    if draw:
        out.append(('mid', draw[len(draw) // 2]))
        out.append(('end', draw[-1]))
    if hold:
        out.append(('hold', hold[min(len(hold) - 1, 36)]))
    if free:
        out.append(('back', free[min(len(free) - 1, 72)]))
    return out


def body_panel(d, ox, oy, fr, view, label, s):
    d.rectangle([ox, oy, ox + CW - 1, oy + CH - 1], outline=(210, 210, 210))
    if view == 'front':
        P = lambda p: (ox + CW * 0.42 + p[2] * SC, oy + CH - 12 - p[1] * SC)
        name = '앞면'
    elif view == 'top':
        P = lambda p: (ox + CW * 0.42 + p[2] * SC, oy + CH * 0.7 - p[0] * SC)
        name = '위에서'
    else:
        P = lambda p: (ox + 60 + p[0] * SC, oy + CH - 12 - p[1] * SC)
        name = '칼끝 길 (옆)'
    d.text((ox + 6, oy + 4), f'{label} · {name}', fill=(40, 40, 40), font=F2)
    if view != 'top':
        d.line([(ox, oy + CH - 12), (ox + CW, oy + CH - 12)], fill=(200, 200, 200), width=1)
    if view == 'tip':
        seg = {'sheath': [], 'cut': [], 'hold': [], 'back': []}
        for f in fr:
            if f['ph'] == 'draw':
                seg['cut' if f.get('cut') else 'sheath'].append(f['tip'])
            elif f['ph'] == 'hold':
                seg['hold'].append(f['tip'])
            elif f['ph'] in ('fade', 'free') and f['t'] <= (fr[-1]['t'] - 0.6):
                seg['back'].append(f['tip'])
        for k, c, w in (('back', (20, 150, 150), 2), ('hold', (240, 150, 40), 3), ('sheath', (160, 160, 160), 3), ('cut', (220, 30, 30), 4)):
            if len(seg[k]) > 1:
                d.line([P(p) for p in seg[k]], fill=c, width=w)
        for key, f in moments(fr):
            if key in ('end', 'hold'):
                d.line([P(f['hi']), P(f['tip'])], fill=(90, 90, 90), width=3)
                d.line([P(f['sh']), P(f['el']), P(f['wr'])], fill=COL[key], width=4)
        return
    dr = [f['tip'] for f in fr if f['ph'] == 'draw' and f.get('cut')]
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
        if view == 'front':
            d.line([P(f['pel']), P(f['kF']), P(f['fF'])], fill=c, width=w - 1)
            d.line([P(f['pel']), P(f['kB']), P(f['fB'])], fill=c, width=w - 1)
        d.line([P(f['hi']), P(f['tip'])], fill=(120, 120, 120) if key != 'pre' else (200, 200, 200), width=2)
        g = (40, 160, 70) if key != 'pre' else (170, 210, 180)
        d.line([P(f['osh']), P(f['oel']), P(f['ohd'])], fill=g, width=w)
        x, y = P(f['ohd'])
        if f.get('grip'):
            d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=g)
        else:
            d.ellipse([x - 6, y - 6, x + 6, y + 6], outline=g, width=2)
        d.line([P(f['sh']), P(f['el']), P(f['wr'])], fill=c, width=w + 2)
        x, y = P(f['el'])
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=c)


def body_main(argv):
    out, title = argv[0], argv[1]
    specs = [load(s) for s in argv[2:]]
    RH = CH + 46
    img = Image.new('RGB', (W, 96 + RH * len(specs) + 20), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=(0, 0, 0), font=F1)
    d.text((8, 38), '회색 뽑기 전 · 파랑 뽑는 가운데 · 짙은 파랑 뽑기 끝 · 보라 굳음 0.3 s · 청록 다시 쥔 뒤 · 빨강 칼끝 길(베는 몫) · 주황 굳음 칼끝', fill=(70, 70, 70), font=F2)
    d.text((8, 62), '초록 = 빈팔 · 빈손 채운 점 = 칼자루를 쥠 · 빈 동그라미 = 놓음 (칼집 손 자리 — 배 앞)', fill=(70, 70, 70), font=F2)
    for i, (lab, r) in enumerate(specs):
        oy = 96 + i * RH
        s = r['sum']
        g = s['grip']
        hit = r.get('hit') or {}
        info = [
            f"빈손 쥠: 뽑기 {max(0, g['draw'] - 1)}/{g['nDraw'] - 1} · 굳음 {g['hold']}/{g['nHold']} · 풀기 {g['fade']}/{g['nFade']} 스텝",
            f"맞음 {hit.get('zone', '헛침')} {hit.get('E', 0):.0f} J · 심각도 {hit.get('sev', 0):.2f}",
            f"끝 칼 {s['end']['elev']:.0f}° · 굳음 칼 {s['hold']['elev']:.0f}° ({s['holdElev'][0]:.0f} ~ {s['holdElev'][1]:.0f})",
            f"굳음 팔꿈치 {s['hold']['flex']:.0f}° · 칼끝 흔들림 {s['holdTipV']:.1f} m/s",
            f"베는 몫 칼끝 휨 {s['tipCut']['devShare']:.3f} · 길 {s['tipCut']['len']:.2f} m",
        ]
        sub = f"{lab} ({r['guard']} · {r['start']})"
        for j, v in enumerate(['front', 'top', 'tip']):
            pane = Image.new('RGB', (CW, CH), (255, 255, 255))  # 칸마다 따로 그려 붙임 (칸 밖으로 넘친 선은 잘림)
            body_panel(ImageDraw.Draw(pane), 0, 0, r['frames'], v, sub if j == 0 else lab, info)
            img.paste(pane, (j * CW, oy))
        d.text((8, oy + CH + 3), ' · '.join(info[:3]), fill=(50, 50, 50), font=F3)
        d.text((8, oy + CH + 23), ' · '.join(info[3:]), fill=(50, 50, 50), font=F3)
    img.save(out, optimize=True)
    print('wrote', out)


def regrip_main(argv):
    out, title = argv[0], argv[1]
    specs = [load(s) for s in argv[2:]]
    RH = 300
    LW = 400
    img = Image.new('RGB', (W, 96 + RH * len(specs) + 20), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((8, 6), title, fill=(0, 0, 0), font=F1)
    d.text((8, 38), '왼쪽: 가슴 앞면(오른쪽 = 칼 든 쪽) — 점 = 빈손 목표(스텝마다) · 초록 선 = 빈손 · 회색 = 칼자루 끝 · 노랑 = 칼집 손 자리', fill=(70, 70, 70), font=F2)
    d.text((8, 62), '오른쪽: 굳음 끝 앞 0.1 s ~ 뒤 0.8 s — 파랑 = 빈손 목표 이웃 스텝 옮김(cm) · 초록 = 빈손 ↔ 칼자루 끝(m) · 띠 = 쥠', fill=(70, 70, 70), font=F2)
    for i, (lab, r) in enumerate(specs):
        oy = 96 + i * RH
        fr = r['frames']
        iH = next((k for k, f in enumerate(fr) if f['ph'] == 'fade'), 0)
        iF = next((k for k, f in enumerate(fr) if f['ph'] == 'free'), len(fr) - 1)
        t0 = fr[iF]['t']
        win = [f for f in fr[max(0, iH - 12):] if f['t'] <= t0 + 0.8]
        # 왼쪽 — 가슴 앞면 (x = 칼 든 쪽 z · y = 위)
        d.rectangle([0, oy, LW - 1, oy + RH - 1], outline=(210, 210, 210))
        S2 = 260
        P = lambda p: (LW * 0.5 + p[2] * S2, oy + RH * 0.5 - p[1] * S2)
        d.text((6, oy + 4), f"{lab} · 가슴 앞면", fill=(40, 40, 40), font=F2)
        sx, sy = P([SAYA[0], SAYA[1], -SAYA[2]])
        d.rectangle([sx - 7, sy - 7, sx + 7, sy + 7], outline=(220, 180, 20), width=3)
        pm = [f['pmL'] for f in win if f.get('pmL')]
        oh = [f['ohL'] for f in win if f.get('ohL')]
        if len(pm) > 1:
            d.line([P(p) for p in pm], fill=(150, 150, 150), width=2)
        if len(oh) > 1:
            d.line([P(p) for p in oh], fill=(40, 160, 70), width=3)
        for f in win:
            if f.get('offT'):
                x, y = P(f['offT'])
                c = (40, 80, 220) if f['ph'] == 'free' else (180, 180, 220)
                d.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=c)
        s = r['sum']
        d.text((6, oy + RH - 44), f"다시 쥠 {s['regripGrip']:.2f} s · 자리 잡음 {s['regripSeat']:.2f} s (풀기 끝부터)", fill=(40, 40, 40), font=F3)
        d.text((6, oy + RH - 24), f"빈손 목표 가장 큰 옮김 {s['offJump']['d'] * 100:.1f} cm/스텝 · 빈손 빠르기 가장 {s['ohVmax']:.1f} m/s", fill=(40, 40, 40), font=F3)
        # 오른쪽 — 그래프
        ox = LW
        GW = W - LW
        d.rectangle([ox, oy, ox + GW - 1, oy + RH - 1], outline=(210, 210, 210))
        ta, tb = win[0]['t'], win[-1]['t']
        X = lambda t: ox + 40 + (t - ta) / max(1e-6, tb - ta) * (GW - 60)
        gy0, gh = oy + RH - 30, RH - 70
        for k, f in enumerate(win):
            if f['grip']:
                x0 = X(f['t'])
                d.rectangle([x0, gy0 + 6, x0 + max(1, (GW - 60) / len(win)) + 1, gy0 + 14], fill=(120, 200, 140))
        d.line([(X(t0), oy + 30), (X(t0), gy0)], fill=(200, 200, 200), width=1)
        d.text((X(t0) + 3, oy + 30), '풀기 끝', fill=(120, 120, 120), font=F3)
        # 옮김 (cm — 0 ~ 55 cm 눈금)
        Yj = lambda cm: gy0 - min(cm, 55) / 55 * gh
        Yg = lambda m: gy0 - min(m, 0.6) / 0.6 * gh
        for cm in (0, 10, 20, 30, 40, 50):
            d.line([(ox + 36, Yj(cm)), (ox + GW - 10, Yj(cm))], fill=(238, 238, 238), width=1)
            d.text((ox + 4, Yj(cm) - 8), f'{cm}', fill=(130, 130, 160), font=F3)
        pts_j, pts_g = [], []
        for k in range(1, len(win)):
            a, b = win[k - 1].get('offT'), win[k].get('offT')
            if a and b:
                dd = sum((a[q] - b[q]) ** 2 for q in range(3)) ** 0.5
                pts_j.append((X(win[k]['t']), Yj(dd * 100)))
            pts_g.append((X(win[k]['t']), Yg(win[k]['gap'])))
        if len(pts_g) > 1:
            d.line(pts_g, fill=(40, 160, 70), width=2)
        if len(pts_j) > 1:
            d.line(pts_j, fill=(40, 80, 220), width=2)
        d.text((ox + 40, oy + 6), f"{lab} · 굳음 끝 앞뒤 (가로 {tb - ta:.1f} s)", fill=(40, 40, 40), font=F2)
    img.save(out, optimize=True)
    print('wrote', out)


def main():
    mode = sys.argv[1]
    if mode == 'body':
        return body_main(sys.argv[2:])
    if mode == 'regrip':
        return regrip_main(sys.argv[2:])
    raise SystemExit('mode: body | regrip')


main()
