import sys
p=sys.argv[1]; s=open(p).read()
old="    foe.applyWound({ ...r, part: best.info.part, passing: true });"
assert s.count(old)==2, s.count(old)
s=s.replace(old,"    globalThis.__JCf?.('inst.applied'); for (const k of r._jm ?? []) globalThis.__JCf?.('mi.' + k);\n"+old)
open(p,'w').write(s); print('ok')
