# thrust_drive_draw.py — 사람 탭 찌르기 몸 싣기(THRUST.drive) 끔 ↔ 켬 옆 그림 (11/15 기록 docs/strike/thrust_stuck_2026-11-15.md §7)
#  python3.12 tools/sim/thrust_drive_draw.py <out.png> <제목> <json 폴더> <유파_무기> <장면,...>
#    json = tools/sim/thrust_drive_check.mjs scene --dir=… 이 쓴 <유파>_<무기>_<장면>_d<0|3>.json
#    한 줄에 한 장면 · 왼쪽 drive 0 · 오른쪽 drive 3 — 옆(앞 x · 위 y) · 탭부터 1.0 s 를 0.05 s 칸마다 몸(뼈대) · 칼(손 → 칼끝)
#    색 = 때(옅음 → 짙음) · 탭 동안 칼 파랑 · 뒤 회색 · 발 디딘 자리 = 아래 눈금(앞발 주황 · 뒷발 초록) · 칸 머리 = 탭 길이 · 골반 감 · 머묾 · 걸린 이상
import json, sys
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
F_T = ImageFont.truetype(FONT, 26)
F_H = ImageFont.truetype(FONT, 18)
F_S = ImageFont.truetype(FONT, 15)
BG = (250, 248, 244)
INK = (40, 38, 36)
GRID = (222, 218, 210)
BONES = [('head', 'chest'), ('chest', 'pelvis'), ('chest', 'uarmS'), ('uarmS', 'farmS'), ('chest', 'uarmO'), ('uarmO', 'farmO'), ('pelvis', 'thighF'), ('thighF', 'shinF'), ('shinF', 'footF'), ('pelvis', 'thighB'), ('thighB', 'shinB'), ('shinB', 'footB')]
AN = {'stack': '겹침', 'double': '두 번 디딤', 'slide': '미끄러짐', 'cross': '발 엇갈림', 'armFirst': '팔 먼저', 'hold': '안 풀림'}
SCENE = {'stand': '선 채 탭', 'walk': '걷다 탭', 'side': '옆걸음 뒤 탭', 'double': '탭 뒤 또 탭', 'riso': '탭 뒤 리솔루토', 'cut': '탭 뒤 내려베기'}


def panel(d, box, r):
    x0, y0, w, h = box
    d.rectangle([x0, y0, x0 + w, y0 + h], outline=GRID)
    st = [s for s in r['steps'] if s['t'] <= 1.0]
    o = st[0]['body']['pelvis']
    sc = h / 2.4
    cx = x0 + 70
    cy = y0 + h - 40

    def S(p):
        return (cx + (p[0] - o[0]) * sc, cy - p[1] * sc)
    # 바닥 · 0.5 m 눈금
    d.line([x0 + 4, cy, x0 + w - 4, cy], fill=GRID)
    for k in range(0, 5):
        X = cx + k * 0.5 * sc
        if X < x0 + w:
            d.line([X, cy, X, cy + 6], fill=GRID)
            d.text((X - 8, cy + 6), f'{k * 0.5:.1f}', fill=(150, 145, 140), font=F_S)
    fr, seen = [], set()
    for s in st:
        b = int(s['t'] / 0.05 + 1e-6)
        if b not in seen:
            seen.add(b)
            fr.append(s)
    n = max(1, len(fr) - 1)
    for i, s in enumerate(fr):
        a = i / n
        c = int(205 - 175 * a)
        for b0, b1 in BONES:
            p, q = s['body'].get(b0), s['body'].get(b1)
            if p and q:
                d.line([S(p), S(q)], fill=(c, c, c), width=2)
        blade = (int(60 + 120 * (1 - a)), int(90 + 100 * (1 - a)), int(210 - 40 * a)) if s['tap'] else (170, 170, 170)
        d.line([S(s['hand']), S(s['tip'])], fill=blade, width=3)
    # 발 디딘 자리 (디딤 순간)
    prev = None
    for s in st:
        if prev:
            for k, key, col in (('stF', 'footF', (230, 130, 20)), ('stB', 'footB', (40, 150, 80))):
                if s[k] and not prev[k]:
                    X, _ = S(s['body'][key])
                    d.polygon([(X, cy - 2), (X - 5, cy + 8), (X + 5, cy + 8)], fill=col)
        prev = s
    tp = r['taps'][0] if r['taps'] else None
    if tp:
        an = [AN[k] for k, v in tp['an'].items() if v]
        if len(r['taps']) > 1:
            an2 = [AN[k] for k, v in r['taps'][1]['an'].items() if v]
            an += [f'둘째 {x}' for x in an2]
        d.text((x0 + 6, y0 + 4), f"drive {r['drive']} · 탭 {tp['dur']} s · 골반 {tp['travel']} m · 머묾 {tp['freeze']} s · 걸음 부탁 {tp['reqFwd']}", fill=INK, font=F_S)
        d.text((x0 + 6, y0 + 22), '이상: ' + (' · '.join(an) if an else '없음'), fill=(190, 40, 30) if an else (60, 120, 60), font=F_S)


def main(out, title, folder, sw, scenes):
    rows = []
    for sc in scenes:
        try:
            rows.append((sc, [json.load(open(f'{folder}/{sw}_{sc}_d{d}.json')) for d in (0, 3)]))
        except FileNotFoundError:
            pass
    W, Hh = 1500, 300
    img = Image.new('RGB', (W, 70 + Hh * len(rows) + 40), BG)
    d = ImageDraw.Draw(img)
    d.text((16, 12), title, fill=INK, font=F_T)
    for k, (sc, rs) in enumerate(rows):
        y = 70 + k * Hh
        d.text((16, y + 8), SCENE.get(sc, sc), fill=INK, font=F_H)
        bw = (W - 200) // 2
        for j, r in enumerate(rs):
            panel(d, (190 + j * bw, y + 4, bw - 10, Hh - 12), r)
    d.text((16, img.height - 30), '옆에서 본 몸 · 탭부터 1.0 s · 0.05 s 칸(옅음 → 짙음) · 칼 파랑 = 탭 동안 · 세모 = 발 디딤(주황 앞발 F · 초록 뒷발 B) · 눈금 0.5 m', fill=(110, 105, 100), font=F_S)
    img.save(out)


if __name__ == '__main__':
    out, title, folder, sw, scenes = sys.argv[1:6]
    main(out, title, folder, sw, scenes.split(','))
