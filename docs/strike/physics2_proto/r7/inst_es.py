# 팔꿈치 돌림 고르기 끝에 재는 줄을 넣는다 (재는 사본에만): inst_es.py <fighter.js> <rope|shipped>
import sys
p, mode = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf8').read()
line = "const dth = Math.atan2(Math.sin(want - th0), Math.cos(want - th0));"
assert s.count(line) == 2, s.count(line)
r0 = "rope ? ropeOk(0) : true" if mode == 'rope' else "true"
rp = "rope" if mode == 'rope' else "false"
i = s.index(line)
hook = lambda br: f"if (globalThis.__ES) globalThis.__ES('{br}', want, th0, k, human, {rp}, {r0}, armOk(th0), pDir, Dn, ca, sa, side);\n    "
s = s[:i] + hook('thrust') + s[i:]
j = s.index(line, i + len(hook('thrust')) + len(line))
s = s[:j] + hook('gen').replace('\n    ', '\n  ') + s[j:]
open(p, 'w', encoding='utf8').write(s)
