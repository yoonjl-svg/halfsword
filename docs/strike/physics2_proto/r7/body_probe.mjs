// 팔 고침 재기 (읽기만 — 미리 싣는 재기). ROOT=<나무> OUT=<json> SCENE=<이름> node --import file://<이 파일> <재는 도구> …
//  src 에 재기 고리(globalThis.__P — es: elbowSwivel 들어감 · want · th, rs: ropeSwivel 후보 · 고름)가 있는 나무면 F1 ~ F5 를,
//  없는 나무(본판)면 F6(팔꿈치 돌림 길 밖 명령 튐)과 위팔 명령 튐 · 밧줄 밖만 센다. 몸 재기(wristSample)는 BODY=1 일 때 driveSword armIK 마다.
const root = process.env.ROOT;
if (!root) throw new Error('probe: ROOT');
const { Fighter, HUMAN } = await import(root + '/src/fighter.js');
const CONFIG = await import(root + '/src/config.js');
const THREE = await import(root + '/node_modules/three/build/three.module.js');
const { writeFileSync } = await import('node:fs');
const JOINTS = CONFIG.JOINTS;
const HD = Math.PI / 180;
const N = [HUMAN.shoulderPlane[1] - 90, HUMAN.shoulderPlane[0] + 90].map((c) => [Math.sin(c * HD), Math.cos(c * HD)]);
const ropeM = (u, side) => Math.min(...N.map(([s, c]) => s * u.x + side * c * u.z));
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
const V = () => new THREE.Vector3();
const _p = V(), _q = V(), _u = V(), _y = V(), _z = V(), _r = V(), _t = V(), _f = V();
const _Q = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);
// 기하 (가슴 틀): 바탕 p0 ⟂ Dn, q0 = Dn × p0. θ → 팔꿈치 비킴 p · 위팔 u
function geo(F, th) {
  _q.crossVectors(F.Dn, F.p0);
  _p.copy(F.p0).multiplyScalar(Math.cos(th)).addScaledVector(_q, Math.sin(th));
  _u.copy(F.Dn).multiplyScalar(Math.cos(F.alpha)).addScaledVector(_p, Math.sin(F.alpha));
  return { p: _p, u: _u };
}
// 참 위팔 돌림 수 (armTwistOk 식 — u.y > 0.5 지름길 없이). aU · dR = 위팔 길이 · 어깨 → 손 거리
function twistAt(F, th, aU, dR) {
  const { u } = geo(F, th);
  _y.copy(F.Dn).multiplyScalar(dR).addScaledVector(u, -aU);
  _y.addScaledVector(u, -_y.dot(u));
  if (_y.lengthSq() < 1e-9) return 0;
  _z.crossVectors(u, _y.normalize()).normalize();
  _r.set(0, 0, F.side).applyQuaternion(_Q.setFromUnitVectors(DOWN, u));
  return (F.side * Math.atan2(_t.crossVectors(_r, _z).dot(u), _r.dot(_z))) / HD;
}
const twOut = (tw) => tw < JOINTS.twist[0] || tw > JOINTS.twist[1];
const twOkGame = (F, th, aU, dR) => geo(F, th).u.y > 0.5 || !twOut(twistAt(F, th, aU, dR)); // armTwistOk 그대로
const ropeAt = (F, th) => ropeM(geo(F, th).u, F.side);
const upAt = (F, th) => geo(F, th).p.y; // > 0 = 팔꿈치가 어깨 → 손 줄 위
function devAt(E, th) {
  const { u } = geo(E, th);
  _f.copy(E.Dn).multiplyScalar(E.d).addScaledVector(u, -E.a).normalize();
  _y.copy(u).negate().addScaledVector(_f, u.dot(_f));
  if (_y.lengthSq() < 1e-9) return 0;
  _y.normalize();
  return Math.atan2(E.D.dot(_y), E.D.dot(_f));
}
const scene = process.env.SCENE ?? '';
const R = {
  scene,
  calls: { main: 0, mainEs: 0, mainAlign: 0, mainNone: 0, other: 0 },
  f1: { runs: [], stepsCond: 0, esRoped: 0, nRuns: 0, ge10: 0, ge24: 0, longest: 0 },
  f2: { esPathRsNonzero: 0, esPathRsCalls: 0, diff: [] },
  f3: [],
  f6: { jumpNonEs: 0, jumpNonEsBoth: 0, jumpEs: 0, nonEsSteps: 0, maxNonEs: 0, det: [] },
  cmd: { n: 0, jump: 0, max: 0, roped: 0, out: 0 },
  body: { n: 0, rotN: 0, shOut: 0, up0: 0, up30: 0 },
  bodyBy: {},
  cmdTw: {},
  trav: {},
  cat: {},
  perF: [],
};
const st = new WeakMap();
const allS = new Set();
let wristSample = null;
if (process.env.BODY) wristSample = (await import(root + '/tools/sim/wrist_audit.mjs')).wristSample;
const ik = Fighter.prototype.armIK;
const MAXDET = 400;
Fighter.prototype.armIK = function (target, alignDir = null) {
  const main = !!this._ikMain;
  const path = alignDir ? 'align' : JOINTS.elbowSwivel && this.armed && this.aimDirW ? 'es' : 'none';
  if (main && wristSample) {
    const s = wristSample(this);
    if (s) {
      const B = R.body;
      B.n++;
      if (s.shRot != null) {
        B.rotN++;
        if (twOut(s.shRot)) B.shOut++;
      }
      this._bodyOut = s.shRot != null && twOut(s.shRot);
      this._bodyUp30 = s.elbowUp > 30;
      if (s.elbowUp > 0) B.up0++;
      if (s.elbowUp > 30) B.up30++;
      const key = (this.weaponCfg?.twoHand ? '2h' : '1h') + (this._lastHuman ? ':human' : '');
      const K = (R.bodyBy[key] ||= { n: 0, rotN: 0, shOut: 0, up0: 0, up30: 0 });
      K.n++;
      if (s.shRot != null) {
        K.rotN++;
        if (twOut(s.shRot)) K.shOut++;
      }
      if (s.elbowUp > 0) K.up0++;
      if (s.elbowUp > 30) K.up30++;
    }
  }
  const th0 = this.swivelTh || 0;
  globalThis.__P = { es: null, rs: null };
  const r = ik.call(this, target, alignDir);
  const P = globalThis.__P;
  globalThis.__P = null;
  const rec = main || !!alignDir;
  if (!rec) {
    R.calls.other++;
    return r;
  }
  if (main) {
    R.calls.main++;
    R.calls[path === 'es' ? 'mainEs' : path === 'align' ? 'mainAlign' : 'mainNone']++;
  }
  let S = st.get(this);
  if (!S) {
    st.set(this, (S = { prevU: null, prevPath: null, run: null }));
    allS.add(S);
  }
  const roped = !!this.shoulderRopes?.length;
  // 명령 튐 · 밧줄 밖 (arm_cmd_probe 와 같은 셈 — 칼 팔 본 부름만)
  if (main) {
    const human = !!JOINTS.swivelHuman && (!this.weaponCfg.twoHand || !!this.thReach || (!!this._clrOn && !!this._ikMain));
    this._lastHuman = path === 'es' && human;
    const qT = this.jointByName.uarmS.target;
    const uu = V().set(1, 0, 0).applyQuaternion(qT), zz = V().set(0, 0, 1).applyQuaternion(qT);
    _r.set(0, 0, this.side).applyQuaternion(_Q.setFromUnitVectors(DOWN, uu));
    const tw = (this.side * Math.atan2(_t.crossVectors(_r, zz).dot(uu), _r.dot(zz))) / HD;
    const key = (this.weaponCfg?.twoHand ? '2h' : '1h') + (this._lastHuman ? ':human' : '') + ':' + path;
    const C = (R.cmdTw[key] ||= { n: 0, out: 0, up: 0 });
    C.n++;
    if (uu.y <= 0.5 && twOut(tw)) C.out++;
    this._cmdTw = uu.y <= 0.5 ? Math.round(tw / 10) * 10 : 'hi';
    const u = V().set(1, 0, 0).applyQuaternion(this.jointByName.uarmS.target);
    if (S.prevU) {
      const d = Math.acos(Math.max(-1, Math.min(1, u.dot(S.prevU)))) / HD;
      R.cmd.n++;
      if (d > 20) R.cmd.jump++;
      if (d > R.cmd.max) R.cmd.max = d;
      if (path !== 'es') {
        R.f6.nonEsSteps++;
        if (d > 20) {
          R.f6.jumpNonEs++;
          if (S.prevPath !== 'es') R.f6.jumpNonEsBoth++;
          if (R.f6.det.length < MAXDET) R.f6.det.push({ d: +d.toFixed(1), path, prev: S.prevPath, armed: !!this.armed, pickup: !!this.pickup, rs: P.rs && !P.rs.in0 ? +(P.rs.best / HD).toFixed(1) : 0 });
        }
        if (d > R.f6.maxNonEs) R.f6.maxNonEs = d;
      } else if (d > 20) R.f6.jumpEs++;
    }
    S.prevU = u;
    S.prevPath = path;
    if (roped) {
      R.cmd.roped++;
      if (ropeM(u, this.side) < -1e-6) R.cmd.out++;
    }
  }
  const E = P.es;
  const RS = P.rs;
  const human = E ? E.human : null;
  // F2/F4/F5 · F3: ropeSwivel 고름
  if (RS) {
    const onEs = path === 'es' && main;
    if (onEs) {
      R.f2.esPathRsCalls++;
      if (RS.best !== 0) {
        R.f2.esPathRsNonzero++;
        if (RS.bestOk) (R.f2.esOk ||= []).push({ rot: +(RS.best / HD).toFixed(3), th: E ? +(E.th / HD).toFixed(2) : null, want: E ? +(E.want / HD).toFixed(2) : null, th0p: E?.th0p !== undefined ? +(E.th0p / HD).toFixed(2) : null, mode: E?.rope });
      }
    }
    if (P.ad) {
      RS.aU = P.ad[0];
      RS.dR = P.ad[1];
    }
    if (!RS.in0) {
      const F = RS;
      const c = RS.th.map((th, i) => ({ th, kind: RS.cand[i], ok: ropeAt(F, th) >= -1e-9 }));
      const ends = c.filter((x) => x.kind === 'end' && x.ok);
      let near = null;
      for (const x of ends) if (!near || Math.abs(x.th) < Math.abs(near.th)) near = x;
      const pick = c.find((x) => x.th === RS.best) ?? { th: RS.best, kind: '?' };
      const ctx = { path, main, human, unarmed: !this.armed, twoHand: !!this.weaponCfg?.twoHand, w: this.weapon?.id };
      if (RS.bestOk) {
        if (near && Math.abs(pick.th - near.th) > 1e-9) {
          // 1° 훑음: 밧줄 안 · 참 돌림 안인 가장 가까운(|θ|) 돌림
          let nearTw = null;
          for (let n = 0; n <= 180 && nearTw === null; n++)
            for (const s of n ? [1, -1] : [1]) {
              const th = s * n * HD;
              if (ropeAt(F, th) >= 0 && !twOut(twistAt(F, th, F.aU, F.dR))) {
                nearTw = th;
                break;
              }
            }
          R.f2.diff.push({
            ...ctx,
            kind: pick.kind,
            rot: +(Math.abs(pick.th) / HD).toFixed(1),
            nearRot: +(Math.abs(near.th) / HD).toFixed(1),
            uy: +geo(F, pick.th).u.y.toFixed(2),
            tw: +twistAt(F, pick.th, F.aU, F.dR).toFixed(1),
            twNear: +twistAt(F, near.th, F.aU, F.dR).toFixed(1),
            up: upAt(F, pick.th) > 0,
            upNear: upAt(F, near.th) > 0,
            nearTwRot: nearTw === null ? null : +(Math.abs(nearTw) / HD).toFixed(1),
          });
        }
      } else {
        let any = false;
        for (let n = 0; n < 360 && !any; n++) if (ropeAt(F, n * HD) >= 0) any = true;
        const tw0 = twistAt(F, 0, F.aU, F.dR), tw1 = twistAt(F, RS.best, F.aU, F.dR);
        R.f3.push({
          ...ctx,
          rot: +(Math.abs(RS.best) / HD).toFixed(1),
          up: upAt(F, RS.best) > 0,
          up0: upAt(F, 0) > 0,
          tw0: +tw0.toFixed(1),
          tw1: +tw1.toFixed(1),
          out0: twOut(tw0) && geo(F, 0).u.y <= 0.5,
          out1: twOut(tw1) && geo(F, RS.best).u.y <= 0.5,
          gain: +((ropeAt(F, RS.best) - ropeAt(F, 0)) / HD).toFixed(1),
          anyIn1deg: any,
        });
      }
    }
  }
  // 갈래: A = 밧줄이 돌림 원 어디도 안 막음 · B = 0 은 밧줄 안 · 다른 곳 막힘 · C = 0 이 밧줄 밖 — 몸 돌림 밖 · 팔꿈치 위 몫을 갈래별로 (같은 스텝 몸)
  if (E && main && path === 'es' && roped) {
    let full = true;
    for (let n = 0; n < 90 && full; n++) if (ropeAt(E, n * 4 * HD) < 0) full = false;
    const c = full ? 'A' : ropeAt(E, 0) >= 0 ? 'B' : 'C';
    this._cat = c + (E.human ? 'h' : '') + ':sw' + Math.round(this.swivelTh / HD / 10) * 10 + ':want' + Math.round(E.want / HD / 10) * 10 + ':dev' + Math.round(devAt(E, this.swivelTh) / HD / 10) * 10;
    const key = (this.weaponCfg?.twoHand ? '2h' : '1h') + (E.human ? ':human' : '') + ':' + c;
    const K = (R.cat[key] ||= { n: 0, out: 0, up30: 0 });
    K.n++;
    if (this._bodyOut) K.out++;
    if (this._bodyUp30) K.up30++;
    if (c === 'C') {
      // 0 에서 가장 가까운 밧줄 안 돌림(1°) 과 고른 돌림의 참 위팔 돌림 · 손목
      let e = null;
      for (let n = 1; n <= 180 && e === null; n++) for (const sg of [1, -1]) if (e === null && ropeAt(E, sg * n * HD) >= 0) e = sg * n * HD;
      const st = this.swivelTh;
      const okT = (th) => geo(E, th).u.y > 0.5 || !twOut(twistAt(E, th, E.a, E.d));
      K.c = K.c || { n: 0, selOut: 0, endOut: 0, selUp: 0, endUp: 0, selDev: 0, endDev: 0, bothIn: 0 };
      K.c.n++;
      if (!okT(st)) K.c.selOut++;
      if (e !== null && !okT(e)) K.c.endOut++;
      if (upAt(E, st) > 0) K.c.selUp++;
      if (e !== null && upAt(E, e) > 0) K.c.endUp++;
      K.c.selDev += devAt(E, st) / HD;
      K.c.wantOut = (K.c.wantOut ?? 0) + (okT(E.want) ? 0 : 1);
      K.c.wantIsZ = (K.c.wantIsZ ?? 0) + (e !== null && Math.abs(wrap(E.want - e)) < 2.5 * HD ? 1 : 0);
      K.c.gap = (K.c.gap ?? 0) + Math.abs(wrap(E.want - st)) / HD;
      K.c.th0p = (K.c.th0p ?? 0) + (E.th0p !== undefined && Math.abs(wrap(E.th0p - th0)) > 1e-9 ? 1 : 0);
      if (e !== null) K.c.endDev += devAt(E, e) / HD;
    }
  }
  if (main) {
    S.bn = (S.bn ?? 0) + 1;
    if (this._bodyOut) {
      S.bout = (S.bout ?? 0) + 1;
      const k = `${this._cat}:cmd${this._cmdTw}:${this.foe ? Math.round(this.foeDistance?.() * 2) / 2 : '-'}`;
      (S.os ||= {})[k] = (S.os[k] ?? 0) + 1;
    }
  }
  // 따라감 길: 투영(th0 → th0p) · 긴 쪽(밧줄 호를 따라 짧은 쪽의 반대) — 몸 돌림 밖과 엮어 봄 (뒤 30 스텝 안)
  if (E && main && path === 'es' && E.th0p !== undefined && E.want !== null) {
    const key = (this.weaponCfg?.twoHand ? '2h' : '1h') + (E.human ? ':human' : '');
    const T = (R.trav[key] ||= { n: 0, proj: 0, projBig: 0, long: 0, after: 0, afterOut: 0 });
    T.n++;
    const pj = Math.abs(wrap(E.th0p - th0));
    if (pj > 1e-9) T.proj++;
    if (pj > 10 * HD) T.projBig++;
    const sh = wrap(E.want - E.th0p);
    const mv = wrap(E.th - E.th0p);
    if (Math.abs(mv) > 1e-9 && Math.sign(mv) !== Math.sign(sh)) {
      T.long++;
      S.lastLong = 30;
    }
    if (S.lastLong > 0) {
      S.lastLong--;
      T.after++;
      if (this._bodyOut) T.afterOut++;
    }
  }
  // F1: 팔꿈치 돌림 길 (본 부름) — want 가 밧줄 안 · 저장 돌림이 want 에서 20° 넘게 · 이 스텝에 다가가지 않음
  if (E && main && path === 'es' && E.want !== null && roped) {
    R.f1.esRoped++;
    const stored = this.swivelTh;
    const wIn = ropeAt(E, E.want) >= -1e-9;
    const gap1 = Math.abs(wrap(E.want - stored));
    const gap0 = Math.abs(wrap(E.want - th0));
    const cond = wIn && gap1 > 20 * HD && gap1 >= gap0 - 1e-6;
    if (cond) {
      R.f1.stepsCond++;
      if (!S.run) S.run = { n: 0, devStored: 0, devWant: 0, gap: 0, human: E.human, path: E.path, w: this.weapon?.id };
      S.run.n++;
      S.run.devStored += devAt(E, stored) / HD;
      S.run.devWant += devAt(E, E.want) / HD;
      S.run.gap += gap1 / HD;
    } else if (S.run) endRun(S);
  } else if (main && S.run) endRun(S);
  return r;
};
function endRun(S) {
  const x = S.run;
  S.run = null;
  R.f1.nRuns++;
  if (x.n >= 10) R.f1.ge10++;
  if (x.n >= 24) R.f1.ge24++;
  if (x.n > R.f1.longest) R.f1.longest = x.n;
  if (x.n >= 72) R.f1.runs.push({ n: x.n, devStored: +(x.devStored / x.n).toFixed(1), devWant: +(x.devWant / x.n).toFixed(1), gap: +(x.gap / x.n).toFixed(1), human: x.human, path: x.path, w: x.w });
}
process.on('exit', () => {
  for (const S of allS) {
    if (S.run) endRun(S);
    R.perF.push([S.bn ?? 0, S.bout ?? 0, S.os ?? {}]);
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(R));
  const f1 = R.f1.runs;
  process.stderr.write(`probe ${scene}: main ${R.calls.main} (es ${R.calls.mainEs} · align ${R.calls.mainAlign} · none ${R.calls.mainNone}) · F1 runs≥72 ${f1.length} longest ${Math.max(0, ...f1.map((r) => r.n))} · F2 diff ${R.f2.diff.length} · F3 ${R.f3.length} · es-path rs≠0 ${R.f2.esPathRsNonzero}/${R.f2.esPathRsCalls} · F6 nonEs jumps ${R.f6.jumpNonEs} · cmd jump ${R.cmd.jump} out ${R.cmd.out}/${R.cmd.roped}\n`);
});
