# 겨눔 재기 고리 넣기 (재기 나무의 fighter.js 복사본에만 — src 에는 안 넣음): python3 inst_aim.py <fighter.js>
#  driveSword 의 겨눔 단계(자세 지도 → 보정 → 교정 전 aimRawW → 손목 교정 뒤 aimDirW)와 손목 교정이 탄 가지 · wristClamp 의 조건을 스텝마다 this._ad 에 둠
import sys
p = sys.argv[1]; s = open(p).read()
def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (old[:70], s.count(old))
    s = s.replace(old, new)
A = 'globalThis.__A'
rep("""    aim.applyQuaternion(this.yaw);
    // 보정 v2 (s > 0)""", """    aim.applyQuaternion(this.yaw);
    const _d0 = %s ? aim.clone() : null;
    // 보정 v2 (s > 0)""" % A)
rep("""    if (v2) corrStep(this, aim, sv);
""", """    if (v2) corrStep(this, aim, sv);
    const _d1 = %s ? aim.clone() : null;
""" % A)
rep("""    if (JOINTS.wristGuard && !this.mordAim) this.wristFixDeg = wristGuardAim(this, aim);
""", """    if (%s) { %s.wc = null; %s.br = null; }
    if (JOINTS.wristGuard && !this.mordAim) this.wristFixDeg = wristGuardAim(this, aim);
    if (%s) this._ad = { s0: _d0, s1: _d1, s2: this.aimRawW.clone(), s3: aim.clone(), wc: %s.wc, br: %s.br, fix: this.wristFixDeg, sw: this.swivelTh };
""" % (A, A, A, A, A, A))
# wristClamp 의 조건
rep("""  z.addScaledVector(aim, -z.dot(aim));
  if (z.lengthSq() < 1e-6) return 0;
  z.normalize();
  if (Math.abs(Math.asin(THREE.MathUtils.clamp(fx.dot(z), -1, 1))) > JOINTS.wristFE * HD) return 0;
  const x = _wgX.crossVectors(aim, z);
  const dev = 90 - Math.atan2(fx.dot(aim), fx.dot(x)) / HD;""", """  z.addScaledVector(aim, -z.dot(aim));
  if (z.lengthSq() < 1e-6) { if (%s) %s.wc = { g: 'z0' }; return 0; }
  z.normalize();
  const _fe = Math.asin(THREE.MathUtils.clamp(fx.dot(z), -1, 1)) / HD;
  if (Math.abs(Math.asin(THREE.MathUtils.clamp(fx.dot(z), -1, 1))) > JOINTS.wristFE * HD) { if (%s) %s.wc = { g: 'fe', fe: _fe, dev: 90 - Math.atan2(fx.dot(aim), fx.dot(_wgX.crossVectors(aim, z))) / HD }; return 0; }
  const x = _wgX.crossVectors(aim, z);
  const dev = 90 - Math.atan2(fx.dot(aim), fx.dot(x)) / HD;""" % (A, A, A, A))
rep("""  if (a === 0 || a >= span) return 0;
  const d = a <= span / 2 ? -a : span - a; // 가까운 끝으로
""", """  if (a === 0 || a >= span) { if (%s) %s.wc = { g: 'in', fe: _fe, dev }; return 0; }
  const d = a <= span / 2 ? -a : span - a; // 가까운 끝으로
  if (%s) %s.wc = { g: 'clamp', fe: _fe, dev, d };
""" % (A, A, A, A))
# wristGuardAim 의 가지
rep("""          f.wristPlaneOk = true;
          return 0;
        }
        return wristClamp(fx, aim, _wgZ""", """          f.wristPlaneOk = true;
          if (%s) %s.br = 'restTap';
          return 0;
        }
        if (%s) %s.br = 'restFits';
        return wristClamp(fx, aim, _wgZ""" % (A, A, A, A))
rep("""    if (wristPlane(fx, zF, aim, pref, out)) {
      f.wristPlaneOk = true;
      return 0;
    }""", """    if (wristPlane(fx, zF, aim, pref, out)) {
      f.wristPlaneOk = true;
      if (%s) %s.br = 'plane';
      return 0;
    }""" % (A, A))
rep("""      if (wristPlane(fx, zF, aim, pref, out)) {
        f.wristPlaneOk = true;
        return -hi / HD;
      }""", """      if (wristPlane(fx, zF, aim, pref, out)) {
        f.wristPlaneOk = true;
        if (%s) %s.br = 'pull';
        return -hi / HD;
      }""" % (A, A))
# offHand: 빈손 목표(칼자루 끝 gripAim) — 빈손 비킴(gripClear) 앞 · 뒤, 그 조건 (고치기 전 · 뒤 줄 둘 다에 맞음)
import re
n = 0
def gc(m):
    global n; n += 1
    return m.group(1) + "const _g0 = %s ? gripAim.clone() : null;\n" % A + m.group(1) + "const _g1 = %s ? gripAim.clone() : null;\n" % A + m.group(1) + "if (_g1 && !this.armsPlaced()) gripClear(this, _g1, SKILL.armClear.grip, Infinity);\n" + m.group(1) + m.group(2) + m.group(1) + "if (%s) this._od = { clrOn: !!this._clrOn, gap: this.armClrGap, push: _g0.distanceTo(gripAim), pushFull: _g0.distanceTo(_g1), g0: _g0, g: gripAim.clone(), clrT: this.armClrT };\n" % A
s = re.sub(r"( *)(if \(this\._clrOn && !this\.armsPlaced\(\)[^\n]*gripClear\(this, gripAim,[^\n]*\n)", gc, s)
assert n == 1, n
# armIK: 기본 팔꿈치(돌림 0 · 밧줄 돌림 없음)의 위팔 방향 — 가슴 틀 (swj_probe.mjs 가 읽음)
rep("""    const alpha = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    // 팔꿈치 돌림 (기본 켬""", """    const alpha = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    if (%s) %s.ud = Dn.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(pDir, Math.sin(alpha));
    // 팔꿈치 돌림 (기본 켬""" % (A, A))
open(p, 'w').write(s)
