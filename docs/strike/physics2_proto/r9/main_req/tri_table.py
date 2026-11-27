#!/usr/bin/env python3
# 가르기 표: tri_<case>_{main,comb}.jsonl → 씨앗마다 잰 값 · 통과 수 · 가름(표의 규칙대로)
import json, glob, os, sys
W = os.path.dirname(os.path.abspath(__file__))
SKIP = {'tag', 'case', 'seed', 'pass', 'thr', 'sec'}
def load(p):
    if not os.path.exists(p): return {}
    return {d['seed']: d for d in (json.loads(l) for l in open(p) if l.strip())}
cases = sorted({os.path.basename(p)[4:].rsplit('_', 1)[0] for p in glob.glob(os.path.join(W, 'tri_*_*.jsonl'))})
if len(sys.argv) > 1: cases = [c for c in cases if c in sys.argv[1:]]
for k in cases:
    m, c = load(os.path.join(W, f'tri_{k}_main.jsonl')), load(os.path.join(W, f'tri_{k}_comb.jsonl'))
    thr = next((d.get('thr') for d in list(m.values()) + list(c.values()) if d.get('thr')), '')
    print(f'### {k}  (문턱: {thr})')
    for s in sorted(set(m) | set(c)):
        f = lambda d: ('—' if d is None else ('PASS' if d.get('pass') else ('ERR ' + d.get('err', '')[:60] if d.get('pass') is None else 'fail')) + ' ' + json.dumps({x: y for x, y in d.items() if x not in SKIP}, ensure_ascii=False))
        print(f'  씨앗 {s}: 본판 {f(m.get(s))}')
        print(f'          합친 {f(c.get(s))}')
    pm, pc = sum(1 for d in m.values() if d.get('pass')), sum(1 for d in c.values() if d.get('pass'))
    nm, nc = len(m), len(c)
    if nm < 8 or nc < 8: cls = f'아직 (본판 {nm} · 합친 {nc} 판)'
    elif pm < nm or pc >= pm - 1: cls = 'seed chaos' + (' (본판도 깨짐)' if pm < nm else ' (합친 판 통과 ≥ 본판 − 1)')
    else: cls = 'behaviour changed'
    print(f'  → 통과 본판 {pm}/{nm} · 합친 {pc}/{nc} → {cls}\n')
