# 아이템 그림 사진 판 (docs/import/item_art_2026-10-16.md) — 두 가지
#  1) 장면 맞대기: itemart_capture.mjs 가 찍은 전(바탕 판) · 후 사진을 자리(rects.json)대로 잘라 나란히 → <out>/itemart_<장면>.webp
#       python3 tools/browser/itemart_sheet.py scenes <전 폴더> <후 폴더> docs/handoff
#     + 유파 다섯 별자리 판(후만 — 문서 꼴 다섯) → itemart_tree_schools.webp · 설명 카드는 독일 전 · 후 + 일본 후
#  2) 그림 판: 스킬북 25 장 + 금화 + 머리를 원래 크기(256 × 336 — 테두리 선 = 그림 틀, 아래 숫자 = 투명 여백 px)와
#     실제 화면 크기(폰 화소 비 3: 책 칸 32 × 42 css = 96 × 126 · 안 산 책 = 어둡게 · 설명 카드 26 × 34 · 금화 · 머리 20 / 14 / 9 css)로 → <out.webp>
#     [전 그림 폴더]를 주면 맨 아래에 전(책 꼴 + 급 숫자) 25 장을 실제 크기로 한 띠 더
#       python3 tools/browser/itemart_sheet.py sheet public/ui docs/handoff/itemart_sheet.webp [전 그림 폴더 — <폴더>/books/<유파>_<급>.webp]
#  글자는 PIL 기본 글꼴(라틴)만 쓴다 — 한글 글꼴이 없는 곳에서도 돌게
import json, os, sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese']
ROMAN = ['', 'I', 'II', 'III', 'IV', 'V']
DPR = 3
FG, SUB, LINE = (243, 233, 216), (176, 160, 136), (107, 90, 68)


def font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # 옛 Pillow
        return ImageFont.load_default()


def alpha_pad(im):
    """보이는 화소(알파 > 8)의 상자와 그림 가장자리 사이 가장 좁은 곳 (px)"""
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if not box:
        return 0
    return min(box[0], box[1], im.width - box[2], im.height - box[3])


def crop(path, rect, pad=0):
    im = Image.open(path).convert('RGB')
    x, y, w, h = rect
    return im.crop((round((x - pad) * DPR), round((y - pad) * DPR), round((x + w + pad) * DPR), round((y + h + pad) * DPR)))


def side_by_side(a, b, la, lb, gap=24):
    f = font(30)
    top = 46
    out = Image.new('RGB', (a.width + b.width + gap, max(a.height, b.height) + top), (20, 15, 11))
    out.paste(a, (0, top))
    out.paste(b, (a.width + gap, top))
    d = ImageDraw.Draw(out)
    d.text((6, 8), la, fill=SUB, font=f)
    d.text((a.width + gap + 6, 8), lb, fill=FG, font=f)
    return out


def scenes(before, after, out):
    rb = json.load(open(os.path.join(before, 'rects.json')))['rects']
    ra = json.load(open(os.path.join(after, 'rects.json')))['rects']
    la, lb = 'before (5b3ac43 - pixel)', 'after (smooth 3D)'
    saved = []
    for scene, key, pad in [('tree', 'tree', 0), ('result', 'result', 0)]:
        img = side_by_side(crop(f'{before}/{scene}.png', rb[key], pad), crop(f'{after}/{scene}.png', ra[key], pad), la, lb)
        saved.append(save(img, os.path.join(out, f'itemart_{scene}.webp')))
    # 설명 카드: 독일 III 전 · 후 + 일본 III 후 (두루마리 · 제목 쪽지)
    saved.append(save(row([crop(f'{before}/detail.png', rb['detail']), crop(f'{after}/detail.png', ra['detail']), crop(f'{after}/detail_japanese.png', ra['detail_japanese'])],
                          [la + ' german III', 'after german III', 'after japanese III']), os.path.join(out, 'itemart_detail.webp')))
    # 유파 다섯 별자리 판 (후 — I · III 사용 · II 봉인 · IV · V 안 삼)
    keys = ['tree', 'tree_italian', 'tree_iberian', 'tree_japanese', 'tree_chinese']
    saved.append(save(row([crop(f'{after}/{k}.png', ra[k]) for k in keys], ['german (Fechtbuch)', 'italian (leaves)', 'iberian (vellum roll + seal)', 'japanese (Gorin scroll)', 'chinese (bamboo slips)']),
                      os.path.join(out, 'itemart_tree_schools.webp')))
    # 대기실 지갑: 내 정보 칸(금화 · 머리 18~20 px) + 스킬북 칸 머리(14 px) — 위아래 두 줄
    def wallet(d, r):
        w = r['wallet']
        a = crop(f'{d}/wallet.png', [w[0] - 14, w[1] - 52, w[2] + 28, w[3] + 92])
        p = r['panelWallet']
        b = crop(f'{d}/tree.png', [p[0] - 10, p[1] - 8, p[2] + 20, p[3] + 16])
        o = Image.new('RGB', (max(a.width, b.width), a.height + b.height + 12), (20, 15, 11))
        o.paste(a, (0, 0))
        o.paste(b, (0, a.height + 12))
        return o
    saved.append(save(side_by_side(wallet(before, rb), wallet(after, ra), la, lb), os.path.join(out, 'itemart_wallet.webp')))
    return saved


def row(ims, labels, gap=24):
    f = font(30)
    top = 46
    out = Image.new('RGB', (sum(i.width for i in ims) + gap * (len(ims) - 1), max(i.height for i in ims) + top), (20, 15, 11))
    d = ImageDraw.Draw(out)
    x = 0
    for k, (im, lab) in enumerate(zip(ims, labels)):
        out.paste(im, (x, top))
        d.text((x + 6, 8), lab, fill=SUB if lab.startswith('before') else FG, font=f)
        x += im.width + gap
    return out


def save(img, path, q=82):
    img.save(path, 'WEBP', quality=q, method=6)
    print(f'{path}  {img.width}x{img.height}  {os.path.getsize(path) / 1024:.0f} KB')
    return path


def sheet(ui, out, before=None):
    f, fs, fb = font(17), font(14), font(26)
    BW, BH, G = 256, 336, 12
    LX, TOP = 110, 96
    native_w = LX + 5 * (BW + G)
    right_x = native_w + 20
    W = right_x + BW + 40
    band_y = TOP + 5 * (BH + 40) + 30
    RB, RD = (32 * DPR, 42 * DPR), (26 * DPR, 34 * DPR)
    H = band_y + 60 + 5 * (RB[1] + 22) + 20
    before_y = H + 10
    if before:
        H = before_y + 50 + 5 * (RB[1] + 22) + 10
    img = Image.new('RGBA', (W, H), (27, 20, 16, 255))
    d = ImageDraw.Draw(img)
    d.text((16, 14), 'Skill pictures 25 + coins + pouch  (2026-10-16)  -  native 256 x 336: outline = image frame, number = transparent padding px (>= 4)', fill=FG, font=f)
    d.text((16, 40), 'Rows: german (leather Fechtbuch) / italian (loose illustrated leaves, ribbon) / iberian (rolled vellum, wax seal) / japanese (Gorin-no-sho scroll: earth water fire wind void) / chinese (bamboo slips).  Columns: tier I..V = volume + tie colour only (no numerals).', fill=SUB, font=fs)
    for t in range(1, 6):
        d.text((LX + (t - 1) * (BW + G) + BW // 2 - 10, TOP - 26), ROMAN[t], fill=FG, font=fb)
    worst = 999
    for r, s in enumerate(SCHOOLS):
        y = TOP + r * (BH + 40)
        d.text((14, y + BH // 2 - 10), s, fill=FG, font=f)
        for t in range(1, 6):
            x = LX + (t - 1) * (BW + G)
            im = Image.open(f'{ui}/books/{s}_{t}.webp').convert('RGBA')
            img.alpha_composite(im, (x, y))
            d.rectangle((x - 1, y - 1, x + BW, y + BH), outline=LINE)
            p = alpha_pad(im)
            worst = min(worst, p)
            d.text((x + 2, y + BH + 4), f'pad {p}px', fill=SUB, font=fs)
    # 금화 · 머리 (원래 크기 + 실제 크기)
    y = TOP
    for name, label in [('coins', 'coins'), ('pouch', 'pouch (heads)')]:
        im = Image.open(f'{ui}/wallet/{name}.webp').convert('RGBA')
        d.text((right_x, y - 24), label, fill=FG, font=f)
        img.alpha_composite(im, (right_x, y))
        d.rectangle((right_x - 1, y - 1, right_x + 256, y + 256), outline=LINE)
        d.text((right_x + 2, y + 260), f'pad {alpha_pad(im)}px   real size: 20 / 14 / 9 css', fill=SUB, font=fs)
        xx = right_x
        for css in (20, 14, 9):
            px = css * DPR
            img.alpha_composite(im.resize((px, px), Image.LANCZOS), (xx, y + 284 + (60 - px)))
            xx += px + 14
        y += 400
    # 실제 화면 크기 띠 (폰 화소 비 3): 별자리 판 책 칸 · 안 산 책(어둡게 — lobby.css grayscale(1) brightness(.42)) · 설명 카드
    d.rectangle((0, band_y - 10, W, H), fill=(33, 26, 18))
    d.text((16, band_y), 'Real size on phone (DPR 3): board thumb 32x42 css  |  unowned (grayscale + brightness .42)  |  detail card 26x34 css', fill=FG, font=f)
    for r, s in enumerate(SCHOOLS):
        y = band_y + 40 + r * (RB[1] + 22)
        d.text((14, y + RB[1] // 2 - 10), s, fill=SUB, font=fs)
        x = LX
        for t in range(1, 6):
            im = Image.open(f'{ui}/books/{s}_{t}.webp').convert('RGBA')
            small = im.resize(RB, Image.LANCZOS)
            img.alpha_composite(small, (x + (t - 1) * (RB[0] + 10), y))
            gray = ImageEnhance.Brightness(ImageOps.grayscale(small.convert('RGB')).convert('RGB')).enhance(0.42).convert('RGBA')
            gray.putalpha(small.getchannel('A'))
            img.alpha_composite(gray, (x + 5 * (RB[0] + 10) + 30 + (t - 1) * (RB[0] + 10), y))
            img.alpha_composite(im.resize(RD, Image.LANCZOS), (x + 10 * (RB[0] + 10) + 60 + (t - 1) * (RD[0] + 10), y + (RB[1] - RD[1]) // 2))
    if before:  # 전 (앞 작업 — 책 꼴 + 급 숫자) 실제 크기 띠
        d.rectangle((0, before_y - 6, W, H), fill=(24, 19, 14))
        d.text((16, before_y + 4), 'Before (previous pass 93d4274 - all books, Roman numerals): real size, board thumb 32x42 css', fill=SUB, font=f)
        for r, s in enumerate(SCHOOLS):
            y = before_y + 44 + r * (RB[1] + 22)
            d.text((14, y + RB[1] // 2 - 10), s, fill=SUB, font=fs)
            for t in range(1, 6):
                im = Image.open(f'{before}/books/{s}_{t}.webp').convert('RGBA')
                img.alpha_composite(im.resize(RB, Image.LANCZOS), (LX + (t - 1) * (RB[0] + 10), y))
    save(img.convert('RGB'), out, q=80)
    print(f'smallest transparent padding: {worst}px')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'scenes':
        scenes(*sys.argv[2:5])
    elif cmd == 'sheet':
        sheet(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)  # 넷째 = 전 그림 폴더 (없으면 띠 없음)
    else:
        print(__doc__ or 'usage: itemart_sheet.py scenes <before> <after> <out> | sheet <public/ui> <out.webp> [log]')
