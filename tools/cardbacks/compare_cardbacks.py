"""픽셀 카드 뒷면 비교 그림: 테마마다 index.html 의 #draw[data-back="px"] 와 같은 방식으로 한 장을 짜 맞춰 나란히 키워 놓는다.

  python3 tools/cardbacks/compare_cardbacks.py <출력.png> <줄 정의> [<줄 정의> ...]
    줄 정의 = '<제목>=<폴더>:<테마>,<테마>,...'  (폴더 안의 px_<테마>_{tile,frame,center,plaque}.png 를 읽는다)
  예) python3 tools/cardbacks/compare_cardbacks.py docs/handoff/cardbacks_compare.png \
        'existing=public/ui/cardbacks:castle,cathedral,temple,poseidon_night' 'new=public/ui/cardbacks:loggia,corsair,sacred_grove'

짜 맞추는 법(CSS 와 같게): 바탕 조각을 카드 가운데 기준으로 반복 → 위·아래 가운데에서 3칸 들어간 자리에 원판 → 가운데 장식 →
테두리(9조각, 폭 7칸, 띠는 가운데 기준 반복). 카드는 56×84 칸, 한 칸 = 4 화소. PIL(Pillow) 이 필요하다(개발 도구).
"""
import os
import sys
from PIL import Image, ImageDraw

CW, CH, S = 56, 84, 4  # PC·가로 폰의 흔한 카드: 224×336 CSS px, 한 칸 4 px (main.js 카드 크기 계산)


def card(folder, theme):
    load = lambda part: Image.open(os.path.join(folder, f'px_{theme}_{part}.png')).convert('RGBA')
    tile, frame, center, plaque = load('tile'), load('frame'), load('center'), load('plaque')
    c = Image.new('RGBA', (CW, CH), (0, 0, 0, 255))
    ox, oy = (CW // 2 - tile.width // 2) % tile.width - tile.width, (CH // 2 - tile.height // 2) % tile.height - tile.height
    for y in range(oy, CH, tile.height):
        for x in range(ox, CW, tile.width):
            c.alpha_composite(tile, (x, y)) if x >= 0 and y >= 0 else c.paste(tile, (x, y), tile)
    c.paste(plaque, ((CW - plaque.width) // 2, 3), plaque)
    c.paste(plaque, ((CW - plaque.width) // 2, CH - 3 - plaque.height), plaque)
    c.paste(center, ((CW - center.width) // 2, (CH - center.height) // 2), center)
    B, n = 7, frame.width
    m = n - 2 * B
    corners = [((0, 0), (0, 0)), ((n - B, 0), (CW - B, 0)), ((0, n - B), (0, CH - B)), ((n - B, n - B), (CW - B, CH - B))]
    for (sx, sy), (dx, dy) in corners:
        c.paste(frame.crop((sx, sy, sx + B, sy + B)), (dx, dy))
    top, bot = frame.crop((B, 0, B + m, B)), frame.crop((B, n - B, B + m, n))
    left, right = frame.crop((0, B, B, B + m)), frame.crop((n - B, B, n, B + m))
    span_x, span_y = CW - 2 * B, CH - 2 * B
    x = B + ((span_x - m) // 2) % m - m
    while x < CW - B:
        l, r = max(0, B - x), min(m, CW - B - x)
        if r > l:
            c.paste(top.crop((l, 0, r, B)), (x + l, 0))
            c.paste(bot.crop((l, 0, r, B)), (x + l, CH - B))
        x += m
    y = B + ((span_y - m) // 2) % m - m
    while y < CH - B:
        t, b = max(0, B - y), min(m, CH - B - y)
        if b > t:
            c.paste(left.crop((0, t, B, b)), (0, y + t))
            c.paste(right.crop((0, t, B, b)), (CW - B, y + t))
        y += m
    return c.resize((CW * S, CH * S), Image.NEAREST)


def main():
    out, rows = sys.argv[1], []
    for spec in sys.argv[2:]:
        title, rest = spec.split('=', 1)
        folder, themes = rest.split(':', 1)
        rows.append((title, [(folder, t) for t in themes.split(',')]))
    gap, label = 16, 18
    cols = max(len(r[1]) for r in rows)
    W = cols * (CW * S + gap) + gap
    H = len(rows) * (CH * S + gap + label * 2) + gap
    img = Image.new('RGB', (W, H), (34, 30, 28))
    d = ImageDraw.Draw(img)
    y = gap
    for title, cards in rows:
        d.text((gap, y), title, fill=(230, 220, 200))
        y += label
        for i, (folder, theme) in enumerate(cards):
            x = gap + i * (CW * S + gap)
            img.paste(card(folder, theme).convert('RGB'), (x, y))
            d.text((x, y + CH * S + 2), theme, fill=(200, 190, 170))
        y += CH * S + gap + label
    img.save(out)
    print(out, img.size)


if __name__ == '__main__':
    main()
