# 파고들기 거리-시간 그림 (11/14 — tools/sim/de_dig_feel.mjs --json 의 줄로 SVG 를 그린다 · 그림 도구 없이 손으로)
#  python3.12 tools/sim/de_dig_fig.py <dig_feel.json> <out.svg>
import json, sys
runs = json.load(open(sys.argv[1], encoding='utf8'))
W, H, L, R, T, B = 640, 360, 56, 150, 24, 44
tmax, dmax = 1.5, 2.0
X = lambda t: L + (W - L - R) * t / tmax
Y = lambda d: H - B - (H - T - B) * d / dmax
COL = {'walk': '#8a8f98', 'chase': '#3b82c4', 'dig': '#c2410c'}
NAME = {'walk': '보통 걸음', 'chase': '옛 간격 잡기 (헛침 뒤)', 'dig': '파고들기 (11/14)'}
s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="sans-serif" font-size="12">',
     f'<rect width="{W}" height="{H}" fill="#fff"/>']
for i in range(0, 4):
    d = i * 0.5
    s.append(f'<line x1="{L}" x2="{W-R}" y1="{Y(d):.1f}" y2="{Y(d):.1f}" stroke="#e5e7eb"/><text x="{L-6}" y="{Y(d)+4:.1f}" text-anchor="end" fill="#555">{d:.1f}</text>')
for i in range(0, 4):
    t = i * 0.5
    s.append(f'<text x="{X(t):.1f}" y="{H-B+16}" text-anchor="middle" fill="#555">{t:.1f}</text>')
s.append(f'<text x="{(L+W-R)/2}" y="{H-8}" text-anchor="middle" fill="#333">스틱을 민 뒤 실제 초</text>')
s.append(f'<text x="14" y="{(T+H-B)/2}" text-anchor="middle" fill="#333" transform="rotate(-90 14 {(T+H-B)/2})">앞으로 간 거리 (골반 m)</text>')
for r in runs:
    pts = ' '.join(f'{X(p["t"]):.1f},{Y(max(0, p["dx"])):.1f}' for p in r['rows'] if p['t'] <= tmax)
    c = COL[r['mode']]
    s.append(f'<polyline points="{pts}" fill="none" stroke="{c}" stroke-width="2.2"/>')
    last = [p for p in r['rows'] if p['t'] <= tmax][-1]
    s.append(f'<text x="{X(last["t"])+6:.1f}" y="{Y(last["dx"])+4:.1f}" fill="{c}">{NAME[r["mode"]]}</text>')
    for st in r['steps']:
        if st['t'] <= tmax and (st['dig'] or st['chase']):
            p = min(r['rows'], key=lambda q: abs(q['t'] - st['t']))
            s.append(f'<circle cx="{X(st["t"]):.1f}" cy="{Y(max(0, p["dx"])):.1f}" r="3.5" fill="{c}"/>')
s.append(f'<text x="{L}" y="16" fill="#333">독일 롱소드 · 서 있다 스틱 곧장 앞 1.0 · 점 = 빠른 걸음을 뗀 때 (de_dig_feel.mjs)</text>')
s.append('</svg>')
open(sys.argv[2], 'w', encoding='utf8').write('\n'.join(s))
