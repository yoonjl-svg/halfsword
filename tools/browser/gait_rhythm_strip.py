import sys
from PIL import Image, ImageDraw, ImageFont
H = sys.argv[1] if len(sys.argv) > 1 else 'docs/handoff'  # gait_rhythm_shots.mjs 가 찍은 연속 장면을 한 장으로 (전/후 두 줄, 칸마다 시각) — 시각 표는 그 실행의 OUT 줄에서
times = {
    'before': ['+0.35', '+0.40', '+0.50', '+0.55', '+0.65', '+0.75', '+0.80', '+0.90', '+0.95', 'stop+0.15', 'stop+0.35', 'stop+0.65'],
    'after': ['+0.35', '+0.40', '+0.50', '+0.55', '+0.65', '+0.75', '+0.80', '+0.90', '+0.95', 'stop+0.15', 'stop+0.32', 'stop+0.62'],
}
box = (300, 40, 660, 300)
sc = 0.62
tw, th = int((box[2] - box[0]) * sc), int((box[3] - box[1]) * sc)
pad = 22
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
except Exception:
    font = ImageFont.load_default()
rows = ['before', 'after']
W = tw * 12
out = Image.new('RGB', (W + 110, (th + pad) * 2), (24, 24, 24))
d = ImageDraw.Draw(out)
for r, mode in enumerate(rows):
    y0 = r * (th + pad)
    d.text((8, y0 + pad + th // 2 - 8), 'BEFORE' if mode == 'before' else 'AFTER', fill=(255, 220, 120), font=font)
    files = [f'{H}/gait_rhythm_{mode}_{i:02d}.png' for i in range(1, 10)] + [f'{H}/gait_rhythm_{mode}_stop_{i}.png' for i in range(1, 4)]
    for c, fn in enumerate(files):
        im = Image.open(fn).convert('RGB').crop(box).resize((tw, th))
        x = 110 + c * tw
        out.paste(im, (x, y0 + pad))
        d.text((x + 4, y0 + 3), times[mode][c] + ' s', fill=(255, 255, 255), font=font)
out.save(f'{H}/gait_rhythm_strip.png', optimize=True)
print(out.size)
