// ─────────────────────────────────────────────────────────────
//  honesty.mjs — 물리 정직성 지표 H1 (물리 2.0 · 0 단계 · docs/strike/physics2_plan_2026-11-23.md §4 · §8). 재기만 한다 — 몸에 아무것도 걸지 않는다.
//
//   node tools/sim/honesty.mjs [--scene=stand|walk|stroke|fight|all] [--weapon=longsword] [--seed=7] [--secs=30] [--fam=diagR] [--json=<파일>] [--root=<트리>] [--selftest]
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
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

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
const OUT = ['support', 'push', 'anchor', 'damp', 'write', 'mass', 'unpaired'];
const SHARED = { phase: 'other', sets: [] }; // 단계 이름표는 한 번에 하나 (모든 장부가 같이 봄)

/**
 * attach(world, bodies, opts) → 장부. bodies = [[이름, 강체]…]. opts.fighter 가 있으면 단계 감싸기 · 닻 재계산을 한다.
 * pre() = 스텝 앞(힘 넣기 전) · mid() = world.step 바로 뒤 · post() = 스텝 끝. 장면 쪽이 차례대로 부른다 (hook(G, [장부…]) 가 G.step 에 건다).
 */
export function attach(world, named, opts = {}) {
  const DT = world.timestep;
  const g = world.gravity.y;
  const bodies = named.map(([, b]) => b), names = named.map(([n]) => n);
  const f = opts.fighter ?? null;
  const L = { names, rows: 0, T: 0, acc: {}, chk: { resMax: 0, pairMax: 0 }, fighter: f };
  const A = (k) => (L.acc[k] ||= { Fimp: 0, Fy: 0, Timp: 0, Wabs: 0, Wpos: 0, Wneg: 0, n: 0 });
  let decl = [];
  const mine = new Map(bodies.map((b, i) => [b.handle, i]));
  bodies.forEach((rb, bi) => {
    const o = {};
    for (const k of ['addForce', 'addForceAtPoint', 'addTorque', 'applyImpulse', 'applyImpulseAtPoint', 'applyTorqueImpulse', 'setLinvel', 'setAngvel']) o[k] = rb[k];
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
    for (const [n, t] of [['driveBalance', 'balance'], ['shove', 'shove'], ['closeStep', 'shove'], ['driveSword', 'sword'], ['offHand', 'offhand'], ['driveJoints', 'muscle'], ['elbowGravity', 'elbowG'], ['anatSoft', 'anat'], ['trackBlade', 'track']]) wrap(f, n, t);
    wrap(f.gait, 'pinFeet', 'pin');
    wrap(f.gait, 'swingPull', 'swing'); // 내딛는 발 ↔ 골반 당김 (쌍 — 힘은 맞지만 작용선이 달라 짝힘 토크가 남을 수 있음)
    const rs = f.uprightJoint.rawSet;
    if (!rs.__honestyCap) {
      const cap = (rs.__honestyCap = new Map());
      const o1 = rs.jointConfigureMotorPosition;
      rs.jointConfigureMotorPosition = function (h, ax, t, k, d) { let m = cap.get(h); if (!m) cap.set(h, (m = {})); m[ax] = { t, k, d }; return o1.call(this, h, ax, t, k, d); };
    }
    capUp = () => rs.__honestyCap.get(f.uprightJoint.handle);
  }
  const sample = () => {
    const s = { p: [], v: [], w: [], m: [], P: V3(), E: 0, M: 0, c: V3() };
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i], m = b.mass(), p = cv(b.worldCom()), v = cv(b.linvel()), w = cv(b.angvel());
      s.p.push(p); s.v.push(v); s.w.push(w); s.m.push(m);
      s.P = add(s.P, scl(v, m)); s.M += m; s.c = add(s.c, scl(p, m));
      s.E += 0.5 * m * dot(v, v) + 0.5 * dot(w, Iw(i, w)) - m * g * p.y;
    }
    s.c = scl(s.c, 1 / s.M);
    if (f) { s.qA = cq(f.anchor.rotation()); s.qP = cq(f.bodies.pelvis.rotation()); }
    return s;
  };
  let prev = null, mid = null;
  L.pre = () => { if (!prev) prev = sample(); decl = []; };
  L.mid = () => { // world.step 바로 뒤: 감쇠 충격량 (v_뒤 로)
    mid = { J: V3(), Jabs: 0, Tabs: 0, W: 0 };
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i], cl = b.linearDamping(), ca = b.angularDamping();
      if (b.isSleeping()) continue;
      const v = cv(b.linvel()), w = cv(b.angvel()), m = b.mass();
      const j = scl(v, -m * cl * DT), lw = Iw(i, w);
      mid.J = add(mid.J, j); mid.Jabs += len(j); mid.Tabs += len(lw) * ca * DT;
      mid.W += -(cl * m * dot(v, v) + ca * dot(w, lw)) * DT;
    }
  };
  L.post = () => {
    const cur = sample();
    const dP = scl(sub(cur.P, prev.P), 1 / DT);
    // 질량 바뀜: Δm·v (디딘 발 덧질량)
    let Fmass = V3(), massAbs = 0;
    for (let i = 0; i < bodies.length; i++) if (Math.abs(cur.m[i] - prev.m[i]) > 1e-9) { const j = scl(prev.v[i], (cur.m[i] - prev.m[i]) / DT); Fmass = add(Fmass, j); massAbs += len(j); A('mass').n++; }
    // 선언 힘: 단계별 합
    const by = {};
    let Fdecl = V3();
    for (const d of decl) {
      let kind = d.kind;
      if (kind === 'balance') kind = d.F && Math.abs(d.F.x) + Math.abs(d.F.z) < 1e-9 ? 'support' : 'push';
      const k = (by[kind] ||= { F: V3(), T: V3(), gross: 0, P: 0 });
      const i = d.bi, vb = scl(add(prev.v[i], cur.v[i]), 0.5), wb = scl(add(prev.w[i], cur.w[i]), 0.5);
      if (d.F) {
        k.F = add(k.F, d.F); k.gross += len(d.F); Fdecl = add(Fdecl, d.F);
        k.P += dot(d.F, d.r ? add(vb, cross(wb, d.r)) : vb);
        k.T = add(k.T, cross(sub(d.p, prev.c), d.F)); // 계 질량중심 둘레
      }
      if (d.T) { k.T = add(k.T, d.T); k.P += dot(d.T, wb); }
    }
    const put = (name, Fnet, tauAbs, P, Fy = 0) => { const a = A(name); a.Fimp += len(Fnet) * DT; a.Fy += Fy * DT; a.Timp += tauAbs * DT; a.Wabs += Math.abs(P) * DT; if (P > 0) a.Wpos += P * DT; else a.Wneg += P * DT; a.n++; };
    let Pout = 0, pairP = 0;
    for (const [kind, k] of Object.entries(by)) {
      if (PAIRED.has(kind)) {
        // 짝이 맞는 몫은 안(근육) · 안 맞는 합력만 밖
        const a = A('musclePair'); a.Wabs += Math.abs(k.P) * DT; if (k.P > 0) a.Wpos += k.P * DT; else a.Wneg += k.P * DT; a.Fimp += k.gross * DT; a.n++;
        pairP += k.P;
        if (len(k.F) > 1e-6 || len(k.T) > 1e-6) { put('unpaired', k.F, len(k.T), 0, k.F.y); L.chk.pairMax = Math.max(L.chk.pairMax, len(k.F)); L.chk.coupleMax = Math.max(L.chk.coupleMax || 0, len(k.T)); (L.chk.coupleBy ||= {})[kind] = (L.chk.coupleBy[kind] || 0) + len(k.T) * DT; }
      } else {
        put(kind, k.F, len(k.T), k.P, k.F.y);
        if (kind === 'support' || kind === 'push' || kind === 'write' || kind === 'other' || kind === 'unpaired') Pout += k.P;
      }
    }
    // 감쇠
    { const a = A('damp'); a.Fimp += mid ? mid.Jabs : 0; a.Timp += mid ? mid.Tabs : 0; a.Wabs += mid ? -mid.W : 0; a.Wneg += mid ? mid.W : 0; a.n++; Pout += mid ? mid.W / DT : 0; }
    if (massAbs > 0) { const a = A('mass'); a.Fimp += massAbs * DT; }
    // 닻 τ̂
    if (f) {
      const m = capUp?.();
      if (m) {
        const dqA = qmul(cur.qA, qconj(prev.qA)), wA = scl(rotvec(dqA), 1 / DT);
        const iPel = mine.get(f.bodies.pelvis.handle);
        const e = rotvec(qmul(qconj(prev.qA), prev.qP)), wr = qrot(qconj(prev.qA), sub(cur.w[iPel], wA));
        const tl = V3();
        for (const ax of ['x', 'y', 'z']) { const s = m[AXG[ax]]; if (s) tl[ax] = -(s.k * (e[ax] - s.t) + s.d * wr[ax]); }
        const tw = qrot(prev.qA, tl), P = dot(tw, scl(add(prev.w[iPel], cur.w[iPel]), 0.5));
        const a = A('anchor'); a.Timp += len(tw) * DT; a.Wabs += Math.abs(P) * DT; if (P > 0) a.Wpos += P * DT; else a.Wneg += P * DT; a.n++;
        const y = A('anchorYaw'); y.Timp += Math.abs(tl.y) * DT; const t = A('anchorTilt'); t.Timp += Math.hypot(tl.x, tl.z) * DT;
        Pout += P;
      }
    }
    // 잔차 = 엔진이 준 힘 (땅 접촉 · 마찰 · 상대 · 칼 접촉)
    const Fdamp = mid ? scl(mid.J, 1 / DT) : V3();
    const res = sub(sub(sub(sub(dP, V3(0, cur.M * g, 0)), Fdecl), Fdamp), Fmass);
    { const a = A('res'); a.Fimp += len(res) * DT; a.Fy += res.y * DT; a.n++; }
    // 안쪽 일률 = dE/dt − 밖 일률
    const Pin = (cur.E - prev.E) / DT - Pout;
    { const a = A('inside'); a.Wabs += Math.abs(Pin) * DT; if (Pin > 0) a.Wpos += Pin * DT; else a.Wneg += Pin * DT; }
    L.rows++; L.T += DT; L.Mg = -cur.M * g; L.lastRes = res;
    prev = cur; decl = []; mid = null;
  };
  L.summary = () => {
    const a = L.acc, v = (k, q) => a[k]?.[q] ?? 0;
    const Fout = OUT.reduce((s, k) => s + v(k, 'Fimp'), 0) + v('other', 'Fimp');
    const Fin = v('res', 'Fimp') + v('pin', 'Fimp');
    const Wout = OUT.reduce((s, k) => s + v(k, 'Wabs'), 0) + v('other', 'Wabs');
    const Win = v('inside', 'Wabs');
    return {
      T: +L.T.toFixed(3),
      forceShare: Fout / Math.max(1e-9, Fout + Fin),
      supportShare: v('support', 'Fy') / Math.max(1e-9, L.Mg * L.T),
      workShare: Wout / Math.max(1e-9, Wout + Win),
      anchorYawNms: v('anchorYaw', 'Timp'), anchorTiltNms: v('anchorTilt', 'Timp'),
      pairResidualMaxN: L.chk.pairMax, coupleBy: L.chk.coupleBy ?? {},
      cats: Object.fromEntries(Object.entries(a).map(([k, x]) => [k, { Fimp: +x.Fimp.toFixed(3), Fy: +x.Fy.toFixed(3), Timp: +x.Timp.toFixed(3), Wabs: +x.Wabs.toFixed(3), Wpos: +x.Wpos.toFixed(3), Wneg: +x.Wneg.toFixed(3) }])),
    };
  };
  SHARED.sets.push(L);
  return L;
}

/** G.step 에 장부들을 건다: 앞 → (world.step 뒤) → 끝. combat.afterStep 은 'combat' 단계. */
export function hook(G, ledgers) {
  const w = G.world, ws = w.step;
  w.step = function (...a) { const r = ws.apply(this, a); for (const l of ledgers) l.mid(); return r; };
  if (G.combat?.afterStep) { const o = G.combat.afterStep; G.combat.afterStep = function (...a) { const prev = SHARED.phase; SHARED.phase = 'combat'; try { return o.apply(this, a); } finally { SHARED.phase = prev; } }; }
  const s0 = G.step;
  G.step = () => { for (const l of ledgers) l.pre(); s0(); for (const l of ledgers) l.post(); };
}
const bodiesOf = (f) => { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; };

// ───────── 보고 ─────────
const pct = (x) => (100 * x).toFixed(1).padStart(5) + ' %';
const n1 = (x, w = 9) => (+x).toFixed(1).padStart(w);
export function report(title, S) {
  const lines = [`■ ${title}  (${S.T} s)`, `  힘 몫(밖) ${pct(S.forceShare)} · 수직 받침 몫 ${pct(S.supportShare)} · 일 몫(밖) ${pct(S.workShare)} · 닻 yaw ${n1(S.anchorYawNms, 0)} N·m·s · 닻 기울기 ${n1(S.anchorTiltNms, 0)} N·m·s · 근육 쌍 어긋남 최고 ${S.pairResidualMaxN.toFixed(3)} N${Object.keys(S.coupleBy).length ? ' · 짝 없는 토크 ' + Object.entries(S.coupleBy).map(([k, x]) => `${k} ${x.toFixed(1)}`).join(' · ') + ' N·m·s' : ''}`];
  lines.push('   갈래          ∫|F|dt N·s   그중 수직    ∫|τ|dt N·m·s    ∫|P|dt J     더한 일 J     뺀 일 J');
  const order = ['support', 'push', 'anchor', 'damp', 'write', 'mass', 'unpaired', 'other', 'shove', 'combat', 'pin', 'res', 'musclePair', 'inside'];
  const lab = { support: '받침(밖)', push: '걷기 밀기(밖)', anchor: '닻(밖)', damp: '엔진 감쇠(밖)', write: '속도 쓰기(밖)', mass: '질량 바뀜(밖)', unpaired: '짝 없는 힘(밖)', other: '그 밖 선언(밖)', shove: '밀쳐내기(따로)', combat: '판정 뒤 충격(따로)', pin: '발 핀(안)', res: '땅 · 접촉(안)', musclePair: '근육 쌍(안)', inside: '안쪽 일(합)' };
  for (const k of order) { const c = S.cats[k]; if (!c) continue; lines.push(`   ${lab[k].padEnd(14)}${n1(c.Fimp, 10)} ${n1(c.Fy, 10)} ${n1(c.Timp, 13)} ${n1(c.Wabs, 13)} ${n1(c.Wpos, 12)} ${n1(c.Wneg, 12)}`); }
  return lines.join('\n');
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
  return [[`${kind} · ${o.weapon}${kind === 'stroke' ? ' · ' + o.fam : ''}`, L.summary()]];
}
async function sceneFight(Gm, o) {
  const { H, DT } = Gm;
  const G = H.newRound({ walls: true, seed: o.seed, weapon: o.weapon, weapon2: o.weapon2 ?? o.weapon, AI2Class: H.AI });
  const LP = attach(G.world, bodiesOf(G.player), { fighter: G.player }), LE = attach(G.world, bodiesOf(G.enemy), { fighter: G.enemy });
  hook(G, [LP, LE]);
  let tDead = null;
  const n = Math.round(o.secs / DT);
  for (let i = 0; i < n; i++) { G.step(); if (tDead == null && (G.player.state === 'dead' || G.enemy.state === 'dead')) tDead = G.t; if (tDead != null && G.t > tDead + 1) break; }
  return [[`fight P · ${o.weapon} · seed ${o.seed} (${G.player.state}/${G.enemy.state})`, LP.summary()], [`fight E · seed ${o.seed}`, LE.summary()]];
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
  console.log(`honesty.mjs 자가 시험 (Rapier ${RAPIER.version?.() ?? ''})\n${out.join('\n')}\n${all ? '모두 통과' : '실패 있음'}`);
  process.exit(all ? 0 : 1);
}

async function main() {
  if (args.selftest) return selftest();
  const Gm = await load();
  const o = { weapon: String(args.weapon ?? 'longsword'), seed: +(args.seed ?? 7), secs: +(args.secs ?? 30), fam: String(args.fam ?? 'diagR') };
  const which = String(args.scene ?? 'all');
  const scenes = which === 'all' ? ['stand', 'walk', 'stroke', 'fight'] : which.split(',');
  const all = [];
  for (const s of scenes) all.push(...(s === 'fight' ? await sceneFight(Gm, o) : await sceneSolo(Gm, o, s)));
  for (const [t, S] of all) console.log(report(t, S) + '\n');
  if (args.json) writeFileSync(String(args.json), JSON.stringify(all.map(([title, S]) => ({ title, ...S })), null, 1));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
