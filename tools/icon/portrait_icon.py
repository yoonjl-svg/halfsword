# 앱 아이콘 = 플레이어2 프사 (사장님 10/19 02:5x '저거 안 되겠다. 우리 캐릭터 프사 중에 플레이어2 어두운 배경 그리드 있음. 이 이미지로 해.')
#  그림: art/portraits-px-20261018/player2.png (샛별 확정 22 × 22 칸 · 액자 1 · 투명 바탕) 를 대기실 프사 칸과 같은 어두운 갈색 바탕(#30261c)에 얹고,
#   ?portraitGrid=1 칸 줄(grid-overlay.svg — 하늘색 #8dd8dd · 불투명 0.48 · 칸 50 px · 77 ~ 1177)을 겹친 꼴 그대로
#  크기: 1254 원본에서 곱게 줄임(LANCZOS). 칸 줄은 큰 판(128 px 이상)에서만 그 크기에 1 px 로 다시 그음 — 64 · 32 파비콘은 줄이 그림을 덮어 줄 없이
#  python3 tools/icon/portrait_icon.py [--preview 경로]
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'art', 'portraits-px-20261018', 'player2.png')
ICONS = os.path.join(ROOT, 'public', 'icons')
BG = (0x30, 0x26, 0x1c)
GRID = (0x8d, 0xd8, 0xdd)
G0, CELLPX, NC, FULL = 77, 50, 22, 1254


def base():
    src = Image.open(SRC).convert('RGBA')
    bg = Image.new('RGBA', src.size, BG + (255,))
    return Image.alpha_composite(bg, src)


def icon(s, grid=None):
    im = base().resize((s, s), Image.LANCZOS)
    if grid is None:
        grid = s >= 128
    if grid:
        over = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        d = ImageDraw.Draw(over)
        k = s / FULL
        a, b = round(G0 * k), round((G0 + NC * CELLPX) * k)
        for i in range(NC + 1):
            p = round((G0 + i * CELLPX) * k)
            d.line([(p, a), (p, b)], fill=GRID + (122,), width=1)
            d.line([(a, p), (b, p)], fill=GRID + (122,), width=1)
        im = Image.alpha_composite(im, over)
    return im.convert('RGB')


if __name__ == '__main__':
    if '--preview' in sys.argv:
        out = sys.argv[sys.argv.index('--preview') + 1]
        a, b, c = icon(512), icon(192).resize((192, 192)), icon(64).resize((128, 128), Image.NEAREST)
        sheet = Image.new('RGB', (512 + 16 + 192 + 16 + 128, 512), (24, 24, 24)); sheet.paste(a, (0, 0)); sheet.paste(b, (528, 0)); sheet.paste(c, (736, 0)); sheet.save(out)
        print('preview', out); raise SystemExit
    big = {s: icon(s) for s in (512, 192, 180, 64, 32)}
    for prefix in ('player2-portrait-20261019-', 'tree-sword-px22-20261019-', 'tree-sword-px28-20261019-', 'tree-sword-px32-20261018-', 'tree-sword-20261017-', ''):
        for name, s in (('icon-512.png', 512), ('icon-maskable-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-64.png', 64), ('favicon-32.png', 32)):
            big[s].save(os.path.join(ICONS, prefix + name), optimize=True)
    big[32].save(os.path.join(ICONS, 'px32.png'), optimize=True); big[32].save(os.path.join(ICONS, 'px32_mask.png'), optimize=True)
    print('ok')
