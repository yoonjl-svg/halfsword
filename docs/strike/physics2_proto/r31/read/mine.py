# 읽은 이 다시 셈 (원 출력에서): python3 mine.py <$S/r31> <바탕> <새> > out
import sys, re, json, math, random, statistics as st
d, A, B = sys.argv[1:4]
def num(f, key):
    t = open(f).read().splitlines()
    return [l for l in t if key in l]
def j(c):
    r = {}
    for f in ('j12', 'j12b'):
        l = num(f'{d}/{f}_{c}.txt', '팔 명령2')[-1]
        m = re.findall(r'>8° (\d+)', l); r[f] = (int(m[0]), int(m[1]))
    w = re.search(r'A 셈 자체: > 8° (\d+)', open(f'{d}/j12_{c}.txt').read())
    wb = re.search(r'A 셈 자체: > 8° (\d+)', open(f'{d}/j12b_{c}.txt').read())
    return r, int(w.group(1)), (int(wb.group(1)) if wb else None)
ra, wa, wba = j(A); rb, wb, wbb = j(B)
oa = ra['j12'][1] + ra['j12b'][1]; ob = rb['j12'][1] + rb['j12b'][1]
print(f'T1 셈자체(fights12) {wa} -> {wb} 한도 {wa/5:.1f} · fights_blk 셈자체 {wba} -> {wbb} · 빈팔>8 {oa} -> {ob} : {"맞음" if wb <= wa/5 and ob <= oa else "아님"}')
def grip(c):
    g = []
    for l in open(f'{d}/tri/tri_arm_real_{c}.jsonl'):
        for k, v in json.loads(l)['v'].items():
            if k.startswith('longsword'):
                m = re.search(r'g([\d.]+)', str(v)); g.append(float(m.group(1)) if m else 0.0)
    nA = 0; bad = []
    for l in open(f'{d}/tri/tri_A_{c}.jsonl'):
        o = json.loads(l); nA += 1; bad += o['bad']
    return g, nA, bad
for c in (A, B):
    g, nA, bad = grip(c); print(f'T2 {c}: arm_real 롱소드 {len(g)} 판 놓침 합 {sum(g):.2f} · tri_A 씨앗 {nA} 실패 {len(bad)} {bad[:3]}')
def seeds(c): return json.load(open(f'{d}/seed_{c}.json')) + json.load(open(f'{d}/seedb_{c}.json'))
sa, sb = seeds(A), seeds(B)
s8a, s8b = sum(x['s8'] for x in sa), sum(x['s8'] for x in sb)
r = random.Random(7); bs = []
for _ in range(4000):
    bs.append(sum(sa[r.randrange(len(sa))]['s8'] for _ in sa))
se = st.pstdev(bs)
print(f'T4 칼팔>8 (싸움꾼 합) {s8a} -> {s8b} · 차 {s8b-s8a} · 2SE {2*se:.0f} (싸움꾼 {len(sa)}/{len(sb)}) · j12 줄 합 {ra["j12"][0]+ra["j12b"][0]} -> {rb["j12"][0]+rb["j12b"][0]} : {"맞음" if s8b-s8a <= 2*se else "아님"}')
def qv(q, v):
    x, y, z, w = q; import numpy as np
    R = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]
    return [sum(R[i][k]*v[k] for k in range(3)) for i in range(3)]
fa, fb = json.load(open(f'{d}/fp_{A}.json')), json.load(open(f'{d}/fp_{B}.json'))
dd = []
for k in fa:
    u, w = qv(fa[k]['u'], (0, -1, 0)), qv(fb[k]['u'], (0, -1, 0))
    dd.append(math.degrees(math.acos(max(-1, min(1, sum(p*q for p, q in zip(u, w)))))))
print(f'T5 자리 {len(dd)} 가운데 {st.median(dd):.2f} 가장 큰 {max(dd):.2f} : {"맞음" if st.median(dd) <= 10 else "아님"}')
for g in ('fp_%s_g2.999.json', 'fp_%s_g3.001.json'):
    try:
        xa, xb = json.load(open(f'{d}/' + g % A)), json.load(open(f'{d}/' + g % B))
        e = [math.degrees(math.acos(max(-1, min(1, sum(p*q for p, q in zip(qv(xa[k]['u'], (0,-1,0)), qv(xb[k]['u'], (0,-1,0)))))))) for k in xa]
        print(f'   T5 곁 간격 {g}: 가운데 {st.median(e):.2f} 가장 큰 {max(e):.2f}')
    except Exception as ex: print('  ', g, ex)
FAM = ['f_longsword', 'f_rapier', 'f_zweihander', 'f_uchigatana', 'p_longsword', 'p_rapier', 'p_zweihander', 't_1', 't_2']
ok6 = True
for fam in FAM:
    ea = [x for x in json.load(open(f'{d}/elb/elb_{A}_{fam}.json'))['f'] if x['n']]
    eb = [x for x in json.load(open(f'{d}/elb/elb_{B}_{fam}.json'))['f'] if x['n']]
    row = []
    for k in 'ab':
        sh = lambda s: sum(x[k] for x in s) / sum(x['n'] for x in s)
        rr = random.Random(3); v = [sh([ea[rr.randrange(len(ea))] for _ in ea]) for _ in range(2000)]
        se = st.pstdev(v); pa, pb = sh(ea), sh(eb); ok = pb - pa <= 2*se; ok6 &= ok
        row.append(f'{k} {100*pa:.1f}->{100*pb:.1f} (2SE {200*se:.1f}){"" if ok else " 넘음"}')
    print(f'T6 {fam:13s} ' + ' · '.join(row) + f' · 싸움꾼 {len(ea)}/{len(eb)}')
print('T6', '맞음' if ok6 else '아님')
