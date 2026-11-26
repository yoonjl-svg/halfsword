# parse finish_thrust per-trial rows (bare-body block only) for zweihander: main=bf_4_120, patch=bt_4_120
import re, sys, statistics as st
R = sys.argv[1]
pat = re.compile(r's(\d+)\[(\S+) (?:(\w+)/(\w+)(?:→(\w+))?/(-?[\d.]+)/(-?[\d.]+|-)J|(\w+)/(\w+)|-) line (-?[\d.]+|-)° miss (-?[\d.]+|-) achY (-?[\d.]+|-) walk (\S+?)[\] ]')
def load(f):
    L = open(f).read().split('\n')
    # bare block = up to second '전체'
    idx = [i for i, l in enumerate(L) if l.startswith('전체')]
    L = L[:idx[1]] if len(idx) > 1 else L
    rows = {}
    cell = None
    for l in L:
        m0 = re.match(r'\s+(\S+) ([\d.]+m) (\w+) (\d+)/(\d+):', l)
        if m0: cell = m0.group(1, 2, 3)
        for m in pat.finditer(l):
            seed = int(m.group(1))
            rows[cell] = dict(seed=seed, cell=cell, why=m.group(2), part=m.group(3) or m.group(8), kin=m.group(4) or m.group(9), typ=m.group(5) or m.group(4) or m.group(9),
                              along=float(m.group(6)) if m.group(6) else None, E=float(m.group(7)) if m.group(7) and m.group(7) != '-' else None,
                              line=float(m.group(10)) if m.group(10) != '-' else None, miss=float(m.group(11)) if m.group(11) != '-' else None, achY=float(m.group(12)) if m.group(12) != '-' else None, fin=m.group(6) is not None)
    return rows
def summ(name, rows):
    fin = [r for r in rows.values() if r['fin']]
    print(f'{name}: rows {len(rows)} with torso-contact record {len(fin)}')
    from collections import Counter
    print('  kin', dict(Counter(r['kin'] for r in fin)), ' final', dict(Counter(r['typ'] for r in fin)), ' kin->final changed', sum(1 for r in fin if r['typ'] != r['kin']))
    for k in ['along', 'E', 'line', 'miss', 'achY']:
        v = [r[k] for r in fin if r[k] is not None]
        if v: print(f'  {k:5s} n={len(v)} median {st.median(v):.2f} mean {st.mean(v):.2f} q1 {st.quantiles(v, n=4)[0]:.2f} q3 {st.quantiles(v, n=4)[2]:.2f}')
    for kk in ['cut', 'blunt']:
        sub = [r for r in fin if r['typ'] == kk]
        if sub: print(f'  final {kk}: n={len(sub)} along med {st.median([r["along"] for r in sub]):.2f} E med {st.median([r["E"] for r in sub if r["E"] is not None]):.0f} line med {st.median([r["line"] for r in sub if r["line"] is not None]):.1f}')
    print('  parts', dict(Counter(r['part'] for r in fin)))
    return rows
a = summ('MAIN', load(R + '/bf_4_120/fin_rows_zweihander.txt'))
b = summ('PATCH', load(R + '/bt_4_120/fin_rows_zweihander.txt'))
same = [s for s in a if s in b]
print('paired seeds', len(same))
# paired comparison by cell (same stance/distance/direction/seed on both trees)
fa = {k: v for k, v in a.items() if v['fin']}; fb = {k: v for k, v in b.items() if v['fin']}
both = [k for k in fa if k in fb]
print('cells with torso contact: main', len(fa), 'patch', len(fb), 'both', len(both))
from collections import Counter
print('  type pairs (main>patch):', dict(Counter(f"{fa[k]['typ']}>{fb[k]['typ']}" for k in both)))
d = lambda key: [fb[k][key] - fa[k][key] for k in both if fa[k][key] is not None and fb[k][key] is not None]
for key in ['along', 'E', 'line', 'achY']:
    v = d(key)
    if v: print(f'  paired diff patch-main {key}: n={len(v)} median {st.median(v):.2f} mean {st.mean(v):.2f} sign+ {sum(x>0 for x in v)} sign- {sum(x<0 for x in v)}')
print('  kin cut but final blunt (energy too low): main', sum(1 for r in fa.values() if r['kin']=='cut' and r['typ']=='blunt'), 'patch', sum(1 for r in fb.values() if r['kin']=='cut' and r['typ']=='blunt'))
