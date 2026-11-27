#!/usr/bin/env python3
# 묶음 표 (칸마다 한 줄씩 · 재기 파일만 읽음): S=<작업 자리> python3 bat_r17.py bw_250 bz_250 bz2_250
import os, re, sys
MX = os.path.join(os.environ['S'], 'p2/r6/mx')
def rd(c, f):
    p = os.path.join(MX, c, f)
    return open(p, encoding='utf-8', errors='replace').read() if os.path.exists(p) else ''
rows = {}
for c in sys.argv[1:]:
    s = rd(c, 'summary.txt'); r = {}
    m = re.search(r'기본 19 \[[^\]]*\]: (\d+/\d+)', s); r['기본 19'] = m and m.group(1)
    m = re.search(r'싸움 꼴 8 \[[^\]]*\]: (\d+/\d+)', s); r['싸움 꼴 8'] = m and m.group(1)
    for k, lab in (('1~24', '싸움 1~24'), ('301~324', '싸움 301~324')):
        m = re.search(rf'싸움 씨앗 {k}: 한 번도 안 넘어진 (\d+)/48 · 스스로 넘어짐 (\d+) · 스스로 안 넘어진 \d+/48 · 서 있던 분당 ([\d.]+) · 넘어짐 (\d+) · 죽음 (\d+)/24', s)
        r[lab + ' 스스로 · 넘어짐 · 분당 · 죽음 · 안 넘어진'] = m and f'{m.group(2)} · {m.group(4)} · {m.group(3)} · {m.group(5)} · {m.group(1)}'
    fin = rd(c, 'fin_sum.txt') + rd(c, 'fin_sum_x.txt')
    r['마무리 상처 s1 · s2 · s34 · 레 · 츠'] = ' · '.join(next(iter(re.findall(rf'== {k}: n \d+ · 상처 (\d+)', fin)), '-') for k in ('s1', 's2', 's34', 'rapier', 'zweihander'))
    for f, lab in (('parry.txt', '막기 치는 롱'), ('parry_atk_rapier.txt', '막기 치는 레'), ('parry_atk_zweihander.txt', '막기 치는 츠')):
        r[lab + ' (막는 롱 · 레 · 츠)'] = ' · '.join(re.findall(r'막음 (\d+/\d+)', rd(c, f))) or '-'
    rows[c] = r
keys = list(next(iter(rows.values())).keys())
print('| 줄 | ' + ' | '.join(rows) + ' |'); print('|---' * (len(rows) + 1) + '|')
for k in keys: print(f'| {k} | ' + ' | '.join(str(rows[c][k]) for c in rows) + ' |')
