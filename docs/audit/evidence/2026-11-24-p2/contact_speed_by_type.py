# contact_speed_by_type.py <dir with f_<tag>_<seed>.json from `node tools/sim/honesty.mjs --scene=fight --seed=N [--root=<tree>] --json=...`>
# The first report gave one median "contact speed at wounds" per build. This splits it by wound type (bruise / cut / stab), leaving out wounds from a placed (teleported) sword.
import json, statistics as st, collections, sys
S = sys.argv[1]
def load(tag, seeds):
    W = []
    for s in seeds:
        for e in json.load(open(f'{S}/f_{tag}_{s}.json')): W += e['woundsTaken']
    return W
med = lambda a: (round(st.median(a), 1) if a else None)
print('build seeds | all n med | per type n med | share of bruises')
for seeds, name in [(range(1, 9), '1-8'), (range(11, 19), '11-18')]:
    for tag in ['0930', '1101', 'now']:
        W = [w for w in load(tag, seeds) if w.get('speed') is not None and not w.get('kin')]
        by = collections.defaultdict(list)
        for w in W: by[w['type']].append(w['speed'])
        print(tag, name, '| n', len(W), 'med', med([w['speed'] for w in W]), '|', ' · '.join(f"{k} n {len(v)} med {med(v)}" for k, v in sorted(by.items())), '| bruise share', round(len(by['blunt']) / max(1, len(W)), 2))
