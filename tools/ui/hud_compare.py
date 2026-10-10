"""HUD 전/후 나란히 (10/10 글자 체계 구현 — docs/ui/hud_type_system_2026-10-10.md §12)

docs/ui/hud_before_<방향>_<장면>.png 와 hud_after_<방향>_<장면>.png 를 옆으로(가로 화면은 위아래로) 붙여
docs/ui/hud_compare_<방향>_<장면>.png 로 쓴다. 위·왼쪽 = 전, 아래·오른쪽 = 후. 256 색으로 줄여 저장한다.
실행: python3 tools/ui/hud_compare.py [docs/ui] [장면,장면…]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

D = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/ui')
SCENES = (sys.argv[2] if len(sys.argv) > 2 else 'landscape_overlap,landscape_foe_secret,landscape_cards,landscape_menu,portrait_overlap,landscape_cue_secretReady').split(',')

for sc in SCENES:
    a, b = D / f'hud_before_{sc}.png', D / f'hud_after_{sc}.png'
    if not (a.exists() and b.exists()):
        print('없음', sc)
        continue
    A, B = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    side = A.width < A.height  # 세로 화면은 옆으로, 가로 화면은 위아래로
    gap = 12
    W = A.width + B.width + gap if side else max(A.width, B.width)
    H = max(A.height, B.height) if side else A.height + B.height + gap
    out = Image.new('RGB', (W, H), (27, 20, 16))
    out.paste(A, (0, 0))
    out.paste(B, (A.width + gap, 0) if side else (0, A.height + gap))
    d = ImageDraw.Draw(out)
    for (x, y), t in (((8, 8), 'BEFORE'), ((A.width + gap + 8, 8) if side else (8, A.height + gap + 8), 'AFTER')):
        d.rectangle([x, y, x + 74, y + 22], fill=(13, 9, 7))
        d.text((x + 8, y + 5), t, fill=(243, 233, 216))
    f = D / f'hud_compare_{sc}.png'
    out.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
    print('쓴', f)
