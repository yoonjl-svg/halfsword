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
const WID = new WeakMap(); let nWorld = 0; // world → 판 번호 (한 프로세스에서 판을 여럿 돌리는 도구)
const ABCOND = process.env.R19_ABCOND ?? null; // 'run' = 뛰는 동안(f.run.on)만 A/B
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
const AXESF3 = [['ankInv', V(1, 0, 0), 'ankleInv', 'ankleInv'], ['ankRot', V(0, 1, 0), 'ankleRot', 'ankleRot'], ['ankle', V(0, 0, 1), 'anklePlantar', 'ankleDorsi']]; // 공 발목(본 게임)
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
function runCopy(snap, rec, items, x, offIt) {
  const W = RAPIER.World.restoreSnapshot(snap);
  const raw = W.impulseJoints.raw;
  for (const it of items) {
    const P = W.getRigidBody(it.ph), C = W.getRigidBody(it.ch);
    // 모터 끄기: k = 0 · d = 1e-9 (k = d = 0 을 넣으면 Rapier 0.19 는 관절을 굳힌다 — 확인함: 그 축이 토크에 꿈쩍 않음)
    if (it === offIt) { if (it.hinge) raw.jointConfigureMotor(it.h, 3, 0, 0, 0, 1e-9); else for (const ax of [3, 4, 5]) raw.jointConfigureMotor(it.h, ax, 0, 0, 0, 1e-9); }
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
  return { y, all, z: zvec(all) };
}
let ALLH = [], WT = []; // 몸 토막 손잡이 · 무게 (√m · √I)
const zvec = (all) => { const z = []; all.forEach(([lv, av], i) => { const [a, b] = WT[i]; z.push(lv.x * a, lv.y * a, lv.z * a, av.x * b, av.y * b, av.z * b); }); return z; };
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
  if (!WID.has(this)) WID.set(this, nWorld++);
  const wid = WID.get(this);
  const fs = [...FIGHTERS].filter((f) => f.world === this && isWho(f) && f.state !== 'dead' && f.gait?.legs);
  // 표본 고르기: 고른 스텝(s % EVERY == 0) + 디딘 뒤 TDWIN 스텝
  let regular = !NOAB && EVERY > 0 && s % EVERY === 0;
  let tdForce = false;
  for (const f of fs) { const T = TDS.get(f); if (T) for (const k of ['F', 'B']) if (T[k].since >= 0 && T[k].since < TDWIN) tdForce = true; }
  const condOK = ABCOND !== 'run' || fs.some((f) => f.run?.on);
  const doAB = !NOAB && fs.length && condOK && (regular || tdForce);
  let snap = null, rec = null, pre = null;
  if (doAB) {
    snap = this.takeSnapshot();
    rec = new Map();
    pre = fs.map((f) => legJoints(f).map((it) => ({ ...it, qp: cq(oRot.call(it.j.parent)), qc: cq(oRot.call(it.j.child)), vc0: cv(oLinvel.call(it.j.child)), wc0: cv(oAngvel.call(it.j.child)), cc0: cv(it.j.child.worldCom()), tc0: cv(it.j.child.translation()), pf: cq(it.j.child.principalInertiaLocalFrame()), pi: cv(it.j.child.principalInertia()), m: it.j.child.mass(), a2: cv(it.j.joint.anchor2()), ld: it.j.child.linearDamping(), ad: it.j.child.angularDamping() })));
  }
  const hk = rec && hooks ? {
    filterContactPair: (c1, c2, b1, b2) => { const r = hooks.filterContactPair(c1, c2, b1, b2); rec.set(c1 + ',' + c2, r); return r; },
    filterIntersectionPair: (c1, c2, b1, b2) => { const r = hooks.filterIntersectionPair ? hooks.filterIntersectionPair(c1, c2, b1, b2) : true; rec.set('i' + c1 + ',' + c2, r); return r; },
  } : hooks;
  const preV = STEPLOG && fs.length ? fs.map((f) => f.meshes.map(({ rb }) => [oLinvel.call(rb).y, rb.mass(), rb.linearDamping()])) : null;
  const preQ = !NOIMP && fs.length ? fs.map((f) => legJoints(f).map((it) => ({ ...it, qp: cq(oRot.call(it.j.parent)), qc: cq(oRot.call(it.j.child)) }))) : null;
  const ret = origStep.call(this, eq, hk);
  if (preQ) impFighters(this, fs, preQ, s, preV, wid);
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

// ── 모터 충격량 읽기: 스텝 뒤 스냅숏 바이트에서 JointMotor { target_vel, target_pos, stiffness, damping, max_force, impulse, model } 를 찾는다 (bincode · f32 · 정렬 없음).
//  넘긴 [tv, t, k, d] 네 값(f32)이 이어진 자리 → +20 바이트 = impulse. Rapier 는 마지막 작은 스텝(substep)의 충격량만 남긴다 →
//  토크 ≈ impulse ÷ (dt / 작은 스텝 수). 자유 두 몸 시험(dbg d4)에서 참값 ÷ 이 값 = 1.11 ~ 1.14 (첫 작은 스텝들이 더 큼) — A/B 로 다시 맞춘다
const NOIMP = !!process.env.R19_NOIMP;
const STEPLOG = process.env.R19_STEPLOG ?? null;
const f32b = (() => { const F = new Float32Array(1), U = new Uint32Array(F.buffer); return (x) => { F[0] = x; return U[0]; }; })();
const LASTIMP = new WeakMap(); // fighter → Map(jointName → child torque world (imp 법))
function impFighters(world, fs, preQ, s, preV, wid) {
  const cap = CAP.get(world.impulseJoints.raw); if (!cap) return;
  const sn = world.takeSnapshot();
  const dv = new DataView(sn.buffer, sn.byteOffset, sn.byteLength);
  const nsub = world.integrationParameters.numSolverIterations || 1;
  const want = new Map(); const slots = [];
  fs.forEach((f, fi) => preQ[fi].forEach((it) => { const m = cap.get(it.h); if (!m) return; for (const ax of it.hinge ? [3] : [3, 4, 5]) { const c = m[ax]; if (!c) continue; const pat = [c.tv, c.t, c.k, c.d].map(f32b); const sl = { fi, it, ax, pat, imp: null, hits: 0 }; slots.push(sl); const a = want.get(pat[0]) ?? []; a.push(sl); want.set(pat[0], a); } }));
  for (let o = 0; o + 24 <= sn.length; o++) {
    const a = want.get(dv.getUint32(o, true)); if (!a) continue;
    for (const sl of a) if (dv.getUint32(o + 4, true) === sl.pat[1] && dv.getUint32(o + 8, true) === sl.pat[2] && dv.getUint32(o + 12, true) === sl.pat[3]) { sl.imp = dv.getFloat32(o + 20, true); sl.hits++; }
  }
  const per = fs.map(() => new Map());
  for (const sl of slots) {
    if (sl.hits !== 1) { IMPMISS++; continue; }
    const tq = -sl.imp / (DT / nsub);
    const axL = sl.it.hinge ? V(0, 0, 1) : sl.ax === 3 ? V(1, 0, 0) : sl.ax === 4 ? V(0, 1, 0) : V(0, 0, 1);
    const w = qrot(sl.it.qp, axL), m = per[sl.fi];
    m.set(sl.it.n, add(m.get(sl.it.n) ?? V(), scl(w, tq)));
  }
  fs.forEach((f, fi) => {
    LASTIMP.set(f, per[fi]);
    if (!STEPLOG) return;
    const T = TDS.get(f), ex = EXPL.get(f) ?? new Map();
    const str = { F: f.legDrive.strengthOf('F'), B: f.legDrive.strengthOf('B') };
    const J = preQ[fi].map((it) => {
      const real = per[fi].get(it.n) ?? V(), expl = ex.get(it.ch) ?? V();
      const recW = recompute(world, it, cap);
      const fr = it.kind === 's' ? it.qp : it.qc;
      const axv = AXES2[it.kind].map(([an, vec]) => { const w = qrot(fr, vec); return [+(-dot(real, w)).toFixed(2), +(-dot(recW, w)).toFixed(2), +(-dot(expl, w)).toFixed(2)]; });
      return [it.n, f.gait.legs[it.k].stance ? 1 : 0, +str[it.k].toFixed(3), axv];
    });
    // 접촉 힘은 다음 스텝 앞에 셈된 TDS 를 쓰면 한 스텝 늦으므로 여기서 다시 잰다
    const BW = T?.bw ?? bw(f);
    const fyF = footFy(world, f, 'F') / BW, fyB = footFy(world, f, 'B') / BW;
    const D = f.legDrive?.dbg;
    let fyM = null; // 몸 전체 운동량으로 잰 접촉 수직 힘 (선언 힘은 빼지 않음 — 다리 쪽엔 수직 선언 힘이 없다) ÷ 몸무게
    if (preV) { let dp = 0, M = 0; f.meshes.forEach(({ rb }, i) => { const [vy0, m, ld] = preV[fi][i]; dp += m * (oLinvel.call(rb).y * (1 + ld * DT) - vy0); M += m; }); fyM = (dp / DT + M * 9.81) / BW; }
    appendFileSync(STEPLOG, JSON.stringify({ s, wid, who: f.name ?? f.index, state: f.state, run: f.run?.on ? 1 : 0, fyM: fyM == null ? null : +fyM.toFixed(3), fyF: +fyF.toFixed(3), fyB: +fyB.toFixed(3), N: D && typeof D.N === 'number' ? +(D.N / BW).toFixed(3) : null, J }) + '\n');
  });
}
let IMPMISS = 0;
const AXES2 = { t: [['abd', V(1, 0, 0)], ['rot', V(0, 1, 0)], ['flex', V(0, 0, 1)]], s: [['knee', V(0, 0, 1)]], f: [['ankInv', V(1, 0, 0)], ['ankRot', V(0, 1, 0)], ['ankle', V(0, 0, 1)]] };
function recompute(world, it, cap) {
  const m = cap?.get(it.h); if (!m) return V();
  const e = rotvec(qmul(cq(it.j.restInv), qmul(qconj(it.qp), it.qc)));
  const P = world.getRigidBody(it.ph), C = world.getRigidBody(it.ch);
  const wr = qrot(qconj(it.qp), sub(cv(oAngvel.call(C)), cv(oAngvel.call(P))));
  const loc = V();
  if (it.hinge) { const sl = m[3]; if (sl) loc.z = sl.k * (sl.t - e.z) + sl.d * (sl.tv - wr.z); }
  else for (const [ax, i] of [['x', 3], ['y', 4], ['z', 5]]) { const sl = m[i]; if (sl) loc[ax] = sl.k * (sl.t - e[ax]) + sl.d * (sl.tv - wr[ax]); }
  return qrot(it.qp, loc);
}

function abFighter(world, f, items, snap, rec, s, regular) {
  ALLH = f.meshes.map(({ rb }) => rb.handle);
  WT = f.meshes.map(({ rb }) => { const I = rb.principalInertia(); return [Math.sqrt(rb.mass()), Math.sqrt((I.x + I.y + I.z) / 3)]; });
  let o = 0;
  for (const it of items) { it.o = o; o += it.hinge ? 1 : 3; it.axis = qrot(it.qp, V(0, 0, 1)); }
  const n = o;
  const truthY = readY(world, items);
  const truthAll = ALLH.map((h) => { const b = world.getRigidBody(h); return [cv(oLinvel.call(b)), cv(oAngvel.call(b))]; });
  const zero = new Array(n).fill(0);
  let det = null;
  if (VALIDATE || nSampled < 3) { const r = runCopy(snap, rec, items, zero, null); det = Math.max(...r.y.map((v, i) => Math.abs(v - truthY[i]))); }
  // 관절 하나씩: 그 관절 모터만 끄고 토크 쌍 x(경첩 1 · 공 3)로 바꿔, 그 관절 상대 각속도가 원래와 같아지는 x (나머지 관절 모터는 그대로).
  //  (모터 여섯을 한꺼번에 끄고 14 개를 함께 풀면 두 발이 땅에 닿은 닫힌 고리에서 야코비안이 특이 — 고리 안 토크 나눔은 움직임으로 안 갈린다. 확인함)
  //  맞추는 것 = 그 싸움꾼 모든 몸 토막의 선 · 각속도(√m · √I 무게 — 운동 에너지 틀)를 최소제곱으로. 관절 상대 각속도만 맞추면 디딘 다리(발이 땅에 눌린 닫힌 고리)에서
  //  토크가 거의 땅 반력으로 빠져 그 관절 각속도로는 안 보인다 — 반작용을 받는 부모 쪽 몸 · 골반의 움직임까지 맞춰야 갈린다(확인함)
  const solveJ = (targetZ, it) => {
    const d = it.hinge ? 1 : 3;
    const mk = (v) => { const x = zero.slice(); for (let i = 0; i < d; i++) x[it.o + i] = v[i]; return x; };
    const z0 = runCopy(snap, rec, items, zero, it).z;
    const h = it.kind === 'f' ? 1 : 5, cols = []; // 발목: 발이 가벼워(1.1 kg) 모터 없이 20 N·m 이면 한 스텝에 ±80 rad/s — 관절 끝에 닿아 비선형. 작은 h
    for (let c = 0; c < d; c++) { const e = new Array(d).fill(0); e[c] = h; const zc = runCopy(snap, rec, items, mk(e), it).z; cols.push(zc.map((q, r) => (q - z0[r]) / h)); }
    const N = Array.from({ length: d }, (_, r) => Array.from({ length: d }, (_, c) => cols[r].reduce((s2, q, i) => s2 + q * cols[c][i], 0)));
    const ls = (res) => solveLin(N, cols.map((cl) => cl.reduce((s2, q, i) => s2 + q * res[i], 0)));
    let v = ls(targetZ.map((t, i) => t - z0[i]));
    let last = null;
    for (let k = 0; k < 4; k++) { last = runCopy(snap, rec, items, mk(v), it); const dv = ls(targetZ.map((t, i) => t - last.z[i])); v = v.map((q, i) => q + dv[i]); }
    last = runCopy(snap, rec, items, mk(v), it);
    const nr = Math.hypot(...targetZ.map((t, i) => t - last.z[i])), n0 = Math.hypot(...targetZ.map((t, i) => t - z0[i]));
    return { v, resid: nr / Math.max(1e-9, n0), last, nr, n0 };
  };
  const truthZ = zvec(truthAll);
  if (process.env.R19_LIN && nSampled < 6) for (const it of items.slice(0, 3)) {
    const out = [];
    for (const q of [-40, -20, -10, 0, 10, 20, 40]) { const x = zero.slice(); x[it.o] = q; const r = runCopy(snap, rec, items, x, it); out.push(r.y[it.o].toFixed(4) + '|' + r.z[0].toFixed(4)); }
    process.stderr.write(`lin s=${s} ${it.n} ${out.join(' ')}\n`);
  }
  const x = zero.slice();
  let resid = 0, maxDv = 0, maxDw = 0;
  const per = [];
  for (const it of items) {
    const r = solveJ(truthZ, it);
    r.v.forEach((q, i) => (x[it.o + i] = q));
    let dv = 0, dw = 0;
    r.last.all.forEach(([lv, av], i) => { dv = Math.max(dv, len(sub(lv, truthAll[i][0]))); dw = Math.max(dw, len(sub(av, truthAll[i][1]))); });
    resid = Math.max(resid, r.resid); maxDv = Math.max(maxDv, dv); maxDw = Math.max(maxDw, dw);
    per.push([+r.resid.toExponential(2), +dv.toExponential(2), +dw.toExponential(2), +r.nr.toExponential(2), +r.n0.toExponential(2)]);
  }
  let val = null;
  if (VALIDATE) {
    let err = 0, ref = 0; const ej = [];
    for (const it of items) {
      let e1 = 0;
      const A0 = it.kind === 'f' ? 6 : 30;
      const X0 = it.hinge ? [A0 * Math.sin(s + it.o)] : [A0 * Math.sin(s + it.o), A0 * Math.cos(s + it.o), A0 * 0.7 * Math.sin(2 * s + it.o)];
      const xx = zero.slice(); X0.forEach((q, i) => (xx[it.o + i] = q));
      const tgt = runCopy(snap, rec, items, xx, it).z;
      const r = solveJ(tgt, it);
      r.v.forEach((q, i) => { e1 = Math.max(e1, Math.abs(q - X0[i]) / A0); ref = Math.max(ref, Math.abs(X0[i]) / A0); });
      err = Math.max(err, e1); ej.push(+e1.toFixed(3));
    }
    val = { err: +err.toFixed(4), ref: +ref.toFixed(1), ej };
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
    const impW = LASTIMP.get(f)?.get(it.n) ?? V();
    // 뜬 발(땅 접촉 0)의 발목: 발 한 몸의 운동량으로 잰 관절 토크(정답) = I(ω' − ω)/dt − 명시 − (닻 − 질량중심) × 관절 힘 · 관절 힘 = m(v' − v)/dt − m g (엔진 감쇠 되돌림)
    let momW = null;
    if (it.kind === 'f' && T && T[it.k].fy === 0) {
      const C = world.getRigidBody(it.ch);
      const v1 = scl(cv(oLinvel.call(C)), 1 + it.ld * DT), w1 = scl(cv(oAngvel.call(C)), 1 + it.ad * DT);
      const q = qmul(it.qc, it.pf), dw = qrot(qconj(q), sub(w1, it.wc0));
      const Idw = qrot(q, V(it.pi.x * dw.x, it.pi.y * dw.y, it.pi.z * dw.z));
      const FJ = sub(scl(sub(v1, it.vc0), it.m / DT), V(0, -9.81 * it.m, 0));
      const r = sub(add(it.tc0, qrot(it.qc, it.a2)), it.cc0);
      const cr = V(r.y * FJ.z - r.z * FJ.y, r.z * FJ.x - r.x * FJ.z, r.x * FJ.y - r.y * FJ.x);
      momW = sub(sub(scl(Idw, 1 / DT), ex.get(it.ch) ?? V()), cr);
    }
    const st = !!f.gait.legs[it.k].stance;
    const out = { n: it.n, st, since: T?.[it.k]?.since ?? -1, str: +str[it.k].toFixed(3), ax: {} };
    for (const [an, vec, pos, neg] of (it.kind === 'f' && !it.hinge ? AXESF3 : AXES[it.kind])) {
      const w = qrot(fr, vec);
      const mR = -dot(real, w), mC = -dot(recW, w), e = -dot(expl, w), tR = mR + e, tC = mC + e;
      const lim = (v) => ((v >= 0 ? LIM[pos] : LIM[neg]) * Math.max(1e-3, str[it.k]));
      out.ax[an] = [+(-dot(impW, w)).toFixed(2), +mR.toFixed(2), momW ? +(-dot(momW, w)).toFixed(2) : null, +mC.toFixed(2), +e.toFixed(2), +(Math.abs(tR) / lim(tR)).toFixed(4), +(Math.abs(tC) / lim(tC)).toFixed(4), +(Math.abs(mR) / lim(mR)).toFixed(4), +(Math.abs(mC) / lim(mC)).toFixed(4)];
    }
    J.push(out);
  }
  const line = { s, wid: WID.get(world), who: f.name ?? f.index, state: f.state, run: f.run?.on ? 1 : 0, reg: regular, fyF: T ? +(T.F.fy / T.bw).toFixed(3) : null, fyB: T ? +(T.B.fy / T.bw).toFixed(3) : null, per, resid: +resid.toExponential(2), maxDv: +maxDv.toExponential(2), maxDw: +maxDw.toExponential(2), det, val, J };
  if (OUT) appendFileSync(OUT, JSON.stringify(line) + '\n');
}
process.on('exit', () => { process.stderr.write(`r19 probe: ${nSampled} sampled steps · ${(tAB / Math.max(1, nSampled)).toFixed(1)} ms each · imp misses ${IMPMISS}\n`); });
