"""HUD 전/후 나란히 (10/10 글자 체계 구현 — docs/ui/hud_type_system_2026-10-10.md §12)

docs/ui/hud_before_<방향>_<장면>.png 와 hud_after_<방향>_<장면>.png 를 옆으로(가로 화면은 위아래로) 붙여
docs/ui/hud_compare_<방향>_<장면>.png 로 쓴다. 위·왼쪽 = 전, 아래·오른쪽 = 후. 256 색으로 줄여 저장한다.
실행: python3 tools/ui/hud_compare.py [docs/ui] [장면,장면…]
     python3 tools/ui/hud_compare.py docs/ui v2   → 10/10 19:2x 세 묶음: 전 = hud_after_*(v1) · 후 = hud_v2_* → hud_v2_compare_<방향>_<장면>.png
     python3 tools/ui/hud_compare.py docs/ui v3   → 10/10 20:3x 두 묶음·한 줄: 전 = hud_v2_* · 후 = hud_v3_* → hud_v3_compare_<방향>_<장면>.png
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

D = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/ui')
V2 = len(sys.argv) > 2 and sys.argv[2] == 'v2'
V3 = len(sys.argv) > 2 and sys.argv[2] == 'v3'
if V3:  # (전 장면, 후 장면) — v2 패시브+비기 두 줄 ↔ v3 한 줄(foe_tech), v2 ③ 브란 분노(overlap) ↔ v3 감정 줄(emo)
    PAIRS = [(f'{o}_{a}', f'{o}_{b}', f'{o}_{b}') for o in ('landscape', 'portrait') for a, b in (('start', 'start'), ('foe_secret', 'foe_tech'), ('overlap', 'emo'), ('menu', 'menu'), ('menu', 'menu_test'))]
elif V2:  # (전 장면, 후 장면) — v1 경직은 가운데 칸(cue_stiff), v2 는 오른쪽 위 ③ 묶음(state)
    PAIRS = [(f'{o}_{a}', f'{o}_{b}', f'{o}_{b}') for o in ('landscape', 'portrait') for a, b in (('start', 'start'), ('foe_secret', 'foe_secret'), ('cue_stiff', 'state'), ('menu', 'menu'), ('overlap', 'overlap'))]
else:
    SCENES = (sys.argv[2] if len(sys.argv) > 2 else 'landscape_overlap,landscape_foe_secret,landscape_cards,landscape_menu,portrait_overlap,landscape_cue_secretReady').split(',')
    PAIRS = [(sc, sc, sc) for sc in SCENES]

for sa, sb, sc in PAIRS:
    a, b = (D / f'hud_v2_{sa}.png', D / f'hud_v3_{sb}.png') if V3 else (D / f'hud_after_{sa}.png', D / f'hud_v2_{sb}.png') if V2 else (D / f'hud_before_{sa}.png', D / f'hud_after_{sb}.png')
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
    f = D / (f'hud_v3_compare_{sc}.png' if V3 else f'hud_v2_compare_{sc}.png' if V2 else f'hud_compare_{sc}.png')
    out.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(f, optimize=True)
    print('쓴', f)
