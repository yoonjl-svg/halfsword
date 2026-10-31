"""redondo_gamecam_shots.mjs 낱장(게임 카메라 화면 그대로)을 사람 · AI 마다 띠 그림 한 장으로 (칸마다 이름 · 그때 감기 몫 — _gamecam_<꼬리>.json).
사용: python3 tools/browser/redondo_gamecam_strip.py <폴더> <꼬리 before|after>
 → <폴더>/redondo_gamecam_player_<꼬리>.png · redondo_gamecam_ai_<꼬리>.png (화면 가운데 몸 둘레를 잘라 줄임)
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

D, tag = sys.argv[1], sys.argv[2]
only = sys.argv[3].split(',') if len(sys.argv) > 3 and sys.argv[3] else None
meta = json.load(open(f'{D}/_gamecam_{tag}.json'))
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 12)
    big = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception:
    font = big = ImageFont.load_default()
TITLE = {'player': 'PLAYER (game camera, 844x390 touch, real long press via CDP)', 'ai': 'AI foe windmill (game camera - foe faces the player)'}
box = {'player': (212, 0, 632, 390), 'ai': (300, 20, 580, 330)}  # AI: 상대 둘레 (상대는 화면 가운데 조금 오른쪽)
sc = {'player': 0.47, 'ai': 0.7}
for s in meta['summary']:
    if only and s['who'] not in only:
        continue
    w = s['who']
    b = box[w]
    tw, th = int((b[2] - b[0]) * sc[w]), int((b[3] - b[1]) * sc[w])
    shots = s['shots']
    top = 24
    out = Image.new('RGB', (tw * len(shots), th + top + 32), (22, 22, 24))
    d = ImageDraw.Draw(out)
    d.text((6, 4), f"{TITLE[w]} - {tag}", fill=(255, 220, 120), font=big)
    pre = 'p' if w == 'player' else 'a'
    for c, sh in enumerate(shots):
        im = Image.open(f"{D}/_{pre}_{tag}_{sh['k']}.png").convert('RGB').crop(b).resize((tw, th))
        out.paste(im, (c * tw, top))
        p = sh.get('pose') or {}
        wd = p.get('wind')
        sub = f"wind {wd['t'] / 1.1:.2f}s k{wd['k']:.1f}" if wd else ('strike' if p.get('iai') else (p.get('aiPhase') or ''))
        d.text((c * tw + 4, top + th + 2), sh['label'], fill=(235, 235, 235), font=font)
        d.text((c * tw + 4, top + th + 16), sub, fill=(170, 170, 170), font=font)
    fn = f"{D}/redondo_gamecam_{w}_{tag}.png"
    out.quantize(colors=256, method=Image.Quantize.MEDIANCUT).save(fn, optimize=True)
    print(fn, out.size)
