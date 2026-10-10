"""HUD 글자 색 대비 확인 (10/10 HUD 글자 체계 — docs/ui/hud_type_system_2026-10-10.md)

글자 없는 실제 게임 배경(docs/ui/hud_bg_*.png, tools/ui/hud_shots.mjs before 가 찍음)에서
하늘·모래·돌기둥·어두운 숲 같은 자리의 가운데 값을 떠서, 색 토큰마다 WCAG 대비(1:1 ~ 21:1)를 잰다.
  ① 글자색 : 맨 배경        — 외곽선 없이 얹으면 얼마나 읽히나
  ② 글자색 : 외곽선색       — 외곽선 표준(--hud-outline 의 짙은 갈색)을 두르면 글자 몸이 얼마나 서나
  ③ 외곽선색 : 맨 배경      — 외곽선이 배경에서 떨어져 보이나 (글자 윤곽)
실행: python3 tools/ui/hud_contrast.py [docs/ui]   → 표를 찍는다 (markdown)
"""
import sys
from pathlib import Path
from PIL import Image

D = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/ui')

TOKENS = {
    '--hud-guard (자세 이름, 지금 색)': '#f3e6c8',
    '--hud-guard-sub (자세 설명, 지금 색)': '#e4d8bf',
    '#B96648 (사장님 견본)': '#b96648',
    '--hud-tech (패시브·고유 동작, 제안)': '#c8714e',
    '--hud-tech-sub (꼬리표, 제안)': '#e3a382',
    '--hud-secret (비기, 제안)': '#de7c46',
    '--hud-name (캐릭터 이름)': '#f3e6c8',
    '--hud-epithet (칭호)': '#d9c9a6',
    '--hud-line (대사)': '#efe3c8',
    '--hud-sys (판 알림)': '#f3e9d8',
    '--hud-state (경직)': '#b9c7d6',
    '--hud-guide (안내)': '#e2d6bf',
    '--emo-fear': '#b9c8de',
    '--emo-anger (지금 #ff7a5c)': '#ff7a5c',
    '--emo-anger (제안)': '#f0604c',
    '--emo-obsession': '#f2c75a',
    '--emo-revive': '#fff1c8',
    # 10/10 19:2x 사장님 답 (§13): ② 패시브·비기 옅은 오렌지 후보 · ③ 경직·상태 옅은 붉은색 후보
    '② A #D5997B': '#d5997b',
    '② B #DAAE95 (기본 --hud-tech)': '#daae95',
    '② C #E0C2AE': '#e0c2ae',
    '② 둘째 줄 #E6CDBC (기본 --hud-tech-sub)': '#e6cdbc',
    '③ R1 #E48E8B (기본 --hud-state)': '#e48e8b',
    '③ R2 #E59EA3': '#e59ea3',
    '③ R3 #E58A80': '#e58a80',
    '③ 둘째 줄 #E8BCBA (기본 --hud-state-sub)': '#e8bcba',
}
OUTLINE = '#0d0907'

# 자리: (파일, x0, y0, x1, y1) — 1 = 화면 폭/높이 비율. hud_bg 는 포세이돈 신전(밝은 하늘·모래·돌기둥) — 가장 나쁜 경우
REGIONS = {
    '하늘(가로 오른쪽 위)': ('hud_bg_landscape.png', 0.70, 0.02, 0.98, 0.16),
    '모래(가로 아래)': ('hud_bg_landscape.png', 0.30, 0.62, 0.70, 0.80),
    '돌기둥(가로 오른쪽)': ('hud_bg_landscape.png', 0.88, 0.10, 0.95, 0.35),
    '하늘(세로 위)': ('hud_bg_portrait.png', 0.60, 0.02, 0.98, 0.10),
    '모래(세로 아래)': ('hud_bg_portrait.png', 0.30, 0.70, 0.70, 0.85),
}
DARK = {'바탕 #1b1410 (메뉴·카드 판)': '#1b1410', '어두운 숲(개울가 세로 왼쪽, hud_before_portrait_overlap 가운데 값)': '#262c28'}


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lum(rgb):
    def ch(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def median_rgb(file, x0, y0, x1, y1):
    im = Image.open(D / file).convert('RGB')
    w, h = im.size
    crop = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
    raw = crop.tobytes()
    px = sorted((tuple(raw[i:i + 3]) for i in range(0, len(raw), 3)), key=lum)
    return px[len(px) // 2]


bgs = {k: median_rgb(*v) for k, v in REGIONS.items()}
bgs.update({k: hex2rgb(v) for k, v in DARK.items()})
o = hex2rgb(OUTLINE)
print('| 배경 자리 | 가운데 값 | 외곽선 #0d0907 과 |')
print('|---|---|---|')
for k, c in bgs.items():
    print(f'| {k} | #{c[0]:02x}{c[1]:02x}{c[2]:02x} | {ratio(o, c):.1f} |')
print()
cols = list(bgs)
print('| 토큰 | 값 | 외곽선과 ② | ' + ' | '.join(f'{c} ①' for c in cols) + ' |')
print('|---|---|---|' + '---|' * len(cols))
for k, v in TOKENS.items():
    c = hex2rgb(v)
    print(f'| {k} | {v} | {ratio(c, o):.1f} | ' + ' | '.join(f'{ratio(c, bgs[b]):.1f}' for b in cols) + ' |')
