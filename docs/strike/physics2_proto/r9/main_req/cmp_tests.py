#!/usr/bin/env python3
# 네 칸의 단위 시험을 시험 이름 전체로 맞대어 봄 (줄 잘림 없이 TAP 의 "ok N - 이름" 줄에서 이름을 읽음)
# 쓰기: python3 cmp_tests.py [--tsv]
import re, sys, os
MX = os.path.join(os.environ['S'], 'p2/r6/mx')  # S = 작업 자리(scratchpad) 뿌리
CELLS = [('main', 'bf_4_120'), ('arm', 'bu_4_120'), ('limits', 'bh_250'), ('combined', 'bw_250')]
TOP = re.compile(r'^(not ok|ok) \d+ - (.*)$')
LOC = re.compile(r"^\s+location: '.*/tools/sim/([^/:']+):(\d+)")
ERR = re.compile(r"^\s+error: (.*)$")

def parse(tag):
    p = os.path.join(MX, tag, 'tests.txt')
    res, files, errs, seen = {}, {}, {}, {}
    cur = None
    for line in open(p, encoding='utf-8', errors='replace'):
        line = line.rstrip('\n')
        m = TOP.match(line)
        if m:
            name = m.group(2)
            seen[name] = seen.get(name, 0) + 1
            if seen[name] > 1:
                name = f'{name} #{seen[name]}'
            res[name] = (m.group(1) == 'ok')
            cur = name
            continue
        if cur is not None:
            m = LOC.match(line)
            if m and cur not in files:
                files[cur] = m.group(1)
            m = ERR.match(line)
            if m and cur not in errs:
                errs[cur] = m.group(1)[:90]
        if line.startswith('# Subtest:'):
            cur = None
    return res, files, errs

data = {lab: parse(tag) for lab, tag in CELLS}
tsv = '--tsv' in sys.argv
print('칸\t통과/전체\t실패')
for lab, tag in CELLS:
    r = data[lab][0]
    print(f'{lab} ({tag})\t{sum(r.values())}/{len(r)}\t{len(r) - sum(r.values())}')
names = set()
for lab in data: names |= set(data[lab][0])
missing = [(lab, n) for n in names for lab in data if n not in data[lab][0]]
if missing:
    print('이름이 어느 칸엔 없음:', len(missing))
    for lab, n in missing[:10]: print('  ', lab, n[:120])
def st(lab, n):
    r = data[lab][0]
    return '—' if n not in r else ('pass' if r[n] else 'FAIL')
rows = []
for n in names:
    s = [st(lab, n) for lab, _ in CELLS]
    if any(x != s[0] for x in s[1:]):
        f = next((data[lab][1][n] for lab, _ in CELLS if n in data[lab][1]), '?')
        rows.append((f, n, s))
rows.sort()
print()
print('이름\t파일\tmain\tarm\tlimits\tcombined')
for f, n, s in rows:
    print('\t'.join([n, f] + s))
if '--err' in sys.argv:
    print()
    for f, n, s in rows:
        for lab, _ in CELLS:
            e = data[lab][2].get(n)
            if e and data[lab][0].get(n) is False: print(f'{lab}\t{f}\t{n[:50]}\t{e}')
