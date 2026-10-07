// ─────────────────────────────────────────────────────────────
//  chain_ledger.mjs — 보존 잔차 장부 (R2′ 명세 docs/strike/r2p_spec_2026-10-02.md §5 G2·G2b·G3·G5·G11, §6 W1a). 재기만 한다 — 몸에 아무것도 걸지 않는다.
//
//   node tools/sim/chain_ledger.mjs [--scene=script|corr|p24|fight|all] [--fams=diagR,vert,horizR] [--seeds=7,8,9] [--weapon=longsword]
//        [--skill=0.7] [--input=60|120|30J|J] [--strokes=6] [--secs=30] [--json=<파일>] [--rows=<파일.jsonl>] [--digest] [--proof]
//        [--quiet] [--root=<트리>] [--selftest]
//
//  무엇을 재나 (한 파이터 = 몸 14 강체 + 칼, 기준점 = 그 15 강체의 질량중심 c — 골반이 아니라 질량중심을 골랐다: 움직이는 점 보정항이 없다):
//   L  = Σ m (p−c)×(v−v_c) + R I R^T ω  (각운동량, 월드)        dL/dt = (L_{n+1} − L_n)/dt  (스텝 n 의 힘·충격량이 만든 변화)
//   τ_땅  = 땅(고정 물체) 접촉 법선 충격량 × 팔 ÷ dt × n/(n+1)  (Rapier 0.19 (n+1)/n 과대 보고 교정, support_measure 와 같은 식, n = 6 → 6/7)
//           + 발바닥 핀 힘·발 yaw 핀 토크 (gait.pinFeet 가 addForceAtPoint·addTorque 로 **선언**해 넣는 땅 모형 힘 — 그대로 적는다)
//           + 엔진 마찰: **Rapier 0.19.3 JS 는 접선 충격량을 내주지 않는다** (contactTangentImpulseX/Y 가 늘 0 — 상자 시험 w1a/conv_test.mjs).
//             그래서 마찰 합력 F_마찰 = dP_h/dt − 선언 수평 힘 − 접촉 법선의 수평 몫 (계 선운동량 보존, 정확) 으로 재고,
//             그 돌림힘은 법선 하중 가중 접촉 중심 p̄ 에 실어 (p̄−c)×F_마찰 로 적는다. 두 발 사이의 **마찰 힘쌍**(합력 0 인 몫)은 어떤 강체 상태로도
//             볼 수 없다 → 수직축 잔차 r_V 에 남는다. 그 크기의 상한이 마찰 예산 μ·min(N_F,N_B)·d_feet (열 budget) 이고 한 발만 딛으면 0 이다 (열 single).
//             수평축(pitch·roll) 잔차 r_H 는 마찰 팔 길이가 두 발 모두 질량중심 높이라 힘쌍이 끼어들지 않는다 → **정확** (닻 pitch·roll 토크의 검산).
//   선언 외부 힘 = 파이터가 addForce/addForceAtPoint/addTorque/applyImpulse 로 넣는 모든 것 (받침 fy·걷기 밀기·핀·밀치기·손목 토크 쌍 …), 단계별로
//           (balance → support/push, pin, shove, sword, offhand, muscle, elbowG, track, other). 몸 안의 쌍은 합에서 상쇄된다.
//   엔진 자이로 생략 몫 G = Σ ω_i×(I_i ω_i): Rapier 는 ω 를 I⁻¹τ 로만 적분해 몸마다 dL/dt = τ + ω×L (상자 시험 w1a/gyro_test.mjs). 구동기가 아니라 적분 오차라
//           아는 항으로 빼고 크기를 따로 적는다 (열 gyroV). 칼처럼 비대칭·빠른 몸에서 수십 N·m 가 될 수 있다.
//   r_V = dL_V/dt − τ_땅,V − 선언_V − G_V   (명세의 r_z. V = 수직 = 엔진 y)      r_H = |(r_x, r_z)| (명세의 r_x·r_z = pitch·roll)
//   τ̂_닻 = 닻(uprightJoint) 모터의 재계산: 스텝마다 jointConfigureMotorPosition 에 실제로 넘어간 k·d 를 받아 τ̂_i = −(k_i·e_i + d_i·ω_rel,i),
//           e = 2·q_xyz·sign(q_w) of (q_닻⁻¹·q_골반) (닻 틀), ω_rel = R_닻^T(ω_골반,post − ω_닻)  [post = 암시 모터; pre 변형도 함께 적어 견준다]
//           숨은 일률 = Σ τ̂_i·ω_rel,i (W, 음수 = 제동)
//   엉덩이 τ̂ = 같은 식 (jointConfigureMotor 의 k·d·목표·목표 속도), 골반에 거는 반작용의 수직 몫 hipτ̂V; 포화율 σ̂ = 넘어간 k ÷ (j.k·mus·gain) —
//           BODY.chain 'legs' 가 k·σ 를 넘기면 σ̂ = σ. f.debug.chain.sigma.{F,B} 가 있으면 그것을 쓴다. 싱크 몫 = Σ(hipτ̂V·I_up·α_골반,V)/Σ hipτ̂V² (G2b)
//   발: N_F·N_B (×6/7, N) · wF = N_F/(N_F+N_B) · d_feet · 마찰 예산 · 핀 미끄러짐 (pinC 이동, 디딘 뒤 2 스텝 지나서) · 발 yaw 핀 포화 (|τ_y| ≥ μ·Nf·0.05)
//   순서: 획마다 골반 ω_V·가슴 ω_V·손·칼끝 최고 시각 (ms) → 골반 ≤ 가슴 ≤ 손 ≤ 칼끝 (G5)   몸통 몫: 칼날 70 % 점 최고 속도 때 가슴·골반 몫 (body_share 식)
//   척추: 비틀림 각 (가슴 yaw − 골반 yaw, °) 최고 · ±45° 닿음 스텝 · 손목 반작용 → 가슴 직접 토크 (driveSword 단계의 가슴 addTorque, 확인표 151)
//  장면: script = 대본 베기 (상대 치움, 손 목표를 자세 쌍 사이로 F.v = 12 m/s 직선 이동, body_share 꼴; 획 = 반 왕복)  corr = chain_corr 장면 틀 (입력 길: 쟁기 → 감기 3 m/s
//        → 베기 12 m/s → 뗌, 헛치기 2.0 m)  p24 = live_common 차림표 24 획 (P, 상대 1.3 m 멈춤·둘 다 죽지 않음)  fight = AI 대 AI 한 판 (획 = skill.swings 증가 창)
//  상대와 닿는 스텝(foreign)은 깨끗한 통계에서 빼고 (상대 마찰 모름) '모든 스텝' 열을 따로 적는다 — p24·fight 는 칼이 상대에 자주 닿아 깨끗한 스텝이 적다.
//  결정적: 같은 시드 → 같은 출력. script·corr 는 고정 박자(60)라 시드와 무관하다 (다이제스트 같음) — 시드 변동은 corr --input=30J|J (떨리는 박자, corr_lib.pacer) 나 fight 에서만. --digest 는 스텝마다 플레이어 상태 (골반·가슴·칼·칼끝 속도) 해시, --proof 는 장부 없이 한 번 더 돌려 해시가 같음을 보인다 (읽기만 함의 증명).
//  --selftest: 상자 시험 (쉼·밀어 붙잡힘·공중 회전) 으로 법선·마찰 합력·관성 부기 검산. 라이브러리: import { attachLedger, summariseStrokes } (live_twin 등에서 같은 표본)
//  출력: 획마다 한 줄 + 장면 중앙값 + 기준선 줄 (r_V rms ↔ τ̂닻_V rms 상관·비). 모델 이름 없음. 새 수 없음 (문턱은 표시일 뿐, 명세 155 는 판정값).
// ─────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { realpathSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const ROOT = realpathSync(resolve(arg('root', resolve(HERE, '..', '..'))));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const isMain = process.argv[1] && realpathSync(resolve(process.argv[1])) === SELF;

// ───────── 작은 셈 (할당 적게, THREE 없이) ─────────
const V3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const add = (a, b) => V3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => V3(a.x - b.x, a.y - b.y, a.z - b.z);
const scl = (a, s) => V3(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const qmul = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const qrot = (q, v) => {
  // v' = q v q*
  const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return V3(ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x);
};
const qinvrot = (q, v) => qrot(qconj(q), v);
/** 작은 각 회전 벡터 (2·q_xyz·sign(w)) — Rapier 모터의 각 오차 꼴 */
const rotvec = (q) => { const s = q.w < 0 ? -2 : 2; return V3(q.x * s, q.y * s, q.z * s); };
const cp = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });
const rms = (a) => (a.length ? Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length) : null);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const maxAbs = (a) => (a.length ? a.reduce((s, x) => Math.max(s, Math.abs(x)), 0) : null);
const q = (a, p) => { if (!a.length) return null; const b = Float64Array.from(a).sort(); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const med = (a) => q(a.filter((x) => x != null && Number.isFinite(x)), 0.5);
const pearson = (a, b) => {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) (ma += a[i]), (mb += b[i]);
  ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : null;
};
const slope0 = (y, x) => { let sxy = 0, sxx = 0; for (let i = 0; i < x.length; i++) (sxy += x[i] * y[i]), (sxx += x[i] * x[i]); return sxx > 0 ? sxy / sxx : null; };
const rN = (x, n = 2) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(n));
const f = (x, n = 1, w = 0) => (x == null || !Number.isFinite(x) ? '-'.padStart(w) : (+x).toFixed(n).padStart(w));
const UP = V3(0, 1, 0);
const AX = { x: 3, y: 4, z: 5 }; // RawJointAxis.AngX/AngY/AngZ — spherical 관절(엉덩이·척추): raw 3·4·5 = 몸 틀 x·y·z
const AXG = { x: 3, z: 4, y: 5 }; // 닻 generic(축 (1,0,0)) 관절: raw 4 = 닻 z, raw 5 = 닻 y(연직 = yaw) — 측정 10/7 (디렉터 작업 공간 a021/axis_map_test.mjs). 10/2 W1a·W2 는 y=4 로 적었다: anchor 는 세 축 k·d 가 같아 τ̂ 값이 바뀌지 않고, legs(옛 W1b) 는 τ̂닻_V 0 을 적은 것이 틀렸다(실제 raw 5 는 2500·330)

// ───────── 장부 붙이기 ─────────
/**
 * attachLedger(G, f, { CONFIG, pinMu, onRow }) → ledger. G.step 뒤(= combat.afterStep 뒤)마다 post() 가 한 줄을 만든다 (ledger.rows).
 *  읽기만: 메서드 감싸기는 인자 그대로 넘기고, 난수·힘·상태를 바꾸지 않는다 (--proof 로 확인).
 */
export function attachLedger(G, fighter, opts = {}) {
  const world = G.world;
  const CONFIG = opts.CONFIG;
  const DT = world.timestep;
  const named = [...Object.entries(fighter.bodies), ['sword', fighter.sword]].filter(([, b]) => b);
  const bodies = [], names = [], idx = new Map();
  for (const [n, b] of named) if (!idx.has(b.handle)) { idx.set(b.handle, bodies.length); bodies.push(b); names.push(n); } // 같은 강체 두 이름 (자가 시험) 은 한 번만
  const iOf = (n) => (fighter.bodies[n] ? idx.get(fighter.bodies[n].handle) : n === 'sword' && fighter.sword ? idx.get(fighter.sword.handle) : -1);
  const UPPER = new Set(['pelvis', 'abdomen', 'chest', 'head', 'uarmS', 'farmS', 'uarmO', 'farmO', 'sword'].map(iOf).filter((i) => i >= 0));
  const iPel = iOf('pelvis'), iCh = iOf('chest'), iAb = iOf('abdomen');
  const iFootF = iOf('footF'), iFootB = iOf('footB'), iThF = iOf('thighF'), iThB = iOf('thighB');
  const nIter = world.integrationParameters?.numSolverIterations ?? 4;
  const KC = nIter / (nIter + 1); // Rapier 0.19 접촉 충격량 (n+1)/n 과대 보고 교정 (support_optimum §2, 확인표 127)
  const pinMu = opts.pinMu ?? CONFIG?.GAIT?.pinMu ?? 0.9;
  const Mg = fighter.totalMass * 9.81;
  const mass = bodies.map((b) => b.mass());
  const Ip = bodies.map((b) => { const p = b.principalInertia(); return V3(p.x, p.y, p.z); });
  const Iq = bodies.map((b) => cp(b.principalInertiaLocalFrame()));
  const L = { rows: [], steps: 0, bodies: names.length, KC, Mg, nIter, declared: null, phase: 'other', detached: false };

  // ── 선언 힘 기록 (강체 메서드 감싸기) ──
  let decl = []; // { p (월드 점), F (N), T (N·m 순수 토크), kind, body }
  const kindOf = (F) => {
    const ph = L.phase;
    if (ph === 'balance') return F && Math.abs(F.x) + Math.abs(F.z) < 1e-9 ? 'support' : 'push';
    return ph;
  };
  const wrapBody = (rb, bi) => {
    const o = { addForce: rb.addForce, addForceAtPoint: rb.addForceAtPoint, addTorque: rb.addTorque, applyImpulse: rb.applyImpulse, applyImpulseAtPoint: rb.applyImpulseAtPoint, applyTorqueImpulse: rb.applyTorqueImpulse };
    rb.addForce = function (F, w) { if (!L.detached) decl.push({ p: V3(this.worldCom().x, this.worldCom().y, this.worldCom().z), F: V3(F.x, F.y, F.z), T: null, kind: kindOf(F), body: bi }); return o.addForce.call(this, F, w); };
    rb.addForceAtPoint = function (F, P, w) { if (!L.detached) decl.push({ p: V3(P.x, P.y, P.z), F: V3(F.x, F.y, F.z), T: null, kind: kindOf(F), body: bi }); return o.addForceAtPoint.call(this, F, P, w); };
    rb.addTorque = function (T, w) { if (!L.detached) decl.push({ p: null, F: null, T: V3(T.x, T.y, T.z), kind: kindOf(null), body: bi }); return o.addTorque.call(this, T, w); };
    rb.applyImpulse = function (J, w) { if (!L.detached) decl.push({ p: V3(this.worldCom().x, this.worldCom().y, this.worldCom().z), F: scl(J, 1 / DT), T: null, kind: kindOf(J), body: bi }); return o.applyImpulse.call(this, J, w); };
    rb.applyImpulseAtPoint = function (J, P, w) { if (!L.detached) decl.push({ p: V3(P.x, P.y, P.z), F: scl(J, 1 / DT), T: null, kind: kindOf(J), body: bi }); return o.applyImpulseAtPoint.call(this, J, P, w); };
    rb.applyTorqueImpulse = function (J, w) { if (!L.detached) decl.push({ p: null, F: null, T: scl(J, 1 / DT), kind: kindOf(null), body: bi }); return o.applyTorqueImpulse.call(this, J, w); };
  };
  bodies.forEach(wrapBody);
  // ── 단계 표시 (파이터 메서드 감싸기: 인자 그대로) ──
  const phaseWrap = (obj, name, tag) => {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function (...a) { const prev = L.phase; L.phase = tag; try { return orig.apply(this, a); } finally { L.phase = prev; } };
  };
  for (const [n, t] of [['driveBalance', 'balance'], ['shove', 'shove'], ['closeStep', 'shove'], ['driveSword', 'sword'], ['offHand', 'offhand'], ['driveJoints', 'muscle'], ['elbowGravity', 'elbowG'], ['trackBlade', 'track']]) phaseWrap(fighter, n, t);
  // 핀: 단계 + 미끄러짐 (pinC 이동) 기록
  const slip = { F: { d: 0, ev: 0, was: false }, B: { d: 0, ev: 0, was: false } };
  if (fighter.gait) {
    const g = fighter.gait;
    const orig = g.pinFeet;
    g.pinFeet = function (...a) {
      const prev = L.phase; L.phase = 'pin';
      const snap = {};
      for (const k of ['F', 'B']) { const l = this.legs[k]; snap[k] = { x: l.pinC.x, z: l.pinC.z, st: l.stance, tl: l.tLand }; }
      try { return orig.apply(this, a); } finally {
        L.phase = prev;
        for (const k of ['F', 'B']) {
          const l = this.legs[k], s = snap[k];
          const moved = Math.hypot(l.pinC.x - s.x, l.pinC.z - s.z);
          const slid = s.st && l.stance && s.tl > 2.5 * DT && moved > 1e-9;
          if (slid) { slip[k].d += moved; if (!slip[k].was) slip[k].ev++; }
          slip[k].was = slid;
        }
      }
    };
  }
  // ── 모터 매개변수 받기 (공유 rawSet 한 번만 감싼다; 핸들별 축별) ──
  const rawSet = fighter.uprightJoint.rawSet;
  if (!rawSet.__ledgerCap) {
    const cap = new Map();
    rawSet.__ledgerCap = cap;
    const o1 = rawSet.jointConfigureMotorPosition, o2 = rawSet.jointConfigureMotor, o3 = rawSet.jointConfigureMotorVelocity;
    const slot = (h, ax) => { let m = cap.get(h); if (!m) cap.set(h, (m = {})); return (m[ax] ||= { t: 0, tv: 0, k: 0, d: 0 }); };
    rawSet.jointConfigureMotorPosition = function (h, ax, t, k, d) { const s = slot(h, ax); s.t = t; s.tv = 0; s.k = k; s.d = d; return o1.call(this, h, ax, t, k, d); };
    rawSet.jointConfigureMotor = function (h, ax, t, tv, k, d) { const s = slot(h, ax); s.t = t; s.tv = tv; s.k = k; s.d = d; return o2.call(this, h, ax, t, tv, k, d); };
    if (typeof o3 === 'function') rawSet.jointConfigureMotorVelocity = function (h, ax, tv, d) { const s = slot(h, ax); s.t = 0; s.tv = tv; s.k = 0; s.d = d; return o3.call(this, h, ax, tv, d); };
  }
  const cap = rawSet.__ledgerCap;
  const hUp = fighter.uprightJoint.handle;
  const J = fighter.jointByName;
  const hHip = { F: J.thighF.joint.handle, B: J.thighB.joint.handle };
  const hSp = { ab: J.abdomen.joint.handle, ch: J.chest.joint.handle };

  // ── 상태 표본 ──
  const sample = () => {
    const p = [], v = [], w = [], qb = [];
    let c = V3(), vc = V3();
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      // 질량·주관성은 스텝마다 다시 읽는다 (10/7): gait.footMass 가 딛은 발에 +2 kg 을 켰다 끄고(gait.js footMass·GAIT.footExtra) setAdditionalMass 는 관성도 함께 키운다 → 붙일 때 한 번 읽은 값으로는 L·dL/dt 가 틀어진다
      mass[i] = b.mass(); { const pi = b.principalInertia(); Ip[i] = V3(pi.x, pi.y, pi.z); }
      const pc = b.worldCom(), lv = b.linvel(), av = b.angvel();
      p.push(V3(pc.x, pc.y, pc.z)); v.push(V3(lv.x, lv.y, lv.z)); w.push(V3(av.x, av.y, av.z)); qb.push(cp(b.rotation()));
      c = add(c, scl(p[i], mass[i])); vc = add(vc, scl(v[i], mass[i]));
    }
    const M = mass.reduce((s, x) => s + x, 0);
    c = scl(c, 1 / M); vc = scl(vc, 1 / M);
    let Lt = V3(), P = V3(), Gy = V3();
    const Iw = [];
    for (let i = 0; i < bodies.length; i++) {
      const qw = qmul(qb[i], Iq[i]); // 월드 ← 주축 틀
      const wl = qinvrot(qw, w[i]);
      const Lr = qrot(qw, V3(Ip[i].x * wl.x, Ip[i].y * wl.y, Ip[i].z * wl.z));
      Gy = add(Gy, cross(w[i], Lr)); // 엔진이 생략한 자이로 항 ω×(Iω): Rapier 는 ω 를 I⁻¹τ 로만 적분해 몸마다 dL/dt = τ + ω×L (w1a/gyro_test.mjs)
      Lt = add(Lt, add(Lr, scl(cross(sub(p[i], c), sub(v[i], vc)), mass[i])));
      P = add(P, scl(v[i], mass[i]));
      // 수직축 관성 (주축 틀 → 월드 yy 성분)
      const ey = qinvrot(qw, UP);
      Iw.push(Ip[i].x * ey.x * ey.x + Ip[i].y * ey.y * ey.y + Ip[i].z * ey.z * ey.z);
    }
    // 윗몸 (골반 포함 ~ 칼) 수직축 관성, 윗몸 질량중심 기준
    let cu = V3(), mu = 0;
    for (const i of UPPER) { cu = add(cu, scl(p[i], mass[i])); mu += mass[i]; }
    cu = scl(cu, 1 / mu);
    let Iup = 0;
    for (const i of UPPER) { const dx = p[i].x - cu.x, dz = p[i].z - cu.z; Iup += Iw[i] + mass[i] * (dx * dx + dz * dz); }
    const an = fighter.anchor;
    return { t: G.t, p, v, w, q: qb, c, vc, L: Lt, P, Gy, Iup, qA: cp(an.rotation()), state: fighter.state, muscle: fighter.muscle };
  };
  let prev = sample();
  decl = [];
  for (const k of ['F', 'B']) { slip[k].d = 0; slip[k].ev = 0; }
  L.prev = prev;

  // ── 접촉 읽기 (법선 충격량만 — 접선은 0.19.3 이 내주지 않는다) ──
  const readContacts = (cbar, dt) => {
    const out = { tauN: V3(), FN: V3(), foot: { F: { N: 0, p: V3(), k: 0 }, B: { N: 0, p: V3(), k: 0 } }, other: { N: 0, p: V3() }, foreign: { N: 0, tau: V3() }, groundNonFoot: false, Nsum: 0, pbar: V3() };
    for (let bi = 0; bi < bodies.length; bi++) {
      const rb = bodies[bi];
      const nc = rb.numColliders();
      for (let ci = 0; ci < nc; ci++) {
        const col = rb.collider(ci);
        world.contactPairsWith(col, (other) => {
          const ob = other.parent();
          if (!ob || idx.has(ob.handle)) return; // 몸 안 쌍 (상쇄)
          const fixed = ob.isFixed();
          const ct = col.translation(), cq = cp(col.rotation());
          world.contactPair(col, other, (m, flipped) => {
            const n = m.normal();
            const s = flipped ? 1 : -1; // 우리 몸에 걸리는 충격량 = s·n·J (상자 시험으로 확인)
            for (let k = 0, nk = m.numContacts(); k < nk; k++) {
              const Jn = m.contactImpulse(k) * KC;
              if (Jn === 0) continue;
              const lp = flipped ? m.localContactPoint2(k) : m.localContactPoint1(k);
              const Pw = add(V3(ct.x, ct.y, ct.z), qrot(cq, V3(lp.x, lp.y, lp.z)));
              const I = V3(s * n.x * Jn, s * n.y * Jn, s * n.z * Jn);
              const F = scl(I, 1 / dt);
              const tau = cross(sub(Pw, cbar), F);
              if (fixed) {
                out.tauN = add(out.tauN, tau);
                out.FN = add(out.FN, F);
                const Ny = Math.abs(F.y);
                const slot = bi === iFootF ? out.foot.F : bi === iFootB ? out.foot.B : out.other;
                if (bi !== iFootF && bi !== iFootB && Ny > 1) out.groundNonFoot = true;
                slot.N += Ny; slot.p = add(slot.p, scl(Pw, Ny)); if (slot.k != null) slot.k++;
                out.Nsum += Ny; out.pbar = add(out.pbar, scl(Pw, Ny));
              } else {
                out.foreign.N += len(F);
                out.foreign.tau = add(out.foreign.tau, tau);
              }
            }
          });
        });
      }
    }
    for (const k of ['F', 'B']) if (out.foot[k].N > 0) out.foot[k].p = scl(out.foot[k].p, 1 / out.foot[k].N);
    if (out.other.N > 0) out.other.p = scl(out.other.p, 1 / out.other.N);
    if (out.Nsum > 0) out.pbar = scl(out.pbar, 1 / out.Nsum);
    return out;
  };

  const motorTau = (h, qParent, wParent, qChild, wChild, AXM = AX) => {
    const m = cap.get(h);
    if (!m) return null;
    const e = rotvec(qmul(qconj(qParent), qChild));
    const wr = qinvrot(qParent, sub(wChild, wParent));
    const tl = V3();
    const pw = V3();
    for (const [ax, i] of [['x', AXM.x], ['y', AXM.y], ['z', AXM.z]]) {
      const s = m[i];
      if (!s) continue;
      tl[ax] = -(s.k * (e[ax] - s.t) + s.d * (wr[ax] - s.tv));
      pw[ax] = tl[ax] * wr[ax];
    }
    return { local: tl, world: qrot(qParent, tl), e, wr, power: pw.x + pw.y + pw.z, powerY: pw.y, m };
  };

  L.post = () => {
    const cur = sample();
    const dt = DT;
    const cbar = scl(add(prev.c, cur.c), 0.5);
    // dL/dt, dP/dt
    const dL = scl(sub(cur.L, prev.L), 1 / dt);
    const dP = scl(sub(cur.P, prev.P), 1 / dt);
    // 선언 힘의 돌림힘 (cbar 기준), 수평 합력
    const td = { support: V3(), push: V3(), pin: V3(), shove: V3(), sword: V3(), offhand: V3(), muscle: V3(), elbowG: V3(), track: V3(), other: V3() };
    let Fd = V3();
    let wristChest = 0, pinYawF = 0, pinYawB = 0;
    for (const d of decl) {
      const slot = td[d.kind] || td.other;
      if (d.F) { const tau = cross(sub(d.p, cbar), d.F); slot.x += tau.x; slot.y += tau.y; slot.z += tau.z; Fd = add(Fd, d.F); }
      if (d.T) {
        slot.x += d.T.x; slot.y += d.T.y; slot.z += d.T.z;
        if (d.kind === 'sword' && d.body === iCh) wristChest += d.T.y;
        if (d.kind === 'pin' && d.body === iFootF) pinYawF += d.T.y;
        if (d.kind === 'pin' && d.body === iFootB) pinYawB += d.T.y;
      }
    }
    let tauDecl = V3();
    for (const k in td) tauDecl = add(tauDecl, td[k]);
    // 접촉
    const C = readContacts(cbar, dt);
    // 마찰 합력 (선운동량 보존): 중력은 수직 → 수평만
    const Ffric = V3(dP.x - Fd.x - C.FN.x, 0, dP.z - Fd.z - C.FN.z);
    // 수직 검산: dP_y − Fd_y − FN_y + Mg ≈ 0 (접촉 교정·선언 힘 부기가 맞는지)
    const Mtot = mass.reduce((s, x) => s + x, 0);
    const vertRes = dP.y - Fd.y - C.FN.y + Mtot * 9.81;
    const tauFric = C.Nsum > 0 ? cross(sub(C.pbar, cbar), Ffric) : V3();
    const gyro = prev.Gy; // 스텝 시작 ω 로 (상자 시험: 평균 오차 0.77 → 0.04 N·m)
    const tauKnown = add(add(add(add(C.tauN, tauDecl), tauFric), C.foreign.tau), gyro);
    const r = sub(dL, tauKnown);
    // 닻 τ̂ (post ω 와 pre ω)
    const dqA = qmul(cur.qA, qconj(prev.qA));
    const wA = scl(rotvec(dqA), 1 / dt);
    const anc = motorTau(hUp, prev.qA, wA, prev.q[iPel], cur.w[iPel], AXG);
    const ancPre = motorTau(hUp, prev.qA, wA, prev.q[iPel], prev.w[iPel], AXG);
    // 엉덩이 (반작용을 골반에: −τ)
    const hips = {};
    let hipTauV = 0;
    for (const k of ['F', 'B']) {
      const ith = k === 'F' ? iThF : iThB;
      const h = motorTau(hHip[k], prev.q[iPel], cur.w[iPel], prev.q[ith], cur.w[ith]);
      hips[k] = h;
      if (h) hipTauV -= h.world.y;
    }
    // 포화율 추정 σ̂ = 넘어간 k_y ÷ (j.k·mus·gain)
    const legsMus = Math.max(0.15, fighter.muscle);
    const sig = {};
    for (const k of ['F', 'B']) {
      const dbg = fighter.debug?.chain?.sigma?.[k];
      if (dbg != null) { sig[k] = dbg; continue; }
      const j = J[k === 'F' ? 'thighF' : 'thighB'];
      const mus = legsMus * (0.6 + 0.4 * fighter.legHealth) * (0.4 + 0.6 * (fighter.limbs?.[k === 'F' ? 'legF' : 'legB'] ?? 1));
      const k0 = j.k * mus * (j.gain || 1);
      const m = cap.get(hHip[k]);
      sig[k] = m && m[AX.y] && k0 > 0 ? Math.min(1, m[AX.y].k / k0) : null;
    }
    // 척추
    const sp = {};
    sp.ab = motorTau(hSp.ab, prev.q[iPel], cur.w[iPel], prev.q[iAb], cur.w[iAb]);
    sp.ch = motorTau(hSp.ch, prev.q[iAb], cur.w[iAb], prev.q[iCh], cur.w[iCh]);
    const qtw = qmul(qconj(cur.q[iPel]), cur.q[iCh]);
    const twist = (2 * Math.atan2(qtw.y, Math.abs(qtw.w)) * 180) / Math.PI;
    // 손·칼끝·몸통 몫
    const handP = (() => { const b = fighter.bodies.farmS; const t = b.translation(); return add(V3(t.x, t.y, t.z), qrot(cp(b.rotation()), V3(0.13, 0, 0))); })();
    const vh = fighter.bodies.farmS.velocityAtPoint(handP);
    const handV = Math.hypot(vh.x, vh.y, vh.z);
    let tipV = 0, chShare = 0, pelShare = 0;
    if (fighter.sword && fighter.bladePoint) {
      const tip = fighter.bladePoint(1);
      const vt = fighter.sword.velocityAtPoint(tip);
      tipV = Math.hypot(vt.x, vt.y, vt.z);
      const wc = fighter.weaponCfg;
      if (wc) {
        const p70 = add(V3(fighter.sword.translation().x, fighter.sword.translation().y, fighter.sword.translation().z), qrot(cp(fighter.sword.rotation()), V3(0, wc.hiltLength + 0.7 * wc.bladeLength, 0)));
        const v70 = fighter.sword.velocityAtPoint(p70);
        const s70 = Math.hypot(v70.x, v70.y, v70.z);
        if (s70 > 1e-6) {
          const d = scl(V3(v70.x, v70.y, v70.z), 1 / s70);
          const vc = fighter.bodies.chest.velocityAtPoint(p70), vp = fighter.bodies.pelvis.velocityAtPoint(p70);
          chShare = (vc.x * d.x + vc.y * d.y + vc.z * d.z) / s70;
          pelShare = (vp.x * d.x + vp.y * d.y + vp.z * d.z) / s70;
        }
      }
    }
    // 발
    const NF = C.foot.F.N, NB = C.foot.B.N;
    const pf = cur.p[iFootF], pb = cur.p[iFootB];
    const dfeet = Math.hypot(pf.x - pb.x, pf.z - pb.z);
    const budget = pinMu * Math.min(NF, NB) * dfeet;
    const single = NF + NB > 1 ? (Math.min(NF, NB) / (NF + NB) < 0.05 ? 1 : 0) : 0;
    const gl = fighter.gait?.legs;
    const yawSat = (k, tau) => { const l = gl?.[k]; if (!l || !l.stance) return 0; const lt = pinMu * (l.Nf || 0) * 0.05; return lt > 0 && Math.abs(tau) >= lt * (1 - 1e-6) ? 1 : 0; };
    const alphaPel = (cur.w[iPel].y - prev.w[iPel].y) / dt;
    const row = {
      t: cur.t, state: cur.state, stand: cur.state === 'stand' ? 1 : 0,
      LV: cur.L.y, dLV: dL.y, dLx: dL.x, dLz: dL.z,
      tauNV: C.tauN.y, tauNx: C.tauN.x, tauNz: C.tauN.z,
      declV: tauDecl.y, declx: tauDecl.x, declz: tauDecl.z,
      pinV: td.pin.y, pushV: td.push.y, supportV: td.support.y, shoveV: td.shove.y, swordV: td.sword.y, muscleV: td.muscle.y, otherV: td.other.y + td.offhand.y + td.elbowG.y + td.track.y,
      fricX: Ffric.x, fricZ: Ffric.z, fric: Math.hypot(Ffric.x, Ffric.z), tauFricV: tauFric.y, tauFricx: tauFric.x, tauFricz: tauFric.z,
      foreign: C.foreign.N > 1 ? 1 : 0, foreignTauV: C.foreign.tau.y, groundNonFoot: C.groundNonFoot ? 1 : 0, vertRes, gyroV: gyro.y, gyroH: Math.hypot(gyro.x, gyro.z),
      rV: r.y, rx: r.x, rz: r.z, rH: Math.hypot(r.x, r.z),
      aV: anc ? anc.world.y : null, ax: anc ? anc.world.x : null, az: anc ? anc.world.z : null, aH: anc ? Math.hypot(anc.world.x, anc.world.z) : null,
      aVpre: ancPre ? ancPre.world.y : null, aHpre: ancPre ? Math.hypot(ancPre.world.x, ancPre.world.z) : null,
      eYaw: anc ? anc.e.y : null, hidden: anc ? anc.power : null, hiddenYaw: anc ? anc.powerY : null, kYaw: anc ? anc.m[AXG.y]?.k ?? null : null, dYaw: anc ? anc.m[AXG.y]?.d ?? null : null,
      pelW: cur.w[iPel].y, chW: cur.w[iCh].y, alphaPel, Iup: cur.Iup, handV, tipV, chShare, pelShare,
      hipTauV, hipTauYF: hips.F ? hips.F.local.y : null, hipTauYB: hips.B ? hips.B.local.y : null, sigF: sig.F, sigB: sig.B,
      spineTauY: (sp.ab ? sp.ab.local.y : 0) + (sp.ch ? sp.ch.local.y : 0), twist,
      NF, NB, wF: NF + NB > 1 ? NF / (NF + NB) : null, load: (NF + NB) / Mg, dfeet, budget, single, Nother: C.other.N,
      slipF: slip.F.d, slipB: slip.B.d, slipEvF: slip.F.ev, slipEvB: slip.B.ev, yawSatF: yawSat('F', pinYawF), yawSatB: yawSat('B', pinYawB), pinYawF, pinYawB,
      wristChest, stanceF: gl ? (gl.F.stance ? 1 : 0) : null, stanceB: gl ? (gl.B.stance ? 1 : 0) : null,
    };
    if (opts.onRow) opts.onRow(row);
    L.rows.push(row);
    L.steps++;
    prev = cur;
    L.prev = cur;
    decl = [];
    for (const k of ['F', 'B']) { slip[k].d = 0; slip[k].ev = 0; }
    return row;
  };
  // G.step 뒤에 post (inputPump 의 감싸기 위/아래 어느 쪽이어도 차례는 같다: 스텝 → 표본)
  const step0 = G.step;
  G.step = () => { step0(); L.post(); };
  return L;
}

// ───────── 획 요약 ─────────
/** rows[i0..i1) 를 한 획으로 요약. foreign (상대 몸·칼 접촉) 스텝은 잔차 통계에서 뺀다 (마찰 모름) */
export function summariseStrokes(rows, i0, i1, extra = {}) {
  const w = rows.slice(i0, i1);
  const ok = w.filter((r) => !r.foreign);
  const g = (k, src = ok) => src.map((r) => r[k]).filter((x) => x != null && Number.isFinite(x));
  const t0 = w.length ? w[0].t : 0;
  const peakT = (k) => { let best = -1, ti = null; for (const r of w) { const v = Math.abs(r[k]); if (v > best) { best = v; ti = r.t; } } return ti == null ? null : Math.round((ti - t0) * 1000); };
  const tPel = peakT('pelW'), tCh = peakT('chW'), tHand = peakT('handV'), tTip = peakT('tipV');
  let tipMax = 0, chAt = null, pelAt = null;
  for (const r of w) if (r.tipV > tipMax) { tipMax = r.tipV; chAt = r.chShare; pelAt = r.pelShare; }
  // 마찰 예산: 골반 ω 최고 −100 ms 창의 최솟값
  let budgetWin = null;
  if (tPel != null) { const a = t0 + tPel / 1000 - 0.1, b = t0 + tPel / 1000; const bw = w.filter((r) => r.t >= a - 1e-9 && r.t <= b + 1e-9).map((r) => r.budget); if (bw.length) budgetWin = Math.min(...bw); }
  const rV = g('rV'), aV = g('aV'), rx = g('rx'), rz = g('rz'), ax = g('ax'), az = g('az');
  // 모든 스텝 (상대 접촉 스텝 포함: 상대 접촉의 법선 충격량은 τ_known 에 들어가고 그 마찰만 모른다 → p24·fight 처럼 상대와 닿는 장면의 참고값)
  const rVa = g('rV', w), aVa = g('aV', w);
  const hipV = g('hipTauV'), ia = ok.map((r) => r.Iup * r.alphaPel);
  const sumSq = hipV.reduce((s, x) => s + x * x, 0);
  const S = {
    ...extra, i0, i1, steps: w.length, foreignSteps: w.length - ok.length, durMs: w.length ? Math.round((w[w.length - 1].t - t0) * 1000) : 0,
    rV_rms: rms(rV), rV_max: maxAbs(rV), aV_rms: rms(aV), aV_max: maxAbs(aV), corrV: pearson(rV, aV), ratioV: rms(aV) > 0 ? rms(rV) / rms(aV) : null, slopeV: slope0(rV, aV),
    rV_minus_aV_rms: rms(ok.map((r) => (r.aV == null ? r.rV : r.rV - r.aV))),
    rV_rms_all: rms(rVa), aV_rms_all: rms(aVa), corrV_all: pearson(rVa, aVa), ratioV_all: rms(aVa) > 0 ? rms(rVa) / rms(aVa) : null, foreignShare: w.length ? (w.length - ok.length) / w.length : null,
    rH_rms: rms(g('rH')), rH_max: maxAbs(g('rH')), aH_rms: rms(g('aH')), corrH: pearson([...rx, ...rz], [...ax, ...az]), rH_minus_aH_rms: rms(ok.flatMap((r) => (r.ax == null ? [r.rx, r.rz] : [r.rx - r.ax, r.rz - r.az]))),
    aVpre_rms: rms(g('aVpre')), corrVpre: pearson(rV, g('aVpre')), corrHpre: pearson([...rx, ...rz], [...rx, ...rz].map((_, i) => 0)) == null ? null : null,
    hidden_mean: mean(g('hidden')), hidden_min: g('hidden').length ? Math.min(...g('hidden')) : null, hidden_max: g('hidden').length ? Math.max(...g('hidden')) : null, hiddenYaw_mean: mean(g('hiddenYaw')), hiddenYaw_min: g('hiddenYaw').length ? Math.min(...g('hiddenYaw')) : null,
    kYaw: med(g('kYaw')), dYaw: med(g('dYaw')),
    gyroV_rms: rms(g('gyroV')), gyroH_rms: rms(g('gyroH')), tauNV_rms: rms(g('tauNV')), pinV_rms: rms(g('pinV')), pushV_rms: rms(g('pushV')), swordV_rms: rms(g('swordV')), tauFricV_rms: rms(g('tauFricV')), fric_rms: rms(g('fric')), fric_max: maxAbs(g('fric')), vertRes_rms: rms(g('vertRes')),
    budget_med: med(g('budget')), budget_win: budgetWin, single: mean(g('single')),
    pelW_max: (maxAbs(g('pelW', w)) * 180) / Math.PI, chW_max: (maxAbs(g('chW', w)) * 180) / Math.PI, tPel, tCh, tHand, tTip,
    dpc: tPel != null && tCh != null ? tCh - tPel : null, dpt: tPel != null && tTip != null ? tPel - tTip : null, dct: tCh != null && tTip != null ? tCh - tTip : null,
    orderOk: tPel != null && tCh != null && tHand != null && tTip != null ? (tPel <= tCh && tCh <= tHand && tHand <= tTip ? 1 : 0) : null,
    tip_max: tipMax, chShare: chAt, pelShare: pelAt,
    NF_p10: q(g('NF', w), 0.1), NB_p10: q(g('NB', w), 0.1), load_p10: q(g('load', w), 0.1), wF_mean: mean(g('wF', w)), dfeet_mean: mean(g('dfeet', w)), groundNonFoot: w.some((r) => r.groundNonFoot) ? 1 : 0,
    slipEv: w.reduce((s, r) => s + r.slipEvF + r.slipEvB, 0), slipDist: w.reduce((s, r) => s + r.slipF + r.slipB, 0), yawSat: mean(w.map((r) => (r.yawSatF + r.yawSatB) / 2)),
    sigLtF: mean(w.map((r) => (r.sigF != null && r.sigF < 1 - 1e-6 ? 1 : 0))), sigLtB: mean(w.map((r) => (r.sigB != null && r.sigB < 1 - 1e-6 ? 1 : 0))), sigF_min: g('sigF', w).length ? Math.min(...g('sigF', w)) : null, sigB_min: g('sigB', w).length ? Math.min(...g('sigB', w)) : null,
    hipTauV_rms: rms(hipV), hipTauY_rms: rms([...g('hipTauYF'), ...g('hipTauYB')]), sink: sumSq > 1 ? hipV.reduce((s, x, i) => s + x * ia[i], 0) / sumSq : null, Ialpha_rms: rms(ia),
    spineTauY_rms: rms(g('spineTauY')), twist_max: maxAbs(g('twist', w)), twistLimit: w.filter((r) => Math.abs(r.twist) >= 44.5).length, wristChest_rms: rms(g('wristChest')),
    fallen: w.some((r) => !r.stand) ? 1 : 0,
  };
  delete S.corrHpre;
  return S;
}
const fmtStroke = (S) => {
  const lab = `${S.scene} ${String(S.fam).padEnd(7)} s${S.seed} #${S.k}${S.part ? ' ' + S.part : ''}`.padEnd(28);
  return `${lab} ${f(S.durMs / 1000, 2)}s | rV rms ${f(S.rV_rms, 1, 5)} max ${f(S.rV_max, 0, 4)} | τ̂닻V rms ${f(S.aV_rms, 1, 5)} max ${f(S.aV_max, 0, 4)} corr ${f(S.corrV, 2)} ratio ${f(S.ratioV, 2)}${S.foreignSteps ? ` (모든 스텝: rV ${f(S.rV_rms_all, 1)} τ̂ ${f(S.aV_rms_all, 1)} corr ${f(S.corrV_all, 2)})` : ''} | rH ${f(S.rH_rms, 1)} τ̂닻H ${f(S.aH_rms, 1)} corrH ${f(S.corrH, 2)} | 숨은 W ${f(S.hidden_mean, 0)} min ${f(S.hidden_min, 0)} | 마찰 N ${f(S.fric_rms, 0)} 예산 ${f(S.budget_win, 0)} 한발 ${f(S.single, 2)} | 골반 ${f(S.pelW_max, 0)} 가슴 ${f(S.chW_max, 0)} °/s Δpc ${S.dpc ?? '-'} Δpt ${S.dpt ?? '-'} Δct ${S.dct ?? '-'} ms ${S.orderOk == null ? '' : S.orderOk ? '순서✓' : '순서✗'} | 칼끝 ${f(S.tip_max, 1)} 가슴 ${f(100 * S.chShare, 0)}% 골반 ${f(100 * S.pelShare, 0)}% | N_F ${f(S.NF_p10, 0)} N_B ${f(S.NB_p10, 0)} p10 ${f(S.load_p10, 2)} wF ${f(S.wF_mean, 2)} | 미끄럼 ${S.slipEv} (${f(S.slipDist, 3)} m) yaw포화 ${f(S.yawSat, 2)} | σ<1 F ${f(S.sigLtF, 2)} B ${f(S.sigLtB, 2)} hipτ̂V ${f(S.hipTauV_rms, 1)} 싱크 ${f(S.sink, 2)} | 비틀림 ${f(S.twist_max, 0)}° 한도 ${S.twistLimit} | 손목→가슴 ${f(S.wristChest_rms, 1)} | ${S.fallen ? '넘어짐' : '섬'}${S.foreignSteps ? ` 상대접촉 ${S.foreignSteps}` : ''}`;
};

// ───────── 장면 ─────────
async function loadGame() {
  const H = await import(u('tools/sim/harness_m.mjs'));
  const CL = await import(u('tools/sim/corr_lib.mjs'));
  const { Input } = await import(u('src/input.js'));
  return { H, CL, Input, CONFIG: H.CONFIG, DT: H.DT, THREE: H.THREE };
}
const SCENE_FAMS = { script: ['diagR', 'vert', 'horizR'], corr: ['diagR', 'vert', 'horizR'], p24: ['p24'], fight: ['fight'] };

/** 공통: 판 + 장부 + 다이제스트 */
function setup(Gm, o, mk) {
  const { H, CONFIG } = Gm;
  const G = mk();
  const P = G.player;
  const dig = o.digest ? createHash('sha256') : null;
  const digBuf = new Float64Array(20);
  const digest = () => {
    if (!dig) return;
    const pp = P.bodies.pelvis.translation(), pq = P.bodies.pelvis.rotation(), cq = P.bodies.chest.rotation(), sp = P.sword.translation(), sq = P.sword.rotation(), tv = P.tipVel;
    digBuf.set([pp.x, pp.y, pp.z, pq.x, pq.y, pq.z, pq.w, cq.x, cq.y, cq.z, cq.w, sp.x, sp.y, sp.z, sq.x, sq.y, sq.z, sq.w, tv.x, tv.y]);
    dig.update(Buffer.from(digBuf.buffer));
  };
  const led = o.ledger ? attachLedger(G, P, { CONFIG, onRow: digest }) : null;
  if (!led && dig) { const s0 = G.step; G.step = () => { s0(); digest(); }; }
  return { G, P, led, digestHex: () => (dig ? dig.digest('hex').slice(0, 16) : null) };
}

async function sceneScript(Gm, o) {
  const { H, CL, DT } = Gm;
  const F = CL.FAM[o.fam];
  if (!F || !F.end) throw new Error(`script 장면: 끝 자리가 있는 무리만 (${Object.keys(CL.FAM).filter((k) => CL.FAM[k].end).join(',')}) — ${o.fam}`);
  const { G, P, led, digestHex } = setup(Gm, o, () => H.newRound({ walls: false, weapon: o.weapon, weapon2: 'longsword', seed: o.seed }));
  G.park();
  P.skill.level = o.skill;
  P.handOffset.set(F.ch[0], F.ch[1]);
  for (let i = 0; i < Math.round(1.5 / DT); i++) { P.move.set(0, 0); G.step(); }
  const strokes = [];
  let tgt = F.end;
  for (let k = 0; k < o.strokes; k++) {
    const i0 = led ? led.rows.length : 0;
    const from = [P.handOffset.x, P.handOffset.y];
    const dist = Math.hypot(tgt[0] - from[0], tgt[1] - from[1]);
    const n = Math.round((dist / F.v + 0.6) / DT);
    for (let i = 0; i < n; i++) {
      const off = P.handOffset;
      const dx = tgt[0] - off.x, dy = tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
      if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else off.set(tgt[0], tgt[1]);
      P.move.set(0, 0);
      G.step();
    }
    if (led) strokes.push(summariseStrokes(led.rows, i0, led.rows.length, { scene: 'script', fam: o.fam, seed: o.seed, k, cut: F.cut, dir: tgt === F.end ? 'fwd' : 'back' }));
    tgt = tgt === F.end ? F.ch : F.end;
  }
  return { strokes, rows: led?.rows ?? [], digest: digestHex(), fighter: P };
}

async function sceneCorr(Gm, o) {
  const { H, CL, DT, Input, CONFIG } = Gm;
  const F = CL.FAM[o.fam];
  if (!F || !F.end) throw new Error(`corr 장면: 끝 자리가 있는 무리만 — ${o.fam}`);
  const { G, P, led, digestHex } = setup(Gm, o, () => H.newRound({ walls: false, gap: 2.0 + 0.17, seed: o.seed, weapon: o.weapon }));
  const E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.skill.level = o.skill;
  CL.setPad(P, CL.PAD.Pflug);
  CL.inputPump(G, { Input, CONFIG, DT }, { pace: CL.pacer(o.input, o.seed) });
  const runUntil = (qq, max = 20 / DT) => { let g = 0; while (!qq.done && g++ < max) G.step(); };
  for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
  const off0 = [P.handOffset.x, P.handOffset.y];
  const iW = led ? led.rows.length : 0;
  const chq = CL.feedTrace(G, CL.stroke(F.ch[0] - off0[0], F.ch[1] - off0[1], 3, { lift: false, hold: F.chHold ?? 0 }));
  runUntil(chq);
  const cur = [P.handOffset.x, P.handOffset.y];
  const cut = CL.feedTrace(G, CL.stroke(F.end[0] - cur[0], F.end[1] - cur[1], F.v, { down: false, lift: true, hold: F.hold ?? 0 }));
  let g = 0;
  do G.step(); while (cut.t0 == null && ++g < 120);
  const iC = led ? led.rows.length - 1 : 0;
  runUntil(cut);
  const tEnd = G.t + 0.5;
  while (G.t < tEnd - 1e-9) G.step();
  const iR = led ? led.rows.length : 0;
  for (let i = 0; i < Math.round(1.5 / DT); i++) G.step();
  const strokes = [];
  if (led) {
    strokes.push(summariseStrokes(led.rows, iW, iC, { scene: 'corr', fam: o.fam, seed: o.seed, k: 0, part: '감기', cut: F.cut }));
    strokes.push(summariseStrokes(led.rows, iC, iR, { scene: 'corr', fam: o.fam, seed: o.seed, k: 1, part: '베기', cut: F.cut }));
    strokes.push(summariseStrokes(led.rows, iR, led.rows.length, { scene: 'corr', fam: o.fam, seed: o.seed, k: 2, part: '되돌림', cut: F.cut }));
  }
  return { strokes, rows: led?.rows ?? [], digest: digestHex(), fighter: P };
}

async function sceneP24(Gm, o) {
  const { H, CL, DT, Input, CONFIG } = Gm;
  const LC = await import(pathToFileURL(join(HERE, 'live_common.mjs')).href);
  const prog = LC.buildProgramme({ loops: 1 });
  const { G, P, led, digestHex } = setup(Gm, o, () => H.newRound({ walls: false, gap: LC.PROGRAMME.passive.gapM, seed: o.seed, weapon: o.weapon }));
  const E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (const fz of [P, E]) { fz.die = () => {}; const aw = fz.applyWound.bind(fz); fz.applyWound = (h) => { if (!(fz.decapitated && h.zone === 'neck')) aw(h); }; }
  P.skill.level = o.skill;
  CL.setPad(P, LC.PROGRAMME.pad0);
  CL.inputPump(G, { Input, CONFIG, DT }, { pace: CL.pacer(o.input, o.seed) });
  const strokes = [];
  for (const s of prog.strokes) {
    while (G.t < s.tDown / 1000 - 1e-9) G.step();
    const i0 = led ? led.rows.length : 0;
    const pts = s.samples.map(([t, x, y]) => [t - s.tDown, x, y]);
    const qq = CL.feedTrace(G, pts);
    let g = 0;
    while (!qq.done && g++ < 20 / DT) G.step();
    while (G.t < s.tEnd / 1000 - 1e-9) G.step();
    if (led) strokes.push(summariseStrokes(led.rows, i0, led.rows.length, { scene: 'p24', fam: s.id, seed: o.seed, k: s.idx, kind: s.kind, amp: s.amp, speed: s.speed, touch: s.touch }));
  }
  return { strokes, rows: led?.rows ?? [], digest: digestHex(), fighter: P };
}

async function sceneFight(Gm, o) {
  const { H, DT } = Gm;
  const { G, P, led, digestHex } = setup(Gm, o, () => H.newRound({ walls: true, seed: o.seed, weapon: o.weapon, AI2Class: H.AI }));
  P.skill.level = o.skill;
  const E = G.enemy;
  const sw = [];
  let swings = P.skill.swings;
  let tDead = null;
  const nMax = Math.round(o.secs / DT);
  for (let i = 0; i < nMax; i++) {
    G.step();
    if (P.skill.swings !== swings) { swings = P.skill.swings; sw.push(led ? led.rows.length - 1 : i); }
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = G.t;
    if (tDead != null && G.t > tDead + 1.0) break;
  }
  const strokes = [];
  if (led) {
    const n = led.rows.length;
    for (let k = 0; k < sw.length; k++) {
      const i0 = sw[k], i1 = Math.min(n, k + 1 < sw.length ? sw[k + 1] : n, i0 + Math.round(0.6 / DT));
      if (i1 - i0 < 6) continue;
      strokes.push(summariseStrokes(led.rows, i0, i1, { scene: 'fight', fam: 'swing', seed: o.seed, k }));
    }
    strokes.push(summariseStrokes(led.rows, 0, n, { scene: 'fight', fam: 'whole', seed: o.seed, k: -1, end: `${P.state}/${E.state}`, tDead: rN(tDead, 1) }));
  }
  return { strokes, rows: led?.rows ?? [], digest: digestHex(), fighter: P, end: `${P.state}/${E.state}`, tDead };
}
const SCENES = { script: sceneScript, corr: sceneCorr, p24: sceneP24, fight: sceneFight };

// ───────── 상자 자가 시험 ─────────
async function selftest() {
  const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
  await RAPIER.init();
  const results = [];
  const mkWorld = () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 120; world.integrationParameters.numSolverIterations = 6;
    const g = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9), g);
    return world;
  };
  const mkBox = (world, y) => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, y, 0));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 0.1, 0.1).setDensity(1000).setFriction(0.9), b);
    return b;
  };
  // 가짜 파이터 (장부가 읽는 것만): bodies·sword·anchor·uprightJoint·jointByName·gait 없음
  const fake = (world, b) => {
    const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.1, 0));
    const jd = RAPIER.JointData.generic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0);
    const uj = world.createImpulseJoint(jd, anchor, b, true); // 모터 없음 (k·d 0) → τ̂ 0
    const J = { thighF: { joint: uj, k: 1, gain: 1 }, thighB: { joint: uj, k: 1, gain: 1 }, abdomen: { joint: uj }, chest: { joint: uj } };
    return { bodies: { pelvis: b, chest: b, farmS: b, footF: b, footB: b, thighF: b, thighB: b, abdomen: b }, sword: b, anchor, uprightJoint: uj, jointByName: J, totalMass: b.mass(), state: 'stand', muscle: 1, legHealth: 1, limbs: { legF: 1, legB: 1 }, gait: null, debug: {}, bladePoint: null };
  };
  const run = (name, y, force, torque, n = 480, win = 240) => {
    const world = mkWorld();
    const b = mkBox(world, y);
    const fk = fake(world, b);
    const G = { world, t: 0, step: () => { world.step(); G.t += world.timestep; } };
    const led = attachLedger(G, fk, { CONFIG: { GAIT: { pinMu: 0.9 } } });
    for (let i = 0; i < n; i++) {
      b.resetForces(true); b.resetTorques(true);
      if (force) b.addForce(force, true);
      if (torque) b.addTorque(torque, true);
      G.step();
    }
    const w = led.rows.slice(win);
      const rr = { name, rV: rms(w.map((r) => r.rV)), rH: rms(w.map((r) => r.rH)), vert: rms(w.map((r) => r.vertRes)), fric: mean(w.map((r) => r.fric)), N: mean(w.map((r) => r.NF)), declV: rms(w.map((r) => r.otherV)), dLV: rms(w.map((r) => r.dLV)) };
    results.push(rr);
    return rr;
  };
  const m = 1000 * 0.24 * 0.2 * 0.2;
  const g = 9.81;
  const a = run('쉼 (법선 ×6/7 = mg, r 0)', 0.1, null, null);
  const bb = run('수평 밀기 0.5 mg (마찰이 붙잡음: 마찰 합력 = 밀기, rH 0)', 0.1, { x: 0.5 * m * g, y: 0, z: 0 }, null);
  const c = run('공중 회전 (접촉 없음: dL/dt = 선언 토크 + ω×L 자이로 생략 몫, r 0)', 3.0, { x: 0, y: m * g, z: 0 }, { x: 0.3, y: 0.5, z: 0.2 }, 240, 10);
  const d = run('수직축 토크 0.4·μmg·0.1 (한 발 안 힘쌍 → r_V = 선언 토크: 예산 안, 관측 불가)', 0.1, null, { x: 0, y: 0.4 * 0.9 * m * g * 0.1, z: 0 });
  const ok1 = a.rV < 0.05 && a.rH < 0.05 && Math.abs(a.N - m * g) / (m * g) < 0.01 && a.vert < 1;
  const ok2 = bb.rH < 0.2 && Math.abs(bb.fric - 0.5 * m * g) / (0.5 * m * g) < 0.02;
  const ok3 = c.rV < 0.05 && c.rH < 0.08; // 1차 자이로 보정 뒤 남는 2차 몫 (상자 ω ≈ 8 rad/s 에서 ≈ 0.04)
  const ok4 = Math.abs(d.rV - 0.4 * 0.9 * m * g * 0.1) < 0.05;
  for (const r of results) console.log(`${r.name.padEnd(64)} rV ${f(r.rV, 3)} rH ${f(r.rH, 3)} 수직 ${f(r.vert, 3)} N ${f(r.N, 1)} (mg ${f(m * g, 1)}) 마찰 ${f(r.fric, 2)} N 선언V ${f(r.declV, 3)} dLV ${f(r.dLV, 3)}`);
  console.log(`selftest ${ok1 && ok2 && ok3 && ok4 ? 'PASS' : 'FAIL'} (${[ok1, ok2, ok3, ok4].map((x) => (x ? 'ok' : 'NG')).join(' ')}) — 접선 충격량 미보고: 수직축 마찰 힘쌍은 r_V 에 남는다 (예산 열로 상한만)`);
  process.exitCode = ok1 && ok2 && ok3 && ok4 ? 0 : 1;
}

// ───────── 본문 ─────────
async function main() {
  if (arg('selftest', false)) return selftest();
  const Gm = await loadGame();
  const { CONFIG } = Gm;
  const scenes = list('scene', 'script').flatMap((s) => (s === 'all' ? ['script', 'corr', 'p24', 'fight'] : [s]));
  const seeds = list('seeds', '7,8,9').map(Number);
  const o0 = { weapon: arg('weapon', 'longsword'), skill: +arg('skill', 0.7), input: String(arg('input', '60')), strokes: +arg('strokes', 6), secs: +arg('secs', 30), digest: !!arg('digest', false) || !!arg('proof', false), ledger: true };
  const quiet = !!arg('quiet', false);
  const chain = CONFIG.BODY?.chain ?? 'anchor(없음)';
  console.log(`chain_ledger 뿌리 ${ROOT} · BODY.chain ${chain} · legTorque ${CONFIG.BODY?.legTorque ?? '-'} · assist ${CONFIG.GAIT?.assist ?? '-'} · humanLimits ${CONFIG.BODY?.humanLimits ?? '-'} · 접촉 교정 n/(n+1) · 기준점 질량중심 (14 강체 + 칼) · 잔차 r_V = dL_V/dt − τ_땅,V − 선언_V (마찰 힘쌍은 못 봄 → 예산 열)`);
  const all = [];
  const digests = [];
  let rowsOut = null;
  const rowsPath = arg('rows', null);
  for (const scene of scenes) {
    const fams = scene === 'script' || scene === 'corr' ? list('fams', SCENE_FAMS[scene].join(',')) : SCENE_FAMS[scene];
    for (const fam of fams)
      for (const seed of seeds) {
        const o = { ...o0, scene, fam, seed };
        const t0 = Date.now();
        const R = await SCENES[scene](Gm, o);
        const sec = (Date.now() - t0) / 1000;
        if (o.digest) {
          let proof = null;
          if (arg('proof', false)) { const R2 = await SCENES[scene](Gm, { ...o, ledger: false }); proof = R2.digest === R.digest ? 'same' : `DIFF ${R2.digest}`; }
          digests.push({ scene, fam, seed, digest: R.digest, proof });
          console.log(`digest ${scene} ${fam} s${seed} ${R.digest}${proof ? ` proof ${proof}` : ''} (${sec.toFixed(1)} s)`);
        }
        for (const S of R.strokes) { all.push(S); if (!quiet) console.log(fmtStroke(S)); }
        if (rowsPath && !rowsOut) { rowsOut = R.rows.map((r) => JSON.stringify({ scene, fam, seed, ...r })).join('\n') + '\n'; }
      }
  }
  // 장면 요약 (중앙값)
  const keys = ['rV_rms', 'rV_max', 'aV_rms', 'aV_max', 'corrV', 'ratioV', 'slopeV', 'rV_minus_aV_rms', 'rV_rms_all', 'aV_rms_all', 'corrV_all', 'ratioV_all', 'foreignShare', 'rH_rms', 'aH_rms', 'corrH', 'rH_minus_aH_rms', 'corrVpre', 'aVpre_rms', 'hidden_mean', 'hidden_min', 'hiddenYaw_mean', 'fric_rms', 'budget_win', 'single', 'pelW_max', 'chW_max', 'dpc', 'dpt', 'dct', 'orderOk', 'tip_max', 'chShare', 'pelShare', 'NF_p10', 'NB_p10', 'load_p10', 'wF_mean', 'slipEv', 'slipDist', 'yawSat', 'sigLtF', 'sigLtB', 'hipTauV_rms', 'sink', 'twist_max', 'twistLimit', 'wristChest_rms', 'fallen', 'vertRes_rms', 'gyroV_rms', 'gyroH_rms', 'kYaw', 'dYaw'];
  const groups = {};
  for (const S of all) { const g = `${S.scene}:${S.part ?? (S.scene === 'fight' ? S.fam : S.scene === 'p24' ? S.kind : 'cut')}`; (groups[g] ||= []).push(S); }
  const summary = {};
  console.log('\n장면 요약 (획 중앙값 [p10–p90], n = 획 수)');
  for (const [g, arr] of Object.entries(groups)) {
    const S = { n: arr.length };
    for (const k of keys) { const v = arr.map((s) => s[k]).filter((x) => x != null && Number.isFinite(x)); S[k] = { med: rN(med(v), 3), p10: rN(q(v, 0.1), 3), p90: rN(q(v, 0.9), 3), n: v.length }; }
    S.fallen_sum = arr.reduce((s, x) => s + (x.fallen || 0), 0);
    S.slipEv_sum = arr.reduce((s, x) => s + (x.slipEv || 0), 0);
    summary[g] = S;
    const m = (k, n = 1) => `${f(S[k].med, n)} [${f(S[k].p10, n)}–${f(S[k].p90, n)}]`;
    console.log(`${g.padEnd(12)} n ${String(S.n).padStart(3)} | rV rms ${m('rV_rms')} max ${m('rV_max', 0)} | τ̂닻V rms ${m('aV_rms')} | corr ${m('corrV', 2)} ratio ${m('ratioV', 2)} slope ${m('slopeV', 2)} | rV−τ̂ rms ${m('rV_minus_aV_rms')}${S.foreignShare.med ? ` | 모든 스텝 (상대 접촉 ${m('foreignShare', 2)}): rV ${m('rV_rms_all')} τ̂ ${m('aV_rms_all')} corr ${m('corrV_all', 2)} ratio ${m('ratioV_all', 2)}` : ''} | rH ${m('rH_rms')} τ̂닻H ${m('aH_rms')} corrH ${m('corrH', 2)} rH−τ̂ ${m('rH_minus_aH_rms')} | 숨은 W ${m('hidden_mean', 0)} min ${m('hidden_min', 0)} | 마찰 N ${m('fric_rms', 0)} 예산 ${m('budget_win', 0)} 한발 ${m('single', 2)} | 골반 ${m('pelW_max', 0)} 가슴 ${m('chW_max', 0)} °/s Δpc ${m('dpc', 0)} Δpt ${m('dpt', 0)} Δct ${m('dct', 0)} 순서 ${m('orderOk', 2)} | 칼끝 ${m('tip_max', 1)} 가슴몫 ${m('chShare', 2)} | p10 ${m('load_p10', 2)} wF ${m('wF_mean', 2)} | 미끄럼 Σ${S.slipEv_sum} yaw포화 ${m('yawSat', 2)} | σ<1 ${m('sigLtF', 2)}/${m('sigLtB', 2)} hipτ̂V ${m('hipTauV_rms', 1)} 싱크 ${m('sink', 2)} | 비틀림 ${m('twist_max', 0)}° | 넘어짐 Σ${S.fallen_sum} | 자이로 생략 V ${m('gyroV_rms', 1)} | 수직검산 ${m('vertRes_rms', 2)}`);
  }
  const base = all.filter((S) => S.scene === 'script' || S.part === '베기');
  if (base.length) {
    const rv = base.map((s) => s.rV_rms), av = base.map((s) => s.aV_rms);
    console.log(`\n기준선 (${chain}, 베기 획 n=${base.length}): r_V rms 중앙 ${f(med(rv), 1)} N·m · τ̂닻_V rms 중앙 ${f(med(av), 1)} · 획 안 상관 중앙 ${f(med(base.map((s) => s.corrV)), 3)} · 비 r/τ̂ 중앙 ${f(med(base.map((s) => s.ratioV)), 3)} · 획 사이 rms 상관 ${f(pearson(rv, av), 3)} · r_V−τ̂ rms 중앙 ${f(med(base.map((s) => s.rV_minus_aV_rms)), 1)} · r_H rms 중앙 ${f(med(base.map((s) => s.rH_rms)), 1)} (τ̂닻_H ${f(med(base.map((s) => s.aH_rms)), 1)}, corrH ${f(med(base.map((s) => s.corrH)), 3)}) · 숨은 일률 평균 중앙 ${f(med(base.map((s) => s.hidden_mean)), 0)} W 최저 ${f(Math.min(...base.map((s) => s.hidden_min ?? 0)), 0)} W · 마찰 예산(골반 최고 전 100 ms) 중앙 ${f(med(base.map((s) => s.budget_win)), 0)} N·m`);
  }
  if (rowsPath && rowsOut) { mkdirSync(dirname(resolve(rowsPath)), { recursive: true }); writeFileSync(resolve(rowsPath), rowsOut); console.log(`rows → ${resolve(rowsPath)} (첫 판)`); }
  const jsonPath = arg('json', null);
  if (jsonPath && jsonPath !== true) {
    mkdirSync(dirname(resolve(jsonPath)), { recursive: true });
    writeFileSync(resolve(jsonPath), JSON.stringify({ meta: { tool: 'chain_ledger.mjs', root: ROOT, chain, legTorque: CONFIG.BODY?.legTorque ?? null, assist: CONFIG.GAIT?.assist ?? null, humanLimits: CONFIG.BODY?.humanLimits ?? null, scenes, seeds, opts: o0, ref: 'com(14 bodies + sword)', contactCal: 'contactImpulse × n/(n+1)', tangentImpulse: 'Rapier 0.19.3 JS 미보고 → 마찰 합력은 선운동량 보존, 돌림힘은 N 가중 접촉 중심; 힘쌍은 r_V 에 남음 (budget 열 상한)', digests }, strokes: all, summary }, null, 1));
    console.log(`json → ${resolve(jsonPath)}`);
  }
}
if (isMain) await main();
