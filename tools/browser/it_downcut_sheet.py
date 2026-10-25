"""사람 내려 긋기 프레임 띠 (10/25 19:0x 사장님 '이탈리아 내려 긋기의 문제를 살펴보고 수정해' — docs/strike/wrist_audit_2026-10-24.md §15).

it_downcut_shots.mjs 그림을 무기 · 기술 · 보기(side · game)마다 한 장으로 — 줄 = 판(전 · 후), 칸 = 긋기 시작 뒤 시간.
  python3 -I tools/browser/it_downcut_sheet.py <그림 폴더> [판,…(기본 before,after)]
  나감: strip_<무기>_<기술>_<보기>.webp
"""
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
LABEL = {
    'before': '전 (`?cutPronate=0` — 감는 동안 손 면을 쥐어 칼이 늦게 따라감)',
    'after': '후 (기본 — 엎친 손은 쉬는 자세만 · 칼을 끄는 동안 팔꿈치 돌림 + 교정)',
}


def main():
    folder = Path(sys.argv[1])
    tags = (sys.argv[2] if len(sys.argv) > 2 else 'before,after').split(',')
    pat = re.compile(r'^(?P<tag>[a-z0-9-]+)_(?P<w>[a-z_]+?)_(?P<tech>[a-zA-Z]+)_(?P<ms>\d{3,})_(?P<view>side|game)\.webp$')
    groups = {}
    for p in folder.glob('*.webp'):
        m = pat.match(p.name)
        if not m or m['tag'] not in tags:
            continue
        groups.setdefault((m['w'], m['tech'], m['view']), {}).setdefault(m['tag'], {})[int(m['ms'])] = p
    font = ImageFont.truetype(FONT, 18)
    small = ImageFont.truetype(FONT, 15)
    W = 360
    for (w, tech, view), byTag in sorted(groups.items()):
        times = sorted({t for d in byTag.values() for t in d})
        first = next(iter(next(iter(byTag.values())).values()))
        im0 = Image.open(first)
        H = round(im0.height * W / im0.width)
        head, cap = 34, 24
        sheet = Image.new('RGB', (W * len(times), head + len(tags) * (cap + H)), (24, 24, 28))
        d = ImageDraw.Draw(sheet)
        d.text((8, 7), f'{w} · {tech} · {"옆 카메라" if view == "side" else "게임 화면"} — 칸 = 긋기 시작 뒤 (ms)', fill=(235, 235, 235), font=font)
        for r, tag in enumerate(tags):
            y = head + r * (cap + H)
            d.text((8, y + 3), LABEL.get(tag, tag), fill=(255, 214, 120), font=small)
            for c, t in enumerate(times):
                p = byTag.get(tag, {}).get(t)
                if not p:
                    continue
                im = Image.open(p).convert('RGB').resize((W, H))
                sheet.paste(im, (c * W, y + cap))
                d.text((c * W + 6, y + cap + 4), f'{t} ms', fill=(255, 255, 255), font=small)
        outp = folder / f'strip_{w}_{tech}_{view}.webp'
        sheet.save(outp, 'WEBP', quality=84, method=6)
        print(outp)


if __name__ == '__main__':
    main()
