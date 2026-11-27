// r19 probe — 다리 관절 엔진 모터가 실제로 낸 토크를 세계 사본 A/B 로 잰다. 재기만 한다(게임 · 도구 코드는 그대로).
//  쓰는 법: R19_ROOT=<나무> R19_OUT=<jsonl> [R19_EVERY=6] [R19_TDWIN=4] [R19_WHO=P|all] [R19_VALIDATE=1]
//          node --import file://<이 파일> tools/sim/<도구>.mjs ...
//  Q4 감쇠 0 다시 걷기: R19_ZD_STEP=<스텝> R19_ZD_LEG=F|B [R19_ZD_N=4] [R19_STOP=<스텝>] [R19_ZD_OFF=1 = 같은 창을 그대로(대조)]
//   (판마다 세계 스텝 번호 · 도구가 결정적이라 같은 스텝까지 그대로 되풀이된다)
//  재는 법 (스텝마다 표본):
//   1) world.step 바로 앞 takeSnapshot (도구가 건 명시 토크 · 모터 목표 · 접촉 캐시 모두 들어 있음). 원래 스텝을 그대로 돌리고(이때 접촉 걸이 결정을 적어 둠) 뒤 각속도 = 정답.
//   2) 사본(restoreSnapshot)에서 다리 관절 6 개의 모터를 모두 끄고(k = d = 0), 대신 관절 두 몸에 같고 반대인 토크 쌍 x 를 건다(엉덩이 3 축 · 무릎 · 발목 경첩 축 1 개씩 = 10 개).
//      x 를 바꿔 가며 한 스텝 뒤 관절 상대 각속도(10 개)가 원래와 같아지는 x 를 찾는다 (유한차분 야코비안 + 뉴턴 2 번). 이 x 가 모터가 실제로 낸 토크(한 스텝 평균).
//   3) 검산: 그 x 로 돌린 사본의 모든 몸 선 · 각속도가 원래와 얼마나 같은지(maxDv · maxDw), 그리고 사본을 그대로 돌리면 원래와 비트까지 같은지(det).
//  다시 센 값(honesty.mjs 와 같은 식): τ̂ = k(t − e) + d(tv − ω_rel) · e = 스텝 앞 자세 · ω_rel = 스텝 뒤 (부모 틀).
import { pathToFileURL } from 'node:url';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.R19_ROOT;
const OUT = process.env.R19_OUT;
const EVERY = +(process.env.R19_EVERY ?? 6);
const TDWIN = +(process.env.R19_TDWIN ?? 4);
const WHO = process.env.R19_WHO ?? 'P';
const VALIDATE = !!process.env.R19_VALIDATE;
const ZD_STEP = process.env.R19_ZD_STEP != null ? +process.env.R19_ZD_STEP : null;
const ZD_LEG = process.env.R19_ZD_LEG ?? 'F';
const ZD_N = +(process.env.R19_ZD_N ?? 4);
const ZD_OFF = !!process.env.R19_ZD_OFF;
const STOP = process.env.R19_STOP != null ? +process.env.R19_STOP : null;
const NOAB = !!process.env.R19_NOAB; // 힘 기록만 (A/B 없음)
const FORCELOG = process.env.R19_FORCELOG ?? null; // 스텝마다 발 힘 줄 (Q4)
const u = (p) => pathToFileURL(join(ROOT, p)).href;

const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
const { Fighter } = await import(u('src/fighter.js'));
const { LegDrive } = await import(u('src/legs_vmc.js'));
const CONFIG = await import(u('src/config.js'));
const LIM = CONFIG.LEGS.limit;
const DT = CONFIG.PHYSICS.timestep;

// ── 작은 수학 ──
const V = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const scl = (a, s) => V(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const cv = (a) => V(a.x, a.y, a.z);
const cq = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });
const qmul = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const qrot = (q, v) => { const p = qmul(qmul(q, { x: v.x, y: v.y, z: v.z, w: 0 }), qconj(q)); return V(p.x, p.y, p.z); };
const rotvec = (q0) => { let q = q0; if (q.w < 0) q = { x: -q.x, y: -q.y, z: -q.z, w: -q.w }; const s = Math.hypot(q.x, q.y, q.z); if (s < 1e-9) return V(2 * q.x, 2 * q.y, 2 * q.z); const a = 2 * Math.atan2(s, q.w); return V(q.x / s * a, q.y / s * a, q.z / s * a); };
function solveLin(A, b) { // 가우스 소거 (작은 n)
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}

// ── 원래 메서드 (도구가 인스턴스에 감싸기 전) ──
const W0 = RAPIER.World.prototype;
const origStep = W0.step;
const RB = RAPIER.RigidBody.prototype;
const oAddTorque = RB.addTorque, oAngvel = RB.angvel, oLinvel = RB.linvel, oRot = RB.rotation;

// ── 모터 매개변수 잡기 (raw 관절 묶음 prototype) ──
const CAP = new WeakMap(); // rawSet → Map(handle → {ax: {t,tv,k,d}})
let rawPatched = false;
function patchRaw(rs) {
  if (rawPatched || !rs) return;
  const P = Object.getPrototypeOf(rs);
  const o = P.jointConfigureMotor;
  P.jointConfigureMotor = function (h, ax, t, tv, k, d) { let m = CAP.get(this); if (!m) CAP.set(this, (m = new Map())); let e = m.get(h); if (!e) m.set(h, (e = {})); e[ax] = { t, tv, k, d }; return o.call(this, h, ax, t, tv, k, d); };
  rawPatched = true;
}
const oCIJ = W0.createImpulseJoint;
W0.createImpulseJoint = function (...a) { patchRaw(this.impulseJoints.raw); return oCIJ.apply(this, a); };

// ── 싸움꾼 등록 · 명시 토크 쌍 모으기 ──
const FIGHTERS = new Set();
const EXPL = new WeakMap(); // fighter → Map(childHandle → torque on child (world))
const oFStep = Fighter.prototype.step;
Fighter.prototype.step = function (dt) {
  FIGHTERS.add(this);
  EXPL.set(this, new Map());
  return oFStep.call(this, dt);
};
const oPair = LegDrive.prototype.pair;
LegDrive.prototype.pair = function (parent, child, x, y, z) {
  const m = EXPL.get(this.f); if (m) { const k = child.handle; const p = m.get(k) ?? V(); m.set(k, V(p.x - x, p.y - y, p.z - z)); }
  return oPair.call(this, parent, child, x, y, z);
};
// Q4: 감쇠 0 (그 다리 세 관절 · 그 창 스텝만)
const STEPNO = new WeakMap(); // world → 지금까지 끝난 스텝 수
const oDrive = Fighter.prototype.driveJoints;
Fighter.prototype.driveJoints = function (...a) {
  if (ZD_STEP != null && !ZD_OFF && isWho(this, true)) {
    const s = STEPNO.get(this.world) ?? 0;
    if (s >= ZD_STEP && s < ZD_STEP + ZD_N) { const l = this.gait.legs[ZD_LEG]; for (const n of [l.thigh, l.shin, l.foot]) this.jointByName[n].gainD = 0; }
  }
  return oDrive.apply(this, a);
};
function isWho(f, mainOnly = false) { if (mainOnly || WHO === 'P') return f.index === 0 || f.name === 'P'; return true; }

// ── 다리 관절 목록 ──
function legJoints(f) {
  const out = [];
  for (const k of ['F', 'B']) for (const [n, kind] of [['thigh' + k, 't'], ['shin' + k, 's'], ['foot' + k, 'f']]) {
    const j = f.jointByName[n]; if (!j?.joint) continue;
    out.push({ n, k, kind, j, h: j.joint.handle, ph: j.parent.handle, ch: j.child.handle, hinge: j.type === 'hinge' });
  }
  return out;
}
const AXES = { t: [['abd', V(1, 0, 0), 'hipAbd', 'hipAbd'], ['rot', V(0, 1, 0), 'hipRot', 'hipRot'], ['flex', V(0, 0, 1), 'hipFlex', 'hipFlex']], s: [['knee', V(0, 0, 1), 'kneeFlex', 'kneeExt']], f: [['ankle', V(0, 0, 1), 'anklePlantar', 'ankleDorsi']] };

// ── 발 땅 수직 힘 (엔진 접촉 충격량 · 고정 물체와의 접촉만) ──
function footFy(world, f, k) {
  const b = f.bodies['foot' + k]; let fy = 0;
  for (let i = 0; i < b.numColliders(); i++) {
    const c = b.collider(i);
    world.contactPairsWith(c, (c2) => {
      const p2 = c2.parent(); if (p2 && !p2.isFixed()) return;
      world.contactPair(c, c2, (m) => { const n = m.normal(); let s = 0; for (let q = 0; q < m.numContacts(); q++) s += m.contactImpulse(q); fy += Math.abs(n.y) * s; });
    });
  }
  return fy / DT;
}
const TDS = new WeakMap(); // fighter → {F: {on, since}, B: ...}
function bw(f) { let M = 0; for (const { rb } of f.meshes) M += rb.mass(); return M * 9.81; }

// ── 사본 한 스텝 ──
function runCopy(snap, rec, items, x, motorsOff) {
  const W = RAPIER.World.restoreSnapshot(snap);
  const raw = W.impulseJoints.raw;
  for (const it of items) {
    const P = W.getRigidBody(it.ph), C = W.getRigidBody(it.ch);
    if (motorsOff) { if (it.hinge) raw.jointConfigureMotor(it.h, 3, 0, 0, 0, 0); else for (const ax of [3, 4, 5]) raw.jointConfigureMotor(it.h, ax, 0, 0, 0, 0); }
    const T = it.hinge ? scl(it.axis, x[it.o]) : V(x[it.o], x[it.o + 1], x[it.o + 2]);
    if (T.x || T.y || T.z) { oAddTorque.call(C, T, true); oAddTorque.call(P, scl(T, -1), true); }
  }
  const hooks = { filterContactPair: (c1, c2) => (rec.has(c1 + ',' + c2) ? rec.get(c1 + ',' + c2) : 1), filterIntersectionPair: (c1, c2) => (rec.has('i' + c1 + ',' + c2) ? rec.get('i' + c1 + ',' + c2) : true) };
  if (!COPYEQ) COPYEQ = new RAPIER.EventQueue(true);
  origStep.call(W, COPYEQ, hooks); // 이벤트 줄을 넘겨야 접촉 걸이가 불린다 (없으면 걸이 없이 도는 다른 길 — 확인함)
  COPYEQ.clear();
  const y = readY(W, items);
  const all = [];
  for (const h of ALLH) { const b = W.getRigidBody(h); all.push([cv(oLinvel.call(b)), cv(oAngvel.call(b))]); }
  W.free();
  return { y, all };
}
let ALLH = [];
let COPYEQ = null;
function readY(W, items) {
  const y = [];
  for (const it of items) {
    const P = W.getRigidBody(it.ph), C = W.getRigidBody(it.ch);
    const wr = sub(cv(oAngvel.call(C)), cv(oAngvel.call(P)));
    if (it.hinge) { const ax = qrot(cq(oRot.call(P)), V(0, 0, 1)); y.push(dot(wr, ax)); } else y.push(wr.x, wr.y, wr.z);
  }
  return y;
}

// ── 세계 스텝 감싸기 ──
let nSampled = 0, tAB = 0;
W0.step = function (eq, hooks) {
  const s = STEPNO.get(this) ?? 0;
  const fs = [...FIGHTERS].filter((f) => f.world === this && isWho(f) && f.state !== 'dead' && f.gait?.legs);
  // 표본 고르기: 고른 스텝(s % EVERY == 0) + 디딘 뒤 TDWIN 스텝
  let regular = !NOAB && EVERY > 0 && s % EVERY === 0;
  let tdForce = false;
  for (const f of fs) { const T = TDS.get(f); if (T) for (const k of ['F', 'B']) if (T[k].since >= 0 && T[k].since < TDWIN) tdForce = true; }
  const doAB = !NOAB && fs.length && (regular || tdForce);
  let snap = null, rec = null, pre = null;
  if (doAB) {
    snap = this.takeSnapshot();
    rec = new Map();
    pre = fs.map((f) => legJoints(f).map((it) => ({ ...it, qp: cq(oRot.call(it.j.parent)), qc: cq(oRot.call(it.j.child)) })));
  }
  const hk = rec && hooks ? {
    filterContactPair: (c1, c2, b1, b2) => { const r = hooks.filterContactPair(c1, c2, b1, b2); rec.set(c1 + ',' + c2, r); return r; },
    filterIntersectionPair: (c1, c2, b1, b2) => { const r = hooks.filterIntersectionPair ? hooks.filterIntersectionPair(c1, c2, b1, b2) : true; rec.set('i' + c1 + ',' + c2, r); return r; },
  } : hooks;
  const ret = origStep.call(this, eq, hk);
  STEPNO.set(this, s + 1);
  // 발 힘 · 디딤 (스텝마다)
  for (const f of fs) {
    let T = TDS.get(f); if (!T) TDS.set(f, (T = { F: { on: false, since: -1 }, B: { on: false, since: -1 }, bw: bw(f) }));
    for (const k of ['F', 'B']) {
      const fy = footFy(this, f, k); T[k].fy = fy;
      const on = fy > 0.03 * T.bw;
      if (on && !T[k].on) T[k].since = 0; else if (T[k].since >= 0) T[k].since++;
      if (T[k].since > 1000) T[k].since = 1000;
      T[k].on = on;
    }
    if (FORCELOG && isWho(f, true)) {
      const D = f.legDrive?.dbg;
      appendFileSync(FORCELOG, JSON.stringify({ s, fyF: +(T.F.fy / T.bw).toFixed(4), fyB: +(T.B.fy / T.bw).toFixed(4), stF: !!f.gait.legs.F.stance, stB: !!f.gait.legs.B.stance, sinceF: T.F.since, sinceB: T.B.since, N: D && typeof D.N === 'number' ? +(D.N / T.bw).toFixed(4) : null }) + '\n');
    }
  }
  if (doAB) {
    const t0 = performance.now();
    fs.forEach((f, fi) => abFighter(this, f, pre[fi], snap, rec, s, regular));
    tAB += performance.now() - t0; nSampled++;
  }
  if (STOP != null && s + 1 >= STOP && fs.length) { process.stderr.write(`r19 stop at ${s + 1}\n`); process.exit(0); }
  return ret;
};

function abFighter(world, f, items, snap, rec, s, regular) {
  ALLH = f.meshes.map(({ rb }) => rb.handle);
  let o = 0;
  for (const it of items) { it.o = o; o += it.hinge ? 1 : 3; it.axis = qrot(it.qp, V(0, 0, 1)); }
  const n = o;
  const truthY = readY(world, items);
  const truthAll = ALLH.map((h) => { const b = world.getRigidBody(h); return [cv(oLinvel.call(b)), cv(oAngvel.call(b))]; });
  const zero = new Array(n).fill(0);
  let det = null;
  if (VALIDATE || nSampled < 3) { const r = runCopy(snap, rec, items, zero, false); det = Math.max(...r.y.map((v, i) => Math.abs(v - truthY[i]))); }
  // 알려진 답 검산: 모터 끈 사본 + 알려진 토크 X0 를 '원래'로 놓고 같은 풀이로 X0 를 되찾는가
  const solve = (target) => {
    const y0 = runCopy(snap, rec, items, zero, true).y;
    const h = 20, Jc = [];
    for (let i = 0; i < n; i++) { const e = zero.slice(); e[i] = h; const yi = runCopy(snap, rec, items, e, true).y; Jc.push(yi.map((v, r) => (v - y0[r]) / h)); }
    const A = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => Jc[c][r]));
    let x = solveLin(A, target.map((v, i) => v - y0[i]));
    let last = null;
    for (let it = 0; it < 2; it++) { last = runCopy(snap, rec, items, x, true); const r = target.map((v, i) => v - last.y[i]); const dx = solveLin(A, r); x = x.map((v, i) => v + dx[i]); }
    last = runCopy(snap, rec, items, x, true);
    const resid = Math.max(...target.map((v, i) => Math.abs(v - last.y[i])));
    return { x, resid, last };
  };
  const { x, resid, last } = solve(truthY);
  let maxDv = 0, maxDw = 0;
  last.all.forEach(([lv, av], i) => { maxDv = Math.max(maxDv, len(sub(lv, truthAll[i][0]))); maxDw = Math.max(maxDw, len(sub(av, truthAll[i][1]))); });
  let val = null;
  if (VALIDATE) {
    const X0 = items.flatMap((it) => (it.hinge ? [40 * Math.sin(s + it.o)] : [30 * Math.sin(s + it.o), 30 * Math.cos(s + it.o), 20 * Math.sin(2 * s + it.o)]));
    const tgt = runCopy(snap, rec, items, X0, true).y;
    const r = solve(tgt);
    let err = 0, ref = 0; r.x.forEach((v, i) => { err = Math.max(err, Math.abs(v - X0[i])); ref = Math.max(ref, Math.abs(X0[i])); });
    val = { err: +err.toFixed(4), ref: +ref.toFixed(1) };
  }
  // 관절마다: 실제 모터 · 다시 센 모터 · 명시 (모두 자식이 받은 토크 · 세계 틀) → 축 값
  const cap = CAP.get(world.impulseJoints.raw);
  const ex = EXPL.get(f) ?? new Map();
  const T = TDS.get(f);
  const str = { F: f.legDrive.strengthOf('F'), B: f.legDrive.strengthOf('B') };
  const J = [];
  for (const it of items) {
    const real = it.hinge ? scl(it.axis, x[it.o]) : V(x[it.o], x[it.o + 1], x[it.o + 2]);
    // 다시 센 값 (honesty.mjs 와 같은 식)
    let recW = V();
    const m = cap?.get(it.h);
    if (m) {
      const e = rotvec(qmul(cq(it.j.restInv), qmul(qconj(it.qp), it.qc)));
      const P = world.getRigidBody(it.ph), C = world.getRigidBody(it.ch);
      const wr = qrot(qconj(it.qp), sub(cv(oAngvel.call(C)), cv(oAngvel.call(P))));
      const loc = V();
      if (it.hinge) { const sl = m[3]; if (sl) loc.z = sl.k * (sl.t - e.z) + sl.d * (sl.tv - wr.z); }
      else for (const [ax, i] of [['x', 3], ['y', 4], ['z', 5]]) { const sl = m[i]; if (sl) loc[ax] = sl.k * (sl.t - e[ax]) + sl.d * (sl.tv - wr[ax]); }
      recW = qrot(it.qp, loc);
    }
    const expl = ex.get(it.ch) ?? V();
    const fr = it.kind === 's' ? it.qp : it.qc;
    const st = !!f.gait.legs[it.k].stance;
    const out = { n: it.n, st, since: T?.[it.k]?.since ?? -1, str: +str[it.k].toFixed(3), ax: {} };
    for (const [an, vec, pos, neg] of AXES[it.kind]) {
      const w = qrot(fr, vec);
      const mR = -dot(real, w), mC = -dot(recW, w), e = -dot(expl, w), tR = mR + e, tC = mC + e;
      const lim = (v) => ((v >= 0 ? LIM[pos] : LIM[neg]) * Math.max(1e-3, str[it.k]));
      out.ax[an] = [+mR.toFixed(2), +mC.toFixed(2), +e.toFixed(2), +(Math.abs(tR) / lim(tR)).toFixed(4), +(Math.abs(tC) / lim(tC)).toFixed(4), +(Math.abs(mR) / lim(mR)).toFixed(4), +(Math.abs(mC) / lim(mC)).toFixed(4)];
    }
    J.push(out);
  }
  const line = { s, who: f.name ?? f.index, reg: regular, fyF: T ? +(T.F.fy / T.bw).toFixed(3) : null, fyB: T ? +(T.B.fy / T.bw).toFixed(3) : null, resid: +resid.toExponential(2), maxDv: +maxDv.toExponential(2), maxDw: +maxDw.toExponential(2), det, val, J };
  if (OUT) appendFileSync(OUT, JSON.stringify(line) + '\n');
}
process.on('exit', () => { if (OUT) process.stderr.write(`r19 probe: ${nSampled} sampled steps · ${(tAB / Math.max(1, nSampled)).toFixed(1)} ms each\n`); });
