#!/usr/bin/env python3
# Re-score recorded AI-vs-AI wounds at energy multipliers k (tip speed x sqrt(k)), and recompute weapon-break
# probability from recorded fresh clash impulses (J scales ~linearly with speed).
# Rules copied from src/fighter.js applyWound / combat.js analyze / weapons.js breakChance.
import json, sys, math
FRAG = {'longsword': 0.056, 'rapier': 0.032, 'sabre': 0.056, 'lightsaber': 0.0104, 'zweihander': 0.032, 'tree_branch': 0.4, 'estoc': 0.056}
BLEED = {'head': 0.03, 'neck': 0.2, 'chest': 0.025, 'abdomen': 0.03, 'pelvis': 0.02, 'arm': 0.012, 'leg': 0.015}
def rescore(w, k):
    if w['type'] not in ('cut', 'stab') or w['eff'] is None or w['thr'] is None: return None
    eff = w['eff'] * k; thr = w['thr']
    if eff <= thr: return {'sev': 0}
    sev = (eff - thr) / (90 if w['type'] == 'cut' else 60)
    z = w['zone']; dead = None
    if z == 'neck' and sev > 0.5: dead = 'neck'
    elif z == 'head' and ((w['type'] == 'cut' and sev > 0.8) or (w['type'] == 'stab' and sev > 0.5)): dead = 'head'
    # single-wound bleed-out: total loss ~ bleed/clotting(0.12); collapse at loss 0.55
    bleed = sev * BLEED.get(z, 0.025) * (1.6 if w['type'] == 'stab' else 1) + (0.25 if z == 'chest' and w['type'] == 'stab' and sev > 1.1 else 0)
    if not dead and bleed / 0.12 > 0.55: dead = 'bleed'
    disarm = z == 'arm' and sev * 0.7 > 0.85
    return {'sev': sev, 'dead': dead, 'disarm': disarm}
for fn in sys.argv[1:]:
    d = json.load(open(fn))
    W = fn.split('duel_')[1].split('_')[0] if 'duel_' in fn else 'longsword'
    ws = [w for w in d['wounds'] if w['type'] in ('cut', 'stab')]
    solid = [w for w in ws if w['eff'] is not None and w['eff'] > w['thr']]
    print(f"== {fn.split('/')[-1]}: wounds {len(d['wounds'])} (edge {len(ws)}, penetrating {len(solid)}), rounds deaths {len(d['deaths'])}, capHits {len(d['capHits'])}, tipPeaks {d['tipPeaks']}")
    effs = sorted(w['eff'] for w in solid)
    if effs: print('   penetrating eff J  p25/p50/p90:', effs[len(effs)//4], effs[len(effs)//2], effs[int(len(effs)*0.9)])
    for k in (1.0, 1.69, 2.0, 2.56):
        rs = [rescore(w, k) for w in ws]; rs = [r for r in rs if r]
        pen = sum(1 for r in rs if r['sev'] > 0)
        dead = sum(1 for r in rs if r.get('dead')); dis = sum(1 for r in rs if r.get('disarm'))
        byz = {}
        for w, r in zip([w for w in ws if rescore(w, k)], rs):
            if r.get('dead'): byz[r['dead']] = byz.get(r['dead'], 0) + 1
        print(f"   k={k:4}: penetrating {pen}/{len(rs)}  one-hit-lethal {dead}/{len(rs)} ({100*dead/max(1,len(rs)):.0f}%) {byz}  one-hit-disarm {dis}")
    js = [c['J'] for c in d['clashJ']]
    if js:
        js.sort(); f = FRAG.get(W, 0.056)
        print(f"   fresh clashes {len(js)}  J p50 {js[len(js)//2]:.2f} p90 {js[int(len(js)*0.9)]:.2f}  frac J>=6: {sum(1 for j in js if j>=6)/len(js):.2f}")
        for s in (1.0, 1.3, 1.6):
            p = [f * min(1, j * s / 6) ** 2 for j in js]
            surv = math.prod(1 - x for x in p)
            print(f"     speed x{s}: mean p/clash {sum(p)/len(p):.4f} (vs cap {f}), P(break over these {len(js)} clashes) {1-surv:.2f}")
    jo = sorted(d['jolts'])
    if jo: print(f"   jolts n={len(jo)} p50 {jo[len(jo)//2]:.2f} p90 {jo[int(len(jo)*0.9)]:.2f} N·s")
