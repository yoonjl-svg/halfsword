"""손님 인물 셋 프로필 확정본 검사 (10/24 — docs/import/hero_profiles_import_2026-10-24.md)

샛별 저장소 전달본(0aef88d4)에 든 검사 도구의 검사를 우리 경로 · 우리 id 로 옮겨 쓴 것 — 그림 · 게임 파일을 바꾸지 않고 읽기만 한다.
  1) manifest.json 의 파일마다 sha256 · 바이트 수 (그림 9 장 · sprites.json · 공유 액자 1 · 게임 WebP 3 장)
  2) 그림 9 장 = 1254² RGBA · sprites.json 칸 22 × 22 · 칸 투명도는 0 / 255 뿐
  3) low.png = sprites.json 칸 색을 칸 50 px · 칸 시작 (77, 77) 로 키워 그린 뒤 액자 1 을 덮은 그림과 픽셀이 같다
     grid.png = low.png 위에 칸 줄(23 줄 · 2 px · (141, 216, 221, 122) · 액자 자리는 뺌)을 덮은 그림과 같다
     original.png 의 액자 자리(액자 투명도 255)는 액자 1 과 같다
  4) 베르나르도 지정 눈끝 두 칸 (13, 7) · (16, 8) = #4F3829 (칸 자료 · low.png 칸 가운데 둘 다)
  5) 게임 파일 public/ui/portraits/<id>.webp = low.png 를 768² LANCZOS · WebP 품질 95 · 투명도 품질 100 · method 6 으로 줄인 바이트와 같다(Pillow 12.3 · libwebp 1.6 에서 잼)
  6) src/portraits.js — 세 id 가 손님 인물 표(GUEST_IDS)에 있고 임시 그림 표(TEMP_IDS)에는 없다 · 옛 임시 마스터는 기록으로 남아 있다

실행 (저장소 뿌리에서):  python3 -I tools/ui/hero_profiles_verify.py
"""
import hashlib
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'art/hero-profiles-20261024'
CANVAS, CELLS, CELL, ORIGIN, SIDE = 1254, 22, 50, 77, 768


def check_file(rec):
    p = ROOT / rec['path']
    data = p.read_bytes()
    assert hashlib.sha256(data).hexdigest() == rec['sha256'], ('sha256', rec['path'])
    assert len(data) == rec['bytes'], ('bytes', rec['path'])
    return p


def main():
    manifest = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
    spec = json.loads((ART / 'sprites.json').read_text(encoding='utf-8'))
    files = [manifest['frame'], manifest['sprites']]
    for char in manifest['characters']:
        files += list(char['files'].values()) + [char['game']]
    for rec in files:
        check_file(rec)

    frame = Image.open(ROOT / manifest['frame']['path']).convert('RGBA')
    overlay = Image.new('RGBA', (CANVAS, CANVAS))
    draw = ImageDraw.Draw(overlay)
    for i in range(CELLS + 1):
        v = ORIGIN + CELL * i
        draw.line([(v, ORIGIN), (v, ORIGIN + CELL * CELLS)], fill=(141, 216, 221, 122), width=2)
        draw.line([(ORIGIN, v), (ORIGIN + CELL * CELLS, v)], fill=(141, 216, 221, 122), width=2)
    overlay.paste((0, 0, 0, 0), (0, 0), frame.getchannel('A').point(lambda a: 255 if a else 0))
    frame_mask = frame.getchannel('A').point(lambda a: 255 if a == 255 else 0)

    webp = manifest['conversion']['webp']
    results = []
    for char in manifest['characters']:
        cid, src = char['id'], char['sourceId']
        imgs = {k: Image.open(ROOT / rec['path']) for k, rec in char['files'].items()}
        for k, img in imgs.items():
            assert img.size == (CANVAS, CANVAS) and img.mode == 'RGBA', (cid, k, img.size, img.mode)
        rec = spec['characters'][src]
        assert len(rec['cells']) == CELLS and all(len(row) == CELLS for row in rec['cells']), cid
        colors = [tuple(rec['palette'][n]) for row in rec['cells'] for n in row]
        assert {c[3] for c in colors} == {0, 255}, cid
        sprite = Image.new('RGBA', (CELLS, CELLS))
        sprite.putdata(colors)
        low = Image.new('RGBA', (CANVAS, CANVAS))
        low.alpha_composite(sprite.resize((CELL * CELLS, CELL * CELLS), Image.Resampling.NEAREST), (ORIGIN, ORIGIN))
        low.alpha_composite(frame)
        assert low.tobytes() == imgs['low'].tobytes(), ('low', cid)
        assert Image.alpha_composite(low, overlay).tobytes() == imgs['grid'].tobytes(), ('grid', cid)
        diff = ImageChops.difference(imgs['original'], frame)
        assert all(ImageChops.multiply(ch, frame_mask).getbbox() is None for ch in diff.split()), ('original frame', cid)
        out = {'id': cid, 'sourceId': src, 'reconstruction': True}

        eyes = char.get('eyeCells')
        if eyes:
            want = tuple(int(eyes['color'][i:i + 2], 16) for i in (1, 3, 5)) + (255,)
            for cx, cy in eyes['cells']:
                assert sprite.getpixel((cx, cy)) == want, ('eye cell', cid, cx, cy, sprite.getpixel((cx, cy)))
                px = imgs['low'].getpixel((ORIGIN + cx * CELL + CELL // 2, ORIGIN + cy * CELL + CELL // 2))
                assert px == want, ('eye low', cid, cx, cy, px)
            out['eyeCells'] = eyes['cells']

        buf = io.BytesIO()
        imgs['low'].convert('RGBA').resize((SIDE, SIDE), Image.LANCZOS).save(buf, 'WEBP', quality=webp['quality'], alpha_quality=webp['alpha_quality'], method=webp['method'])
        game = ROOT / char['game']['path']
        assert buf.getvalue() == game.read_bytes(), ('game webp is not the conversion of low.png', cid)
        g = Image.open(game)
        assert g.size == (SIDE, SIDE) and g.mode == 'RGBA', ('game webp', cid, g.size, g.mode)
        out['game'] = char['game']['path']
        results.append(out)

    portraits = (ROOT / 'src/portraits.js').read_text(encoding='utf-8')
    guest = re.search(r"const GUEST_IDS = \[(.*?)\];", portraits).group(1)
    temp = re.search(r"const TEMP_IDS = \[(.*?)\];", portraits).group(1)
    for char in manifest['characters']:
        assert repr(char['id']) in guest, ('GUEST_IDS', char['id'])
        assert repr(char['id']) not in temp, ('TEMP_IDS', char['id'])
        assert (ROOT / 'art/portraits-temp-20261023' / (char['id'] + '.png')).exists(), ('temp master kept', char['id'])

    print(json.dumps({'status': 'passed', 'source': manifest['source']['commit'], 'fileHashes': len(files),
                      'portraitFiles': 3 * len(manifest['characters']), 'fixedGridAndFrame': True,
                      'gameWebpFromLow': True, 'characters': results}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
