# 앱 아이콘 32 × 32 도트판 (사장님 10/18 04:1x '지금 앱 아이콘도 아까 만든 32배 정도 기준으로 바꿔. 바로 교체해.')
#  원본: art/app-icon-20261017/master.png (샛별 저장소 8ad8e0bf 의 1254² 제작 원본 — 출처 메타 조각만 뺌, 화소 그대로)
#  32 칸 = 원본 39 px 한 칸(1254 → 가운데 1248) — 프로필 32배 시안(34 칸)과 같은 굵기 · 512 / 192 / 64 / 32 가 정수배라 칸이 고르다.
#  만드는 법 (docs/import/app_icon_px32_2026-10-18.md):
#   1) 바탕(나무 · 달 · 하늘 · 땅) = 칸마다 넓이 평균 → Lab k-means 16 색 → 외딴 잔점 정리(비슷한 색끼리만)
#   2) 떨어지는 낙엽 = 노란 화소가 많은 외딴 칸만 그 색으로 (나무 잎 덩어리는 바탕 그대로)
#   3) 칼 = 원본 칼 자리를 칸에 직접 찍음(칼자루 머리 1 · 손잡이 2 · 코등이 5 · 칼날 12 — 칼날 기울기 1:2, 코등이 2:1) + 4 이웃 짙은 윤곽(땅에 꽂힌 끝 줄은 뺌)
#      — 그냥 줄이면 가는 칼자루 · 코등이가 바탕에 묻혀 사라진다(평균 · 최빈값 둘 다)
#  쓰는 곳: public/icons/ 새 이름 tree-sword-px32-20261018-* (index.html · 매니페스트가 거는 것) + 옛 이름 파일도 같은 그림으로 덮음(옛 HTML · 옛 매니페스트를 쥔 곳도 새 그림)
#  python3 tools/icon/px32_icon.py   (numpy · scipy · Pillow)
import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy.cluster.vq import kmeans2
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MASTER = os.path.join(ROOT, 'art', 'app-icon-20261017', 'master.png')
ICONS = os.path.join(ROOT, 'public', 'icons')
OFF, CELL, N = 3, 39, 32
POMMEL = [(20, 12)]
GRIP = [(19, 13), (19, 14)]
GUARD = [(16, 14), (17, 14), (18, 15), (19, 15), (20, 16)]
BLADE = [(18, 16), (18, 17), (17, 18), (17, 19), (16, 20), (16, 21), (15, 22), (15, 23), (14, 24), (14, 25), (13, 26), (13, 27)]


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
    return Image.fromarray(lab_to_rgb(out).astype(np.uint8), 'RGB')


def save(img, name):
    img.save(os.path.join(ICONS, name), optimize=True)


if __name__ == '__main__':
    px = build()
    px.save(os.path.join(ROOT, 'art', 'app-icon-20261017', 'px32-native.png'), optimize=True)
    big = {s: px.resize((s, s), Image.NEAREST) for s in (512, 192, 180, 64, 32)}
    new = 'tree-sword-px32-20261018-'
    for prefix in (new, 'tree-sword-20261017-', ''):
        save(big[512], f'{prefix}icon-512.png'); save(big[512], f'{prefix}icon-maskable-512.png')
        save(big[192], f'{prefix}icon-192.png'); save(big[180], f'{prefix}apple-touch-icon.png')
        save(big[64], f'{prefix}favicon-64.png'); save(big[32], f'{prefix}favicon-32.png')
    save(big[32], 'px32.png'); save(big[32], 'px32_mask.png')
    print('ok', px.size)
