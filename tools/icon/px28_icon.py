# 앱 아이콘 28 × 28 도트판 (사장님 10/19 02:3x '새로 만든 32*32 픽셀 앱 아이콘. 28*28로 바꿔. 그리고 칼이 바닥에 꽂혀있는 게 아니라 서있는거 같애. 고쳐봐.
#  칼을 깊게 하는 대신 꽂힌 곳에 작은 흙무덤을 만들던가. 알아서 좋은 쪽으로.')
#  32 판(tools/icon/px32_icon.py — 기록으로 둠)과 같은 방법 · 원본. 바뀐 것: 28 칸 = 원본 44 px 한 칸(1254 → 가운데 1232) ·
#  칼 자리를 28 칸에 다시 찍음(칼날 10 칸, 기울기 1:2 그대로) · 칼끝이 들어가는 자리에 작은 흙무덤(위 3 칸 · 아래 5 칸 — 밝은 윗면 · 짙은 둘레)으로 '꽂힘'을 보임 ·
#  512 / 192 / 180 / 64 / 32 는 28 의 정수배(18 · 6 · 6 · 2 · 1)로 키우고 남는 몇 px 는 가장자리 색을 늘려 채움(칸 굵기가 고르게)
#  python3 tools/icon/px28_icon.py   (numpy · scipy · Pillow)
import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy.cluster.vq import kmeans2
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MASTER = os.path.join(ROOT, 'art', 'app-icon-20261017', 'master.png')
ICONS = os.path.join(ROOT, 'public', 'icons')
OFF, CELL, N = 11, 44, 28
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
    for y in range(5, N):
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
    sword = {}
    for p in POMMEL: sword[p] = c_light
    for i, p in enumerate(GRIP): sword[p] = c_grip2 if i % 2 == 0 else c_grip1
    for p in GUARD: sword[p] = c_mid
    for p in BLADE: sword[p] = c_light
    mask = np.zeros((N, N), bool)
    for (x, y), c in sword.items(): out[y, x] = c; mask[y, x] = True
    ring = ndimage.binary_dilation(mask, structure=[[0, 1, 0], [1, 1, 1], [0, 1, 0]]) & ~mask
    tip_y = max(y for (x, y) in sword)
    for (y, x) in zip(*np.where(ring)):
        if y < tip_y: out[y, x] = c_dark
    # 흙무덤: 바탕 땅색(무덤 아래 · 둘레 칸 평균)에서 밝기만 바꿔 같은 흙으로 — 칼날 끝 칸을 덮어 '꽂힘'
    ground = np.array([out[y, x] for y in range(24, 27) for x in range(8, 17)]).mean(0)
    a, b = ground[1], ground[2]  # 땅의 색조는 그대로, 밝기만 칼 둘레가 읽히게 (어두운 땅에 묻히지 않게)
    soil = {'hi': np.array([62, a + 6, b + 16]), 'mid': np.array([49, a + 5, b + 13]), 'lo': np.array([36, a + 3, b + 8])}  # 낙엽(주황)과 헷갈리지 않게 채도 낮춤
    soil['slit'] = soil['mid'] * 0.35 + c_dark * 0.65  # 칼날이 들어간 틈 — 양옆 밝은 흙 사이 짙은 한 칸
    for (x, y), k in MOUND.items(): out[y, x] = soil[k]
    for (x, y) in MOUND_EDGE: out[y, x] = c_dark
    return Image.fromarray(lab_to_rgb(out).astype(np.uint8), 'RGB')


def save(img, name):
    img.save(os.path.join(ICONS, name), optimize=True)


def grow(px, s):
    k = s // N
    a = np.asarray(px.resize((N * k, N * k), Image.NEAREST))
    p = s - N * k
    return Image.fromarray(np.pad(a, ((p // 2, p - p // 2), (p // 2, p - p // 2), (0, 0)), mode='edge'), 'RGB')


if __name__ == '__main__':
    import sys
    px = build()
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        old = Image.open(os.path.join(ROOT, 'art', 'app-icon-20261017', 'px32-native.png')).resize((448, 448), Image.NEAREST)
        new = px.resize((448, 448), Image.NEAREST)
        zoom = px.crop((6, 15, 20, 28)).resize((14 * 24, 13 * 24), Image.NEAREST)
        sheet = Image.new('RGB', (448 * 2 + 16 + 14 * 24 + 16, 448), (30, 30, 30)); sheet.paste(old, (0, 0)); sheet.paste(new, (464, 0)); sheet.paste(zoom, (928, 0)); sheet.save(out)
        print('preview', out); raise SystemExit
    px.save(os.path.join(ROOT, 'art', 'app-icon-20261017', 'px28-native.png'), optimize=True)
    big = {s: grow(px, s) for s in (512, 192, 180, 64, 32)}
    for prefix in ('tree-sword-px28-20261019-', 'tree-sword-px32-20261018-', 'tree-sword-20261017-', ''):
        save(big[512], f'{prefix}icon-512.png'); save(big[512], f'{prefix}icon-maskable-512.png')
        save(big[192], f'{prefix}icon-192.png'); save(big[180], f'{prefix}apple-touch-icon.png')
        save(big[64], f'{prefix}favicon-64.png'); save(big[32], f'{prefix}favicon-32.png')
    save(big[32], 'px32.png'); save(big[32], 'px32_mask.png')
    print('ok', px.size)
