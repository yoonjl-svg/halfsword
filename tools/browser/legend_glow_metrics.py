# 레전드 기운 눈에 띄는 정도 셈 (10/24 — tools/browser/legend_glow_measure.mjs 가 찍은 켬 · 끔 사진)
#  같은 장면의 기운 끔(off) · 켬(on0 …) 사진을 화면 px(844 × 390 — 화면 배율 2 사진이면 2 × 2 평균, 선형 빛에서)로 맞추고 CIELAB 으로 바꿔
#  칼날 둘레(보이는 칼날 — mask 사진의 자홍 칼날, 몸 · 코등이에 가린 곳 빠짐 — 에서 0.12 m 안, 그 장면의 m 당 px 로 셈)의 CIEDE2000 차이를 잰다.
#   S   = 둘레 평균 ΔE00 (주 점수 — 넓이 × 세기를 함께 담음)
#   p90 = 둘레 90 번째 백분위 ΔE00 (가장 밝게 바뀐 몫)
#   F   = 둘레에서 ΔE00 > 2.3 인 몫(%) (한눈에 보이는 넓이)
#   core / halo = 보이는 칼날 위 · 칼날 밖 둘레의 평균 ΔE00 (은빛 칼몸 위 옅은 빛이 보이나 · 둘레로 번지나)
#  켬 사진 여러 장(기운 시계 견본)의 평균. 끔 두 장의 차이(noise)가 0 이어야 같은 장면이다.
#  실행: python3 -I tools/browser/legend_glow_metrics.py <사진 폴더[,폴더…]> [--json=<결과 json>] [--ref=excalibur] [--only=무기,…] [--compare=<전 결과 json[,…]> (전 → 후 마크다운 표)]
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
ref = opts.get('ref', 'excalibur')
meta, where = {}, {}  # 사진 폴더를 쉼표로 여럿 줄 수 있다 (보기마다 따로 찍은 폴더)
for fo in args[0].split(','):
    for k, v in json.loads((Path(fo) / 'meta.json').read_text()).items():
        if not k.startswith('_'):
            meta[k], where[k] = v, Path(fo)
REGION_M = 0.12  # 둘레 반지름 (m) — 아지랑이 판 절반 폭 0.11 m 바로 바깥까지
CORE_M = 0.022  # 칼날 위 (m)
JND = 2.3


def rgb(path, k=2):
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.float64) / 255.0
    if k > 1:
        h, w = a.shape[0] // k * k, a.shape[1] // k * k
        a = a[:h, :w].reshape(h // k, k, w // k, k, 3).mean(axis=(1, 3))
    return a


def lab(path, k=2):
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.float64) / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    if k > 1:  # 화면 배율 k 사진 → 화면 px (k × k 평균)
        h, w = lin.shape[0] // k * k, lin.shape[1] // k * k
        lin = lin[:h, :w].reshape(h // k, k, w // k, k, 3).mean(axis=(1, 3))
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > (6 / 29) ** 3, np.cbrt(xyz), xyz / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def de2000(l1, l2):
    L1, a1, b1 = l1[..., 0], l1[..., 1], l1[..., 2]
    L2, a2, b2 = l2[..., 0], l2[..., 1], l2[..., 2]
    C1, C2 = np.hypot(a1, b1), np.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cb ** 7 / (Cb ** 7 + 25.0 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = np.hypot(a1p, b1), np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360
    h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp = L2 - L1
    dCp = C2p - C1p
    dh = h2p - h1p
    dh = np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh))
    dh = np.where(C1p * C2p == 0, 0, dh)
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lbp = (L1 + L2) / 2
    Cbp = (C1p + C2p) / 2
    hs = h1p + h2p
    hbp = np.where(C1p * C2p == 0, hs, np.where(np.abs(h1p - h2p) <= 180, hs / 2, np.where(hs < 360, (hs + 360) / 2, (hs - 360) / 2)))
    T = 1 - 0.17 * np.cos(np.radians(hbp - 30)) + 0.24 * np.cos(np.radians(2 * hbp)) + 0.32 * np.cos(np.radians(3 * hbp + 6)) - 0.20 * np.cos(np.radians(4 * hbp - 63))
    dth = 30 * np.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cbp ** 7 / (Cbp ** 7 + 25.0 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / np.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp
    Sh = 1 + 0.015 * Cbp * T
    Rt = -np.sin(np.radians(2 * dth)) * Rc
    return np.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def seg_dist(shape, a, b):
    h, w = shape
    y, x = np.mgrid[0:h, 0:w] + 0.5
    ax, ay, bx, by = a[0], a[1], b[0], b[1]
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy
    t = np.clip(((x - ax) * vx + (y - ay) * vy) / L2, 0, 1) if L2 > 1e-9 else np.zeros_like(x)
    return np.hypot(x - (ax + t * vx), y - (ay + t * vy))


rows = {}
only = opts.get('only', '').split(',') if opts.get('only') else None  # --only=무기,무기~갈래 … (기준 무기는 늘 셈)
for key, m in meta.items():
    if key.startswith('_'):
        continue
    if only and m['weapon'] != ref and m['weapon'] not in only and m['weapon'].split('~')[0] not in only:
        continue
    folder = where[key]
    okey = m.get('offKey', key)  # 견줌 갈래는 끔 · mask 사진을 바탕 줄과 같이 쓴다
    off = folder / f'{okey}_off.png'
    if not off.exists():
        continue
    ds = int(m.get('dsf', 2))
    L0 = lab(off, ds)
    R = max(4.0, REGION_M * m['pxPerM'])
    mp = folder / f'{okey}_mask.png'
    if mp.exists():  # 보이는 칼날(자홍으로 칠한 칼날 메쉬 — 몸에 가린 곳 빠짐)에서 R 안
        mk, of = rgb(mp, ds), rgb(off, ds)
        core = (mk[..., 0] - mk[..., 1] > 0.35) & (mk[..., 2] - mk[..., 1] > 0.35) & (np.abs(mk - of).sum(-1) > 0.15)
        if not core.any():
            continue
        reg = ndimage.distance_transform_edt(~core) <= R
    else:  # 옛 사진: 칼날 선분에서 R 안
        d = seg_dist(L0.shape[:2], m['a'], m['b'])
        reg, core = d <= R, d <= max(1.0, CORE_M * m['pxPerM'])
    halo = reg & ~core
    noise = float(de2000(L0, lab(folder / f'{okey}_off2.png', ds))[reg].max()) if (folder / f'{okey}_off2.png').exists() else None
    acc = []
    for k in range(m.get('samples', 1)):
        p = folder / f'{key}_on{k}.png'
        if not p.exists():
            continue
        dE = de2000(L0, lab(p, ds))
        r = dE[reg]
        acc.append([r.mean(), np.percentile(r, 90), 100 * (r > JND).mean(), dE[core].mean() if core.any() else 0, dE[halo].mean() if halo.any() else 0])
    if not acc:
        continue
    a = np.mean(acc, 0)
    rows[key] = dict(weapon=m['weapon'], view=m['view'], stage=m['stage'], S=round(float(a[0]), 3), p90=round(float(a[1]), 2), F=round(float(a[2]), 1),
                     core=round(float(a[3]), 2), halo=round(float(a[4]), 2), Rpx=round(R, 1), vis=int(core.sum()), noise=noise,
                     spread=round(float(np.std([x[0] for x in acc])), 3), bladeL=round(float(np.hypot(m['b'][0] - m['a'][0], m['b'][1] - m['a'][1])), 1))

if 'json' in opts:
    Path(opts['json']).write_text(json.dumps(rows, indent=1, ensure_ascii=False))
sits = sorted({(r['view'], r['stage']) for r in rows.values()})
weps = []
for r in rows.values():
    if r['weapon'] not in weps:
        weps.append(r['weapon'])
print(f"{'보기/무대':24s}" + ''.join(f'{w:>26s}' for w in weps) + '   (S 평균 ΔE00 · 기준 대비 % · F ΔE00>2.3 몫 % · p90)')
for v, s in sits:
    rr = {r['weapon']: r for r in rows.values() if r['view'] == v and r['stage'] == s}
    base = rr.get(ref)
    line = f'{v + "/" + s:24s}'
    for w in weps:
        r = rr.get(w)
        if not r:
            line += f'{"-":>26s}'
            continue
        ratio = f"{100 * r['S'] / base['S']:.0f}%" if base and base['S'] > 0 else '-'
        line += f"{r['S']:6.2f} {ratio:>5s} F{r['F']:5.1f} p{r['p90']:5.1f}".rjust(26)
    print(line)
print('\ncore / halo (칼날 위 / 칼날 밖 둘레 평균 ΔE00)')
for v, s in sits:
    rr = {r['weapon']: r for r in rows.values() if r['view'] == v and r['stage'] == s}
    print(f'{v + "/" + s:24s}' + ''.join((f"{rr[w]['core']:6.2f} / {rr[w]['halo']:5.2f}" if w in rr else '-').rjust(26) for w in weps))
bad = [k for k, r in rows.items() if r['noise'] is not None and r['noise'] > 0.5]
print('\n끔 두 장 차이 > 0.5:', bad if bad else '없음 (같은 장면)')

# 기준 대비 % 한 줄 요약 (무기 · 견줌 갈래마다 — 상황마다 · 가운데값 · 가장 낮음 · 가장 높음)
import statistics
order = [(v, s) for v in ('side', 'sidefar', 'mine', 'foe') for s in ('poseidon', 'castle', 'cathedral', 'poseidon_night', 'castle_night', 'frozen_bay') if (v, s) in sits]
exr = {(r['view'], r['stage']): r for r in rows.values() if r['weapon'] == ref}
print('\n' + '기준 대비 S %'.ljust(22) + ''.join(f'{v[0]}/{s[:6]}'.rjust(10) for v, s in order) + '   가운데  낮음  높음')
for w in weps:
    rr = {(r['view'], r['stage']): r for r in rows.values() if r['weapon'] == w}
    vals = [100 * rr[k]['S'] / exr[k]['S'] if k in rr and k in exr else None for k in order]
    got = [x for x in vals if x is not None]
    print(w.ljust(22) + ''.join(f'{x:9.0f}%' if x is not None else '         -' for x in vals) + (f'   {statistics.median(got):5.0f} {min(got):5.0f} {max(got):5.0f}' if got else ''))

# 전 → 후 마크다운 표 (--compare=<전 결과 json[,json…]> — 같은 셈의 --json 결과). 칸 = 기준 대비 S % (전 → 후) · 기준 줄은 S 값
if opts.get('compare'):
    before = {}
    for fn in opts['compare'].split(','):
        before.update(json.loads(Path(fn).read_text()))
    VK = {'side': '칼 옆 1.25 m', 'sidefar': '칼 옆 4.3 m', 'mine': '내 칼 · 게임 화면', 'foe': '상대 칼 · 게임 화면'}
    SK = {'poseidon': '포세이돈(낮)', 'castle': '성 안뜰(낮 눈)', 'cathedral': '대성당(실내)', 'poseidon_night': '밤 포세이돈'}
    stg = [s for s in SK if any(r['stage'] == s for r in rows.values())]

    def ratio(src, w, v, s):
        e = next((r for r in src.values() if r['weapon'] == ref and r['view'] == v and r['stage'] == s), None)
        x = next((r for r in src.values() if r['weapon'] == w and r['view'] == v and r['stage'] == s), None)
        return 100 * x['S'] / e['S'] if e and x and e['S'] > 0 else None
    print('\n| 무기 | 보기 | ' + ' | '.join(SK[s] for s in stg) + ' |')
    print('|---|---|' + '---|' * len(stg))
    for v in ('side', 'sidefar', 'mine', 'foe'):
        e = {r['stage']: r['S'] for r in rows.values() if r['weapon'] == ref and r['view'] == v}
        if e:
            print(f'| 엑스칼리버 (기준 S) | {VK[v]} | ' + ' | '.join(f"{e.get(s, 0):.2f}" for s in stg) + ' |')
    for w in [x for x in weps if x != ref]:
        for v in ('side', 'sidefar', 'mine', 'foe'):
            cells = []
            for s in stg:
                a, b = ratio(before, w, v, s), ratio(rows, w, v, s)
                cells.append(f'{a:.0f} → **{b:.0f}**' if a is not None and b is not None else (f'{b:.0f}' if b is not None else '-'))
            print(f'| {w} | {VK[v]} | ' + ' | '.join(cells) + ' |')
