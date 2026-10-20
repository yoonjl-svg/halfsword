# 고유 공격 실험 집계 (2026-10-20 감독 — docs/strike/unique_attack_study_result_2026-10-20.md)
#  UQ_DIR=<결과 폴더> python3 tools/sim/unique_study_agg.py b | c | p3 | a
#  폴더 안: b/<유파>_off|on.json (unique_study_ai.mjs) · c/<유파>_e0|1|2.json (unique_study_player.mjs) · p3/<유파>_<이름>.json (ARM=drop:) ·
#   a/<유파>.json (parry_gap_map.mjs ATK=<유파 무기> UNIQUE=<넷> OUT=…). 통계 = 짝 차이 부트스트랩 95 % (4000 번)
import json, glob, random, sys, os
D = os.environ.get('UQ_DIR', '.').rstrip('/') + '/'
SCH = ['german', 'italian', 'iberian', 'japanese', 'chinese']
KO = {'german': '독일', 'italian': '이탈리아', 'iberian': '이베리아', 'japanese': '일본', 'chinese': '동방'}
def boot(d, n=4000):
    if not d: return (0, 0)
    random.seed(11); m = []
    for _ in range(n):
        s = [random.choice(d) for _ in d]; m.append(sum(s) / len(s))
    m.sort(); return m[int(.025 * n)], m[int(.975 * n)]
def load(path):
    try: return json.load(open(path))
    except Exception: return None
def wl(r, me, foe):
    return 'W' if r[me] and not r[foe] else 'L' if r[foe] and not r[me] else 'D'
def common(a, b, key):
    cut = min(a['dur'], b['dur']) - 0.5
    f = lambda r: sum(s for t, s in r[key] if t <= cut)
    return f(a), f(b)
def compare(tag, A, B, keyf, me, foe):
    ka = {keyf(r): r for r in A}; kb = {keyf(r): r for r in B}; keys = sorted(set(ka) & set(kb))
    if not keys: return None
    res = {'n': len(keys)}
    for nm, S in (('a', ka), ('b', kb)):
        w = [wl(S[k], me, foe) for k in keys]
        res[nm] = {'W': w.count('W'), 'L': w.count('L'), 'D': w.count('D')}
    # 승점(이김 1 · 비김 .5) 짝 차이
    pt = lambda r: {'W': 1, 'D': .5, 'L': 0}[wl(r, me, foe)]
    d = [pt(kb[k]) - pt(ka[k]) for k in keys]; res['ptDiff'] = (sum(d) / len(d), boot(d))
    for key in ('recvT', 'dealtT'):
        dd = []
        for k in keys:
            x, y = common(ka[k], kb[k], key); dd.append(y - x)
        res[key] = (sum(dd) / len(dd), boot(dd))
    for key in ('recvLimb', 'recvConc', 'recvBleed', 'dealtLimb', 'dealtConc', 'dealtBleed'):
        dd = [kb[k][key] - ka[k][key] for k in keys]; res[key] = (sum(ka[k][key] for k in keys), sum(kb[k][key] for k in keys), boot(dd))
    return res
def fmt(r, la, lb):
    a, b = r['a'], r['b']; p = r['ptDiff']
    s = f"  {la} {a['W']}승 {a['L']}패 {a['D']}무 → {lb} {b['W']}승 {b['L']}패 {b['D']}무 · 승점차 {p[0]:+.3f} [{p[1][0]:+.3f},{p[1][1]:+.3f}]\n"
    for key, nm in (('recvT', '받은 심각도(공통시간)'), ('dealtT', '준 심각도(공통시간)')):
        m, ci = r[key]; s += f"    {nm} 판당 {m:+.3f} [{ci[0]:+.3f},{ci[1]:+.3f}]\n"
    for key, nm in (('recvLimb', '받은 사지'), ('recvConc', '받은 의식'), ('recvBleed', '받은 출혈'), ('dealtLimb', '준 사지')):
        x, y, ci = r[key]; s += f"    {nm} {x:.2f} → {y:.2f} [{ci[0]:+.3f},{ci[1]:+.3f}]\n"
    return s
def mode_a():
    PAIR = {
     'german': {'zwerchAbtritt':'zwerch','krumphau':'zornhau','duplieren':None,'schielhau':'stichOchs'},
     'italian': {'inquartata':'stichPflugL','imbroccata':'stichOchs','cavazione':None,'passataSotto':'stichPflug'},
     'iberian': {'talhoRodeado':'zornhau','altibaixo':'oberhau','redondo':'zwerch','talhoRevezBaixo':'unterhau'},
     'japanese': {'hirakiGiri':'zornhauL','kote':None,'tsubameGaeshi':'oberhau','kokoRenda':'zornhau'},
     'chinese': {'chebuYaoji':'zwerch','zuoyi':None,'lianchi':None,'yaoji':None},
    }
    BASE = ['zornhau','oberhau','zwerch','unterhau','zornhauL','zwerchL','unterhauL','stichPflug','stichPflugL','stichOchs','stichOchsL','stichAlber']
    def tally(res):
        v = [x for x in res if x['why'] != 'clear']
        ok = sum(x['why']=='ok' for x in v); cut = sum(x['why'] in ('cut','pushed') for x in v); wind = sum(x['why']=='wind' for x in v)
        return dict(n=len(v), ok=ok, cut=cut, wind=wind, clear=len(res)-len(v))
    def fmt(t):
        return f"막음 {t['ok']}/{t['n']} · 벰 {t['cut']}" + (f" · 준비벰 {t['wind']}" if t['wind'] else '') + (f" · 안닿음 {t['clear']}" if t['clear'] else '')
    for sch, pairs in PAIR.items():
        p = D + f'a/{sch}.json'
        if not os.path.exists(p): print(sch, '미완'); continue
        o = json.load(open(p))
        print(f"[A] {sch} 치는 칼 {o['atk']} · 간격 {o['gaps']}")
        for name, base in pairs.items():
            U = {k:{'n':0,'ok':0,'cut':0,'wind':0,'clear':0} for k in ['u','b']}
            per = []
            for cfg, rows in o['configs'].items():
                if name not in rows: continue
                tu = tally(rows[name])
                if base: tb = tally(rows[base])
                else:
                    tb = {'n':0,'ok':0,'cut':0,'wind':0,'clear':0}
                    for b in BASE:
                        t = tally(rows[b])
                        for k in tb: tb[k] += t[k]
                for k in tu: U['u'][k] += tu[k]; U['b'][k] += tb[k]
                per.append(f"{cfg}: {tu['ok']}/{tu['n']}")
            bu = U['u']; bb = U['b']
            ru = 100*bu['cut']/max(1,bu['n']+bu['clear']); rb = 100*bb['cut']/max(1,bb['n']+bb['clear'])
            bl_u = 100*bu['ok']/max(1,bu['n']); bl_b = 100*bb['ok']/max(1,bb['n'])
            print(f"  {name:16s} {fmt(bu)} (막음 {bl_u:.0f}% · 벰 {ru:.0f}%) | 바탕 {base or '공용12 평균'}: {fmt(bb)} (막음 {bl_b:.0f}% · 벰 {rb:.0f}%) | {' · '.join(per)}")
        # all base average for reference
        tb = {'n':0,'ok':0,'cut':0,'wind':0,'clear':0}
        for cfg, rows in o['configs'].items():
            for b in BASE:
                t = tally(rows[b])
                for k in tb: tb[k] += t[k]
        print(f"  (공용 12 전체: {fmt(tb)} · 막음 {100*tb['ok']/max(1,tb['n']):.0f}%)")

mode = sys.argv[1] if len(sys.argv) > 1 else 'b'
if mode == 'a': mode_a()
if mode == 'b':
    for s in SCH:
        A = load(D + f'b/{s}_off.json'); B = load(D + f'b/{s}_on.json')
        if not A or not B: print(s, '미완'); continue
        r = compare(s, A, B, lambda x: (x['seed'], x['opp'], x['side']), 'sAlive', 'oAlive')
        print(f"[B] {KO[s]} (짝 {r['n']}) 고유 공격 끔 → 켬"); print(fmt(r, '끔', '켬'), end='')
        uses = {}
        for x in B:
            for k, v in x['uses'].items(): uses[k] = uses.get(k, 0) + v
        print('    켬 쓴 수(72판):', ', '.join(f'{k} {v}' for k, v in sorted(uses.items(), key=lambda kv: -kv[1])))
    # 다섯 유파 합침
    A = []; B = []
    for s in SCH:
        a = load(D + f'b/{s}_off.json'); b = load(D + f'b/{s}_on.json')
        if a and b: A += a; B += b
    r = compare('all', A, B, lambda x: (x['school'], x['seed'], x['opp'], x['side']), 'sAlive', 'oAlive')
    print(f"[B] 다섯 유파 합침 (짝 {r['n']})"); print(fmt(r, '끔', '켬'), end='')
elif mode == 'p3':
    for f in sorted(glob.glob(D + 'p3/*.json')):
        nm = os.path.basename(f)[:-5]; s, tech = nm.split('_', 1)
        P = load(f); B = load(D + f'b/{s}_on.json'); A = load(D + f'b/{s}_off.json')
        if not P or not B: continue
        k = lambda x: (x['seed'], x['opp'], x['side'])
        r = compare(nm, B, P, k, 'sAlive', 'oAlive')
        print(f"[P3] {KO[s]} 켬(넷) → {tech} 뺌 (짝 {r['n']})"); print(fmt(r, '켬', '뺌'), end='')
        r2 = compare(nm, A, P, k, 'sAlive', 'oAlive')
        print(f"    (끔 → {tech} 뺀 셋: 승점차 {r2['ptDiff'][0]:+.3f} [{r2['ptDiff'][1][0]:+.3f},{r2['ptDiff'][1][1]:+.3f}])")
else:
    for s in SCH:
        R = {e: load(D + f'c/{s}_e{e}.json') for e in (0, 1, 2)}
        if not R[0]: print(s, '미완'); continue
        for e in (1, 2):
            if not R[e]: continue
            r = compare(s, R[0], R[e], lambda x: (x['seed'], x['opp'], x['delay']), 'pAlive', 'eAlive')
            print(f"[C] {KO[s]} (짝 {r['n']}) 강화 0 → {e}"); print(fmt(r, '0', str(e)), end='')
        for e in (0, 1, 2):
            if not R[e]: continue
            fired = {}
            for x in R[e]:
                for k, v in x['fired'].items(): fired[k] = fired.get(k, 0) + v
            st = sum(x['strokes'] for x in R[e])
            w = sum(x['pAlive'] and not x['eAlive'] for x in R[e]); l = sum(x['eAlive'] and not x['pAlive'] for x in R[e])
            print(f'    {KO[s]} 강화 {e}: {w}승 {l}패 {len(R[e])-w-l}무 · 긋기 {st} · 발동', sum(fired.values()), '·', ', '.join(f'{k} {v}' for k, v in sorted(fired.items(), key=lambda kv: -kv[1])))

if mode == 'c':
    for e in (1, 2):
        A = []; B = []
        for s in SCH:
            a = load(D + f'c/{s}_e0.json'); b = load(D + f'c/{s}_e{e}.json')
            if a and b: A += a; B += b
        if not B: continue
        r = compare('all', A, B, lambda x: (x['school'], x['seed'], x['opp'], x['delay']), 'pAlive', 'eAlive')
        print(f"[C] 합침 강화 0 → {e} (짝 {r['n']})"); print(fmt(r, '0', str(e)), end='')
