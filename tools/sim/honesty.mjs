// ─────────────────────────────────────────────────────────────
//  honesty.mjs — 물리 정직성 지표 H1 (물리 2.0 · 0 단계 · docs/strike/physics2_plan_2026-11-23.md §4 · §8). 재기만 한다 — 몸에 아무것도 걸지 않는다.
//
//   node tools/sim/honesty.mjs [--scene=stand|stand30|walk|walkstop|strafe|back|kick|stroke|fight|school|all] [--kick=40 (N·s)] [--kickdir=front|back|left|right] · ragdoll(바닥값) · perf [--compare=<기준 json — 지문 견줌>] [--cells=유파:무기:상대,…] [--weapon=longsword] [--seed=7] [--secs=30] [--fam=diagR] [--json=<파일>] [--root=<트리>] [--selftest]
//
//  H1 = 몸(14 강체 + 칼)이 받는 힘 가운데 '몸 밖'에서 온 몫. 힘 몫과 일 몫을 따로 적는다 (감사 11/24: 선 몸은 받침이 한 일이 0 이라 일만으로는 안 보인다).
//   밖 = 받침(support) · 걷기 밀기(push) · 닻 모터 토크(anchor) · 엔진 감쇠(damp) · 속도 직접 쓰기(write) · 질량 바뀜(mass) · 그 밖 짝 없는 선언 힘(unpaired)
//   안 = 근육 쌍(한 단계의 선언 힘 합 = 0 인 몫) · 발 핀(pin — 마찰 모형) · 엔진이 푼 것(땅 접촉 · 관절 · 상대와의 접촉 = 잔차 res)
//   따로 = 밀쳐내기(shove — 쌍이지만 닿아서 생긴 힘이 아님) · 판정 뒤 충격(combat — 끌림 · 되튐 · 규칙 충격. 쌍 여부는 두 몸 합으로 검산)
//  재는 법: 강체 메서드(addForce … applyImpulse · setLinvel · setAngvel)를 감싸 선언 힘을 단계 이름표와 함께 적고(인자는 그대로 넘김),
//   스텝마다 운동량 P · 에너지 E 표본을 떠서 잔차 res = dP/dt − M g − Σ선언 − 감쇠 로 엔진이 준 힘(땅 + 접촉)을 얻는다 (계 선운동량 — 정확).
//   닻 토크는 엔진 모터라 직접 못 읽는다 → 넘어간 k · d 로 다시 셈 τ̂ = −(k·e + d·ω_rel) (chain_ledger.mjs 와 같은 식 · 묵시 풀이라 ± 20 % 쯤).
//   엔진 감쇠: Rapier 는 풀이 뒤 v ← v/(1 + c·dt) → 충격량 = −m·v_뒤·c·dt (회전도 같은 꼴). world.step 바로 뒤 속도로 셈.
//  일: 선언 힘 F·v̄ (v̄ = 스텝 앞뒤 평균 · 작용점 속도) · 닻 τ̂·ω_골반 · 감쇠 −c(m v² + ω·Iω). 안쪽 일률 = dE/dt − 밖 일률 (근육 + 접촉 + 관절이 한 일의 합 — 스텝 안 상쇄는 못 가름).
//  지표: 힘 몫 = ∫|F_밖|dt ÷ (∫|F_밖|dt + ∫|F_안|dt) · 수직 받침 몫 = ∫받침_y dt ÷ (M g T) · 일 몫 = ∫|P_밖|dt ÷ (∫|P_밖|dt + ∫|P_안|dt).
//  선언된 밖 도움 (갈래 aid = Fighter.driveAid 안에서 건 것 · 11/24 검토에서 고침): 네 값으로 갈라 평균(잰 시간 전체로 나눔) · 스텝 최고를 적는다 —
//   돌리는 토크 yaw(수직축) · 기울기 토크(수평 두 축) · 드는 힘(수직 알짜 · ÷ 맨몸 체중) · 수평 힘(수평 알짜). 토크는 그 스텝에 도움 이름으로 건 것 모두(addTorque + 힘 × 팔)의 계 질량중심 둘레 알짜,
//   힘은 크기 합도 같이(짝힘으로 건 도움은 알짜 힘 0 · 예전 셈으로는 토크도 0 으로 읽혀 보고 줄이 사라졌다). 맨몸 체중 = bareWeight(싸움꾼 자기 토막 충돌 모양 질량 합 × g — 칼 · 발 덧질량 빼고).
//   --selftest 가 순수 토크 · 드는 힘 · 짝힘(두 축) · 수평 힘 · 절반 시간을 상자로 확인한다. 옛 칸 이름은 그대로(뜻이 바뀐 것 · 옛 셈을 남긴 칸은 summary 의 aid 주석).
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;

const V3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => V3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => V3(a.x - b.x, a.y - b.y, a.z - b.z);
const scl = (a, s) => V3(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const cv = (a) => V3(a.x, a.y, a.z);
const qmul = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const qrot = (q, v) => { const t = cross(q, v); const t2 = scl(t, 2); return add(add(v, scl(t2, q.w)), cross(q, t2)); };
const rotvec = (q) => { const s = q.w < 0 ? -2 : 2; return V3(q.x * s, q.y * s, q.z * s); };
const cq = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });

const AXG = { x: 3, z: 4, y: 5 }; // 닻 generic 관절의 raw 축 (chain_ledger.mjs · 측정 10/7)
const PAIRED = new Set(['sword', 'offhand', 'muscle', 'elbowG', 'track', 'anat', 'swing']); // 한 몸 안에서 짝이 맞아야 하는 단계 — 안 맞는 몫은 unpaired 로
const OUT = ['support', 'push', 'anchor', 'damp', 'write', 'mass', 'unpaired', 'aid'];
const SHARED = { phase: 'other', sets: [] }; // 단계 이름표는 한 번에 하나 (모든 장부가 같이 봄)

/** 맨몸 체중 (N) — 도움 · 받침을 '÷ 체중' 으로 적을 때 쓰는 하나뿐인 분모. 싸움꾼 자기 토막들의 충돌 모양 질량 합 × 중력.
 *  칼은 안 넣고, 강체에 덧댄 질량(디딘 발 덧질량 setAdditionalMass — 재는 동안 바뀜)도 안 넣는다. 세 무기 · 두 나무 모두 736.7 N (config AID.liftMax 가 곱하는 체중과 같은 값). */
export function bareWeight(f, g = 9.81) {
  let m = 0; const seen = new Set();
  for (const b of Object.values(f?.bodies ?? {})) { if (!b || seen.has(b.handle) || (f.sword && b.handle === f.sword.handle)) continue; seen.add(b.handle); for (let i = 0, n = b.numColliders(); i < n; i++) m += b.collider(i).mass(); }
  return m * Math.abs(g);
}

/**
 * attach(world, bodies, opts) → 장부. bodies = [[이름, 강체]…]. opts.fighter 가 있으면 단계 감싸기 · 닻 재계산을 한다.
 * pre() = 스텝 앞(힘 넣기 전) · mid() = world.step 바로 뒤 · post() = 스텝 끝. 장면 쪽이 차례대로 부른다 (hook(G, [장부…]) 가 G.step 에 건다).
 */
export function attach(world, named, opts = {}) {
  const DT = world.timestep;
  const g = world.gravity.y;
  const bodies = named.map(([, b]) => b), names = named.map(([n]) => n);
  const f = opts.fighter ?? null;
  const L = { names, rows: 0, T: 0, acc: {}, chk: { resMax: 0, pairMax: 0 }, fighter: f, place: { steps: 0, swordSteps: 0, calls: 0, kgm: 0 }, wounds: [], foe: null, swordPlacedAt: -9 };
  let placedNow = false, swordNow = false;
  const iSword = f?.sword ? named.findIndex(([, b]) => b.handle === f.sword.handle) : -1;
  L.virt = {}; L.joint = {}; L.dyn = [];
  L.bareMg = f ? bareWeight(f, g) : null; // 맨몸 체중 (칼 · 덧질량 빼고) — 붙일 때 한 번
  const A = (k) => (L.acc[k] ||= { Fimp: 0, Fy: 0, Timp: 0, Wabs: 0, Wpos: 0, Wneg: 0, n: 0 });
  let decl = [];
  const mine = new Map(bodies.map((b, i) => [b.handle, i]));
  bodies.forEach((rb, bi) => {
    const o = {};
    for (const k of ['addForce', 'addForceAtPoint', 'addTorque', 'applyImpulse', 'applyImpulseAtPoint', 'applyTorqueImpulse', 'setLinvel', 'setAngvel', 'setTranslation', 'setRotation']) o[k] = rb[k];
    // 자리 직접 놓기 (운동학 칼 · 순간 이동): 힘이 아니라 자리를 쓴다 → 스텝 수 · 옮긴 질량 × 거리로 따로 센다
    rb.setTranslation = function (t, w) { const t0 = this.translation(); L.place.calls++; L.place.kgm += this.mass() * Math.hypot(t.x - t0.x, t.y - t0.y, t.z - t0.z); placedNow = true; if (bi === iSword) swordNow = true; return o.setTranslation.call(this, t, w); };
    rb.setRotation = function (q, w) { L.place.calls++; placedNow = true; if (bi === iSword) swordNow = true; return o.setRotation.call(this, q, w); };
    const com = () => cv(rb.worldCom());
    rb.addForce = function (F, w) { decl.push({ bi, r: V3(), p: com(), F: cv(F), T: null, kind: SHARED.phase }); return o.addForce.call(this, F, w); };
    rb.addForceAtPoint = function (F, P, w) { decl.push({ bi, r: sub(cv(P), com()), p: cv(P), F: cv(F), T: null, kind: SHARED.phase }); return o.addForceAtPoint.call(this, F, P, w); };
    rb.addTorque = function (T, w) { decl.push({ bi, r: null, F: null, T: cv(T), kind: SHARED.phase }); return o.addTorque.call(this, T, w); };
    rb.applyImpulse = function (J, w) { decl.push({ bi, r: V3(), p: com(), F: scl(cv(J), 1 / DT), T: null, kind: SHARED.phase, imp: true }); return o.applyImpulse.call(this, J, w); };
    rb.applyImpulseAtPoint = function (J, P, w) { decl.push({ bi, r: sub(cv(P), com()), p: cv(P), F: scl(cv(J), 1 / DT), T: null, kind: SHARED.phase, imp: true }); return o.applyImpulseAtPoint.call(this, J, P, w); };
    rb.applyTorqueImpulse = function (J, w) { decl.push({ bi, r: null, F: null, T: scl(cv(J), 1 / DT), kind: SHARED.phase, imp: true }); return o.applyTorqueImpulse.call(this, J, w); };
    rb.setLinvel = function (v, w) { const v0 = cv(this.linvel()); decl.push({ bi, r: V3(), p: com(), F: scl(sub(cv(v), v0), this.mass() / DT), T: null, kind: 'write', imp: true, v0 }); return o.setLinvel.call(this, v, w); };
    rb.setAngvel = function (wv, w) { const w0 = cv(this.angvel()); decl.push({ bi, r: null, F: null, T: scl(Iw(bi, sub(cv(wv), w0)), 1 / DT), kind: 'write', imp: true }); return o.setAngvel.call(this, wv, w); };
  });
  const Iw = (i, w) => { // 세계 틀 관성 텐서 × 벡터
    const b = bodies[i], q = qmul(cq(b.rotation()), cq(b.principalInertiaLocalFrame())), ip = b.principalInertia();
    const wl = qrot(qconj(q), w);
    return qrot(q, V3(ip.x * wl.x, ip.y * wl.y, ip.z * wl.z));
  };
  // 단계 이름표 · 닻 모터 매개변수 (싸움꾼만)
  let capUp = null;
  if (f) {
    const wrap = (obj, name, tag) => { const orig = obj?.[name]; if (typeof orig !== 'function') return; obj[name] = function (...a) { const prev = SHARED.phase; SHARED.phase = tag; try { return orig.apply(this, a); } finally { SHARED.phase = prev; } }; };
    for (const [n, t] of [['driveBalance', 'balance'], ['shove', 'shove'], ['closeStep', 'closePush'], ['driveSword', 'sword'], ['offHand', 'offhand'], ['driveJoints', 'muscle'], ['elbowGravity', 'elbowG'], ['anatSoft', 'anat'], ['trackBlade', 'track'], ['driveAid', 'aid']]) wrap(f, n, t); // aid = 선언된 밖 도움(세우는 토크 · 일으키는 힘 — 크기를 못박아 따로 적는 갈래)
    wrap(f.gait, 'pinFeet', 'pin');
    wrap(f.gait, 'swingPull', 'swing'); // 내딛는 발 ↔ 골반 당김 (쌍 — 힘은 맞지만 작용선이 달라 짝힘 토크가 남을 수 있음)
    const rs = (f.uprightJoint ?? f.joints?.find((j) => j.joint)?.joint ?? f.gripJoint)?.rawSet; // 닻이 없는 몸에서도 모터 매개변수를 잡는다 (관절 묶음은 세계에 하나)
    if (rs && !rs.__honestyCap) {
      const cap = (rs.__honestyCap = new Map());
      const o1 = rs.jointConfigureMotorPosition;
      rs.jointConfigureMotorPosition = function (h, ax, t, k, d) { let m = cap.get(h); if (!m) cap.set(h, (m = {})); m[ax] = { t, tv: 0, k, d }; return o1.call(this, h, ax, t, k, d); };
      const o2 = rs.jointConfigureMotor;
      if (typeof o2 === 'function') rs.jointConfigureMotor = function (h, ax, t, tv, k, d) { let m = cap.get(h); if (!m) cap.set(h, (m = {})); m[ax] = { t, tv, k, d }; return o2.call(this, h, ax, t, tv, k, d); };
    }
    capUp = () => (rs && f.uprightJoint ? rs.__honestyCap.get(f.uprightJoint.handle) : null);
    // H3: 받은 상처마다 물리 에너지 대 판정 에너지 (applyWound 인자 그대로 넘김). 친 쪽 칼이 이 스텝 · 앞 두 스텝에 '놓인' 칼이면 운동학 칼 상처
    const aw = f.applyWound;
    f.applyWound = function (h, ...rest) {
      const kin = false; // 스텝 끝 · 요약에서 정함 (같은 스텝에서 상처가 놓기보다 먼저일 수 있다)
      const E0 = h.mFree != null && h.speed != null ? 0.5 * h.mFree * h.speed * h.speed : null;
      L.wounds.push({ type: h.type, zone: h.zone, sev: h.severity ?? 0, energy: h.energy ?? null, eff: h.eff ?? null, ephys: h.ephys ?? null, E0, speed: h.speed ?? null, mFree: h.mFree ?? null, mEff: h.mEff ?? null, finish: h.finishPower ?? null, kin, row: L.rows });
      return aw.call(this, h, ...rest);
    };
  }
  // ── 관절 표 (싸움꾼): 관절마다 먼 쪽 토막 묶음 · 닻 자리 · 사람 한도(가늠 · 센 어른 · N·m — 엉덩이 250 · 무릎 250 · 발목 250 · 허리 300 · 목 60 · 어깨 100 · 팔꿈치 80 · 손목 25) ──
  const HUMAN = [[/^thigh/, 250], [/^shin/, 250], [/^foot/, 250], [/^abdomen|^chest/, 300], [/^head/, 60], [/^uarm/, 100], [/^farm/, 80], [/^sword/, 25]];
  if (f?.joints) {
    const edges = f.joints.filter((j) => j.joint && j.parent && j.child).map((j) => ({ name: j.name, handle: j.joint.handle, ip: mine.get(j.parent.handle), ic: mine.get(j.child.handle), parent: j.parent, manual: !!j.manual, hinge: j.type === 'hinge', restInv: j.restInv ? cq(j.restInv) : { x: 0, y: 0, z: 0, w: 1 }, a1: (() => { try { return cv(j.joint.anchor1()); } catch { return V3(); } })() }));
    if (f.sword && f.bodies.farmS && f.gripJoint) edges.push({ name: 'sword', handle: f.gripJoint.handle, ip: mine.get(f.bodies.farmS.handle), ic: mine.get(f.sword.handle), parent: f.bodies.farmS, manual: true, hinge: false, restInv: { x: 0, y: 0, z: 0, w: 1 }, a1: (() => { try { return cv(f.gripJoint.anchor1()); } catch { return V3(); } })() });
    const kids = new Map(); for (const e of edges) if (e.ip != null && e.ic != null) (kids.get(e.ip) ?? kids.set(e.ip, []).get(e.ip)).push(e.ic);
    for (const e of edges) { const D = new Set(), st = [e.ic]; while (st.length) { const x = st.pop(); if (x == null || D.has(x)) continue; D.add(x); for (const y of kids.get(x) ?? []) st.push(y); } e.distal = D; e.limit = (HUMAN.find(([re]) => re.test(e.name)) ?? [0, 200])[1]; }
    L.jdefs = edges.filter((e) => e.ip != null && e.ic != null);
    for (const e of L.jdefs) e.near = bodies.map((_, i) => i).filter((i) => !e.distal.has(i));
  }
  // ── 지문: 세계 · 몸 토막 · 충돌 모양 · 관절 — 기준 판과 견준다 (감사 11/24: 회전 잠금 · 덧댄 관성 · 감쇠 · 중력 · 마찰 · 받침대를 한 번에) ──
  const r4 = (x) => (typeof x === 'number' ? +x.toPrecision(6) : x);
  L.fingerprint = () => {
    const ip = world.integrationParameters, wf = { g: [r4(world.gravity.x), r4(world.gravity.y), r4(world.gravity.z)], dt: r4(world.timestep) };
    for (const k of ['numSolverIterations', 'numInternalPgsIterations', 'contact_erp', 'lengthUnit', 'normalizedAllowedLinearError', 'normalizedPredictionDistance', 'maxCcdSubsteps', 'minIslandSize']) { try { wf[k] = r4(ip[k]); } catch { /* 없는 판 */ } }
    const cnt = { fixed: 0, kinematic: 0, dynamic: 0, colliders: 0 }; try { world.bodies.forEach((b) => { cnt[b.isFixed() ? 'fixed' : b.isKinematic() ? 'kinematic' : 'dynamic']++; }); cnt.colliders = world.colliders.len(); } catch { /* */ }
    let mb = 0; try { mb = world.multibodyJoints.len(); } catch { /* */ }
    const bf = {};
    bodies.forEach((b, i) => {
      const pi = b.principalInertia(), ii = b.invPrincipalInertia?.() ?? { x: 0, y: 0, z: 0 }, cols = [];
      for (let ci = 0, nc = b.numColliders(); ci < nc; ci++) { const c = b.collider(ci); let he = null, rad = null, hh = null; try { const h = c.halfExtents(); he = h ? [r4(h.x), r4(h.y), r4(h.z)] : null; } catch { /* */ } try { rad = r4(c.radius()); } catch { /* */ } try { hh = r4(c.halfHeight()); } catch { /* */ } cols.push({ shape: c.shapeType(), he, rad, hh, mu: r4(c.friction()), e: r4(c.restitution()), m: r4(c.mass()), groups: c.collisionGroups(), sensor: c.isSensor?.() ?? false }); }
      bf[names[i]] = { type: b.bodyType(), m: r4(b.mass()), I: [r4(pi.x), r4(pi.y), r4(pi.z)], rotFree: [ii.x > 0, ii.y > 0, ii.z > 0], ld: r4(b.linearDamping()), ad: r4(b.angularDamping()), gs: r4(b.gravityScale()), dom: b.dominanceGroup?.() ?? 0, ccd: b.isCcdEnabled?.() ?? false, cols };
    });
    const jf = [];
    try { world.impulseJoints.forEach((j) => { const a = j.body1(), b = j.body2(); const ia = a ? mine.get(a.handle) : undefined, ib = b ? mine.get(b.handle) : undefined; if (ia == null && ib == null) return; const nm = (x, i) => (i != null ? names[i] : 'EXT:' + (x.isFixed() ? 'fixed' : x.isKinematic() ? 'kinematic' : 'dynamic')); let lim = null; try { lim = j.limitsEnabled?.() ? [r4(j.limitsMin()), r4(j.limitsMax())] : null; } catch { /* */ } jf.push({ a: nm(a, ia), b: nm(b, ib), type: j.type(), lim }); }); } catch { /* */ }
    jf.sort((x, y) => (x.a + x.b + x.type < y.a + y.b + y.type ? -1 : 1));
    return { world: wf, count: cnt, multibodyJoints: mb, bodies: bf, joints: jf };
  };
  const fp0 = L.fingerprint();
  const sample = () => {
    const s = { p: [], v: [], w: [], m: [], q: [], lw: [], gy: [], P: V3(), E: 0, M: 0, c: V3(), Lo: V3(), Gy: V3() };
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i], m = b.mass(), p = cv(b.worldCom()), v = cv(b.linvel()), w = cv(b.angvel());
      s.p.push(p); s.v.push(v); s.w.push(w); s.m.push(m); s.q.push(cq(b.rotation()));
      { const lw = Iw(i, w); s.lw.push(lw); s.gy.push(cross(w, lw)); s.Lo = add(s.Lo, add(lw, scl(cross(p, v), m))); s.Gy = add(s.Gy, cross(w, lw)); } // 원점 둘레 각운동량 · 엔진이 생략하는 자이로 항 ω×(Iω)
      s.P = add(s.P, scl(v, m)); s.M += m; s.c = add(s.c, scl(p, m));
      s.E += 0.5 * m * dot(v, v) + 0.5 * dot(w, Iw(i, w)) - m * g * p.y;
    }
    s.c = scl(s.c, 1 / s.M);
    s.L = sub(s.Lo, cross(s.c, s.P)); // 계 질량중심 둘레
    if (f?.anchor) { s.qA = cq(f.anchor.rotation()); s.qP = cq(f.bodies.pelvis.rotation()); }
    return s;
  };
  L.swordNowQ = () => swordNow;
  // ── 땅 접촉 읽기 (법선 충격량만 — Rapier 0.19.3 은 접선을 내주지 않는다 · chain_ledger.mjs 와 같은 식 · (n+1)/n 과대 보고 교정) ──
  const nIter = world.integrationParameters?.numSolverIterations ?? 4, KC = nIter / (nIter + 1);
  const iFeet = new Set(names.map((n, i) => (/^foot/.test(n) ? i : -1)).filter((i) => i >= 0));
  const muOf = (a, b) => { const fa = a.friction(), fb = b.friction(), r = Math.max(a.frictionCombineRule?.() ?? 0, b.frictionCombineRule?.() ?? 0); return r === 0 ? (fa + fb) / 2 : r === 1 ? Math.min(fa, fb) : r === 2 ? fa * fb : Math.max(fa, fb); };
  const readContacts = () => {
    const out = { FN: V3(), Nabs: 0, muN: 0, foreign: V3(), foreignAbs: 0, foreignKin: 0, nonFoot: 0, tauNo: V3(), tauFo: V3(), pts: [], mans: [], touch: new Set() };
    for (let bi = 0; bi < bodies.length; bi++) {
      const rb = bodies[bi];
      for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) {
        const col = rb.collider(ci);
        world.contactPairsWith(col, (other) => {
          const ob = other.parent();
          if (!ob || mine.has(ob.handle)) return; // 몸 안 쌍은 상쇄
          const fixed = ob.isFixed(), kin = ob.isKinematic();
          const ct = col.translation(), cqq = cq(col.rotation());
          world.contactPair(col, other, (m, flipped) => {
            const n = m.normal(), sg = flipped ? 1 : -1;
            const man = fixed ? { all: [], N: 0, mu: muOf(col, other) } : null; // 엔진 마찰 모형용 (감사 11/24 대조 4): 묶음마다 한 덩어리
            if (man) out.mans.push(man);
            for (let k = 0, nk = m.numContacts(); k < nk; k++) {
              const Jn = m.contactImpulse(k) * KC;
              if (man) { const lp0 = flipped ? m.localContactPoint2(k) : m.localContactPoint1(k); man.all.push(lp0 ? add(cv(ct), qrot(cqq, cv(lp0))) : cv(ct)); man.N += Math.abs(Jn) / DT; }
              if (Jn === 0) continue;
              out.touch.add(bi);
              const F = V3((sg * n.x * Jn) / DT, (sg * n.y * Jn) / DT, (sg * n.z * Jn) / DT);
              const lp = flipped ? m.localContactPoint2(k) : m.localContactPoint1(k);
              const Pw = lp ? add(cv(ct), qrot(cqq, cv(lp))) : cv(ct);
              if (fixed) { out.FN = add(out.FN, F); out.Nabs += len(F); const mu = muOf(col, other); out.muN += mu * len(F); if (!iFeet.has(bi)) out.nonFoot += len(F); out.tauNo = add(out.tauNo, cross(Pw, F)); out.pts.push({ P: Pw, N: len(F), mu }); }
              else { out.foreign = add(out.foreign, F); out.foreignAbs += len(F); if (kin) out.foreignKin += len(F); out.tauFo = add(out.tauFo, cross(Pw, F)); }
            }
          });
        });
      }
    }
    return out;
  };
  // ── 몸 밖 물체에 묶인 관절 (닻 같은 것) — 요약 때 센다 ──
  const externalJoints = () => {
    const out = [];
    try { world.impulseJoints.forEach((j) => { const a = j.body1(), b = j.body2(); const ia = a && mine.has(a.handle), ib = b && mine.has(b.handle); if (ia === ib) return; const o = ia ? b : a; out.push(o.isFixed() ? 'fixed' : o.isKinematic() ? 'kinematic' : 'dynamic'); }); } catch { /* 옛 엔진 */ }
    return out;
  };
  const stab = { yMin: Infinity, ySum: 0, tiltMax: 0, states: {}, fellAt: null, c0: null, c1: null, tipMax: 0, path: 0 };
  let prev = null, mid = null;
  L.pre = () => { if (!prev) prev = sample(); decl = []; };
  L.mid = () => { // world.step 바로 뒤: 감쇠 충격량 (v_뒤 로)
    mid = { J: V3(), Jabs: 0, Tabs: 0, W: 0, tauDo: V3(), dF: [], dT: [] };
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i], cl = b.linearDamping(), ca = b.angularDamping();
      if (b.isSleeping()) continue;
      const v = cv(b.linvel()), w = cv(b.angvel()), m = b.mass();
      const j = scl(v, -m * cl * DT), lw = Iw(i, w);
      mid.dF[i] = scl(j, 1 / DT); mid.dT[i] = scl(lw, -ca);
      mid.J = add(mid.J, j); mid.Jabs += len(j); mid.Tabs += len(lw) * ca * DT;
      mid.tauDo = add(mid.tauDo, add(scl(cross(cv(b.worldCom()), j), 1 / DT), scl(lw, -ca))); // 감쇠가 계에 주는 토크 (원점 둘레)
      mid.W += -(cl * m * dot(v, v) + ca * dot(w, lw)) * DT;
    }
    try { mid.C = readContacts(); } catch { mid.C = null; }
  };
  L.post = () => {
    const cur = sample();
    const dP = scl(sub(cur.P, prev.P), 1 / DT);
    // 질량 바뀜: Δm·v (디딘 발 덧질량)
    let Fmass = V3(), massAbs = 0;
    for (let i = 0; i < bodies.length; i++) if (Math.abs(cur.m[i] - prev.m[i]) > 1e-9) { const j = scl(prev.v[i], (cur.m[i] - prev.m[i]) / DT); Fmass = add(Fmass, j); massAbs += len(j); A('mass').n++; }
    // 선언 힘: 단계별 합
    const by = {};
    let Fdecl = V3(), tauDeclO = V3();
    const expl = []; // 몸 안 쌍으로 판정된 선언 힘 · 토크 (관절 등가 토크 셈에 씀)
    const declAll = decl;
    for (const d of decl) {
      let kind = d.kind;
      if (kind === 'balance') kind = d.F && Math.abs(d.F.x) + Math.abs(d.F.z) < 1e-9 ? 'support' : 'push';
      if (kind === 'closePush') kind = 'push'; // 붙어 밀 때의 다리 밀기 · 맞밀기: 내 골반에만 거는 짝 없는 힘 = 걷기 밀기와 같은 갈래 (감사 11/24 대조 1)
      const k = (by[kind] ||= { F: V3(), T: V3(), gross: 0, tGross: 0, P: 0 });
      const i = d.bi, vb = scl(add(prev.v[i], cur.v[i]), 0.5), wb = scl(add(prev.w[i], cur.w[i]), 0.5);
      if (d.F) {
        k.F = add(k.F, d.F); k.gross += len(d.F); Fdecl = add(Fdecl, d.F);
        k.P += dot(d.F, d.r ? add(vb, cross(wb, d.r)) : vb);
        { const t = cross(sub(d.p, prev.c), d.F); k.T = add(k.T, t); k.tGross += len(t); } // 계 질량중심 둘레
      }
      if (d.T) { k.T = add(k.T, d.T); k.tGross += len(d.T); k.P += dot(d.T, wb); tauDeclO = add(tauDeclO, d.T); }
      if (d.F) tauDeclO = add(tauDeclO, cross(d.p, d.F));
      (k.items ||= []).push(d);
    }
    { // H2 (접촉 쌍 보존): 엔진 접촉이 아닌 '규칙 충격'(판정 뒤 충격 · 밀쳐내기 · 속도 쓰기)의 이 스텝 합 — 두 싸움꾼 것을 hook 이 더해 짝이 맞는지 본다
      const X = { F: V3(), tauO: V3(), gross: 0, by: {} };
      for (const kind of ['combat', 'shove', 'write']) { const k = by[kind]; if (!k) continue; for (const d of k.items) { if (d.F) { X.F = add(X.F, d.F); X.tauO = add(X.tauO, cross(d.p, d.F)); X.gross += len(d.F); X.by[kind] = (X.by[kind] || 0) + len(d.F); } if (d.T) X.tauO = add(X.tauO, d.T); } }
      L.stepCross = X; L.stepCom = cur.c;
    }
    const put = (name, Fnet, tauAbs, P, Fy = 0) => { const a = A(name); a.Fimp += len(Fnet) * DT; a.Fy += Fy * DT; a.Timp += tauAbs * DT; a.Wabs += Math.abs(P) * DT; if (P > 0) a.Wpos += P * DT; else a.Wneg += P * DT; a.n++; };
    let Pout = 0, pairP = 0;
    for (const [kind, k] of Object.entries(by)) {
      // 짝 판정은 이름이 아니라 합으로: 한 갈래의 힘 합 · 계 질량중심 둘레 토크 합이 0 이면 몸 안의 쌍(근육) — 어느 단계에서 걸었든 안. 아니면 그 갈래 전체가 밖.
      const paired = len(k.F) <= 1e-6 * Math.max(1, k.gross) && len(k.T) <= 1e-6 * Math.max(1, k.tGross);
      if (kind === 'test') { put('test', k.F, len(k.T), k.P, k.F.y); continue; }
      if (PAIRED.has(kind) || (paired && kind !== 'write' && kind !== 'pin' && kind !== 'shove' && kind !== 'combat')) {
        const a = A('musclePair'); a.Wabs += Math.abs(k.P) * DT; if (k.P > 0) a.Wpos += k.P * DT; else a.Wneg += k.P * DT; a.Fimp += k.gross * DT; a.Timp += k.tGross * DT; a.n++;
        for (const d of k.items) expl.push(d);
        if (k.gross > 0) { const va = (L.virt[kind] ||= { Ns: 0, peakN: 0 }); va.Ns += (k.gross / 2) * DT; va.peakN = Math.max(va.peakN, k.gross / 2); } // 힘으로 건 쌍 = 관절을 거치지 않는 가상 구동기 (토크 쌍은 여기 안 듦)
        pairP += k.P;
        if (!paired) { put('unpaired', k.F, len(k.T), 0, k.F.y); L.chk.pairMax = Math.max(L.chk.pairMax, len(k.F)); L.chk.coupleMax = Math.max(L.chk.coupleMax || 0, len(k.T)); (L.chk.coupleBy ||= {})[kind] = (L.chk.coupleBy[kind] || 0) + len(k.T) * DT; }
      } else {
        put(kind, k.F, len(k.T), k.P, k.F.y);
        if (kind === 'support' || kind === 'push' || kind === 'write' || kind === 'other' || kind === 'unpaired' || kind === 'aid') Pout += k.P;
        if (kind === 'aid') {
          // 선언된 밖 도움 (11/24 고침): 토크 = 이 스텝에 도움 이름으로 건 것 모두(addTorque + 힘 × 팔)의 계 질량중심 둘레 알짜(k.T) — 짝힘으로 건 도움도 토크로 읽힌다. 힘 = 크기 합(k.gross — 알짜가 0 인 짝힘도 보임).
          //  네 갈래: yaw(수직축 토크) · 기울기(수평 두 축 토크) · 드는 힘(수직 알짜) · 수평 힘(수평 알짜). 옛 셈(addTorque 만 · 알짜 힘)은 pure* · netPeakN 으로 남김.
          let Tp = V3(); for (const d of k.items) if (d.T) Tp = add(Tp, d.T);
          const q = (L.aid ||= { peakN: 0, peakNm: 0, Tnms: 0, steps: 0, grossNs: 0, yawNms: 0, yawPk: 0, tiltNms: 0, tiltPk: 0, liftNs: 0, liftPk: 0, pushNs: 0, pushPk: 0, pureTnms: 0, purePeakNm: 0, netPeakN: 0 });
          const yaw = Math.abs(k.T.y), tilt = Math.hypot(k.T.x, k.T.z), lift = k.F.y, push = Math.hypot(k.F.x, k.F.z), tAll = len(k.T);
          q.peakN = Math.max(q.peakN, k.gross); q.grossNs += k.gross * DT; q.peakNm = Math.max(q.peakNm, tAll); q.Tnms += tAll * DT;
          q.yawNms += yaw * DT; q.yawPk = Math.max(q.yawPk, yaw); q.tiltNms += tilt * DT; q.tiltPk = Math.max(q.tiltPk, tilt);
          q.liftNs += lift * DT; q.liftPk = Math.max(q.liftPk, Math.abs(lift)); q.pushNs += push * DT; q.pushPk = Math.max(q.pushPk, push);
          q.pureTnms += len(Tp) * DT; q.purePeakNm = Math.max(q.purePeakNm, len(Tp)); q.netPeakN = Math.max(q.netPeakN, len(k.F));
          q.steps++;
        }
      }
    }
    // 감쇠
    { const a = A('damp'); a.Fimp += mid ? len(mid.J) : 0; a.Timp += mid ? mid.Tabs : 0; a.Wabs += mid ? -mid.W : 0; a.Wneg += mid ? mid.W : 0; a.n++; Pout += mid ? mid.W / DT : 0; }
    if (massAbs > 0) { const a = A('mass'); a.Fimp += massAbs * DT; }
    // 닻 τ̂
    if (f) {
      const m = capUp?.();
      if (m && cur.qA && prev.qA) {
        const dqA = qmul(cur.qA, qconj(prev.qA)), wA = scl(rotvec(dqA), 1 / DT);
        const iPel = mine.get(f.bodies.pelvis.handle);
        const e = rotvec(qmul(qconj(prev.qA), prev.qP)), wr = qrot(qconj(prev.qA), sub(cur.w[iPel], wA));
        const tl = V3();
        for (const ax of ['x', 'y', 'z']) { const s = m[AXG[ax]]; if (s) tl[ax] = -(s.k * (e[ax] - s.t) + s.d * wr[ax]); }
        const tw = qrot(prev.qA, tl), P = dot(tw, scl(add(prev.w[iPel], cur.w[iPel]), 0.5));
        const a = A('anchor'); a.Timp += len(tw) * DT; a.Wabs += Math.abs(P) * DT; if (P > 0) a.Wpos += P * DT; else a.Wneg += P * DT; a.n++;
        L.anchorW = tw;
        const y = A('anchorYaw'); y.Timp += Math.abs(tl.y) * DT; const t = A('anchorTilt'); t.Timp += Math.hypot(tl.x, tl.z) * DT;
        Pout += P;
      }
    }
    // 잔차 = 엔진이 준 힘 (땅 접촉 · 마찰 · 상대 · 칼 접촉)
    const Fdamp = mid ? scl(mid.J, 1 / DT) : V3();
    const res = sub(sub(sub(sub(dP, V3(0, cur.M * g, 0)), Fdecl), Fdamp), Fmass);
    { const a = A('res'); a.Fimp += len(res) * DT; a.Fy += res.y * DT; a.n++; }
    // 검산: 접촉 법선으로 설명되는가 · 마찰 한계 안인가 (감사 11/24: 발 핀 + 엔진 마찰이 μ·N 을 넘는 몫은 밖)
    if (mid?.C) {
      const C = mid.C;
      { const a = A('groundN'); a.Fimp += C.Nabs * DT; a.Fy += C.FN.y * DT; }
      if (C.nonFoot > 0) { const a = A('nonFootGround'); a.Fimp += C.nonFoot * DT; a.n++; }
      if (C.foreignAbs > 0) { const a = A('foreignN'); a.Fimp += C.foreignAbs * DT; a.n++; }
      if (C.foreignKin > 0) { const a = A('foreignKin'); a.Fimp += C.foreignKin * DT; a.n++; }
      const hidY = res.y - C.FN.y - C.foreign.y;
      { const a = A('hiddenY'); a.Fimp += Math.abs(hidY) * DT; a.Fy += hidY * DT; }
      const pin = by.pin?.F ?? V3();
      const fx = res.x - C.FN.x - C.foreign.x + pin.x, fz = res.z - C.FN.z - C.foreign.z + pin.z, fh = Math.hypot(fx, fz);
      { const a = A('frictionH'); a.Fimp += fh * DT; }
      { const ex = Math.max(0, fh - C.muN - C.foreignAbs); if (ex > 0) { const a = A('frictionExcess'); a.Fimp += ex * DT; a.n++; } } // 상대와 닿은 스텝은 상대 접촉 법선 크기만큼 여유를 줌 (상대 마찰을 못 가름)
    }
    // 각운동량 잔차 (계 질량중심 둘레): dL/dt − 땅 법선 − 마찰(수평축 몫) − 상대 접촉 법선 − 선언 − 감쇠 − 자이로 생략 몫.
    //  수평축(기울기) 잔차 = 숨은 세우는 토크 (닻 · 회전 잠금 …) — 정확.  수직축(yaw) 잔차는 두 발 사이 마찰 짝힘이 섞인다 → 마찰 짝힘 한도 Σ μ·N·r 를 넘는 몫만 숨은 토크.
    {
      const C = mid?.C ?? { FN: V3(), foreign: V3(), tauNo: V3(), tauFo: V3(), pts: [] };
      const cb = scl(add(prev.c, cur.c), 0.5);
      const dL = scl(sub(cur.L, prev.L), 1 / DT);
      const about = (tauO, F) => sub(tauO, cross(cb, F));
      const tauN = about(C.tauNo, C.FN), tauF = about(C.tauFo, C.foreign);
      let pbar = V3(), Ns = 0; for (const q of C.pts) { pbar = add(pbar, scl(q.P, q.N)); Ns += q.N; }
      const Ffric = sub(sub(res, C.FN), C.foreign);
      let tauFr = V3(), budget = 0;
      if (Ns > 0) { pbar = scl(pbar, 1 / Ns); tauFr = cross(sub(pbar, cb), Ffric); for (const q of C.pts) budget += q.mu * q.N * Math.hypot(q.P.x - pbar.x, q.P.z - pbar.z); }
      const tauDecl = about(tauDeclO, Fdecl), tauDamp = about(mid ? mid.tauDo : V3(), Fdamp);
      const r = sub(sub(sub(sub(sub(sub(dL, tauN), tauF), tauFr), tauDecl), tauDamp), prev.Gy);
      // yaw 한도 둘 (감사 11/24 대조 4 — 한 발 상자 시험으로 확인): budget = 쿨롱(접촉점마다 μ·N_q·팔). Rapier 0.19.3 은 접촉 묶음마다 한 덩어리로 마찰을 건다 —
      //  체중이 발 귀퉁이에 몰려도 고르게 디딘 것과 같은 비틀림 마찰(μ·N·평균 팔)을 준다. budgetEng = Σ_묶음 μ·N_m·(|c_m − pbar| + r̄_m). 이 한도를 넘는 몫만 '숨은 yaw 토크',
      //  쿨롱은 넘고 엔진 한도 안인 몫은 '엔진이 쿨롱 한도 넘게 준 비틀림 마찰'(숨은 힘이 아니라 엔진의 사실성 구멍 — 몸이 거기에 기대는 만큼) 로 따로 적는다.
      let budgetEng = 0;
      if (Ns > 0) for (const mn of C.mans ?? []) { if (!(mn.N > 0) || !mn.all.length) continue; let c = V3(); for (const q of mn.all) c = add(c, q); c = scl(c, 1 / mn.all.length); let rb = 0; for (const q of mn.all) rb += Math.hypot(q.x - c.x, q.z - c.z); rb /= mn.all.length; budgetEng += mn.mu * mn.N * (Math.hypot(c.x - pbar.x, c.z - pbar.z) + rb); }
      budgetEng = Math.max(budgetEng, budget);
      const rH = Math.hypot(r.x, r.z), rVex = Math.max(0, Math.abs(r.y) - budgetEng), rVcoul = Math.max(0, Math.min(Math.abs(r.y), budgetEng) - budget);
      { const a = A('angResYawOverCoulomb'); a.Timp += rVcoul * DT; }
      { const q = L.anchorW ? sub(r, L.anchorW) : r; const a = A('angResTiltFloor'); a.Timp += Math.hypot(q.x, q.z) * DT; L.anchorW = null; } // 닻 재계산값을 뺀 나머지 = 이 방법의 바닥 (닻이 없으면 잔차 그대로)
      globalThis.__honestyDbg?.push({ t: L.T, dL, tauN, tauF, tauFr, tauDecl, tauDamp, gy: prev.Gy, r, budget, budgetEng, Ns, res, FN: C.FN, npts: C.pts.length });
      { const a = A('angResTilt'); a.Timp += rH * DT; } { const a = A('angResYaw'); a.Timp += Math.abs(r.y) * DT; } { const a = A('angResYawExcess'); a.Timp += rVex * DT; }
      { const a = A('groundTorque'); a.Timp += len(add(tauN, tauFr)) * DT; }
    }
    // 관절 토크 (H5): 엔진 모터가 낸 토크를 넘어간 k · d 로 다시 세고(τ̂ = k(t − e) + d(tv − ω_rel) · 묵시 풀이라 ± 20 % 쯤), 몸 안 쌍으로 건 선언 힘 · 토크를 관절 등가 토크(먼 쪽 토막들에 걸린 것의 합 = 야코비 전치)로 더한다
    if (f && L.jdefs) {
      const capAll = (f.joints?.find((j) => j.joint)?.joint ?? f.uprightJoint)?.rawSet?.__honestyCap;
      for (const J of L.jdefs) {
        let tm = V3();
        const m = capAll?.get(J.handle);
        if (m && !J.manual) {
          const qp = prev.q[J.ip], qc = prev.q[J.ic];
          const e = rotvec(qmul(J.restInv, qmul(qconj(qp), qc)));
          const wr = qrot(qconj(qp), sub(cur.w[J.ic], cur.w[J.ip]));
          const loc = V3();
          if (J.hinge) { const sl = m[3]; if (sl) loc.z = sl.k * (sl.t - e.z) + sl.d * (sl.tv - wr.z); }
          else for (const [ax, i] of [['x', 3], ['y', 4], ['z', 5]]) { const sl = m[i]; if (sl) loc[ax] = sl.k * (sl.t - e[ax]) + sl.d * (sl.tv - wr[ax]); }
          tm = qrot(qp, loc);
        }
        let te = V3();
        if (expl.length) { const aw = add(cv(J.parent.translation()), qrot(cq(J.parent.rotation()), J.a1)); for (const d of expl) if (J.distal.has(d.bi)) { if (d.F) te = add(te, cross(sub(d.p, aw), d.F)); if (d.T) te = add(te, d.T); } }
        // 전달된 관절 토크 (잰 값 · 감사 11/24 대조 3): 관절의 한쪽(먼 쪽 묶음, 아니면 나머지 몸)이 이 스텝에 아무것과도 닿지 않았으면 그 묶음의 운동량 변화에서 관절이 준 힘 · 토크가 정확히 나온다.
        //  F_J = dP/dt − m g − 선언 − 감쇠 · τ_J = dL/dt(묶음 질량중심 둘레) − 선언 토크 − 감쇠 토크 − 자이로 생략 몫 − (p_J − c)×F_J.  경첩은 축 몫만 (나머지는 구속 토크).
        let meas = null;
        const touch = mid?.C?.touch;
        if (touch) {
          const farFree = ![...J.distal].some((i) => touch.has(i));
          const nearFree = farFree ? false : !J.near.some((i) => touch.has(i));
          const set = farFree ? [...J.distal] : nearFree ? J.near : null;
          if (set) {
            const sub1 = (S0) => { let P = V3(), c = V3(), M = 0; for (const i of set) { P = add(P, scl(S0.v[i], S0.m[i])); c = add(c, scl(S0.p[i], S0.m[i])); M += S0.m[i]; } c = scl(c, 1 / M); const vc = scl(P, 1 / M); let Lc = V3(), Gy = V3(); for (const i of set) { Lc = add(Lc, add(S0.lw[i], scl(cross(sub(S0.p[i], c), sub(S0.v[i], vc)), S0.m[i]))); Gy = add(Gy, S0.gy[i]); } return { P, c, M, Lc, Gy }; };
            const a = sub1(prev), b2 = sub1(cur), cm = scl(add(a.c, b2.c), 0.5), inSet = new Set(set);
            let Fd = V3(), Td = V3();
            for (const d of declAll) if (inSet.has(d.bi)) { if (d.F) { Fd = add(Fd, d.F); Td = add(Td, cross(sub(d.p, cm), d.F)); } if (d.T) Td = add(Td, d.T); }
            if (mid) for (const i of set) { const dF = mid.dF[i], dT = mid.dT[i]; if (dF) { Fd = add(Fd, dF); Td = add(Td, cross(sub(scl(add(prev.p[i], cur.p[i]), 0.5), cm), dF)); } if (dT) Td = add(Td, dT); }
            const FJ = sub(sub(scl(sub(b2.P, a.P), 1 / DT), V3(0, b2.M * g, 0)), Fd);
            const pJ = add(cv(J.parent.translation()), qrot(cq(J.parent.rotation()), J.a1));
            let tJ = sub(sub(sub(sub(scl(sub(b2.Lc, a.Lc), 1 / DT), Td), a.Gy), cross(sub(pJ, cm), FJ)), V3());
            if (!farFree) tJ = scl(tJ, -1); // 나머지 몸에서 쟀으면 부호를 뒤집어 '먼 쪽 묶음이 받은 토크'로
            if (J.hinge) { const ax = qrot(prev.q[J.ip], V3(0, 0, 1)); tJ = scl(ax, dot(tJ, ax)); }
            meas = tJ;
          }
        }
        const tot = len(add(tm, te)), st = (L.joint[J.name] ||= { n: 0, sum: 0, peak: 0, over: 0, motorPeak: 0, explPeak: 0, hist: [], limit: J.limit, mN: 0, mOver: 0, mPeak: 0, mHist: [], sxy: 0, sxx: 0, syy: 0 });
        if (meas) { const eng = meas; meas = add(meas, te); const mm = len(meas); st.mN++; st.engSum = (st.engSum || 0) + len(eng); st.reqMotorSum = (st.reqMotorSum || 0) + len(tm); st.sxyM = (st.sxyM || 0) + dot(tm, eng); st.sxxM = (st.sxxM || 0) + dot(tm, tm); st.mPeak = Math.max(st.mPeak, mm); if (mm > J.limit) st.mOver++; if (st.mHist.length < 20000) st.mHist.push(mm); const rq = add(tm, te); st.sxy += dot(rq, meas); st.sxx += dot(rq, rq); st.syy += dot(meas, meas); }
        st.n++; st.sum += tot; st.peak = Math.max(st.peak, tot); st.motorPeak = Math.max(st.motorPeak, len(tm)); st.explPeak = Math.max(st.explPeak, len(te)); if (tot > J.limit) st.over++;
        if (st.hist.length < 20000) st.hist.push(tot);
      }
    }
    // 덩어리 값이 재는 동안 바뀌는가 (지문의 움직이는 몫)
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i], d = (L.dyn[i] ||= { ld: [Infinity, -Infinity], ad: [Infinity, -Infinity], gs: [Infinity, -Infinity], m: [Infinity, -Infinity], I: [Infinity, -Infinity], type: new Set() }); const pi = b.principalInertia(); for (const [k, x] of [['ld', b.linearDamping()], ['ad', b.angularDamping()], ['gs', b.gravityScale()], ['m', cur.m[i]], ['I', Math.hypot(pi.x, pi.y, pi.z)]]) { d[k][0] = Math.min(d[k][0], x); d[k][1] = Math.max(d[k][1], x); } d.type.add(b.bodyType()); }
    // 서 있기 · 움직임 (싸움꾼만)
    if (f) {
      const py = f.bodies.pelvis.translation().y, up = qrot(cq(f.bodies.chest.rotation()), V3(0, 1, 0));
      stab.yMin = Math.min(stab.yMin, py); stab.ySum += py;
      stab.tiltMax = Math.max(stab.tiltMax, (Math.acos(Math.max(-1, Math.min(1, up.y))) * 180) / Math.PI);
      stab.states[f.state] = (stab.states[f.state] || 0) + 1;
      if (stab.fellAt == null && ((f.state !== 'stand' && f.state !== 'kneel') || py < 0.5)) stab.fellAt = +(L.T + DT).toFixed(3);
      if (!stab.c0) stab.c0 = cur.c; else stab.path += Math.hypot(cur.c.x - stab.c1.x, cur.c.z - stab.c1.z);
      stab.c1 = cur.c;
      const tv = f.tipVel; if (tv) stab.tipMax = Math.max(stab.tipMax, Math.hypot(tv.x, tv.y, tv.z));
    }
    // 안쪽 일률 = dE/dt − 밖 일률
    const Pin = (cur.E - prev.E) / DT - Pout;
    { const a = A('inside'); a.Wabs += Math.abs(Pin) * DT; if (Pin > 0) a.Wpos += Pin * DT; else a.Wneg += Pin * DT; }
    if (placedNow) L.place.steps++; if (swordNow) { L.place.swordSteps++; L.swordPlacedAt = L.rows; (L.swordRows ||= new Set()).add(L.rows); } placedNow = swordNow = false;
    L.rows++; L.T += DT; L.Mg = -cur.M * g; L.lastRes = res;
    prev = cur; decl = []; mid = null;
  };
  L.summary = () => {
    for (const w of L.wounds) { const R = L.foe?.swordRows; w.kin = !!R && [-3, -2, -1, 0, 1].some((d) => R.has(w.row + d)); } // 친 쪽 칼이 그 스텝 언저리에 '놓인' 칼이었나
    const a = L.acc, v = (k, q) => a[k]?.[q] ?? 0;
    const Fout = OUT.reduce((s, k) => s + v(k, 'Fimp'), 0) + v('other', 'Fimp');
    const Fin = v('res', 'Fimp') + v('pin', 'Fimp');
    const Wout = OUT.reduce((s, k) => s + v(k, 'Wabs'), 0) + v('other', 'Wabs');
    const Win = v('inside', 'Wabs');
    return {
      T: +L.T.toFixed(3),
      forceShare: Fout / Math.max(1e-9, Fout + Fin),
      supportShare: v('support', 'Fy') / Math.max(1e-9, L.Mg * L.T),
      bareMg: L.bareMg, Mg: L.Mg ?? null, // 맨몸 체중(칼 · 덧질량 빼고 — '÷ 체중' 의 분모) · 재는 끝의 온 질량 × g (칼 · 덧질량 포함 — 받침 몫 · liftShare 의 옛 분모)
      // 선언된 밖 도움. 옛 칸(liftShare · forceNs · torqueRate · peakN · peakNm · stepShare)은 이름 그대로 — 다만 torqueRate · peakNm 은 이제 계 질량중심 둘레 알짜 토크(짝힘 포함), peakN 은 힘 크기 합(옛 셈은 pureTorqueRate · pureTorquePeak · netForcePeak).
      //  새 칸: yaw · tilt (N·m 평균 · 스텝 최고) · lift (수직 알짜 N — 평균 · 최고 · ÷ 맨몸 체중) · push (수평 알짜 N) · grossNs · grossRate (힘 크기 합) · torqueNms. 평균은 잰 시간 전체로 나눈 값(안 걸린 스텝은 0).
      aid: (() => {
        const q = L.aid ?? {}, T = Math.max(1e-9, L.T), n = (x) => x ?? 0, bare = L.bareMg > 0 ? L.bareMg : null;
        return {
          liftShare: v('aid', 'Fy') / Math.max(1e-9, L.Mg * L.T), forceNs: v('aid', 'Fimp'), torqueRate: n(q.Tnms) / T, peakN: n(q.peakN), peakNm: n(q.peakNm), stepShare: n(q.steps) / Math.max(1, L.rows),
          torqueNms: n(q.Tnms), grossNs: n(q.grossNs), grossRate: n(q.grossNs) / T,
          yaw: { avg: n(q.yawNms) / T, peak: n(q.yawPk) }, tilt: { avg: n(q.tiltNms) / T, peak: n(q.tiltPk) },
          lift: { avgN: n(q.liftNs) / T, peakN: n(q.liftPk), share: bare ? n(q.liftNs) / (bare * T) : null, peakShare: bare ? n(q.liftPk) / bare : null },
          push: { avgN: n(q.pushNs) / T, peakN: n(q.pushPk) },
          pureTorqueRate: n(q.pureTnms) / T, pureTorquePeak: n(q.purePeakNm), netForcePeak: n(q.netPeakN),
        };
      })(),
      workShare: Wout / Math.max(1e-9, Wout + Win),
      anchorYawNms: v('anchorYaw', 'Timp'), anchorTiltNms: v('anchorTilt', 'Timp'),
      pairResidualMaxN: L.chk.pairMax, coupleBy: L.chk.coupleBy ?? {},
      place: { stepShare: L.place.steps / Math.max(1, L.rows), swordStepShare: L.place.swordSteps / Math.max(1, L.rows), calls: L.place.calls, kgm: +L.place.kgm.toFixed(2) },
      woundsTaken: L.wounds,
      externalJoints: externalJoints(),
      pair: L.pair ? { grossNs: +L.pair.gross.toFixed(2), netFNs: +L.pair.netF.toFixed(2), netTNms: +L.pair.netT.toFixed(2), steps: L.pair.steps, worstNs: +L.pair.worst.toFixed(2), by: Object.fromEntries(Object.entries(L.pair.by).map(([k, v]) => [k, +v.toFixed(2)])) } : null,
      fingerprint: fp0, fingerprintEnd: L.fingerprint(),
      dyn: Object.fromEntries(L.dyn.map((d, i) => [names[i], { ld: d.ld.map(r4), ad: d.ad.map(r4), gs: d.gs.map(r4), m: d.m.map(r4), I: d.I.map(r4), types: [...d.type] }])),
      torque: (() => { const out = v('angResTilt', 'Timp') + v('angResYawExcess', 'Timp') + v('damp', 'Timp') + ['support', 'push', 'unpaired', 'other', 'write', 'aid'].reduce((t, k) => t + v(k, 'Timp'), 0); const inn = v('groundTorque', 'Timp'); return { share: out + inn < 1e-6 ? 0 : out / (out + inn), tiltResRate: v('angResTilt', 'Timp') / Math.max(1e-9, L.T), tiltFloorRate: v('angResTiltFloor', 'Timp') / Math.max(1e-9, L.T), yawExcessRate: v('angResYawExcess', 'Timp') / Math.max(1e-9, L.T), yawOverCoulombRate: v('angResYawOverCoulomb', 'Timp') / Math.max(1e-9, L.T), outNms: out, groundNms: inn, tiltResNms: v('angResTilt', 'Timp'), yawResNms: v('angResYaw', 'Timp'), yawExcessNms: v('angResYawExcess', 'Timp'), dampNms: v('damp', 'Timp') }; })(),
      joints: Object.fromEntries(Object.entries(L.joint).map(([k, x]) => { const h = Float64Array.from(x.hist).sort(); const mh = Float64Array.from(x.mHist).sort(); return [k, { limit: x.limit, mean: +(x.sum / Math.max(1, x.n)).toFixed(1), p95: +(h[Math.floor(0.95 * (h.length - 1))] ?? 0).toFixed(1), peak: +x.peak.toFixed(1), overShare: +(x.over / Math.max(1, x.n)).toFixed(4), motorPeak: +x.motorPeak.toFixed(1), explPeak: +x.explPeak.toFixed(1), measCover: +(x.mN / Math.max(1, x.n)).toFixed(3), measP95: +(mh[Math.floor(0.95 * (mh.length - 1))] ?? 0).toFixed(1), measPeak: +x.mPeak.toFixed(1), measOverShare: +(x.mOver / Math.max(1, x.mN)).toFixed(4), measVsReq: x.sxx > 0 ? +(x.sxy / x.sxx).toFixed(3) : null, engineVsMotorReq: x.sxxM > 1e-9 ? +(x.sxyM / x.sxxM).toFixed(3) : null, measCorr: x.sxx > 0 && x.syy > 0 ? +(x.sxy / Math.sqrt(x.sxx * x.syy)).toFixed(3) : null }]; })),
      virtualActuators: Object.fromEntries(Object.entries(L.virt).map(([k, x]) => [k, { Ns: +x.Ns.toFixed(1), peakN: +x.peakN.toFixed(1) }])),
      check: { foreignNs: v('foreignN', 'Fimp'), foreignKinNs: v('foreignKin', 'Fimp'), groundNShare: v('groundN', 'Fy') / Math.max(1e-9, L.Mg * L.T), hiddenYNs: v('hiddenY', 'Fimp'), hiddenYNet: v('hiddenY', 'Fy'), frictionHNs: v('frictionH', 'Fimp'), frictionExcessNs: v('frictionExcess', 'Fimp'), nonFootGroundNs: v('nonFootGround', 'Fimp') },
      stab: f ? { fellAt: stab.fellAt, pelvisYMean: +(stab.ySum / Math.max(1, L.rows)).toFixed(3), pelvisYMin: +stab.yMin.toFixed(3), tiltMaxDeg: +stab.tiltMax.toFixed(1), states: stab.states, netMove: stab.c0 ? +Math.hypot(stab.c1.x - stab.c0.x, stab.c1.z - stab.c0.z).toFixed(3) : 0, pathMove: +stab.path.toFixed(3), meanSpeed: +(stab.path / Math.max(1e-9, L.T)).toFixed(3), tipSpeedMax: +stab.tipMax.toFixed(2) } : null,
      cats: Object.fromEntries(Object.entries(a).map(([k, x]) => [k, { Fimp: +x.Fimp.toFixed(3), Fy: +x.Fy.toFixed(3), Timp: +x.Timp.toFixed(3), Wabs: +x.Wabs.toFixed(3), Wpos: +x.Wpos.toFixed(3), Wneg: +x.Wneg.toFixed(3) }])),
    };
  };
  SHARED.sets.push(L);
  return L;
}

/** G.step 에 장부들을 건다: 앞 → (world.step 뒤) → 끝. combat.afterStep 은 'combat' 단계. */
export function hook(G, ledgers) {
  const w = G.world, ws = w.step, DT0 = w.timestep;
  w.step = function (...a) { const r = ws.apply(this, a); for (const l of ledgers) l.mid(); return r; };
  if (G.combat?.afterStep) { const o = G.combat.afterStep; G.combat.afterStep = function (...a) { const prev = SHARED.phase; SHARED.phase = 'combat'; try { return o.apply(this, a); } finally { SHARED.phase = prev; } }; }
  const s0 = G.step;
  const H2 = { gross: 0, netF: 0, netT: 0, by: {}, steps: 0, worst: 0 }; // ∫ Σ|F| dt · ∫ |ΣF| dt · ∫ |Στ| dt (두 몸 질량중심의 가운데 둘레) — 규칙 충격이 두 몸 사이에서 짝이 맞으면 뒤 둘이 0
  for (const l of ledgers) l.pair = H2;
  G.step = () => {
    for (const l of ledgers) l.pre(); s0(); for (const l of ledgers) l.post();
    if (ledgers.length === 2) {
      const [a, b] = ledgers, A1 = a.stepCross, B1 = b.stepCross;
      if (A1 && B1 && A1.gross + B1.gross > 0) {
        const F = add(A1.F, B1.F), ref = scl(add(a.stepCom, b.stepCom), 0.5), T = sub(add(A1.tauO, B1.tauO), cross(ref, F));
        H2.gross += (A1.gross + B1.gross) * DT0; H2.netF += len(F) * DT0; H2.netT += len(T) * DT0; H2.steps++; H2.worst = Math.max(H2.worst, len(F) * DT0);
        for (const X of [A1, B1]) for (const [k, v] of Object.entries(X.by)) H2.by[k] = (H2.by[k] || 0) + v * DT0;
      }
    }
  };
}
const bodiesOf = (f) => { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; };

// ───────── 보고 ─────────
const pct = (x) => (100 * x).toFixed(1).padStart(5) + ' %';
const n1 = (x, w = 9) => (+x).toFixed(1).padStart(w);
/** 선언된 밖 도움이 한 번이라도 걸렸나 (힘 알짜 · 힘 크기 합 · 토크 충격량 가운데 하나라도 0 이 아니면 — 짝힘처럼 알짜 힘이 0 인 도움도 줄이 찍히게) */
export const aidOn = (a) => !!a && (a.forceNs > 0 || a.torqueRate > 0 || (a.grossNs ?? 0) > 0 || (a.torqueNms ?? 0) > 0);
/** 선언된 밖 도움 한 줄: 네 갈래(돌리는 토크 yaw · 기울기 토크 · 드는 힘 · 수평 힘)마다 평균 · 스텝 최고. '÷ 체중' 은 맨몸 체중(bareWeight) */
export function aidLine(a) {
  const sh = (x) => (x == null ? '-' : (100 * x).toFixed(1) + ' %');
  return `선언된 밖 도움: 돌리는 토크(yaw · 수직축) 평균 ${a.yaw.avg.toFixed(1)} N·m (스텝 최고 ${a.yaw.peak.toFixed(1)}) · 기울기 토크(수평 두 축) 평균 ${a.tilt.avg.toFixed(1)} N·m (스텝 최고 ${a.tilt.peak.toFixed(1)}) · 드는 힘(수직) 평균 ${a.lift.avgN.toFixed(0)} N = 맨몸 체중의 ${sh(a.lift.share)} (스텝 최고 ${a.lift.peakN.toFixed(0)} N = ${sh(a.lift.peakShare)}) · 수평 힘 평균 ${a.push.avgN.toFixed(1)} N (스텝 최고 ${a.push.peakN.toFixed(1)}) · 힘 크기 합 평균 ${a.grossRate.toFixed(1)} N (스텝 최고 ${a.peakN.toFixed(0)}) · 토크 합 크기 평균 ${a.torqueRate.toFixed(1)} N·m (스텝 최고 ${a.peakNm.toFixed(1)}) · 걸린 스텝 ${pct(a.stepShare)}`;
}
export function report(title, S) {
  const lines = [`■ ${title}  (${S.T} s)`, `  선 힘 몫(밖 · 닻 토크는 안 들어감) ${pct(S.forceShare)} · 수직 받침 몫 ${pct(S.supportShare)} · 일 몫(밖) ${pct(S.workShare)} · 닻 yaw ${n1(S.anchorYawNms, 0)} N·m·s · 닻 기울기 ${n1(S.anchorTiltNms, 0)} N·m·s · 근육 쌍 어긋남 최고 ${S.pairResidualMaxN.toFixed(3)} N${Object.keys(S.coupleBy).length ? ' · 짝 없는 토크 ' + Object.entries(S.coupleBy).map(([k, x]) => `${k} ${x.toFixed(1)}`).join(' · ') + ' N·m·s' : ''}`];
  if (aidOn(S.aid)) lines.push(`  ${aidLine(S.aid)}`);
  if (S.stab) lines.push(`  몸: ${S.stab.fellAt != null ? '넘어짐 ' + S.stab.fellAt + ' s' : '안 넘어짐'} · 골반 높이 평균 ${S.stab.pelvisYMean} (최저 ${S.stab.pelvisYMin}) m · 가슴 기울기 최고 ${S.stab.tiltMaxDeg}° · 옮긴 거리 ${S.stab.netMove} m (길 ${S.stab.pathMove} m · 평균 ${S.stab.meanSpeed} m/s) · 칼끝 최고 ${S.stab.tipSpeedMax} m/s · 상태 ${Object.entries(S.stab.states).map(([k, n]) => k + ' ' + n).join(' ')}`);
  lines.push(`  검산: 땅 법선 ÷ 체중 ${pct(S.check.groundNShare)} · 법선으로 설명 안 되는 수직 힘 ${n1(S.check.hiddenYNs, 0)} N·s (알짜 ${n1(S.check.hiddenYNet, 0)}) · 수평 마찰(핀 포함) ${n1(S.check.frictionHNs, 0)} N·s 가운데 μN 넘는 몫 ${n1(S.check.frictionExcessNs, 0)} N·s · 발 아닌 곳이 땅을 누름 ${n1(S.check.nonFootGroundNs, 0)} N·s · 땅 아닌 것과 닿음 ${n1(S.check.foreignNs, 0)} N·s (그중 운동학 물체 ${n1(S.check.foreignKinNs, 0)}) · 몸 밖에 묶인 관절 ${S.externalJoints.length} (${S.externalJoints.join(',') || '없음'})`);
  if (S.torque) lines.push(`  돌리는 쪽: 숨은 기울기 토크 평균 ${S.torque.tiltResRate.toFixed(2)} N·m (닻 재계산값을 뺀 나머지 ${S.torque.tiltFloorRate.toFixed(2)}) · yaw 엔진 마찰 한도 넘는 몫 평균 ${S.torque.yawExcessRate.toFixed(2)} N·m (쿨롱 한도는 넘고 엔진 한도 안 — 엔진이 봐준 비틀림 마찰 ${(S.torque.yawOverCoulombRate ?? 0).toFixed(2)} N·m) · 토크 몫(밖) ${pct(S.torque.share)} = 밖 ${n1(S.torque.outNms, 0)} ÷ (밖 + 땅 ${n1(S.torque.groundNms, 0)}) N·m·s · 기울기 잔차 ${n1(S.torque.tiltResNms, 0)} · yaw 잔차 ${n1(S.torque.yawResNms, 0)} (마찰 짝힘 한도 넘는 몫 ${n1(S.torque.yawExcessNms, 0)}) · 회전 감쇠 ${n1(S.torque.dampNms, 0)}`);
  if (S.joints && Object.keys(S.joints).length) lines.push('  관절 토크 — 요구(다시 센 값) 95 % / 한도(넘은 몫): ' + Object.entries(S.joints).map(([k, j]) => `${k} ${j.p95.toFixed(0)}/${j.limit}(${(100 * j.overShare).toFixed(1)}%)`).join(' · '));
  if (S.joints && Object.keys(S.joints).length) lines.push('  관절 토크 — 전달(운동량으로 잰 값) 95 % · 최고 (넘은 몫 · 잴 수 있던 스텝 몫 · 엔진 모터의 전달 ÷ 요구): ' + Object.entries(S.joints).map(([k, j]) => `${k} ${j.measP95.toFixed(0)}·${j.measPeak.toFixed(0)}(${(100 * j.measOverShare).toFixed(1)}%·${(100 * j.measCover).toFixed(0)}%·${j.engineVsMotorReq ?? '-'})`).join(' · '));
  if (S.virtualActuators && Object.keys(S.virtualActuators).length) lines.push('  가상 구동기(관절을 거치지 않는 힘 쌍): ' + Object.entries(S.virtualActuators).map(([k, x]) => `${k} ${x.Ns} N·s (최고 ${x.peakN} N)`).join(' · '));
  if (S.pair && S.pair.grossNs > 0) lines.push(`  H2 규칙 충격(두 몸 합 · 엔진 접촉 아님): 건 것 ${S.pair.grossNs} N·s (${Object.entries(S.pair.by).map(([k, v]) => `${{ combat: '판정 뒤 충격', shove: '밀쳐내기', write: '속도 쓰기' }[k] ?? k} ${v}`).join(' · ')}) 가운데 짝이 안 맞는 몫 ${S.pair.netFNs} N·s (${(100 * S.pair.netFNs / Math.max(1e-9, S.pair.grossNs)).toFixed(1)} % · 한 스텝 최고 ${S.pair.worstNs} N·s) · 짝 안 맞는 토크 ${S.pair.netTNms} N·m·s · 스텝 ${S.pair.steps}`);
  if (S.place.calls) lines.push(`  자리 직접 놓기: 스텝의 ${pct(S.place.stepShare)} (칼 ${pct(S.place.swordStepShare)}) · 옮긴 질량 × 거리 ${S.place.kgm} kg·m`);
  if (S.woundsTaken.length) { const W = S.woundsTaken, kin = W.filter((x) => x.kin), sv = (a) => a.reduce((t, x) => t + x.sev, 0); const rs = W.filter((x) => !x.kin && x.E0 > 0).map((x) => (x.type === 'blunt' ? x.energy : x.eff ?? x.energy) / x.E0).sort((a, b) => a - b); lines.push(`  받은 상처 ${W.length} (운동학 칼 ${kin.length} · 심각도 몫 ${pct(sv(kin) / Math.max(1e-9, sv(W)))}) · 판정 ÷ 칼만의 물리 에너지 가운데값 ${rs.length ? rs[rs.length >> 1].toFixed(2) : '-'} 배 (최고 ${rs.length ? rs[rs.length - 1].toFixed(1) : '-'})`); }
  lines.push('   갈래          ∫|F|dt N·s   그중 수직    ∫|τ|dt N·m·s    ∫|P|dt J     더한 일 J     뺀 일 J');
  const order = ['support', 'push', 'aid', 'anchor', 'damp', 'write', 'mass', 'unpaired', 'other', 'shove', 'combat', 'pin', 'res', 'musclePair', 'inside'];
  const lab = { aid: '선언된 도움(밖)', support: '받침(밖)', push: '걷기 밀기(밖)', anchor: '닻(밖)', damp: '엔진 감쇠(밖)', write: '속도 쓰기(밖)', mass: '질량 바뀜(밖)', unpaired: '짝 없는 힘(밖)', other: '그 밖 선언(밖)', shove: '밀쳐내기(따로)', combat: '판정 뒤 충격(따로)', pin: '발 핀(안)', res: '땅 · 접촉(안)', musclePair: '근육 쌍(안)', inside: '안쪽 일(합)' };
  for (const k of order) { const c = S.cats[k]; if (!c) continue; lines.push(`   ${lab[k].padEnd(14)}${n1(c.Fimp, 10)} ${n1(c.Fy, 10)} ${n1(c.Timp, 13)} ${n1(c.Wabs, 13)} ${n1(c.Wpos, 12)} ${n1(c.Wneg, 12)}`); }
  return lines.join('\n');
}

/** 지문 견줌: 기준 요약(base)과 지금 요약(S)의 세계 · 몸 · 충돌 모양 · 관절이 다른 줄을 돌려준다 (빈 배열 = 같음) */
export function diffFingerprint(base, S) {
  const out = [], eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const A0 = base.fingerprint, B0 = S.fingerprint;
  if (!A0 || !B0) return ['지문 없음'];
  for (const k of new Set([...Object.keys(A0.world), ...Object.keys(B0.world)])) if (!eq(A0.world[k], B0.world[k])) out.push(`세계 ${k}: ${JSON.stringify(A0.world[k])} → ${JSON.stringify(B0.world[k])}`);
  if (!eq(A0.count, B0.count)) out.push(`세계 물체 수: ${JSON.stringify(A0.count)} → ${JSON.stringify(B0.count)}`);
  if (A0.multibodyJoints !== B0.multibodyJoints) out.push(`multibody 관절 수: ${A0.multibodyJoints} → ${B0.multibodyJoints}`);
  for (const n of new Set([...Object.keys(A0.bodies), ...Object.keys(B0.bodies)])) {
    const a = A0.bodies[n], b = B0.bodies[n];
    if (!a || !b) { out.push(`몸 토막 ${n}: ${a ? '사라짐' : '새로 생김'}`); continue; }
    for (const k of ['type', 'm', 'I', 'rotFree', 'ld', 'ad', 'gs', 'dom', 'ccd']) if (!eq(a[k], b[k])) out.push(`${n}.${k}: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
    if (!eq(a.cols, b.cols)) out.push(`${n} 충돌 모양: ${JSON.stringify(a.cols)} → ${JSON.stringify(b.cols)}`);
  }
  if (!eq(A0.joints, B0.joints)) { const ka = A0.joints.map((j) => JSON.stringify(j)), kb = B0.joints.map((j) => JSON.stringify(j)); for (const j of ka) if (!kb.includes(j)) out.push(`관절 사라짐/바뀜: ${j}`); for (const j of kb) if (!ka.includes(j)) out.push(`관절 새로/바뀜: ${j}`); }
  for (const n of Object.keys(S.dyn ?? {})) { const a = base.dyn?.[n], b = S.dyn[n]; if (a) for (const k of ['ld', 'ad', 'gs', 'm', 'I', 'types']) if (!eq(a[k], b[k])) out.push(`${n} 재는 동안 ${k} 범위: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`); }
  return out;
}

// ───────── 장면 ─────────
async function load() {
  const H = await import(u('tools/sim/harness_m.mjs'));
  let FAM = null;
  try { FAM = (await import(u('tools/sim/corr_lib.mjs'))).FAM; } catch { /* 옛 트리 */ }
  FAM ||= { diagR: { ch: [0.42, 0.42], end: [-0.4, -0.42], v: 12 }, vert: { ch: [0.02, 0.52], end: [0, -0.5], v: 12 }, horizR: { ch: [0.52, 0.03], end: [-0.52, 0.03], v: 12 } };
  return { H, FAM, DT: H.DT };
}
const run = (G, secs, DT, each) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { each?.(i); G.step(); } };
async function sceneSolo(Gm, o, kind) {
  const { H, FAM, DT } = Gm;
  const G = H.newRound({ walls: false, weapon: o.weapon, seed: o.seed });
  G.park();
  const P = G.player;
  const F = FAM[o.fam];
  if (kind === 'stroke') P.handOffset.set(F.ch[0], F.ch[1]);
  run(G, 3.0, DT, () => P.move.set(0, 0)); // 시작 정지 2 s + 자리 잡기
  const L = attach(G.world, bodiesOf(P), { fighter: P });
  hook(G, [L]);
  if (kind === 'stand') run(G, 4, DT, () => P.move.set(0, 0));
  if (kind === 'stand30') run(G, 30, DT, () => P.move.set(0, 0));
  if (kind === 'walkstop') { run(G, 2.5, DT, () => P.move.set(0, 1)); run(G, 2.5, DT, () => P.move.set(0, 0)); }
  if (kind === 'strafe') run(G, 4, DT, () => P.move.set(1, 0));
  if (kind === 'back') run(G, 4, DT, () => P.move.set(0, -1));
  if (kind === 'kick') { // 서 있는 몸의 가슴을 앞에서 뒤로 o.kick N·s 로 한 번 친다 (시험이 넣는 힘 — 'test' 갈래 · 몫에서 뺌)
    run(G, 1, DT, () => P.move.set(0, 0));
    const prev = SHARED.phase; SHARED.phase = 'test';
    const fw = qrot(cq(P.bodies.pelvis.rotation()), V3(1, 0, 0)); // 몸 앞 = 골반 +x
    const dir = { front: [-1, 0], back: [1, 0], left: [0, 1], right: [0, -1] }[o.kickdir] ?? [-1, 0]; // front = 앞에서 맞아 뒤로 밀림 · left = 왼쪽에서 맞아 오른쪽(+z)으로
    P.bodies.chest.applyImpulse({ x: (fw.x * dir[0] - fw.z * dir[1]) * o.kick, y: 0, z: (fw.z * dir[0] + fw.x * dir[1]) * o.kick }, true);
    SHARED.phase = prev;
    run(G, 4, DT, () => P.move.set(0, 0));
  }
  if (kind === 'walk') run(G, 4, DT, () => P.move.set(0, 1));
  if (kind === 'stroke') {
    let tgt = F.end;
    for (let k = 0; k < 6; k++) {
      const from = [P.handOffset.x, P.handOffset.y], dist = Math.hypot(tgt[0] - from[0], tgt[1] - from[1]);
      run(G, dist / F.v + 0.6, DT, () => {
        const off = P.handOffset, dx = tgt[0] - off.x, dy = tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
        if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else off.set(tgt[0], tgt[1]);
        P.move.set(0, 0);
      });
      tgt = tgt === F.end ? F.ch : F.end;
    }
  }
  return [[`${kind} · ${o.weapon}${kind === 'stroke' ? ' · ' + o.fam : ''}${kind === 'kick' ? ' · ' + o.kickdir + ' ' + o.kick + ' N·s' : ''}`, L.summary()]];
}
/** 바닥값 (감사 11/24 대조 1): 같은 몸에서 닻 관절을 떼고 죽은 상태(근육 0.02 · 받침 없음)로 쓰러뜨린다 — 숨은 토크가 없는 몸에서 이 도구의 잔차(= 방법의 바닥)가 얼마나 나오는가.
 *  쓰러지는 동안(부딪침 · 구름)과 누운 뒤를 함께 잰다. 걷기처럼 발이 땅을 치는 장면의 바닥은 이 값보다 클 수 없다고 본다. */
async function sceneRagdoll(Gm, o) {
  const { H, DT } = Gm;
  const G = H.newRound({ walls: false, weapon: o.weapon, seed: o.seed });
  G.park();
  const P = G.player;
  run(G, 3.0, DT, () => P.move.set(0, 0));
  const L = attach(G.world, bodiesOf(P), { fighter: P });
  hook(G, [L]);
  if (P.uprightJoint) { G.world.removeImpulseJoint(P.uprightJoint, true); const rs = P.uprightJoint.rawSet, o1 = rs.jointConfigureMotorPosition, h = P.uprightJoint.handle; rs.jointConfigureMotorPosition = function (hh, ...a) { if (hh === h) return; return o1.call(this, hh, ...a); }; }
  P.die?.('floor', true);
  run(G, +(args.ragsecs ?? 4), DT, () => P.move.set(0, 0));
  return [[`ragdoll(닻 뗌 · 죽은 몸) · ${o.weapon}`, L.summary()]];
}
/** 스텝 시간: 장부 없이 AI 대 AI 20 s — 벽시계 ms/스텝 (세 번 가운데값) */
async function scenePerf(Gm, o) {
  const { H, DT } = Gm, ts = [];
  for (let r = 0; r < 3; r++) { const G = H.newRound({ walls: true, seed: o.seed + r, weapon: o.weapon, AI2Class: H.AI }); const n = Math.round(20 / DT), t0 = performance.now(); for (let i = 0; i < n; i++) G.step(); ts.push((performance.now() - t0) / n); }
  ts.sort((a, b) => a - b);
  console.log(`■ perf · ${o.weapon}: 스텝마다 ${ts[1].toFixed(3)} ms (세 번: ${ts.map((x) => x.toFixed(3)).join(' · ')})\n`);
  return [];
}
async function sceneFight(Gm, o) {
  const { H, DT } = Gm;
  const G = H.newRound({ walls: true, seed: o.seed, weapon: o.weapon, weapon2: o.weapon2 ?? o.weapon, AI2Class: H.AI });
  const LP = attach(G.world, bodiesOf(G.player), { fighter: G.player }), LE = attach(G.world, bodiesOf(G.enemy), { fighter: G.enemy });
  LP.foe = LE; LE.foe = LP;
  hook(G, [LP, LE]);
  let tDead = null;
  const n = Math.round(o.secs / DT);
  for (let i = 0; i < n; i++) { G.step(); if (tDead == null && (G.player.state === 'dead' || G.enemy.state === 'dead')) tDead = G.t; if (tDead != null && G.t > tDead + 1) break; }
  return [[`fight P · ${o.weapon} · seed ${o.seed} (${G.player.state}/${G.enemy.state})`, LP.summary()], [`fight E · seed ${o.seed}`, LE.summary()]];
}

/** 유파 판 (school_balance.mjs fightOne — 유파 책을 다 익힌 사람 봇 대 숙련 3 AI · 게임처럼 고유 공격 · 비기 · 막기 손이 붙는다). 싸움꾼 둘 다 잰다 */
async function sceneSchool(Gm, o) {
  const SB = await import(u('tools/sim/school_balance.mjs'));
  const out = [];
  for (const cell of o.cells) {
    const [school, weapon, opp] = cell.split(':');
    let LP, LE, GG, SP, SE, st;
    // fightOne 은 끝에서 world.free() 를 부른다 — 요약(지문 · 몸 밖 관절)은 세계가 살아 있을 때 떠야 한다
    SB.fightOne({ school, weapon, opp, seed: o.seed, dur: o.secs, onRound: ({ G }) => { GG = G; LP = attach(G.world, bodiesOf(G.player), { fighter: G.player }); LE = attach(G.world, bodiesOf(G.enemy), { fighter: G.enemy }); LP.foe = LE; LE.foe = LP; hook(G, [LP, LE]); const fr = G.world.free; G.world.free = function (...a) { st = `${G.player.state}/${G.enemy.state}`; SP = LP.summary(); SE = LE.summary(); return fr.apply(this, a); }; } });
    SP ??= LP.summary(); SE ??= LE.summary(); st ??= `${GG.player.state}/${GG.enemy.state}`;
    out.push([`school P(사람 봇) · ${cell} · seed ${o.seed} (${st})`, SP], [`school E(AI) · ${cell} · seed ${o.seed}`, SE]);
  }
  return out;
}

// ───────── 자가 시험: 지표가 0 / 1 로 나와야 하는 경우 ─────────
async function selftest() {
  const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
  await RAPIER.init();
  const mk = (grav = -9.81) => { const w = new RAPIER.World({ x: 0, y: grav, z: 0 }); w.timestep = 1 / 120; w.integrationParameters.numSolverIterations = 6; return w; };
  const box = (w, y, o = {}) => { const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(o.x ?? 0, y, 0).setLinearDamping(o.ld ?? 0).setAngularDamping(o.ad ?? 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.2, 0.2).setDensity(o.rho ?? 125).setFriction(0.9), b); return b; };
  const ground = (w) => w.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9), w.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
  const drive = (w, L, secs, each) => { const G = { world: w, step: () => { each?.(); w.step(); } }; hook(G, [L]); for (let i = 0; i < Math.round(secs * 120); i++) G.step(); return L.summary(); };
  const out = [];
  const ok = (name, cond, note) => { out.push(`  ${cond ? 'OK  ' : 'FAIL'} ${name} — ${note}`); return cond; };
  let all = true;
  { // 1 땅 위에 쉬는 상자: 밖 0 · 땅이 체중을 다 받침
    const w = mk(); ground(w); const b = box(w, 0.2); for (let i = 0; i < 120; i++) w.step();
    const S = drive(w, attach(w, [['box', b]]), 2);
    all &= ok('쉬는 상자 접촉 법선', Math.abs(S.check.groundNShare - 1) < 0.02 && S.check.hiddenYNs / (b.mass() * 9.81 * S.T) < 0.02 && S.externalJoints.length === 0, `접촉 법선 ÷ 체중 ${S.check.groundNShare.toFixed(4)} · 설명 안 되는 수직 ${S.check.hiddenYNs.toFixed(3)} N·s`);
    all &= ok('쉬는 상자', S.forceShare < 0.01 && Math.abs(S.cats.res.Fy / (b.mass() * 9.81 * S.T) - 1) < 0.01, `힘 몫 ${pct(S.forceShare)} · 땅 수직 ÷ 체중 ${(S.cats.res.Fy / (b.mass() * 9.81 * S.T)).toFixed(4)}`);
  }
  { // 2 공중에서 받침 힘(= 체중)으로 뜬 상자: 밖 1 · 받침 몫 1 · 일 0 (안 움직임)
    const w = mk(); const b = box(w, 2); const L = attach(w, [['box', b]]);
    const S = drive(w, L, 2, () => { b.resetForces(true); SHARED.phase = 'balance'; b.addForce({ x: 0, y: b.mass() * 9.81, z: 0 }, true); SHARED.phase = 'other'; });
    all &= ok('받침으로 뜬 상자', S.forceShare > 0.99 && Math.abs(S.supportShare - 1) < 0.01 && S.cats.support.Wabs < 1e-6, `힘 몫 ${pct(S.forceShare)} · 받침 몫 ${pct(S.supportShare)} · 받침이 한 일 ${S.cats.support.Wabs.toFixed(6)} J`);
  }
  { // 3 반씩: 땅 위 상자를 체중의 절반으로 받침 → 받침 몫 0.5 · 힘 몫 0.5
    const w = mk(); ground(w); const b = box(w, 0.2); for (let i = 0; i < 120; i++) w.step(); const L = attach(w, [['box', b]]);
    const S = drive(w, L, 2, () => { b.resetForces(true); SHARED.phase = 'balance'; b.addForce({ x: 0, y: 0.5 * b.mass() * 9.81, z: 0 }, true); SHARED.phase = 'other'; });
    all &= ok('절반 받침', Math.abs(S.supportShare - 0.5) < 0.01 && Math.abs(S.forceShare - 0.5) < 0.01, `받침 몫 ${pct(S.supportShare)} · 힘 몫 ${pct(S.forceShare)}`);
  }
  { // 4 무중력에서 감쇠로 느려지는 상자: 감쇠 충격량 = 운동량 변화 (잔차 0) · 일 = 잃은 운동 에너지
    const w = mk(0); const b = box(w, 2, { ld: 0.5, ad: 0.4 }); b.setLinvel({ x: 3, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 4, z: 0 }, true);
    const m = b.mass(), E0 = 0.5 * m * 9 + 0.5 * b.principalInertia().y * 16;
    const L = attach(w, [['box', b]]); const S = drive(w, L, 2);
    const v1 = b.linvel().x, w1 = b.angvel().y, E1 = 0.5 * m * v1 * v1 + 0.5 * b.principalInertia().y * w1 * w1;
    all &= ok('감쇠 상자', Math.abs(S.cats.damp.Fimp - m * (3 - v1)) / (m * (3 - v1)) < 0.01 && S.cats.res.Fimp < 1e-6 * m && Math.abs(-S.cats.damp.Wneg - (E0 - E1)) / (E0 - E1) < 0.03, `감쇠 충격량 ${S.cats.damp.Fimp.toFixed(3)} 대 Δp ${(m * (3 - v1)).toFixed(3)} · 잔차 ${S.cats.res.Fimp.toExponential(1)} · 감쇠 일 ${(-S.cats.damp.Wneg).toFixed(3)} 대 ΔE ${(E0 - E1).toFixed(3)}`);
  }
  { // 5 무중력 두 상자를 토크 쌍(근육)으로 돌림: 밖 0 · 짝 어긋남 0 · 근육 일 = 얻은 에너지
    const w = mk(0); const a = box(w, 2, { x: -0.5 }), b = box(w, 2, { x: 0.5 }); const L = attach(w, [['a', a], ['b', b]]);
    const S = drive(w, L, 1, () => { a.resetTorques(true); b.resetTorques(true); SHARED.phase = 'muscle'; a.addTorque({ x: 0, y: 2, z: 0 }, true); b.addTorque({ x: 0, y: -2, z: 0 }, true); SHARED.phase = 'other'; });
    const E = 0.5 * a.principalInertia().y * a.angvel().y ** 2 + 0.5 * b.principalInertia().y * b.angvel().y ** 2;
    all &= ok('토크 쌍', S.forceShare < 0.01 && S.workShare < 0.01 && Math.abs(S.cats.musclePair.Wpos - E) / E < 0.02, `힘 몫 ${pct(S.forceShare)} · 일 몫 ${pct(S.workShare)} · 근육 일 ${S.cats.musclePair.Wpos.toFixed(3)} 대 얻은 E ${E.toFixed(3)}`);
  }
  { // 6 무중력 상자를 짝 없는 힘으로 밂: 밖 1 · 일 몫 1
    const w = mk(0); const b = box(w, 2); const L = attach(w, [['box', b]]);
    const S = drive(w, L, 1, () => { b.resetForces(true); SHARED.phase = 'balance'; b.addForce({ x: 20, y: 0, z: 0 }, true); SHARED.phase = 'other'; });
    const E = 0.5 * b.mass() * b.linvel().x ** 2;
    all &= ok('짝 없는 밀기', S.forceShare > 0.99 && S.workShare > 0.97 && Math.abs(S.cats.push.Wpos - E) / E < 0.02, `힘 몫 ${pct(S.forceShare)} · 일 몫 ${pct(S.workShare)} · 민 일 ${S.cats.push.Wpos.toFixed(3)} 대 얻은 E ${E.toFixed(3)}`);
  }
  { // 7 속도 직접 쓰기: Δ(mv) 가 '쓰기'로 잡히고 잔차 0
    const w = mk(0); const b = box(w, 2); const L = attach(w, [['box', b]]); let k = 0;
    const S = drive(w, L, 0.5, () => { if (k++ === 10) b.setLinvel({ x: 2, y: 0, z: 0 }, true); });
    all &= ok('속도 쓰기', Math.abs(S.cats.write.Fimp - 2 * b.mass()) < 1e-6 && S.cats.res.Fimp < 1e-6, `쓰기 ${S.cats.write.Fimp.toFixed(4)} N·s 대 m·Δv ${(2 * b.mass()).toFixed(4)} · 잔차 ${S.cats.res.Fimp.toExponential(1)}`);
  }
  { // 9 ~ 14 구멍 시험 (감사 11/24 referee_holes): 힘을 부르지 않고 몸을 받치는 길이 잡히는가 — 기운 막대(12°)는 그냥 두면 쓰러져야 한다
    const tiltQ = (deg) => { const a = (deg * Math.PI) / 180; return { x: 0, y: 0, z: Math.sin(a / 2), w: Math.cos(a / 2) }; };
    const pole = (w, o = {}) => { const b = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.56, 0).setRotation(tiltQ(12)).setAngularDamping(o.ad ?? 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 0.5, 0.05).setMass(10).setFriction(o.mu ?? 0.9), b); return b; };
    const lean = (b) => { const q = b.rotation(); return (Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (q.x * q.x + q.z * q.z)))) * 180) / Math.PI; };
    const runCase = (prep, grav) => { const w = mk(grav ?? -9.81); ground(w); const b = pole(w, prep?.o); prep?.fn?.(w, b); const S = drive(w, attach(w, [['pole', b]]), 3); return { S, lean: lean(b) }; };
    const C0 = runCase(null);
    all &= ok('대조: 기운 막대', C0.lean > 80 && C0.S.torque.share < 0.05, `3 s 뒤 ${C0.lean.toFixed(0)}° · 토크 몫(밖) ${pct(C0.S.torque.share)}`);
    const hole = (name, c, extra) => { const d = diffFingerprint(C0.S, c.S); const caught = d.length > 0 || c.S.torque.share > 0.2 || extra; all &= ok(name, caught, `3 s 뒤 ${c.lean.toFixed(1)}° · 토크 몫(밖) ${pct(c.S.torque.share)} · 기울기 잔차 ${c.S.torque.tiltResNms.toFixed(1)} N·m·s · 지문 다름 ${d.length}${d.length ? ' (' + d[0].slice(0, 60) + ')' : ''}`); };
    hole('회전 잠금', runCase({ fn: (w, b) => b.lockRotations(true, true) }));
    hole('덧댄 회전 관성 5000', runCase({ fn: (w, b) => b.setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: 5000, y: 5000, z: 5000 }, { x: 0, y: 0, z: 0, w: 1 }, true) }));
    hole('회전 감쇠 200', runCase({ o: { ad: 200 } }));
    hole('중력 절반', runCase(null, -4.905));
    hole('마찰 계수 5', runCase({ o: { mu: 5 } }));
    { const c = runCase({ fn: (w) => { const pr = w.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0.3, 0.3, 0)); w.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.3, 0.2).setFriction(0.9), pr); } }); hole('보이지 않는 운동학 받침대', c, c.S.check.foreignKinNs > 1); }
  }
  { // 15 ~ 17 yaw 한도 (감사 11/24 대조 4 yaw_point_contact): 숨은 힘이 없는 한 발 상자(75 kg) 안의 바퀴를 몸 안 토크 쌍으로 돌려 발을 비튼다 — 엔진 한도 넘는 몫은 0 이어야 하고, 체중이 귀퉁이에 몰리면 '엔진이 봐준 몫'이 잡혀야 한다
    const foot = (cx, cz, T, hidden) => {
      const w = mk(); ground(w);
      const A1 = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0, 0));
      w.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 0.035, 0.05).setTranslation(0, 0.035, 0).setMass(1.1).setFriction(0.9), A1);
      w.createCollider(RAPIER.ColliderDesc.ball(0.05).setTranslation(cx, 0.9, cz).setMass(50).setSensor(true), A1);
      const B1 = w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(cx, 0.9, cz));
      w.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.02, 0.3).setMass(23.9).setSensor(true), B1);
      w.createImpulseJoint(RAPIER.JointData.revolute({ x: cx, y: 0.9, z: cz }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), A1, B1, true);
      for (let i = 0; i < 120; i++) w.step();
      const yaw = () => { const q = A1.rotation(); return (2 * Math.atan2(q.y, q.w) * 180) / Math.PI; }, y0 = yaw();
      const S = drive(w, attach(w, [['footA', A1], ['wheel', B1]]), 2, () => { A1.resetTorques(true); B1.resetTorques(true); SHARED.phase = 'muscle'; B1.addTorque({ x: 0, y: T, z: 0 }, true); A1.addTorque({ x: 0, y: -T + (hidden || 0), z: 0 }, true); SHARED.phase = 'other'; });
      return { S, turned: Math.abs(yaw() - y0) };
    };
    const c1 = foot(0, 0, 60), c2 = foot(0.10, 0.04, 60);
    all &= ok('발 비틀기 · 체중 한가운데 60 N·m', c1.turned < 1 && c1.S.torque.yawExcessRate < 1 && c1.S.torque.yawOverCoulombRate < 1, `발 ${c1.turned.toFixed(2)}° · 엔진 한도 넘는 몫 ${c1.S.torque.yawExcessRate.toFixed(2)} · 엔진이 봐준 몫 ${c1.S.torque.yawOverCoulombRate.toFixed(2)} N·m`);
    all &= ok('발 비틀기 · 체중 귀퉁이 60 N·m', c2.turned < 1 && c2.S.torque.yawExcessRate < 1 && c2.S.torque.yawOverCoulombRate > 20, `발 ${c2.turned.toFixed(2)}° · 엔진 한도 넘는 몫 ${c2.S.torque.yawExcessRate.toFixed(2)} · 엔진이 봐준 몫 ${c2.S.torque.yawOverCoulombRate.toFixed(2)} N·m (쿨롱 한도 29 쯤)`);
  }
  { // 18 ~ 23 선언된 밖 도움(갈래 aid — 11/24 검토): 가짜 싸움꾼의 driveAid 가 건 것이 네 갈래(yaw · 기울기 · 드는 힘 · 수평 힘)로 맞게 읽히는가. 짝힘으로 건 도움이 0 으로 읽히던 구멍을 막았는지 본다
    const fake = (b, driveAid) => ({ bodies: { pelvis: b, chest: b }, state: 'stand', driveAid });
    const runAid = (w, b, secs, fn) => { const fz = fake(b, fn), L = attach(w, [['box', b]], { fighter: fz }); const S = drive(w, L, secs, () => { b.resetForces(true); b.resetTorques(true); fz.driveAid(); }); return { S, line: report('t', S).split('\n').find((l) => l.includes('선언된 밖 도움')) ?? null }; };
    const near = (x, y, tol = 0.01) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(y));
    const A4 = (a) => `yaw ${a.yaw.avg.toFixed(2)}/${a.yaw.peak.toFixed(2)} · 기울기 ${a.tilt.avg.toFixed(2)}/${a.tilt.peak.toFixed(2)} N·m · 드는 힘 ${a.lift.avgN.toFixed(2)}/${a.lift.peakN.toFixed(2)} N (÷ 맨몸 체중 ${a.lift.share == null ? '-' : (100 * a.lift.share).toFixed(1) + ' %'}) · 수평 힘 ${a.push.avgN.toFixed(2)}/${a.push.peakN.toFixed(2)} N · 힘 크기 합 최고 ${a.peakN.toFixed(1)} N (평균/최고)`;
    { // 순수 토크: 무중력 상자에 수평축 5 + 수직축 3 N·m → 기울기 5 · yaw 3 · 힘 0 · 일 = 얻은 에너지
      const w = mk(0), b = box(w, 2); const { S, line } = runAid(w, b, 1, () => b.addTorque({ x: 5, y: 3, z: 0 }, true)); const a = S.aid;
      all &= ok('도움: 순수 토크', near(a.tilt.avg, 5) && near(a.tilt.peak, 5) && near(a.yaw.avg, 3) && near(a.yaw.peak, 3) && a.lift.peakN === 0 && a.push.peakN === 0 && a.peakN === 0 && near(a.peakNm, Math.hypot(5, 3)) && near(a.pureTorquePeak, Math.hypot(5, 3)) && a.stepShare === 1 && !!line && S.forceShare === 0 && S.torque.share > 0.99, `${A4(a)} · 보고 줄 ${line ? '있음' : '없음'} · 토크 몫(밖) ${pct(S.torque.share)}`);
    }
    { // 드는 힘: 땅 위 상자를 체중의 절반으로 → 드는 힘 ÷ 맨몸 체중 0.5 · 땅 법선 0.5 · 토크 0 · 수평 힘 0
      const w = mk(); ground(w); const b = box(w, 0.2); for (let i = 0; i < 120; i++) w.step(); const Mg = b.mass() * 9.81;
      const { S, line } = runAid(w, b, 2, () => b.addForce({ x: 0, y: 0.5 * Mg, z: 0 }, true)); const a = S.aid;
      all &= ok('도움: 드는 힘', near(S.bareMg, Mg, 1e-6) && near(a.lift.share, 0.5) && near(a.lift.peakShare, 0.5) && near(a.lift.avgN, 0.5 * Mg) && near(a.liftShare, 0.5) && a.push.peakN < 1e-9 && a.tilt.peak < 1e-6 * Mg && a.yaw.peak < 1e-6 * Mg && Math.abs(S.check.groundNShare - 0.5) < 0.02 && !S.cats.support && !!line, `${A4(a)} · 맨몸 체중 ${S.bareMg.toFixed(2)} N (상자 ${Mg.toFixed(2)}) · 땅 법선 ÷ 체중 ${pct(S.check.groundNShare)} · 보고 줄 ${line ? '있음' : '없음'}`);
    }
    { // 짝힘: 한 토막의 위 · 아래 0.4 m 에 ± 200 N (= 80 N·m 순수 토크와 같은 일) → 기울기 80 · 알짜 힘 0 · 힘 크기 합 400 · 보고 줄이 찍힘. 옛 셈(addTorque 만)은 0
      const w = mk(0), b = box(w, 2);
      const { S, line } = runAid(w, b, 0.05, () => { const c = b.worldCom(); b.addForceAtPoint({ x: 200, y: 0, z: 0 }, { x: c.x, y: c.y + 0.2, z: c.z }, true); b.addForceAtPoint({ x: -200, y: 0, z: 0 }, { x: c.x, y: c.y - 0.2, z: c.z }, true); }); const a = S.aid;
      all &= ok('도움: 짝힘(기울기 축)', a.tilt.peak > 79 && a.tilt.peak < 81 && a.tilt.avg > 79 && a.yaw.peak < 0.5 && near(a.peakN, 400) && near(a.grossNs, 400 * S.T) && a.forceNs < 1e-6 && a.lift.peakN < 1e-9 && a.push.peakN < 1e-6 && a.peakNm > 79 && a.torqueRate > 79 && a.pureTorquePeak === 0 && near(a.torqueNms, S.cats.aid.Timp, 1e-3) && !!line, `${A4(a)} · ∫|알짜 F| ${a.forceNs.toFixed(4)} N·s · ∫Σ|F| ${a.grossNs.toFixed(2)} N·s · 옛 셈(addTorque 만) 최고 ${a.pureTorquePeak} N·m · 보고 줄 ${line ? '있음' : '없음'}`);
    }
    { // 짝힘(수직축): 앞 · 뒤 0.4 m 에 ± 200 N → yaw 80 · 기울기 0
      const w = mk(0), b = box(w, 2);
      const { S, line } = runAid(w, b, 0.05, () => { const c = b.worldCom(); b.addForceAtPoint({ x: 200, y: 0, z: 0 }, { x: c.x, y: c.y, z: c.z + 0.2 }, true); b.addForceAtPoint({ x: -200, y: 0, z: 0 }, { x: c.x, y: c.y, z: c.z - 0.2 }, true); }); const a = S.aid;
      all &= ok('도움: 짝힘(수직축)', a.yaw.peak > 79 && a.yaw.peak < 81 && a.yaw.avg > 79 && a.tilt.peak < 0.5 && near(a.peakN, 400) && a.lift.peakN < 1e-9 && a.push.peakN < 1e-6 && !!line, `${A4(a)} · 보고 줄 ${line ? '있음' : '없음'}`);
    }
    { // 수평 힘: 무중력 상자를 도움 이름으로 20 N 밂 → 수평 힘 20 · 드는 힘 0 · 토크 0 · 밀기(push) 갈래가 아니라 aid 갈래 · 힘 몫 1
      const w = mk(0), b = box(w, 2); const { S, line } = runAid(w, b, 1, () => b.addForce({ x: 12, y: 0, z: 16 }, true)); const a = S.aid;
      all &= ok('도움: 수평 힘', near(a.push.avgN, 20) && near(a.push.peakN, 20) && a.lift.peakN === 0 && a.liftShare === 0 && a.tilt.peak < 1e-6 && a.yaw.peak < 1e-6 && near(a.peakN, 20) && !S.cats.push && S.forceShare > 0.99 && !!line, `${A4(a)} · 밀기 갈래 ${S.cats.push ? S.cats.push.Fimp : '없음'} · 힘 몫 ${pct(S.forceShare)} · 보고 줄 ${line ? '있음' : '없음'}`);
    }
    { // 절반의 시간만(앞 1 s) 토크 8 + 드는 힘 30: 평균은 잰 시간 전체로 나눈 값(걸린 동안 값의 절반) · 걸린 스텝 0.5 · 최고는 걸린 동안 값
      const w = mk(0), b = box(w, 2); let i = 0; const { S } = runAid(w, b, 2, () => { if (i++ < 120) { b.addTorque({ x: 0, y: 0, z: 8 }, true); b.addForce({ x: 0, y: 30, z: 0 }, true); } }); const a = S.aid;
      all &= ok('도움: 절반 시간', near(a.stepShare, 0.5, 1e-9) && near(a.tilt.avg, 4) && near(a.tilt.peak, 8) && near(a.lift.avgN, 15) && near(a.lift.peakN, 30) && near(a.grossRate, 15), `${A4(a)} · 걸린 스텝 ${pct(a.stepShare)}`);
    }
  }
  console.log(`honesty.mjs 자가 시험 (Rapier ${RAPIER.version?.() ?? ''})\n${out.join('\n')}\n${all ? '모두 통과' : '실패 있음'}`);
  process.exit(all ? 0 : 1);
}

async function main() {
  if (args.selftest) return selftest();
  const Gm = await load();
  const o = { weapon: String(args.weapon ?? 'longsword'), seed: +(args.seed ?? 7), secs: +(args.secs ?? 30), fam: String(args.fam ?? 'diagR'), kick: +(args.kick ?? 40), kickdir: String(args.kickdir ?? 'front') };
  const which = String(args.scene ?? 'all');
  const scenes = which === 'all' ? ['stand', 'walk', 'stroke', 'fight'] : which.split(',');
  const all = [];
  o.cells = String(args.cells ?? 'german:longsword:longsword,italian:rapier:longsword,iberian:zweihander:longsword,japanese:uchigatana:longsword,chinese:hwando:longsword').split(',');
  for (const s of scenes) all.push(...(s === 'perf' ? await scenePerf(Gm, o) : s === 'ragdoll' ? await sceneRagdoll(Gm, o) : s === 'fight' ? await sceneFight(Gm, o) : s === 'school' ? await sceneSchool(Gm, o) : await sceneSolo(Gm, o, s)));
  const base = args.compare ? JSON.parse(readFileSync(String(args.compare), 'utf8')) : null;
  for (const [t, S] of all) {
    console.log(report(t, S));
    if (base) { const key = t.split(' ')[0], b = base.find((x) => x.title.split(' ')[0] === key); if (b) { const d = diffFingerprint(b, S); console.log(d.length ? `  지문이 기준과 다름 (${d.length}):\n    ` + d.slice(0, 40).join('\n    ') : '  지문: 기준과 같음'); } }
    console.log('');
  }
  if (args.json) writeFileSync(String(args.json), JSON.stringify(all.map(([title, S]) => ({ title, ...S })), null, 1));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
