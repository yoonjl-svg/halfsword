"""한손 무기 팔 비틀림 견줌 판 (10/25 01:2x 사장님 '팔 관절이 비틀린 게 많아' — docs/strike/wrist_audit_2026-10-24.md §10).

wrist_audit_shots.mjs 의 TAGS 판(before · now · after · new) 그림을 줄마다 나란히 붙인다 — 칸 = 판, 줄 = 장면.
  python3 -I tools/browser/onehand_arm_sheet.py <그림 폴더> <나갈 이름.webp> <장면 꼬리,…> [판,…]
  장면 꼬리 = 판 이름 뒤 파일 이름 (예 guard_rapier_1_side · tap_side · fight_5_game) — '꼬리=줄 이름' 이면 그 이름을 줄 머리에 · 판 기본 before,now,after,new
  (10/25 감독 '칼끝이 하늘' — new = 엎친 손 판 · after = dbf2120 판 · 기록 §12)
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
LABEL = {
    'before': '전 (elbowSwivel 0 · wristGuard 0)',
    'now': '10/24 판 (swivelHuman 0)',
    'after': 'dbf2120 판 (사람 팔 범위 돌림만 — wristPronate 0)',
    'new': '지금 (엎친 손 + 손목 굽힘 · 1번 자세 손 뻗음)',
}


def main():
    folder = Path(sys.argv[1])
    out = folder / sys.argv[2]
    rows = [r.split('=', 1) if '=' in r else [r, r] for r in sys.argv[3].split(',')]
    tags = (sys.argv[4] if len(sys.argv) > 4 else 'before,now,after,new').split(',')
    W = 560 if len(tags) <= 3 else 480  # 칸 폭 (px)
    head = 40
    cap = 30
    imgs = {}
    for r, _ in rows:
        for t in tags:
            p = folder / f'{t}_{r}.webp'
            if p.exists():
                im = Image.open(p).convert('RGB')
                imgs[(r, t)] = im.resize((W, round(im.height * W / im.width)))
    if not imgs:
        raise SystemExit('그림 없음')
    H = max(im.height for im in imgs.values())
    sheet = Image.new('RGB', (W * len(tags), head + len(rows) * (H + cap)), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype(FONT, 18 if W >= 560 else 15)
    fs = ImageFont.truetype(FONT, 16)
    for i, t in enumerate(tags):
        d.text((i * W + 10, 10), LABEL.get(t, t), fill=(235, 235, 235), font=f)
    for j, (r, name) in enumerate(rows):
        y = head + j * (H + cap)
        d.text((10, y + 6), name, fill=(200, 200, 160), font=fs)
        for i, t in enumerate(tags):
            im = imgs.get((r, t))
            if im:
                sheet.paste(im, (i * W, y + cap))
    sheet.save(out, 'WEBP', quality=84, method=6)
    print(out)


if __name__ == '__main__':
    main()
