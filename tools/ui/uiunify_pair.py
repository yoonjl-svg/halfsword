"""첫 화면·대기실 맞추기 전/후 사진 붙이기 (docs/import/ui_unify_2026-10-16.md §10).
tools/browser/uiunify_capture.mjs 로 찍은 before_*.png · after_*.png 를 왼쪽 전 · 오른쪽 후로 붙여 작은 webp 로 저장한다.
  python3 tools/ui/uiunify_pair.py <사진 폴더> docs/handoff
"""
import os
import sys

from PIL import Image, ImageDraw

SRC, OUT = sys.argv[1], sys.argv[2]
SCENES = ['title_phone', 'settings_phone', 'notices_phone', 'weapons_phone', 'armor_phone', 'skills_phone', 'shop_phone', 'title_pc', 'weapons_pc', 'skills_pc']
HALF_W = {'phone': 1266, 'pc': 960}  # 한쪽 폭 (폰 = 화소 비 3 사진의 반 · PC = 3/4)
BAR = 28


def label(img, text):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width, BAR], fill=(20, 15, 12))
    d.text((10, 7), text, fill=(243, 233, 216))


def shrink(path, w):
    im = Image.open(path).convert('RGB')
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
for scene in SCENES:
    kind = scene.split('_')[-1]
    a, b = (os.path.join(SRC, f'{tag}_{scene}.png') for tag in ('before', 'after'))
    if not (os.path.exists(a) and os.path.exists(b)):
        continue
    left, right = shrink(a, HALF_W[kind]), shrink(b, HALF_W[kind])
    pair = Image.new('RGB', (left.width + right.width + 8, max(left.height, right.height) + BAR), (20, 15, 12))
    pair.paste(left, (0, BAR))
    pair.paste(right, (left.width + 8, BAR))
    label(pair, f'BEFORE (5b3ac43)  |  AFTER  -  {scene}')
    dst = os.path.join(OUT, f'uiunify_{scene}.webp')
    pair.save(dst, 'WEBP', quality=78, method=6)
    print(dst, pair.size, os.path.getsize(dst) // 1024, 'KB')
# 후만 있는 장면 (호칭 내림 상자 — 전에는 없던 것)
for scene in ['titles_phone']:
    b = os.path.join(SRC, f'after_{scene}.png')
    if os.path.exists(b):
        im = shrink(b, HALF_W['phone'])
        out = Image.new('RGB', (im.width, im.height + BAR), (20, 15, 12))
        out.paste(im, (0, BAR))
        label(out, f'AFTER  -  {scene} (new)')
        dst = os.path.join(OUT, f'uiunify_{scene}.webp')
        out.save(dst, 'WEBP', quality=78, method=6)
        print(dst, out.size, os.path.getsize(dst) // 1024, 'KB')
