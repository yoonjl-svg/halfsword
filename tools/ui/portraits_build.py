"""캐릭터 프로필 그림 만들기 (docs/import/portraits_2026-10-17.md §3) — 원본 마스터 → 판에 쓰는 768² WebP · 마스터 출처 메타데이터 빼기 · 액자 1 조각

실행 (저장소 뿌리에서):
  python3 -I tools/ui/portraits_build.py webp  [마스터 폴더] [내보낼 폴더]   기본 art/portraits-frame1-20261017 → public/ui/portraits
      1254² 원본 → 768² (PIL LANCZOS) → WebP 품질 88 · method 6 (손실 · 메타데이터 없음). 같은 PIL/libwebp 면 같은 바이트.
  python3 -I tools/ui/portraits_build.py strip [PNG …]                      PNG 에서 caBX 덩어리(C2PA 출처 메타데이터)만 뺀다 — 화소 · IDAT 그대로(풀어 견줌)
  python3 -I tools/ui/portraits_build.py frame [내보낼 파일]                  기본 public/ui/px_frame1.png — 액자 1 9 조각(16 × 16 · 조각 7 px · 가운데 투명)
"""
import io
import os
import struct
import sys

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


if __name__ == '__main__':
    cmd, args = (sys.argv[1] if len(sys.argv) > 1 else ''), sys.argv[2:]
    if cmd == 'webp':
        webp(*args[:2])
    elif cmd == 'strip':
        strip(args)
    elif cmd == 'frame':
        frame(*args[:1])
    else:
        print(__doc__)
