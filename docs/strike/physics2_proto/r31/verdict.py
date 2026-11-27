#!/usr/bin/env python3
# r31 판정 여섯 줄 (파일에서 셈): python3 verdict.py <폴더 $S/r31> <바탕 칸> <새 칸> [<parry_clu 출력>]
#  T1 why_* 'A 셈 자체' · j12/j12b 빈 팔 > 8° · T2 tri frac.grip 평균 · T3 parry_clu 벰 (첫째) · T4 칼 팔 > 8° + 붓스트랩 흔들림 · T5 fp 빈 위팔 방향 각 · T6 elb_rec
import sys, re, json, math, random, statistics as st
d, A, B = sys.argv[1:4]; pc = sys.argv[4] if len(sys.argv) > 4 else None
def j12(c):
    pat = re.compile(r'칼 팔 (\d+) · >8° (\d+) · >20° (\d+) · 가장 큰 ([\d.]+)° \| 빈 팔 (\d+) · >8° (\d+) · >20° (\d+) · 가장 큰 ([\d.]+)°')
    out = []
    for f in (f'{d}/j12_{c}.txt', f'{d}/j12b_{c}.txt'):
        m = [pat.search(l) for l in open(f) if '팔 명령2' in l][-1]; out.append([float(x) for x in m.groups()])
    return {'s8': out[0][1] + out[1][1], 's20': out[0][2] + out[1][2], 'smax': max(out[0][3], out[1][3]), 'o8': out[0][5] + out[1][5], 'o20': out[0][6] + out[1][6], 'omax': max(out[0][7], out[1][7])}
def why(c):
    t = open(f'{d}/j12_{c}.txt').read(); m = re.search(r'A 셈 자체: > 8° (\d+) · > 20° (\d+) · 가장 큰 ([\d.]+)°', t)
    return (int(m.group(1)), float(m.group(3))) if m else (0, 0.0)
def boot_se(xs, stat, n=2000):
    r = random.Random(1); v = []
    for _ in range(n):
        s = [xs[r.randrange(len(xs))] for _ in xs]; v.append(stat(s))
    return st.pstdev(v)
def seeds(c): return json.load(open(f'{d}/seed_{c}.json')) + json.load(open(f'{d}/seedb_{c}.json'))
def grip(c):
    g = []
    for l in open(f'{d}/tri/tri_arm_real_{c}.jsonl'):
        o = json.loads(l)
        for k, v in o['v'].items():
            if k.startswith('longsword'): m = re.search(r'g([\d.]+)', str(v)); g.append(float(m.group(1)) if m else 0.0)
    for l in open(f'{d}/tri/tri_A_{c}.jsonl'):  # 두손 칼 14 개 — 놓침 없는 무기는 0
        o = json.loads(l)
        for x in o['bad']:
            m = re.search(r'놓침 ([\d.]+)', x)
            if m: g.append(float(m.group(1)))
        g.extend([0.0] * (14 - sum('놓침' in x for x in o['bad'])))
    return sum(g) / len(g), sum(x > 0 for x in g), len(g)
def fp(c): return json.load(open(f'{d}/fp_{c}.json'))
def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    tx, ty, tz = 2 * (y * vz - z * vy), 2 * (z * vx - x * vz), 2 * (x * vy - y * vx)
    return (vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx)
def angv(a, b): return math.degrees(math.acos(max(-1, min(1, sum(x * y for x, y in zip(a, b))))))
FAM = ['f_longsword', 'f_rapier', 'f_zweihander', 'f_uchigatana', 'p_longsword', 'p_rapier', 'p_zweihander', 't_1', 't_2']
def elb(c, j): return json.load(open(f'{d}/elb/elb_{c}_{j}.json'))
def pct(xs, p):
    if not xs: return float('nan')
    xs = sorted(xs); return xs[min(len(xs) - 1, int(p * (len(xs) - 1) + 0.5))]
R = {}
def sect(name, fn):
    try: fn()
    except (FileNotFoundError, IndexError, AttributeError) as e: print(f'{name} 안 잼 ({type(e).__name__}: {str(e).split("/")[-1][:60]})')
def _t0():
    global a, b
    a, b = j12(A), j12(B); wa, wb = why(A), why(B)
    t1 = wb[0] <= wa[0] / 5 and b['o8'] <= a['o8']
    R['T1'] = t1
    print(f"T1 셈 자체 뜀 {A} {wa[0]} (가장 큰 {wa[1]:.1f}°) → {B} {wb[0]} (가장 큰 {wb[1]:.1f}°) · 빈 팔 > 8° {a['o8']:.0f} → {b['o8']:.0f} · > 20° {a['o20']:.0f} → {b['o20']:.0f} · 가장 큰 {a['omax']:.1f} → {b['omax']:.1f}° → {'맞음' if t1 else '아님'}")
sect('T1', _t0)
def _t1():
    global a, b
    ga, gb = grip(A), grip(B); t2 = gb[0] <= ga[0] + 1e-12; R['T2'] = t2
    print(f"T2 쥠 놓침 몫 {A} {ga[0]:.3f} (놓친 판 {ga[1]}/{ga[2]}) → {B} {gb[0]:.3f} ({gb[1]}/{gb[2]}) → {'맞음' if t2 else '아님'}")
sect('T2', _t1)
def _t2():
    global a, b
    if pc:
        t = open(pc).read(); m = re.search(r'벰 \(첫째\): \S+ (\d+)/\d+ = [\d.]+% · \S+ (\d+)/\d+ = [\d.]+% .*순열 p = ([\d.]+)', t)
        na, nb, p = int(m.group(1)), int(m.group(2)), float(m.group(3)); t3 = not (nb > na and p < 0.1); R['T3'] = t3
        print(f"T3 막기 벰 {A} {na} → {B} {nb} · 순열 p = {p:.3f} → {'맞음' if t3 else '아님'}")
    else: print('T3 안 잼 (막기 묶음 parry_clu 출력 없음)')
sect('T3', _t2)
def _t3():
    global a, b
    sa = seeds(A); se4 = boot_se(sa, lambda s: sum(x['s8'] for x in s)); t4 = b['s8'] - a['s8'] <= 2 * se4; R['T4'] = t4
    print(f"T4 칼 팔 > 8° {A} {a['s8']:.0f} → {B} {b['s8']:.0f} (차 {b['s8'] - a['s8']:+.0f} · 흔들림 2·SE {2 * se4:.1f} · 싸움꾼 {len(sa)}) · > 20° {a['s20']:.0f} → {b['s20']:.0f} · 가장 큰 {a['smax']:.1f} → {b['smax']:.1f}° → {'맞음' if t4 else '아님'}")
sect('T4', _t3)
def _t4():
    global a, b
    fa, fb = fp(A), fp(B); dd = []; dq = []
    for k in fa:
        ua, ub = qrot(fa[k]['u'], (0, -1, 0)), qrot(fb[k]['u'], (0, -1, 0)); dd.append(angv(ua, ub))
        dq.append(2 * math.degrees(math.acos(min(1, abs(sum(x * y for x, y in zip(fa[k]['u'], fb[k]['u'])))))))
    t5 = st.median(dd) <= 10; R['T5'] = t5
    print(f"T5 선 자세 빈 위팔 방향 차 (자리 {len(dd)}) 가운데값 {st.median(dd):.2f}° · 가장 큰 {max(dd):.2f}° (사원수 각 가운데값 {st.median(dq):.2f} · 가장 큰 {max(dq):.2f}°) → {'맞음' if t5 else '아님'}")
sect('T5', _t4)
def _t5():
    global a, b
    t6 = True; rows = []
    for j in FAM:
        ea, eb = elb(A, j)['f'], elb(B, j)['f']; ea = [x for x in ea if x['n']]; eb = [x for x in eb if x['n']]
        sh = lambda s, k: sum(x[k] for x in s) / max(1, sum(x['n'] for x in s))
        out = []
        for k in ('a', 'b'):
            pa, pb = sh(ea, k), sh(eb, k); se = boot_se(ea, lambda s: sh(s, k)); ok = pb - pa <= 2 * se; t6 &= ok
            out.append(f"({k}) {100 * pa:.2f} → {100 * pb:.2f} % (2·SE {200 * se:.2f}){'' if ok else ' 넘음'}")
        dwa = [w for x in ea for w in x['dw']]; dwb = [w for x in eb for w in x['dw']]
        out.append(f"(c) 머묾 {len(dwa)} → {len(dwb)} · 길이 가운데 {pct([w[0] for w in dwb], .5)} · p95 {pct([w[0] for w in dwb], .95)} 스텝 · 실제 쪽 돎 가운데 {pct([w[1] for w in dwb], .5):.1f} · p95 {pct([w[1] for w in dwb], .95):.1f}° | 바탕 명령 쪽 돎 가운데 {pct([w[2] for w in dwa], .5):.1f} · p95 {pct([w[2] for w in dwa], .95):.1f}° · 바탕 실제 쪽 돎 가운데 {pct([w[1] for w in dwa], .5):.1f} · p95 {pct([w[1] for w in dwa], .95):.1f}°")
        print(f"T6 {j:13s} " + ' · '.join(out))
    R['T6'] = t6
    print(f"T6 (a) · (b) 장면 아홉 모두 흔들림 안 → {'맞음' if t6 else '아님'}")
sect('T6', _t5)
print('판정 ' + B + ' ' + ' '.join(f"{k}={'맞음' if v else '아님'}" for k, v in R.items()))
