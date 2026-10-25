"""이탈리아 찌르기 견줌 판 (10/25 08:0x 사장님 '이탈리아 찌르기 손봐' — docs/strike/italian_thrust_2026-10-25.md §8).

italian_thrust_shots.mjs 의 그림(before_* · after_*)을 한 장에: 줄 = 장면(사람 1번 자세 탭 · AI 임브로카타), 칸 = 전 옆 · 전 게임 화면 · 후 옆 · 후 게임 화면.
  python3 -I tools/browser/italian_thrust_sheet.py <그림 폴더> [나갈 이름=compare.webp]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
COLS = [('before', 'side', '전 (?itThrust=0) · 옆'), ('before', 'game', '전 · 게임 화면'), ('after', 'side', '지금 (팔 → 몸 → 발) · 옆'), ('after', 'game', '지금 · 게임 화면')]
ROWS = [('tap', '사람 레이피어 1번 자세 탭 (칼 내린 롱소드 · 가슴 사이 2.1 m)'), ('imb', 'AI 레이피어 임브로카타 (나 = 롱소드 · 칼 내림 · 가슴 사이 1.7 m)')]


def main():
    folder = Path(sys.argv[1])
    out = folder / (sys.argv[2] if len(sys.argv) > 2 else 'compare.webp')
    W, head, cap = 420, 36, 28
    imgs = {}
    for r, _ in ROWS:
        for t, v, _ in COLS:
            p = folder / f'{t}_{r}_{v}.webp'
            if p.exists():
                im = Image.open(p).convert('RGB')
                imgs[(r, t, v)] = im.resize((W, round(im.height * W / im.width)))
    if not imgs:
        raise SystemExit('그림 없음')
    H = max(im.height for im in imgs.values())
    sheet = Image.new('RGB', (W * len(COLS), head + len(ROWS) * (H + cap)), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype(FONT, 16)
    for i, (_, _, lab) in enumerate(COLS):
        d.text((i * W + 10, 9), lab, fill=(235, 235, 235), font=f)
    for j, (r, name) in enumerate(ROWS):
        y = head + j * (H + cap)
        d.text((10, y + 5), name, fill=(200, 200, 160), font=f)
        for i, (t, v, _) in enumerate(COLS):
            im = imgs.get((r, t, v))
            if im:
                sheet.paste(im, (i * W, y + cap))
    sheet.save(out, 'WEBP', quality=84, method=6)
    print(out)


if __name__ == '__main__':
    main()
