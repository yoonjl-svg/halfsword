"""캐릭터 프로필 그림 만들기 (docs/import/portraits_2026-10-17.md §3) — 원본 마스터 → 판에 쓰는 768² WebP · 마스터 출처 메타데이터 빼기 · 액자 1 조각

실행 (저장소 뿌리에서):
  python3 -I tools/ui/portraits_build.py webp  [마스터 폴더] [내보낼 폴더]   기본 art/portraits-frame1-20261017 → public/ui/portraits
      1254² 원본 → 768² (PIL LANCZOS) → WebP 품질 88 · method 6 (손실 · 메타데이터 없음). 같은 PIL/libwebp 면 같은 바이트.
  python3 -I tools/ui/portraits_build.py strip [PNG …]                      PNG 에서 caBX 덩어리(C2PA 출처 메타데이터)만 뺀다 — 화소 · IDAT 그대로(풀어 견줌)
  python3 -I tools/ui/portraits_build.py frame [내보낼 파일]                  기본 public/ui/px_frame1.png — 액자 1 9 조각(16 × 16 · 조각 7 px · 가운데 투명) — 10/18 01:2x 부터 대기실은 안 씀
  python3 -I tools/ui/portraits_build.py frame-portrait [원본] [내보낼 파일]   기본 art/…/player.png → public/ui/frame1_portrait.png — 프로필 그림 속 액자 1 을 잘라 만든 9 조각
      (조각 122 px · 곧은 띠 79 px · 띠 안쪽 투명 · 252 × 252) — 대기실 재고 · 별자리 틀이 프로필과 같은 비(표시 폭 ÷ 1254)로 쓴다 (docs/design/portrait_ui_2026-10-17.md §2)
"""
import io
import os
import struct
import sys
from collections import deque

import numpy as np
from PIL import Image

SIDE, QUALITY, METHOD = 768, 88, 6


def webp(src='art/portraits-frame1-20261017', out='public/ui/portraits'):
    os.makedirs(out, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not f.endswith('.png'):
            continue
        im = Image.open(os.path.join(src, f)).convert('RGB')
        assert im.size == (1254, 1254), (f, im.size)
        dst = os.path.join(out, f[:-4] + '.webp')
        im.resize((SIDE, SIDE), Image.LANCZOS).save(dst, 'WEBP', quality=QUALITY, method=METHOD)
        print(dst, os.path.getsize(dst))


def strip(paths):
    for p in paths:
        b = open(p, 'rb').read()
        assert b[:8] == b'\x89PNG\r\n\x1a\n', p
        i, keep, removed = 8, [b[:8]], 0
        while i < len(b):
            n = struct.unpack('>I', b[i:i + 4])[0]
            if b[i + 4:i + 8] == b'caBX':
                removed += 1
            else:
                keep.append(b[i:i + 12 + n])
            i += 12 + n
        nb = b''.join(keep)
        if removed:
            same = Image.open(io.BytesIO(b)).convert('RGBA').tobytes() == Image.open(io.BytesIO(nb)).convert('RGBA').tobytes()
            assert same, p
            open(p, 'wb').write(nb)
        print(p, 'removed', removed, len(b), '->', len(nb))


# 액자 1: 시안(샛별 저장소 26670942 frame-samples.png 첫 칸)의 색을 뽑아 7 px 조각으로 다시 그림 — 바깥부터 어두운 테 · 금색 줄 2 · 어두운 틈 2 · 옅은 금색 줄 · 갈색 그늘
FRAME_COLORS = {
    'o': (31, 24, 19), 'L': (236, 208, 143), 'M': (194, 162, 106), 'D': (155, 120, 81), 'c': (94, 67, 48), 'h': (245, 223, 168),
    'g': (228, 197, 135), 'G': (201, 167, 108), 'k': (29, 22, 18), 'K': (43, 33, 26), 'p': (217, 191, 136), 'b': (93, 65, 40),
}
STUD = ['ooooooo', 'oLLLLLo', 'oMhccDo', 'oMcccDo', 'oMcccDo', 'oDDDDDo', 'ooooooo']  # 네 모서리 네모 장식 (빛은 왼쪽 위)
EDGE = 'ogGkKpb'  # 바깥 → 안


def frame(out='public/ui/px_frame1.png'):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    put = lambda x, y, ch: im.putpixel((x, y), FRAME_COLORS[ch] + (255,))
    for ox, oy in [(0, 0), (9, 0), (0, 9), (9, 9)]:
        for y in range(7):
            for x in range(7):
                put(ox + x, oy + y, STUD[y][x])
    for a in (7, 8):
        for i, ch in enumerate(EDGE):
            put(a, i, ch); put(a, 15 - i, ch); put(i, a, ch); put(15 - i, a, ch)
    im.save(out, optimize=True)
    print(out, os.path.getsize(out))


# 프로필 그림 속 액자 1 그대로 (사장님 10/18 01:2x '3단쪽에 액자 두께가 다르네. 프로필과 똑같아야지'): 플레이어 원본(1254²)의 액자 띠를 잘라 9 조각으로.
#  곧은 띠 FB = 79 px(어두운 바깥 띠 50 · 금색 줄 8 · 어두운 틈 8 · 금색 줄 7 · 안쪽 어두운 선 5 — 네 변 같음) · 모서리 안쪽 계단 장식이 121 px 까지라 조각 FT = 122 px.
#  모서리 넷 = 그 모서리의 실제 화소(빛 방향이 그림과 같다) · 내용 가림 = 왼쪽 위 모서리에서 밝은 바탕을 채워 찾은 모양을 좌우 · 위아래로 뒤집어 씀(액자는 대칭) ·
#  변 넷 = 그 변의 곧은 띠를 길이 방향 가운데값으로(한 줄 = 한 색 — 곧고 고르게) · 띠 안쪽(그림 내용)은 투명.
FT, FB, EDGE_LEN = 122, 79, 8


def _content_mask(block, seed):
    r, g, b = (block[..., i].astype(int) for i in range(3))
    light = (0.299 * r + 0.587 * g + 0.114 * b > 165) & ((r - b) < 55)
    m = np.zeros(block.shape[:2], bool)
    q = deque([seed]); m[seed] = True
    while q:
        y, x = q.popleft()
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < m.shape[0] and 0 <= xx < m.shape[1] and not m[yy, xx] and light[yy, xx]:
                m[yy, xx] = True; q.append((yy, xx))
    return m


def frame_portrait(src='art/portraits-frame1-20261017/player.png', out='public/ui/frame1_portrait.png'):
    a = np.asarray(Image.open(src).convert('RGB'))
    n = a.shape[0]
    assert a.shape[:2] == (1254, 1254), a.shape
    m = _content_mask(a[:FT + 48, :FT + 48], (FT + 40, FT + 40))[:FT, :FT]  # 왼쪽 위 모서리의 내용(밝은 바탕)
    S = 2 * FT + EDGE_LEN
    img = np.zeros((S, S, 4), np.uint8)
    corners = {(0, 0): (a[:FT, :FT], m), (0, 1): (a[:FT, n - FT:], m[:, ::-1]), (1, 0): (a[n - FT:, :FT], m[::-1, :]), (1, 1): (a[n - FT:, n - FT:], m[::-1, ::-1])}
    for (cy, cx), (px, mask) in corners.items():
        oy, ox = cy * (FT + EDGE_LEN), cx * (FT + EDGE_LEN)
        img[oy:oy + FT, ox:ox + FT, :3] = px
        img[oy:oy + FT, ox:ox + FT, 3] = np.where(mask, 0, 255)
    lo, hi = 250, n - 250
    top = np.median(a[:FT, lo:hi], axis=1).astype(np.uint8)            # (FT, 3) — 줄마다 가운데값
    bottom = np.median(a[n - FT:, lo:hi], axis=1).astype(np.uint8)
    left = np.median(a[lo:hi, :FT], axis=0).astype(np.uint8)            # (FT, 3) — 칸마다
    right = np.median(a[lo:hi, n - FT:], axis=0).astype(np.uint8)
    band = np.arange(FT)
    for k in range(FT, FT + EDGE_LEN):
        img[:FT, k, :3] = top; img[:FT, k, 3] = np.where(band < FB, 255, 0)
        img[FT + EDGE_LEN:, k, :3] = bottom; img[FT + EDGE_LEN:, k, 3] = np.where(band >= FT - FB, 255, 0)
        img[k, :FT, :3] = left; img[k, :FT, 3] = np.where(band < FB, 255, 0)
        img[k, FT + EDGE_LEN:, :3] = right; img[k, FT + EDGE_LEN:, 3] = np.where(band >= FT - FB, 255, 0)
    Image.fromarray(img, 'RGBA').save(out, optimize=True)
    print(out, os.path.getsize(out), f'{S}x{S} slice {FT} band {FB}')


if __name__ == '__main__':
    cmd, args = (sys.argv[1] if len(sys.argv) > 1 else ''), sys.argv[2:]
    if cmd == 'webp':
        webp(*args[:2])
    elif cmd == 'strip':
        strip(args)
    elif cmd == 'frame':
        frame(*args[:1])
    elif cmd == 'frame-portrait':
        frame_portrait(*args[:2])
    else:
        print(__doc__)
