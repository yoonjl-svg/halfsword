"""임시 프로필 그림 만들기 — 게임 모델을 찍어 도트 프로필 꼴로 줄임 (10/23 · docs/import/wander_heroes_import_2026-10-23.md §5)

새 인물(롤랑 · 백린의 전사 · 베르나르도)에 샛별 저장소의 프로필 그림이 아직 없어서, 진짜 그림이 올 때까지 쓰는 **임시** 그림이다.
  찍기: tools/browser/portrait_temp_shots.mjs → <찍은 폴더>/<id>_black.png · <id>_white.png (768² · 얼굴 · 가슴 위 · 오른쪽 3/4 · 바탕 검정 / 흰색)
  1) 두 장의 차이로 투명도를 셈한다(바탕 검정 = 투명도 × 색 · 바탕 흰색 − 바탕 검정 = 1 − 투명도)
  2) 22 × 22 칸으로 줄인다 — 칸마다 덮인 몫이 절반 넘으면 한 색(덮인 곳의 평균색) · 아니면 투명 (우리 도트 프로필과 같은 칸 수)
  3) 밝기 · 대비 · 채도를 조금 올리고 색을 COLORS 가지로 줄인다(도트판처럼 또렷하게) — 칸 색은 칸 가운데(CORE)에서만 뽑는다
  4) 1254² 캔버스에 칸 50 px · 칸 시작 (77, 77) 로 그리고 공유 액자 1(art/portraits-px-20261018/frame1.png)을 덮는다 — 다른 프로필과 같은 꼴 · 같은 크기
  마스터 = art/portraits-temp-20261023/<id>.png · 판에 쓰는 것 = public/ui/portraits/<id>.webp (768² · portraits_px_build.py 와 같은 WebP 값)

10/24 — 세 인물 모두 샛별 저장소 손그림 확정본으로 바뀜(art/hero-profiles-20261024/ · tools/ui/portraits_px_build.py · docs/import/hero_profiles_import_2026-10-24.md).
  이 도구와 마스터는 기록으로 둔다. 판 그림(public/ui/portraits/<id>.webp)은 --public 을 붙일 때만 덮어쓴다(확정본을 잘못 덮지 않게).

실행 (저장소 뿌리에서):  python3 -I tools/ui/portraits_temp_build.py <찍은 폴더> roland white_scale bernardo [--public]
"""
import os
import sys

from PIL import Image, ImageEnhance

FRAME = 'art/portraits-px-20261018/frame1.png'
MASTER, OUT = 'art/portraits-temp-20261023', 'public/ui/portraits'
CELLS, CELL, ORIGIN, SIDE = 22, 50, 77, 768
QUALITY, ALPHA_Q, METHOD = 95, 100, 6
COLORS = 24
COVER = 0.5
CORE = 0.6


def build(shots, pid, public=False):
    black = Image.open(os.path.join(shots, pid + '_black.png')).convert('RGB')
    white = Image.open(os.path.join(shots, pid + '_white.png')).convert('RGB')
    w, h = black.size
    bp, wp = black.load(), white.load()
    n = w / CELLS
    cells = {}
    for cy in range(CELLS):
        for cx in range(CELLS):
            x0, x1, y0, y1 = int(cx * n), int((cx + 1) * n), int(cy * n), int((cy + 1) * n)
            # 덮인 몫은 칸 전체에서 · 색은 칸 가운데(CORE)에서만 — 이웃 칸 색이 섞여 흐려지지 않게(눈 · 면갑 틈 같은 작은 꼴을 살림)
            ix0, ix1 = x0 + int((x1 - x0) * (1 - CORE) / 2), x1 - int((x1 - x0) * (1 - CORE) / 2)
            iy0, iy1 = y0 + int((y1 - y0) * (1 - CORE) / 2), y1 - int((y1 - y0) * (1 - CORE) / 2)
            a_sum, a_core, c_sum, count = 0.0, 0.0, [0.0, 0.0, 0.0], 0
            for y in range(y0, y1):
                for x in range(x0, x1):
                    b, wh = bp[x, y], wp[x, y]
                    a = 1 - sum(wh[i] - b[i] for i in range(3)) / (3 * 255)
                    a = min(1.0, max(0.0, a))
                    a_sum += a
                    count += 1
                    if ix0 <= x < ix1 and iy0 <= y < iy1:
                        a_core += a
                        for i in range(3):
                            c_sum[i] += b[i]  # 바탕 검정 = 투명도 × 색 (미리 곱한 색)
            cover = a_sum / count
            if cover >= COVER and a_core > 0:
                cells[(cx, cy)] = tuple(min(255, round(c / a_core)) for c in c_sum)
    # 색 줄이기 · 대비
    small = Image.new('RGB', (CELLS, CELLS), (0, 0, 0))
    for (cx, cy), c in cells.items():
        small.putpixel((cx, cy), c)
    small = ImageEnhance.Brightness(small).enhance(1.15)
    small = ImageEnhance.Contrast(small).enhance(1.3)
    small = ImageEnhance.Color(small).enhance(1.35)
    small = small.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT).convert('RGB')
    canvas = Image.new('RGBA', (1254, 1254), (0, 0, 0, 0))
    for (cx, cy) in cells:
        c = small.getpixel((cx, cy))
        canvas.paste((*c, 255), (ORIGIN + cx * CELL, ORIGIN + cy * CELL, ORIGIN + (cx + 1) * CELL, ORIGIN + (cy + 1) * CELL))
    canvas.alpha_composite(Image.open(FRAME).convert('RGBA'))
    os.makedirs(MASTER, exist_ok=True)
    canvas.save(os.path.join(MASTER, pid + '.png'), optimize=True)
    if public:
        canvas.resize((SIDE, SIDE), Image.LANCZOS).save(os.path.join(OUT, pid + '.webp'), 'WEBP', quality=QUALITY, alpha_quality=ALPHA_Q, method=METHOD)
    print(pid, '칸', len(cells), '/', CELLS * CELLS)


def main():
    args = [a for a in sys.argv[1:] if a != '--public']
    shots, ids, public = args[0], args[1:], '--public' in sys.argv[1:]
    for pid in ids:
        build(shots, pid, public)


if __name__ == '__main__':
    main()
