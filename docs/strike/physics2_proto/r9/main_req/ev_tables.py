#!/usr/bin/env python3
# 근거 표: 결과 파일만 읽음 (새 시뮬 없음). 쓰기: python3 ev_tables.py
import re, json, os
MX = os.path.join(os.environ['S'], 'p2/r6/mx')  # S = 작업 자리(scratchpad) 뿌리

def rd(c, f):
    p = os.path.join(MX, c, f)
    return open(p, encoding='utf-8', errors='replace').read() if os.path.exists(p) else ''

def fin(c, f, key):
    t = rd(c, f)
    m = re.search(r'== ' + key + r': n (\d+) · 상처 (\d+)', t)
    j = re.search(r'== ' + key + r':.*?판정 (\{[^}]*\})', t, re.S)
    return (int(m.group(1)), int(m.group(2)), j.group(1) if j else '') if m else None

def parry(c):
    tot = [0, 0]; rows = []
    for f in ['parry.txt', 'parry_atk_rapier.txt', 'parry_atk_zweihander.txt']:
        for m in re.finditer(r'^(\w+)\s+치는 칼 (\w+)\s+막음 (\d+)/(\d+)', rd(c, f), re.M):
            tot[0] += int(m.group(3)); tot[1] += int(m.group(4)); rows.append(m.groups())
    return tot, len(rows)

def fights(c):
    s = rd(c, 'summary.txt'); out = {}
    for blk in ['1~24', '301~324']:
        m = re.search(r'싸움 씨앗 ' + blk + r': 한 번도 안 넘어진 (\d+)/48 · 스스로 넘어짐 (\d+) · .*?넘어짐 (\d+) · 죽음 (\d+)/24', s)
        out[blk] = tuple(map(int, m.groups())) if m else None
    return out

def fights_txt(c):
    # summary 가 아직 없을 때: fight_*.txt 에서 같은 줄을 찾음
    return None

def battery(c):
    s = rd(c, 'summary.txt'); r = {}
    m = re.search(r'기본 19 \[[^\]]*\]: (\d+)/(\d+)', s); r['def'] = m.groups() if m else None
    m = re.search(r'싸움 꼴 8 \[[^\]]*\]: (\d+)/(\d+)', s); r['fl'] = m.groups() if m else None
    if not r['def'] or not r['fl']:
        for k, f in [('def', 'def_longsword.json'), ('fl', 'fl_longsword.json')]:
            try:
                d = json.load(open(os.path.join(MX, c, f)))['solo']['longsword']
                r[k] = (sum(v['ok'] for v in d.values()), sum(v['n'] for v in d.values()))
            except Exception:
                pass
    return r

def speeds(c):
    try:
        d = json.load(open(os.path.join(MX, c, 'def_longsword.json')))['solo']['longsword']
    except Exception:
        return {}
    return {k: d[k]['speed'] for k in ['walk', 'back', 'strafe', 'slowwalk', 'slowback'] if k in d}

def arm(c):
    m = re.search(r'스텝 (\d+) · 20° 넘게 튐 (\d+) · 가장 큰 ([\d.]+)° · 밧줄 밖 명령 (\d+) \(밧줄 단 스텝 (\d+)\)', rd(c, 'fights12.txt'))
    return m.groups() if m else None

def tests(c):
    t = rd(c, 'tests.txt')
    a = re.search(r'^# tests (\d+)', t, re.M); p = re.search(r'^# pass (\d+)', t, re.M)
    return (p.group(1), a.group(1)) if a and p else None

def honw(c):
    m = re.search(r'옮긴 거리 ([\d.]+) m \(길 ([\d.]+) m · 평균 ([\d.]+) m/s\)', rd(c, 'hon_walk.txt'))
    return m.group(3) if m else '-'

A = ['bf_4_120', 'bt_4_120', 'bu_4_120']
print('## 5a 팔 고침 (본판 · 옛 둘째 · 셋째)')
for c in A:
    s2, s34 = fin(c, 'fin_sum.txt', 's2'), fin(c, 'fin_sum_x.txt', 's34')
    ra, zw = fin(c, 'fin_sum_x.txt', 'rapier'), fin(c, 'fin_sum_x.txt', 'zweihander')
    pt, pn = parry(c); f = fights(c); a = arm(c)
    fall = sum(f[b][2] for b in f if f[b]); selfd = sum(f[b][1] for b in f if f[b]); dead = sum(f[b][3] for b in f if f[b])
    b = battery(c)
    print(f'{c}: 장검 마무리 1~2 {s2[1]}/{s2[0]} · 3~4 {s34[1]}/{s34[0]} · 합 {s2[1]+s34[1]}/{s2[0]+s34[0]} ({100*(s2[1]+s34[1])/(s2[0]+s34[0]):.0f} %)')
    print(f'   레이피어 {ra[1]}/{ra[0]} · 츠바이핸더 {zw[1]}/{zw[0]} {zw[2]}')
    print(f'   막기 {pt[0]}/{pt[1]} ({100*pt[0]/pt[1]:.0f} %) [{pn} 칸]')
    print(f'   싸움 넘어짐 {fall} (0:{f["1~24"][2]} 300:{f["301~324"][2]}) · 스스로 {selfd} ({f["1~24"][1]} · {f["301~324"][1]}) · 죽음 {dead} ({f["1~24"][3]} · {f["301~324"][3]}) · 한 번도 안 넘어짐 {f["1~24"][0]}+{f["301~324"][0]}/96')
    print(f'   기본 19 {b["def"]} · 싸움 꼴 {b["fl"]} · 팔 명령 {a} · 시험 {tests(c)}')
print()
print('## 5b 다리 한도 (본판 · 발목 250 · 발목+엉덩이 250)')
for c in ['bf_4_120', 'ba_250', 'bh_250']:
    f = fights(c); b = battery(c)
    fs = ' · '.join(f'{k}: {v}' for k, v in f.items())
    print(f'{c}: 빠르기 {speeds(c)} · 정직 걷기 {honw(c)} m/s')
    print(f'   기본 19 {b.get("def")} · 싸움 꼴 {b.get("fl")} · 시험 {tests(c)}')
    print(f'   싸움 (안 넘어짐/48 · 스스로 · 넘어짐 · 죽음/24) {fs}')
