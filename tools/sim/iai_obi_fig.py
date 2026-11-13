# iai_obi_fig.py — 帯刀 그림 (11/14 — 사장님 11/14 "권고대로 둘 다 진행해" · 기록 docs/strike/iai_obi_2026-11-14.md · iai_saya2_fig.py 를 본뜸)
#  색: 주황 = 전(11/14 iai_saya2 판 · ?iaiObi=0) · 파랑 = 후 · 청록 = 원전 자리 — 모두 글 이름을 붙임 (색만으로 가르지 않음)
#  python3.12 tools/sim/iai_obi_fig.py ready <out.png> <전 json> <후 json>      (JSON = node tools/sim/iai_obi.mjs ready --json=…)
#  python3.12 tools/sim/iai_obi_fig.py sheet <out.png> <그림 폴더> <인물> <무기> <동작,…> <제목>   (그림 = tools/browser/iai_obi_shots.mjs)
#  python3.12 tools/sim/iai_obi_fig.py table <out.png> <제목> <saya json> [<saya json> …]   (JSON = node tools/sim/iai_obi.mjs saya --json=…)
#  python3.12 tools/sim/iai_obi_fig.py pair <out.png> <제목> <그림:글> …   (나란히 — 글이 '전' 으로 시작하면 주황 · 아니면 파랑)
import json
import math
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
BEFORE, AFTER, SRC = (235, 104, 52), (42, 120, 214), (27, 175, 122)
WEAPON_KO = {'uchigatana': '우치가타나', 'muramasa': '무라마사', 'kusanagi': '쿠사나기', 'monohoshizao': '모노호시자오'}
MODE_KO = {'hip': '사람 허리 대기', 'crouch': 'AI 웅크린 대기'}
STATE_KO = {'stand': '서기', 'walk': '걷기', 'run': '달리기', 'lowwalk': '낮은 걸음', 'ready': '발도 대기', 'draw': '뽑는 순간', 'zanshin': '잔심(굳음)', 'regrip': '다시 쥐기',
            'back': '물러서기', 'clinch': '밀치기 묶임', 'hit': '맞음', 'fall': '넘어짐', 'dead': '쓰러져 죽음'}
VIEW_KO = {'front': '앞', 'side': '옆(왼 — 칼집 쪽)', 'back': '뒤', 'top': '위'}
# 골반 틀 몸 (fighter.js partDefs · 기본 겉모습 그림 상자)
PELVIS = (0.105, 0.09, 0.165)
ABDOMEN_Y = 0.16
NAVEL = (0.105, 0.09, 0.0)  # 배꼽 (배 앞면 · 허리띠 높이 · 몸 가운데)


def text(d, xy, s, f=F3, fill=INK):
    d.text(xy, s, font=f, fill=fill)


def ready(out, before, after):
    B = {(r['weapon'], r['mode']): r for r in json.load(open(before))['rows']}
    A = {(r['weapon'], r['mode']): r for r in json.load(open(after))['rows']}
    PW, PH, TH = 515, 400, 118
    H = 92 + 2 * (PH + TH + 40) + 40
    im = Image.new('RGB', (W, H), 'white')
    d = ImageDraw.Draw(im)
    text(d, (24, 16), '발도 대기 칼 자리 — 코등이 · 칼 축 (골반 틀 위에서 · 앞에서)', F1)
    text(d, (24, 48), '주황 = 전(11/14 판 — ?iaiObi=0) · 파랑 = 후(帯刀) · 청록 = 원전 「鍔がへそ前」 배꼽 앞 · 점 = 코등이 · 선 = 칼 축 0.35 m · 무기 넷 겹침', F3, INK2)
    S = 620  # px / m
    L = 0.35
    for row, mode in enumerate(['hip', 'crouch']):
        oy = 82 + row * (PH + TH + 40)
        text(d, (24, oy), MODE_KO[mode], F2)
        for k, view in enumerate(['top', 'front']):
            p = Image.new('RGB', (PW, PH), 'white')
            q = ImageDraw.Draw(p)
            q.rectangle([0, 0, PW - 1, PH - 1], outline=GRID)
            if view == 'top':
                cx, cy = PW // 2 + 40, PH // 2 + 115
                def P(x, y, z):
                    return (cx + z * S, cy - x * S)
                q.rectangle([P(PELVIS[0], 0, -PELVIS[2]), P(-PELVIS[0], 0, PELVIS[2])], outline=MUTED, width=2)
                text(q, (cx - 18, cy - 10), '골반', F3, MUTED)
                text(q, (8, 8), '위에서 (위 = 앞 · 오른쪽 = 칼 든 쪽)', F3, INK2)
            else:
                cx, cy = PW // 2 + 40, PH // 2 + 40
                def P(x, y, z):
                    return (cx + z * S, cy - y * S)
                q.rectangle([P(0, PELVIS[1], -PELVIS[2]), P(0, -PELVIS[1], PELVIS[2])], outline=MUTED, width=2)
                q.rectangle([P(0, ABDOMEN_Y + 0.0775, -0.16), P(0, ABDOMEN_Y - 0.0775, 0.16)], outline=GRID, width=2)
                text(q, (cx - 18, cy - 10), '골반', F3, MUTED)
                text(q, (8, 8), '앞에서 (오른쪽 = 칼 든 쪽 · 위 = 위)', F3, INK2)
            nx, ny = P(NAVEL[0], NAVEL[1], 0)
            q.ellipse([nx - 7, ny - 7, nx + 7, ny + 7], outline=SRC, width=3)
            text(q, (nx + 9, ny - 24), '배꼽 앞', F3, SRC)
            for key, col in [(B, BEFORE), (A, AFTER)]:
                for w in WEAPON_KO:
                    r = key.get((w, mode))
                    if not r or (w == 'monohoshizao' and mode == 'crouch'):
                        continue
                    t = r['tsuba']
                    a = math.radians(r['yaw'])
                    e = math.radians(r['el'])
                    end = (t[0] + L * math.cos(e) * math.cos(a), t[1] + L * math.sin(e), t[2] + L * math.cos(e) * math.sin(a))
                    q.line([P(*t), P(*end)], fill=col, width=2)
                    px, py = P(*t)
                    q.ellipse([px - 5, py - 5, px + 5, py + 5], fill=col)
            im.paste(p, (24 + k * (PW + 2), oy + 28))
        ty = oy + 28 + PH + 8
        for i, w in enumerate(WEAPON_KO):
            b, a = B.get((w, mode)), A.get((w, mode))
            if not (b and a):
                continue
            if w == 'monohoshizao' and mode == 'crouch':
                s = f"{WEAPON_KO[w]}: 대기 칼이 자세를 못 지킴 (전 · 후 같음 — 축 {b['yaw']:.0f}° / {b['el']:.0f}° → {a['yaw']:.0f}° / {a['el']:.0f}°) — 그림에서 뺌"
            else:
                s = f"{WEAPON_KO[w]}: 코등이 [앞 {b['tsuba'][0]:.2f} · 위 {b['tsuba'][1]:.2f} · {b['tsuba'][2]:+.2f}] → [{a['tsuba'][0]:.2f} · {a['tsuba'][1]:.2f} · {a['tsuba'][2]:+.2f}] m · 축 {b['yaw']:.0f}° / {b['el']:.0f}° → {a['yaw']:.0f}° / {a['el']:.0f}°"
            text(d, (28, ty + i * 24), s, F3, INK2)
    text(d, (24, H - 34), '골반 틀: 앞 · 위 · 칼 든 쪽 + (m · - = 왼쪽). 코등이 = 칼 축 칼날 시작 - 0.006 m · 대기 1.5 s 끝 스텝 (tools/sim/iai_obi.mjs ready — 서 있는 롱소드 과녁 2.4 m)', F3, MUTED)
    im.save(out)


def sheet(out, folder, who, weapon, states, title):
    views = ['front', 'side', 'back', 'top']
    cw = 240
    lw = 120
    H = 60 + 26 + len(states) * cw
    im = Image.new('RGB', (lw + cw * 4, H), 'white')
    d = ImageDraw.Draw(im)
    text(d, (14, 14), title, F1)
    for c, v in enumerate(views):
        text(d, (lw + c * cw + 8, 60), VIEW_KO[v], F3, INK2)
    for r, st in enumerate(states):
        y = 86 + r * cw
        text(d, (10, y + cw // 2 - 10), STATE_KO.get(st, st), F2)
        for c, v in enumerate(views):
            try:
                t = Image.open(f'{folder}/{who}_{weapon}_{st}_{v}.png').convert('RGB').resize((cw, cw))
                im.paste(t, (lw + c * cw, y))
            except OSError:
                d.rectangle([lw + c * cw, y, lw + (c + 1) * cw - 1, y + cw - 1], outline=GRID)
    im.save(out, quality=88) if out.endswith('.webp') else im.save(out, optimize=True)


def table(out, title, files):
    # 파일 하나 = 판 하나 (위아래로 쌓음 — 가로가 너무 길어지지 않게)
    panels = [[o for o in json.load(open(f))['out'] if not o.get('none')] for f in files]
    states = list(STATE_KO)
    cw = 230
    lw = 110
    ph = 40 + 30 * len(states)
    H = 100 + len(panels) * (ph + 20) + 50
    im = Image.new('RGB', (max(W, lw + cw * max(len(p) for p in panels)), H), 'white')
    d = ImageDraw.Draw(im)
    text(d, (14, 14), title, F1)
    text(d, (14, 46), '칸 = 골반 · 배 겉 틈 가장 작음~가장 큼 / 다리 틈 / 가슴 틈 (cm · 음수 = 뚫음) · 땅 = 넘어짐 · 죽음의 땅 위 가장 낮음 · * = 칼집 축이 옷 그림을 지난 스텝 수', F3, INK2)
    text(d, (14, 66), '주황 = 1.5 cm 넘는 틈 (발도 대기 · 낮은 걸음 · 뽑는 순간은 칼집이 대기 칼을 감싸 따라가 뜸) · 빨강 = 0.5 cm 넘는 몸통 뚫음 (없음)', F3, INK2)
    fmt = lambda x, n=1: '-' if x is None else f'{x * 100:.{n}f}'
    for k, rows in enumerate(panels):
        oy = 100 + k * (ph + 20)
        for c, o in enumerate(rows):
            text(d, (lw + c * cw + 6, oy), f"{o['look']} · {WEAPON_KO.get(o['weapon'], o['weapon'])}", F3, INK)
        for r, st in enumerate(states):
            y = oy + 30 + r * 30
            text(d, (10, y), STATE_KO[st], F3)
            for c, o in enumerate(rows):
                v = o['rows'].get(st)
                if not v:
                    continue
                g0, g1 = v['gapMin'], v['gapMax']
                if not v.get('n'):
                    text(d, (lw + c * cw + 6, y), '(맞닿지 않음 — 잼 없음)', F3, MUTED)
                    continue
                col = INK
                if v['torso'] is not None and v['torso'] < -0.005:
                    col = (200, 40, 40)
                elif g1 is not None and g1 > 0.015:
                    col = BEFORE
                nx = sum((v.get('cross') or {}).values())
                s = f"{fmt(g0)}~{fmt(g1)} / {fmt(v['leg'], 0)} / {fmt(v['chest'], 0)}" + (f" 땅{fmt(v.get('ground'))}" if st in ('fall', 'dead') and v.get('ground') is not None else '') + (f' *{nx}' if nx else '')
                text(d, (lw + c * cw + 6, y), s, F3, col)
    text(d, (14, H - 34), 'tools/sim/iai_obi.mjs saya — 한 몸을 동작 대본(열세 동작)으로 몰아 스텝마다 칼집 겉(48 줄 × 16 점)과 골반 · 배 그림 상자 · 다리 몸 캡슐 · 가슴 그림 상자 · 땅 사이 거리를 잼', F3, MUTED)
    im.save(out)


def pair(out, title, specs):
    ims = []
    for s in specs:
        p, lab = s.split(':', 1)
        ims.append((Image.open(p).convert('RGB'), lab))
    cw = W // len(ims)
    h = max(int(i.height * cw / i.width) for i, _ in ims)
    im = Image.new('RGB', (W, h + 90), 'white')
    d = ImageDraw.Draw(im)
    text(d, (14, 12), title, F1)
    for k, (i, lab) in enumerate(ims):
        t = i.resize((cw, int(i.height * cw / i.width)))
        im.paste(t, (k * cw, 80))
        text(d, (k * cw + 8, 50), lab, F2, BEFORE if lab.startswith('전') else AFTER)
    im.save(out, quality=88) if out.endswith('.webp') else im.save(out, optimize=True)


if __name__ == '__main__':
    m = sys.argv[1]
    if m == 'ready':
        ready(sys.argv[2], sys.argv[3], sys.argv[4])
    elif m == 'sheet':
        sheet(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6].split(','), sys.argv[7])
    elif m == 'table':
        table(sys.argv[2], sys.argv[3], sys.argv[4:])
    elif m == 'pair':
        pair(sys.argv[2], sys.argv[3], sys.argv[4:])
