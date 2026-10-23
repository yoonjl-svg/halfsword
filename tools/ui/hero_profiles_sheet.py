"""손님 인물 셋 프로필 확정본 — 화면 그림 WebP 로 옮기기 · 전 · 후 한 장 (10/24 — docs/import/hero_profiles_import_2026-10-24.md §5)

  1) tools/browser/hero_profiles_shots.mjs 가 찍은 PNG(844 × 390 · 배율 2 = 1688 × 780)를 WebP(품질 88 · method 6)로 <출력 폴더>에
  2) before_after.webp — 위 줄 10/23 임시 그림(art/portraits-temp-20261023/<id>.png) · 아래 줄 10/24 확정본(public/ui/portraits/<id>.webp)
     둘 다 게임과 같은 768² 그림을 쓰는 곳의 바탕 #30261c 위에 한 변 360 으로. 글꼴: 문천역 정흑(wqy-zenhei), 없으면 PIL 기본.

실행 (저장소 뿌리에서):  python3 -I tools/ui/hero_profiles_sheet.py <찍은 폴더> docs/handoff/hero_profiles_2026-10-24
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

IDS = (('roland', '롤랑'), ('white_scale', '백린의 전사'), ('bernardo', '베르나르도'))
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
INK, PAPER, SLOT = (243, 233, 216), (27, 20, 16), (48, 38, 28)
SIDE, GAP, HEAD, LEFT, QUALITY = 360, 16, 44, 150, 88


def font(size):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except OSError:
        return ImageFont.load_default()


def main():
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if f.endswith('.png'):
            Image.open(os.path.join(src, f)).convert('RGB').save(os.path.join(out, f[:-4] + '.webp'), 'WEBP', quality=QUALITY, method=6)
    rows = (('10/23 임시', lambda i: Image.open(f'art/portraits-temp-20261023/{i}.png').convert('RGBA').resize((768, 768), Image.LANCZOS)),
            ('10/24 확정', lambda i: Image.open(f'public/ui/portraits/{i}.webp').convert('RGBA')))
    w = LEFT + len(IDS) * (SIDE + GAP) + GAP
    h = HEAD + len(rows) * (SIDE + GAP) + GAP
    sheet = Image.new('RGB', (w, h), PAPER)
    d = ImageDraw.Draw(sheet)
    f = font(26)
    for c, (_, name) in enumerate(IDS):
        x = LEFT + GAP + c * (SIDE + GAP)
        d.text((x + SIDE / 2, HEAD / 2 + 4), name, fill=INK, font=f, anchor='mm')
    for r, (label, load) in enumerate(rows):
        y = HEAD + GAP + r * (SIDE + GAP)
        d.text((LEFT / 2 + 4, y + SIDE / 2), label, fill=INK, font=f, anchor='mm')
        for c, (pid, _) in enumerate(IDS):
            x = LEFT + GAP + c * (SIDE + GAP)
            tile = Image.new('RGBA', (SIDE, SIDE), SLOT + (255,))
            tile.alpha_composite(load(pid).resize((SIDE, SIDE), Image.LANCZOS))
            sheet.paste(tile.convert('RGB'), (x, y))
    sheet.save(os.path.join(out, 'before_after.webp'), 'WEBP', quality=QUALITY, method=6)
    print('→', out)


if __name__ == '__main__':
    main()
