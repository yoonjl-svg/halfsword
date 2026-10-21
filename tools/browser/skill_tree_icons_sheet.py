# 스킬트리 칸 그림 사진 판 (10/22 — docs/design/skill_tree_2026-10-21/IMPLEMENTATION.md §8) — 셋
#  1) 유파 판: skill_tree_layout.mjs 가 SHOTS 폴더에 찍은 사진(844 × 390 · 844 × 340 · 기기 화소 비 2)을 스킬 창 자리(rects.json)대로 잘라
#     [판 위 · 끝까지 내린 판 · 상세 카드] 를 한 줄로 → <out>/tree_<유파>_<화면>.png · 초기화 확인 → <out>/reset_confirm_<화면>.png
#  2) 간격 전후: [전 폴더]/before_<유파>_844x390.png (전 판 — 기기 화소 비 1 · 같은 자리) 와 후 판 위 사진을 유파 다섯 줄로 → <out>/spacing_before_after_<화면>.png
#  3) 그림 판: public/ui/books 의 유파마다 일곱 장(보법 1 · 막기 2 · 고유 공격 3 · 심화 deep · 패시브 4 · 비기 5 · 편지 letter)을 큰 꼴 + 칸 크기(21 × 28)로 → <out>/icons_sheet.png
#  모두 256 색 PNG (크기를 줄임). 글자는 한글 글꼴(WenQuanYi Zen Hei)이 있으면 그것, 없으면 라틴 기본 글꼴
#   python3 tools/browser/skill_tree_icons_sheet.py <SHOTS 폴더> docs/design/skill_tree_2026-10-21/icons [전 폴더]
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese']
KO = {'german': '독일', 'italian': '이탈리아', 'iberian': '이베리아', 'japanese': '일본', 'chinese': '동방'}
DETAIL = {'german': 'G7', 'italian': 'I11', 'iberian': 'B4', 'japanese': 'J8', 'chinese': 'C3'}  # skill_tree_layout.mjs DETAIL 과 같게
ART = [('1', '보법'), ('2', '막기'), ('3', '고유 공격'), ('deep', '심화 (새)'), ('4', '패시브'), ('5', '비기'), ('letter', '편지 (새)')]
BG, FG, SUB = (20, 15, 11), (243, 233, 216), (176, 160, 136)


def font(size):
    for f in ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def save(img, path):
    img.convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path, optimize=True)
    print(f'{path}  {img.width}×{img.height}  {os.path.getsize(path) / 1024:.0f} KB')


def crop(path, rect, k):
    x, y, w, h = rect
    return Image.open(path).convert('RGB').crop((round(x * k), round(y * k), round((x + w) * k), round((y + h) * k)))


def row(ims, gap=12, top=0, labels=None):
    f = font(26)
    W = sum(i.width for i in ims) + gap * (len(ims) - 1)
    out = Image.new('RGB', (W, max(i.height for i in ims) + top), BG)
    x = 0
    for n, i in enumerate(ims):
        out.paste(i, (x, top))
        if labels:
            ImageDraw.Draw(out).text((x + 8, 6), labels[n], fill=SUB if n == 0 and len(ims) == 2 else FG, font=f)
        x += i.width + gap
    return out


def boards(shots, out):
    rects = json.load(open(os.path.join(shots, 'rects.json')))
    for size, rect in rects.items():
        for s in SCHOOLS:
            ims = [crop(os.path.join(shots, f), rect, 2) for f in (f'tree_{s}_{size}.png', f'tree_{s}_end_{size}.png', f'detail_{s}_{DETAIL[s]}_{size}.png')]
            save(row(ims), os.path.join(out, f'tree_{s}_{size}.png'))
        rc = os.path.join(shots, f'reset_confirm_german_{size}.png')  # 초기화 확인 (단추 높이 40)
        if os.path.exists(rc):
            save(crop(rc, rect, 2), os.path.join(out, f'reset_confirm_{size}.png'))


def spacing(shots, before, out):
    rects = json.load(open(os.path.join(shots, 'rects.json')))
    for size, rect in rects.items():
        lines = []
        for s in SCHOOLS:
            b = os.path.join(before, f'before_{s}_{size}.png')
            if not os.path.exists(b):
                continue
            pre = crop(b, rect, 1)
            post = crop(os.path.join(shots, f'tree_{s}_{size}.png'), rect, 2).resize(pre.size, Image.LANCZOS)
            lines.append(row([pre, post], top=40, labels=[f'{KO[s]} — 전 (10/21)', f'{KO[s]} — 후 (10/22)']))
        if lines:
            W, H = max(l.width for l in lines), sum(l.height for l in lines) + 10 * (len(lines) - 1)
            sheet, y = Image.new('RGB', (W, H), BG), 0
            for l in lines:
                sheet.paste(l, (0, y)); y += l.height + 10
            save(sheet, os.path.join(out, f'spacing_before_after_{size}.png'))


def icons(out):
    books = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'ui', 'books')
    cw, ch, lab, head = 128, 168, 120, 44
    f, fs = font(22), font(18)
    sheet = Image.new('RGBA', (lab + cw * len(ART), head + (ch + 40) * len(SCHOOLS)), BG + (255,))
    d = ImageDraw.Draw(sheet)
    for c, (k, name) in enumerate(ART):
        d.text((lab + c * cw + 8, 10), name, fill=FG if '새' in name else SUB, font=fs)
    for r, s in enumerate(SCHOOLS):
        y = head + r * (ch + 40)
        d.text((10, y + ch // 2 - 12), KO[s], fill=FG, font=f)
        for c, (k, _) in enumerate(ART):
            im = Image.open(os.path.join(books, f'{s}_{k}.webp')).convert('RGBA')
            sheet.alpha_composite(im.resize((cw, ch), Image.LANCZOS), (lab + c * cw, y))
            sheet.alpha_composite(im.resize((21, 28), Image.LANCZOS), (lab + c * cw + cw // 2 - 10, y + ch + 6))
    save(sheet, os.path.join(out, 'icons_sheet.png'))


if __name__ == '__main__':
    shots, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    boards(shots, out)
    if len(sys.argv) > 3:
        spacing(shots, sys.argv[3], out)
    icons(out)
