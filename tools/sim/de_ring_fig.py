# 칼 씨름 1] 밀쳐지는 꼴 그림 (11/14 — tools/sim/de_ring_feel.mjs --json 의 poses 로 SVG · 그림 도구 없이 손으로)
#  앞(미는 쪽에서 본 — 옆 · 위) · 옆(밀린 쪽 · 위) · 위(밀린 쪽 · 옆) 세 줄 × 칼 씨름 뒤 0 · 0.2 · 0.4 · 0.6 s 네 칸 · 밀린 몸 = 짙은 색 · 민 몸 = 옅은 회색 · 칼 = 손 → 칼끝
#  python3.12 tools/sim/de_ring_fig.py <ring_feel.json> <out.svg>
import json, sys
run = json.load(open(sys.argv[1], encoding='utf8'))[0]
F = run['ringFrame']
dx, dz = F['dx'], F['dz']
def uvw(p):  # 밀린 쪽 u · 위 y · 옆 w (u 에 수직 — 밀린 몸에서 보아 왼쪽 +)
    x, y, z = p[0] - F['x0'], p[1], p[2] - F['z0']
    return (x * dx + z * dz, y, -x * dz + z * dx)
BONES = [('head', 'chest'), ('chest', 'abdomen'), ('abdomen', 'pelvis'), ('chest', 'uarmS'), ('uarmS', 'farmS'), ('farmS', 'hilt'), ('chest', 'uarmO'), ('uarmO', 'farmO'),
         ('pelvis', 'thighF'), ('thighF', 'shinF'), ('shinF', 'footF'), ('pelvis', 'thighB'), ('thighB', 'shinB'), ('shinB', 'footB')]
VIEWS = [('앞 (미는 쪽에서 — 옆 · 위)', lambda q: (q[2], q[1])), ('옆 (밀린 쪽 → · 위)', lambda q: (q[0], q[1])), ('위 (밀린 쪽 → · 옆)', lambda q: (q[0], q[2]))]
CW, CH, PAD, TOP, LEFT = 190, 190, 14, 40, 120
S = 70  # px / m
W = LEFT + CW * 4 + PAD
H = TOP + CH * 3 + 30
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="sans-serif" font-size="11">', f'<rect width="{W}" height="{H}" fill="#fff"/>']
out.append(f'<text x="{LEFT}" y="16" font-size="13" fill="#222">칼 씨름 1] — 묶인 밀치기 중 상대 지침 → 세게 밀침 (독일 롱소드 사람 → 롱소드 상대 · de_ring_feel.mjs)</text>')
out.append(f'<text x="{LEFT}" y="31" fill="#555">짙은 = 밀린 상대 · 옅은 = 민 몸 · 붉은 줄 = 칼(손 → 칼끝) · 점선 = 칼 씨름 때 상대 골반 자리 · 칸 위 = 그 뒤 시간 · 가슴 사이 · 물러난 거리</text>')
poses = run['poses']
rows = {round(r['t'], 2): r for r in run['rows']}
for c, ps in enumerate(poses):
    t = run['tRing'] + ps['at']
    near = min(run['rows'], key=lambda r: abs(r['t'] - t))
    x0 = LEFT + c * CW
    out.append(f'<text x="{x0 + CW/2}" y="{TOP - 4}" text-anchor="middle" fill="#222">{ps["at"]:.1f} s · 가슴 사이 {near["d"]:.2f} m · 물러남 {(near["moved"] or 0):.2f} m</text>')
for r, (name, proj) in enumerate(VIEWS):
    y0 = TOP + r * CH
    out.append(f'<text x="8" y="{y0 + CH/2}" fill="#333">{name}</text>')
    for c, ps in enumerate(poses):
        x0 = LEFT + c * CW
        out.append(f'<rect x="{x0+2}" y="{y0+2}" width="{CW-4}" height="{CH-4}" fill="#fafafa" stroke="#e5e7eb"/>')
        # 칸 가운데 = 칼 씨름 때 상대 골반 (옆 · 위 칸은 u 를 0.3 m 앞당겨 민 몸도 보이게)
        cu = 0.3 if r > 0 else 0.0
        if r == 2:
            ox, oy = x0 + CW/2 - cu * S, y0 + CH/2
            P = lambda a, b: (ox + a * S, oy - b * S)
        else:
            ox, oy = x0 + CW/2 - cu * S, y0 + CH - 12
            P = lambda a, b: (ox + a * S, oy - b * S)
        # 기준 점선
        if r == 0:
            out.append(f'<line x1="{x0+4}" x2="{x0+CW-4}" y1="{oy}" y2="{oy}" stroke="#ddd"/>')
        else:
            gx = ox
            out.append(f'<line x1="{gx}" x2="{gx}" y1="{y0+4}" y2="{y0+CH-4}" stroke="#bbb" stroke-dasharray="3 3"/>')
        for who, col, w in (('P', '#b8bcc4', 1.6), ('A', '#1f2937', 2.2)):
            Q = {k: proj(uvw(v)) for k, v in ps[who].items()}
            if r == 0 and who == 'P':
                continue  # 앞에서 본 칸은 민 몸을 빼고(겹침) 밀린 몸만
            for a, b in BONES:
                (ax, ay), (bx, by) = P(*Q[a]), P(*Q[b])
                out.append(f'<line x1="{ax:.1f}" y1="{ay:.1f}" x2="{bx:.1f}" y2="{by:.1f}" stroke="{col}" stroke-width="{w}" stroke-linecap="round"/>')
            hx, hy = P(*Q['head'])
            out.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="{0.1*S:.1f}" fill="none" stroke="{col}" stroke-width="{w}"/>')
            (sx, sy), (tx, ty) = P(*Q['hilt']), P(*Q['tip'])
            out.append(f'<line x1="{sx:.1f}" y1="{sy:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" stroke="{"#dc2626" if who == "A" else "#f3a5a5"}" stroke-width="{1.8 if who == "A" else 1.2}"/>')
out.append(f'<text x="{LEFT}" y="{H-10}" fill="#555">칼 거리(롱소드 contact) {run["contact"]:.2f} m · 칼 씨름 때 가슴 사이 {run["dRing"]:.2f} → 가장 멀리 {run["dMax"]:.2f} m · 상대 넘어짐 {"예" if run["fell"] else "아니요"} · 1 칸 눈금 = {1/S*100:.1f} cm/px</text>')
out.append('</svg>')
open(sys.argv[2], 'w', encoding='utf8').write('\n'.join(out))
