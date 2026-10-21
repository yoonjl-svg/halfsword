# 스킬트리 칸 그림의 '가장 작은 둘레 원' (사장님 10/22 01:5x '원형 테두리 크기를 지금보다 작게. 아이콘에 fit하게 맞춰' — IMPLEMENTATION.md §8-8)
#  public/ui/books/<유파>_<1..5 · deep · letter>.webp 35 장마다 보이는 화소(알파 > 60)를 모두 담는 가장 작은 원(Welzl)을 구해
#  src/skill_tree_icon_fit.js 에 [가운데 x / 그림 폭, 가운데 y / 그림 높이, 반지름 / 그림 높이] 로 적는다 — 화면(skill_tree.js)이 원 지름 · 그림 자리를 이것으로 셈.
#  그림을 다시 찍으면(tools/browser/item_thumbs.mjs) 이것도 다시 돌린다:  python3 tools/browser/skill_tree_icon_fit.py
import math, os, random
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese']
KINDS = ['1', '2', '3', 'deep', '4', '5', 'letter']


def hull(points):
    pts = sorted(set(points))
    if len(pts) < 3:
        return pts
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def circle2(a, b):
    c = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    return (c[0], c[1], math.dist(a, c))


def circle3(a, b, c):
    ax, ay = a; bx, by = b; cx, cy = c
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-12:
        return None
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    return (ux, uy, math.dist((ux, uy), a))


def inside(c, p):
    return c is not None and math.dist((c[0], c[1]), p) <= c[2] + 1e-7


def mec(points):
    """가장 작은 둘레 원 (반복 Welzl — 점은 볼록 껍질만)"""
    P = points[:]
    random.Random(7).shuffle(P)
    c = None
    for i, p in enumerate(P):
        if c is None or not inside(c, p):
            c = (p[0], p[1], 0.0)
            for j in range(i):
                q = P[j]
                if not inside(c, q):
                    c = circle2(p, q)
                    for k in range(j):
                        r = P[k]
                        if not inside(c, r):
                            c = circle3(p, q, r) or c
    return c


def fit(path):
    im = Image.open(path).convert('RGBA')
    W, H = im.size
    a = im.getchannel('A').load()
    pts = []
    for y in range(H):
        row = [x for x in range(W) if a[x, y] > 60]
        if row:  # 줄마다 양 끝 (화소 네모의 모서리까지)
            for x in (row[0], row[-1] + 1):
                pts += [(x, y), (x, y + 1)]
    cx, cy, r = mec(hull(pts))
    return round(cx / W, 4), round(cy / H, 4), round(r / H, 4)


def main():
    lines = []
    for s in SCHOOLS:
        for k in KINDS:
            cx, cy, r = fit(os.path.join(ROOT, 'public', 'ui', 'books', f'{s}_{k}.webp'))
            lines.append(f"  '{s}_{k}': [{cx}, {cy}, {r}],")
    out = os.path.join(ROOT, 'src', 'skill_tree_icon_fit.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write("// 스킬트리 칸 그림마다 '가장 작은 둘레 원' — tools/browser/skill_tree_icon_fit.py 가 만든다(손으로 고치지 않음 · 그림을 다시 찍으면 다시 돌림).\n")
        f.write("//  [가운데 x / 그림 폭, 가운데 y / 그림 높이, 반지름 / 그림 높이] (그림 256 × 336 — 보이는 화소 알파 > 60). 화면 skill_tree.js 가 원 지름 · 그림 자리를 셈 (사장님 10/22 01:5x '아이콘에 fit하게')\n")
        f.write('export const ICON_FIT = Object.freeze({\n' + '\n'.join(lines) + '\n});\n')
    print(out, len(lines))


if __name__ == '__main__':
    main()
