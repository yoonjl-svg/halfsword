# 앱 아이콘 22 × 22 도트판 (사장님 10/19 02:5x '다시 그려줘' — 캐릭터 프사(샛별 확정 34 장)와 같은 22 칸 굵기로)
#  28 판(tools/icon/px28_icon.py — 기록으로 둠)과 같은 방법 · 같은 칼 · 흙무덤. 바뀐 것: 22 칸 = 원본 57 px 한 칸(1254 = 22 × 57, 자르지 않음) ·
#  칼 축은 28 판의 원본 화소 자리 그대로(머리 869,385 → 땅속 끝 561,1045) · 부위 길이는 칸 비(22/28)로 · 흙무덤은 칼날이 땅에 드는 줄에 ·
#  512 / 192 / 180 은 22 의 정수배(23 · 8 · 8)에 가장자리 늘림, 64 · 32 는 그대로 줄임
#  python3 tools/icon/px22_icon.py [--preview 경로]   (numpy · scipy · Pillow)
import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy.cluster.vq import kmeans2
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MASTER = os.path.join(ROOT, 'art', 'app-icon-20261017', 'master.png')
ICONS = os.path.join(ROOT, 'public', 'icons')
OFF, CELL, N = 0, 57, 22
POMMEL = [(18, 10)]
GRIP = [(17, 11), (17, 12)]
GUARD = [(14, 12), (15, 12), (16, 13), (17, 13), (18, 14)]
BLADE = [(16, 14), (16, 15), (15, 16), (15, 17), (14, 18), (14, 19), (13, 20), (13, 21), (12, 22), (12, 23)]
# 흙무덤 (칼날 끝이 묻히는 곳): 윗줄 3 칸 · 아랫줄 5 칸 — 'hi' 밝은 윗면 · 'mid' 흙 · 'lo' 그늘 둘레
MOUND = {(11, 23): 'hi', (12, 23): 'slit', (13, 23): 'hi', (10, 24): 'lo', (11, 24): 'mid', (12, 24): 'mid', (13, 24): 'mid', (14, 24): 'lo'}
MOUND_EDGE = [(10, 23), (14, 23), (9, 24), (15, 24)]  # 무덤 둘레 짙은 칸 (바탕과 가름)


def to_lab(rgb):
    c = rgb / 255.0
    a = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = (a @ M.T) / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_rgb(lab):
    L, A, B = lab[..., 0], lab[..., 1], lab[..., 2]
    fy = (L + 16) / 116; fx = fy + A / 500; fz = fy - B / 200
    def inv(t): return np.where(t ** 3 > 0.008856, t ** 3, (t - 16 / 116) / 7.787)
    xyz = np.stack([inv(fx) * 0.95047, inv(fy), inv(fz) * 1.08883], -1)
    Mi = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    a = xyz @ Mi.T
    c = np.where(a <= 0.0031308, 12.92 * a, 1.055 * np.clip(a, 0, None) ** (1 / 2.4) - 0.055)
    return np.clip(c * 255, 0, 255)


def build(K=16, contrast=1.06, sharpen=0.25, leaf_t=0.16, smooth=2, seed=7):
    S = N * CELL
    im = Image.open(MASTER).convert('RGB').crop((OFF, OFF, OFF + S, OFF + S))
    lab = to_lab(np.asarray(im).astype(float)); L, A, Bb = lab[..., 0], lab[..., 1], lab[..., 2]; C = np.hypot(A, Bb)
    # 1) 바탕
    small = ImageEnhance.Contrast(im).enhance(contrast).resize((N, N), Image.BOX)
    small = small.filter(ImageFilter.UnsharpMask(radius=1, percent=int(sharpen * 100), threshold=0))
    sl = to_lab(np.asarray(small).astype(float)).reshape(-1, 3)
    np.random.seed(seed)
    cent, lbl = kmeans2(sl, K, minit='++', iter=50, seed=seed)
    lb = lbl.reshape(N, N)
    for _ in range(smooth):
        o2 = lb.copy()
        for y in range(N):
            for x in range(N):
                c = lb[y, x]
                nb4 = [lb[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < N and 0 <= xx < N]
                if c in nb4: continue
                nb8 = [lb[yy, xx] for yy in range(y - 1, y + 2) for xx in range(x - 1, x + 2) if (yy, xx) != (y, x) and 0 <= yy < N and 0 <= xx < N]
                v, cn = np.unique(nb8, return_counts=True); j = cn.argmax()
                if cn[j] >= 5 and np.linalg.norm(cent[v[j]] - cent[c]) < 14: o2[y, x] = v[j]
        lb = o2
    out = cent[lb].copy()
    # 2) 낙엽
    leaf = (Bb > 30) & (A > -6) & (L > 45) & (L < 85)
    cf = leaf.reshape(N, CELL, N, CELL).mean((1, 3))
    for y in range(int(5 * N / 28), N):
        for x in range(N):
            if cf[y, x] >= leaf_t and (cf[max(0, y - 1):y + 2, max(0, x - 1):x + 2] >= leaf_t).sum() <= 2:
                blk = (slice(y * CELL, (y + 1) * CELL), slice(x * CELL, (x + 1) * CELL)); out[y, x] = lab[blk][leaf[blk]].mean(0)
    # 3) 칼 (색은 원본 칼에서)
    reg = np.zeros(L.shape, bool); reg[440 - OFF:1075 - OFF, 500 - OFF:812 - OFF] = True
    lightpx = lab[(L > 70) & (C < 22) & reg]
    c_light = np.array([np.percentile(lightpx[:, 0], 80), *np.median(lightpx[:, 1:], 0)])
    c_mid = np.array([np.percentile(lightpx[:, 0], 25) - 6, *np.median(lightpx[:, 1:], 0)])
    hilt = np.zeros(L.shape, bool); hilt[475 - OFF:600 - OFF, 690 - OFF:805 - OFF] = True
    grippx = lab[(A > 6) & (Bb > 16) & (L > 28) & (L < 78) & hilt]
    gab = np.median(grippx[:, 1:], 0)
    c_grip1 = np.array([np.percentile(grippx[:, 0], 75), *gab]); c_grip2 = np.array([np.percentile(grippx[:, 0], 25), *gab])
    c_dark = lab[(L < 20) & reg].mean(0)
    # 칼 다시 (사장님 10/19 02:4x '너무 희고 그냥 나뭇가지 막대기 같애'): 칼 축(머리 A → 땅속 끝 B)을 따라 칸마다 부위를 정해 찍음 —
    #  칼날 2 칸 너비(달 쪽 밝은 강철 · 반대쪽 짙은 강철 · 코등이 곁 두 칸만 반짝임 — 흰 막대가 아니라 쇠로) · 놋쇠 코등이(2 줄 두께) · 가죽 손잡이 · 놋쇠 머리 + 짙은 윤곽
    rgbl = lambda *c: to_lab(np.array(c, float))
    K = dict(steel_hi=rgbl(214, 220, 226), steel=rgbl(172, 181, 192), steel_lo=rgbl(100, 110, 126), brass=rgbl(198, 160, 82), brass_lo=rgbl(122, 90, 46),
             grip=rgbl(88, 56, 33), grip_hi=rgbl(122, 80, 45), pommel=rgbl(206, 168, 88))
    A = (np.array([869.0, 385.0]) - OFF) / CELL; Bp = (np.array([561.0, 1045.0]) - OFF) / CELL  # 28 판 칼 축(원본 화소 자리) 그대로
    k = N / 28; MT = int(round(Bp[1] - 0.5))  # k = 28 판 대비 칸 비 · MT = 흙무덤 윗줄(칼날이 땅에 드는 줄)
    d = (Bp - A) / np.linalg.norm(Bp - A); nrm = np.array([d[1], -d[0]])  # nrm = 칼날의 달 쪽(오른쪽 아래)
    axis_x = lambda y: A[0] + d[0] / d[1] * (y + 0.5 - A[1])
    sword = {}
    for y in range(N):
        for x in range(N):
            c = np.array([x + 0.5, y + 0.5]); sa = (c - A) @ d; ta = (c - A) @ nrm
            if -0.7 <= sa <= 0.7 and abs(ta) <= 0.8: sword[(x, y)] = K['pommel']
            elif 2.9 * k < sa <= 4.4 * k and abs(ta) <= max(1.6, 2.6 * k): sword[(x, y)] = K['brass'] if sa <= 3.65 * k else K['brass_lo']
    for y in [r for r in range(N) if 0.7 < (r + 0.5 - A[1]) / d[1] <= 2.9 * k]:  # 손잡이: 줄마다 축에 가장 가까운 한 칸 (감은 가죽 — 두 빛)
        sword[(int(np.floor(axis_x(y))), y)] = K['grip'] if y % 2 else K['grip_hi']
    blade_rows = [y for y in range(N) if 4.4 * k < (np.array([axis_x(y), y + 0.5]) - A) @ d and y < MT]
    for i, y in enumerate(blade_rows):  # 칼날: 줄마다 축을 사이에 둔 두 칸 — 오른쪽(달 쪽) 밝음 · 왼쪽 짙음
        xl = int(np.floor(axis_x(y) - 0.5))
        if (xl, y) in sword or (xl + 1, y) in sword: continue
        sword[(xl + 1, y)] = K['steel_hi'] if i < 2 else K['steel']
        sword[(xl, y)] = K['steel_lo']
    mask = np.zeros((N, N), bool)
    for (x, y), c in sword.items(): out[y, x] = c; mask[y, x] = True
    ring = ndimage.binary_dilation(mask, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~mask
    for (y, x) in zip(*np.where(ring)):
        if y < MT: out[y, x] = c_dark
    xb = int(np.floor(axis_x(MT - 1) - 0.5))  # 칼날이 땅에 드는 두 칸
    MOUND = {(xb - 1, MT): 'hi', (xb, MT): 'slit', (xb + 1, MT): 'slit', (xb + 2, MT): 'hi',
             (xb - 2, MT + 1): 'lo', (xb - 1, MT + 1): 'mid', (xb, MT + 1): 'mid', (xb + 1, MT + 1): 'mid', (xb + 2, MT + 1): 'mid', (xb + 3, MT + 1): 'lo'}
    MOUND_EDGE = [(xb - 2, MT), (xb + 3, MT), (xb - 3, MT + 1), (xb + 4, MT + 1)]
    # 흙무덤: 바탕 땅색(무덤 아래 · 둘레 칸 평균)에서 밝기만 바꿔 같은 흙으로 — 칼날 끝 칸을 덮어 '꽂힘'
    ground = np.array([out[y, x] for y in range(MT + 1, min(N, MT + 4)) for x in range(max(0, xb - 4), min(N, xb + 6))]).mean(0)
    a, b = ground[1], ground[2]  # 땅의 색조는 그대로, 밝기만 칼 둘레가 읽히게 (어두운 땅에 묻히지 않게)
    soil = {'hi': np.array([62, a + 6, b + 16]), 'mid': np.array([49, a + 5, b + 13]), 'lo': np.array([36, a + 3, b + 8])}  # 낙엽(주황)과 헷갈리지 않게 채도 낮춤
    soil['slit'] = soil['mid'] * 0.35 + c_dark * 0.65  # 칼날이 들어간 틈 — 양옆 밝은 흙 사이 짙은 한 칸
    for (x, y), k in MOUND.items(): out[y, x] = soil[k]
    for (x, y) in MOUND_EDGE: out[y, x] = c_dark
    return Image.fromarray(lab_to_rgb(out).astype(np.uint8), 'RGB')


def save(img, name):
    img.save(os.path.join(ICONS, name), optimize=True)


def grow(px, s):
    """큰 판(128 이상)은 칸의 정수배로 키우고 남는 몇 px 는 가장자리 색을 늘려 채움(칸 굵기 고름) · 작은 판(64 · 32)은 그대로 줄임(칸이 1~3 px 라 고르기보다 그림 전체가 들어가게)"""
    if s < 128:
        return px.resize((s, s), Image.NEAREST)
    m = s // N
    a = np.asarray(px.resize((N * m, N * m), Image.NEAREST))
    p = s - N * m
    return Image.fromarray(np.pad(a, ((p // 2, p - p // 2), (p // 2, p - p // 2), (0, 0)), mode='edge'), 'RGB')


if __name__ == '__main__':
    import sys
    px = build()
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        old = Image.open(os.path.join(ROOT, 'art', 'app-icon-20261017', 'px28-native.png')).resize((448, 448), Image.NEAREST)
        new = px.resize((440, 440), Image.NEAREST)
        x0, y0, x1, y1 = int(6 * N / 28), int(6 * N / 28), int(24 * N / 28) + 1, N
        zoom = px.crop((x0, y0, x1, y1)).resize(((x1 - x0) * 24, (y1 - y0) * 24), Image.NEAREST)
        sheet = Image.new('RGB', (448 + 16 + 440 + 16 + zoom.width, 448), (30, 30, 30)); sheet.paste(old, (0, 0)); sheet.paste(new, (464, 4)); sheet.paste(zoom, (920, 0)); sheet.save(out)
        print('preview', out); raise SystemExit
    px.save(os.path.join(ROOT, 'art', 'app-icon-20261017', 'px22-native.png'), optimize=True)
    big = {s: grow(px, s) for s in (512, 192, 180, 64, 32)}
    for prefix in ('tree-sword-px22-20261019-', 'tree-sword-px28-20261019-', 'tree-sword-px32-20261018-', 'tree-sword-20261017-', ''):
        save(big[512], f'{prefix}icon-512.png'); save(big[512], f'{prefix}icon-maskable-512.png')
        save(big[192], f'{prefix}icon-192.png'); save(big[180], f'{prefix}apple-touch-icon.png')
        save(big[64], f'{prefix}favicon-64.png'); save(big[32], f'{prefix}favicon-32.png')
    save(big[32], 'px32.png'); save(big[32], 'px32_mask.png')
    print('ok', px.size)
