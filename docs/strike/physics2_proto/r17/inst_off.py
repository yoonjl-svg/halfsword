# 재기 나무 fighter.js 복사본에 빈손 비킴 ② 고리 넣기 (재기만): python3 inst_off.py <나무>/src/fighter.js
import sys
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
a = "      const want = offYieldWant(this._swGeo, P, this.side, SKILL.armClear, _oaY);\n"
assert s.count(a) == 1
s = s.replace(a, "      const __P0 = P.clone();\n" + a + "      const __H = globalThis.__OYH; if (__H) __H.pre(this, __P0, want, this._swGeo, offPoseGap, offYieldWant);\n")
b = "      P.add(y);\n    } else if (this._offYield) this._offYield.set(0, 0, 0);\n"
assert s.count(b) == 1
s = s.replace(b, "      P.add(y);\n      if (__H) __H.post(this, P, y);\n    } else { if (globalThis.__OYH) globalThis.__OYH.off(this, armClearOn(this), !!this._swGeoOk); if (this._offYield) this._offYield.set(0, 0, 0); }\n")
open(p, 'w', encoding='utf-8').write(s); print('ok')
