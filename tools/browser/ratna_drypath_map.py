"""라트나 마른 길 지도 (docs/import/ratna_drypath/*.webp) — 위에서 본 잠든 습지에 라트나 · 상대 자취를 전 / 후 두 칸으로.

실행:
  node tools/sim/ratna_drypath_sim.mjs stones <지도.json>          (젖음 격자 · 디딤돌 · 석상 · 결투장)
  node tools/browser/ratna_drypath_probe.mjs <주소> <폴더> dry 1 2 3   (자취 <폴더>/dry_<정책>.json)
  python3 -I tools/browser/ratna_drypath_map.py <지도.json> <dry_*.json> <출력.webp> [제목]
그림: 짙은 초록일수록 젖음(진흙 감속)이 크다(1 = 자발 이동 × 0.4) · 회색 돌 = 디딤돌 · 가운데 짙은 원 = 석상 받침, 가는 원 = AI 길잡이 반지름 · 붉은 선 = 라트나 · 파란 선 = 상대.
위가 −z, 오른쪽이 +x (판 시작: 상대 −x 쪽 · 라트나 +x 쪽). 글꼴: 문천역 정흑(wqy-zenhei), 없으면 PIL 기본.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

MAP, DRY, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
TITLE = sys.argv[4] if len(sys.argv) > 4 else ''
FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'


def font(size):
    return ImageFont.truetype(FONT_PATH, size) if os.path.exists(FONT_PATH) else ImageFont.load_default()


F_S, F_M = font(13), font(15)
M = json.load(open(MAP))
D = json.load(open(DRY))
N, H = M['N'], M['H']
PX = 340  # 칸 하나의 한 변 (−H ~ H m)
S = PX / (2 * H)
DRY_RGB, WET_RGB, OUT_RGB = (226, 214, 184), (60, 104, 108), (206, 206, 200)


def to_px(x, z, ox, oy):
    return ox + (x + H) * S, oy + (z + H) * S


def panel(img, ox, oy, runs, label):
    d = ImageDraw.Draw(img, 'RGBA')
    cell = PX / (N - 1)
    for j in range(N):
        for i in range(N):
            x = -H + 2 * H * i / (N - 1)
            z = -H + 2 * H * j / (N - 1)
            w = M['grid'][j][i]
            if x * x + z * z > M['arena'] ** 2:
                col = OUT_RGB
            else:
                col = tuple(int(a + (b - a) * w) for a, b in zip(DRY_RGB, WET_RGB))
            px, py = ox + i * cell, oy + j * cell
            d.rectangle([px - cell / 2, py - cell / 2, px + cell / 2, py + cell / 2], fill=col)
    cx, cy = to_px(0, 0, ox, oy)
    for r, kw in ((M['arena'], dict(outline=(120, 110, 90), width=2)), (M['bear']['clear'], dict(outline=(90, 90, 90, 150), width=1)), (M['bear']['plinth'], dict(fill=(110, 110, 104)))):
        d.ellipse([cx - r * S, cy - r * S, cx + r * S, cy + r * S], **kw)
    for poly in M['stones']:
        d.polygon([to_px(x, z, ox, oy) for x, z in poly], fill=(140, 140, 128), outline=(80, 80, 72))
    for run in runs:  # 판마다 [라트나 x, z, 상대 x, z] 0.1 s 마다
        for rnd in run['path']:
            if len(rnd) > 1:
                d.line([to_px(p[2], p[3], ox, oy) for p in rnd], fill=(40, 80, 200, 150), width=2)
                d.line([to_px(p[0], p[1], ox, oy) for p in rnd], fill=(200, 40, 30, 190), width=2)
    d.text((ox + 6, oy + 4), label, font=F_S, fill=(20, 20, 20))


def share(runs, key):
    t = sum(r['t'] for r in runs)
    return 100 * sum(r[key] for r in runs) / t if t else 0


img = Image.new('RGB', (PX * 2 + 30, PX + 80), (250, 249, 245))
panel(img, 10, 28, D['off'], f"전 · 젖음 0.3 넘는 시간 라트나 {share(D['off'], 'hiR'):.1f} % · 상대 {share(D['off'], 'hiP'):.1f} %")
panel(img, 20 + PX, 28, D['on'], f"후 · 라트나 {share(D['on'], 'hiR'):.1f} % · 상대 {share(D['on'], 'hiP'):.1f} %")
d = ImageDraw.Draw(img)
d.text((10, 5), TITLE, font=F_M, fill=(20, 20, 20))
d.text((10, PX + 34), '붉은 선 라트나 · 파란 선 상대 · 짙은 초록 = 젖음 1(자발 이동 × 0.4) · 회색 = 디딤돌', font=F_S, fill=(60, 60, 60))
d.text((10, PX + 52), '가운데 짙은 원 = 석상 받침 · 가는 원 = 길잡이 반지름 1.4 m · 위가 -z, 오른쪽이 +x', font=F_S, fill=(60, 60, 60))
img.save(OUT, 'WEBP', quality=72, method=6)
print(OUT, img.size, os.path.getsize(OUT), 'B')
