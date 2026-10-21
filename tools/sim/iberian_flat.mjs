// ─────────────────────────────────────────────────────────────
//  iberian_flat.mjs — 칼 면 맞음 재기 (10/22 이베리아 칼면 조사 — docs/strike/iberian_flat_hits_2026-10-22.md)
//   사장님 10/21 23:5x '이베리아 유파가 유독 칼면이 맞는 경우가 많았어 특히 수직베기에서'.
//   몸에 닿은 칼날 사건마다 날 맞춤(edgeAlign — combat.js analyze 식을 corr_lib tapEdge 가 다시 잰다)을 적고, 무기 × 베는 방향으로 칼 면 몫을 센다.
//   칼 면 = 칼날 부품 · 찌르기 후보 아님 · edgeAlign ≤ STRIKE.edgeAlign(0.6). 몫 = 칼 면 / (칼날 · 찌르기 후보 아닌 사건). 찌르기 후보는 '찌르기' 줄로 따로.
//   사건 = (친 쪽, 맞은 쪽, 부위)가 2 스텝 넘게 끊겼다가 다시 닿은 첫 분석 (chain_corr 와 같은 셈). '맞음' = 판정 에너지 ≥ STRIKE.minEnergy(상처 판정까지 간 것).
//
//  node tools/sim/iberian_flat.mjs ai  [--weapons=longsword,uchigatana,rapier,qinggang,zweihander,flamberge] [--foe=longsword] [--seeds=1-30] [--dur=30] [--prof=4] [--abl=…] [--json=파일]
//  node tools/sim/iberian_flat.mjs pad [--weapons=…] [--fams=vDown,vUp,vDownR,vUpR,chainV,chainD,dDown,dDownL,dUp,dUpL,hor,horL] [--reps=6] [--v=12,5] [--dist=1.4,1.6,1.8] [--hold=500] [--jitter=1] [--foe=stand] [--abl=…] [--json=파일]
//  node tools/sim/iberian_flat.mjs sum <json …>   (여러 --json 출력을 합쳐 같은 표)
//   ai  = AI 대 AI 판(harness_m — 시험 무기 쪽은 플레이어 자리, 상대는 --foe). 시험 무기 쪽 칼만 센다(--both 면 상대 칼도 그 무기 이름으로).
//   pad = 사람 손가락 길(corr_lib inputPump — main.js 와 같은 입력 길, 보정 v2 · 0.7 · playerEdge 'goal' = 판 값). 상대 --foe=stand(서 있는 과녁 · 칼 충돌 끔 · 기본) | block(막기만) | ai(보통 AI) — 죽지 않음
//   방향 (두 가지로 잰다):
//    · 칼 길 (모든 판): 맞는 순간 칼날의 상대 속도가 그리는 면 — 면 기울기 < 30° = 수직 · > 60° = 수평 · 그 사이 = 사선. 내림 / 올림 = 그 면에서 칼이 도는 쪽(친 쪽 오른쪽 축 둘레)
//    · 이름 (ai = 기술 이름의 패드 길 · pad = 손가락 길 무리): 같은 문턱(패드 길 기울기 60° · 30°)
//   --abl (시험 끄기 · 바꾸기 — 이 도구 안에서만, 판 값은 그대로):
//    wrist   이베리아 패시브 손목 힘 × 1.3 끔 (SCHOOL_PASSIVE.iberian.on = false)
//    flow    이베리아 이어 긋기 흐름 A 끔 (IB_FLOW.a = false)
//    table   이베리아 몬탄테 자세표 끔 (SCHOOL_ART.table = false → 앞무게 틀 표)
//    tableSkip=a+b  그 칸만 걷음 (tag · tagR · tagL · langort · ochsR · ochsL · pflugR · pflugL · alber · sideR · sideL · wechselR · wechselL · neben · 묶음 wait · pass)
//    heavy   앞무게 틀 흐름 덧씌우기(SKILL.flow) 끔 — skill._flow 감싸기를 판 뒤 걷어 낸다
//    limits  사람 관절 범위 끔 (BODY.humanLimits = false — 손목 밧줄 · 아래팔 돌림 범위 · 양날 고르기)
//    joints  관절 교정 묶음 끔 (JOINTS.mode = 'off')
//    roll    잰 쪽 아래팔 돌림 밧줄만 걷음 (손목 밧줄 둘 가운데 HUMAN.forearmRoll 80° 줄)
//    ts=K    잰 무기 쪽 날 세우기 힘(twistScale) × K · ts=L = 롱소드 값 1 그대로(관성 비례 끔)
//    edge=M  날 세우기 방식 (JOINTS.edge = motor | ff | pre — 있는 시험 스위치)
//    edgeAt  JOINTS.edgeAt = 'near' (있는 시험 스위치) · edgeRel  JOINTS.edgeRel = true · edgeArm=K  JOINTS.edgeArm = K (팔 나눔 ⓓ — edge=motor 와 함께)
//    ibEdge=motor|ff|pre  이베리아 유파만 그 날 세우기 방식 (config IB_EDGE — 이 조사의 시제품, 판 끔 · main.js ?ibEdge= 와 같은 뜻)
//   쥠 꼴은 모듈이 처음 읽힐 때 정해져 환경 변수로만: MONTANTE_HAND=old|wide|guard (츠바이핸더만 — 무기 몸 시험)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, AI, THREE, CONFIG } from './harness_m.mjs';
import { Combat } from '../../src/combat.js';
import { Input } from '../../src/input.js';
import { SCHOOL_ART } from '../../src/schools.js';
import { tapEdge, inputPump, feedTrace, stroke, setPad, setCorr, pacer, PAD, wilson } from './corr_lib.mjs';

// ── 인자 ──
const MODE = process.argv[2];
if (MODE !== 'ai' && MODE !== 'pad' && MODE !== 'sum') throw new Error('첫 인자: ai | pad | sum');
const args = {};
const FILES = []; // sum: 합칠 json (이 도구의 --json 출력)
for (const a of process.argv.slice(3)) {
  if (MODE === 'sum' && !a.startsWith('--')) { FILES.push(a); continue; }
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const range = (s) => {
  const out = [];
  for (const p of String(s).split(',')) {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else out.push(+p);
  }
  return out;
};
const WEAPONS = list('weapons', 'longsword,uchigatana,rapier,qinggang,zweihander,flamberge');
const ABL = list('abl', '');
const ablVal = (k) => { const a = ABL.find((x) => x === k || x.startsWith(k + '=')); return a == null ? null : a.includes('=') ? a.split('=')[1] : true; };
const JSON_OUT = arg('json', null);
const QUIET = !!arg('quiet', false);

// ── 시험 끄기 (판 값은 이 프로세스 안에서만 바뀐다) ──
const { SCHOOL_PASSIVE, IB_FLOW, BODY, JOINTS, STRIKE } = CONFIG;
if (ablVal('wrist')) SCHOOL_PASSIVE.iberian.on = false;
if (ablVal('flow')) IB_FLOW.a = false;
if (ablVal('table')) SCHOOL_ART.table = false;
if (ablVal('tableSkip')) {
  // 이베리아 자세표 칸만 골라 걷음 (+ 로 여럿 · wait = 기다리는 자리 여섯 · pass = 지나는 자리 여덟 — guards.js skipIberianTable · main.js ?ibTableSkip 와 같은 길)
  const { skipIberianTable } = await import('../../src/guards.js');
  skipIberianTable(String(ablVal('tableSkip')).split('+'));
}
if (ablVal('limits')) BODY.humanLimits = false;
if (ablVal('joints')) JOINTS.mode = 'off';
if (ablVal('edge')) JOINTS.edge = ablVal('edge');
if (ablVal('edgeAt')) JOINTS.edgeAt = 'near';
if (ablVal('edgeRel')) JOINTS.edgeRel = true;
if (ablVal('edgeArm')) JOINTS.edgeArm = +ablVal('edgeArm'); // 팔 나눔 ⓓ (새 방식 motor · ff · pre 에서만 읽힘)
if (ablVal('ibEdge') != null) {
  // 이베리아 날 세우기 시험 (config IB_EDGE — main.js ?ibEdge= 와 같은 뜻): motor · ff · pre
  if (!CONFIG.IB_EDGE) throw new Error('이 트리에 IB_EDGE 가 없다');
  if (!['motor', 'ff', 'pre'].includes(ablVal('ibEdge'))) throw new Error(`ibEdge=${ablVal('ibEdge')}?`);
  Object.assign(CONFIG.IB_EDGE, { on: true, edge: ablVal('ibEdge') });
}
const TSK = ablVal('ts');
/** 잰 쪽 검객에 판 뒤 시험 몫을 건다 */
function postBuild(f) {
  if (TSK === 'L') f.twistScale = 1;
  else if (TSK != null) f.twistScale *= +TSK;
  if (ablVal('roll') && f.gripCone?.[1]) {
    f.world.removeImpulseJoint(f.gripCone[1], true); // 아래팔 돌림 밧줄(HUMAN.forearmRoll 80°)만 걷음 — 양날 고르기(rollSide)는 그대로
    f.gripCone.splice(1, 1);
  }
  if (ablVal('heavy') && f.skill?._flow) {
    delete f.skill.update; // installFlow 가 인스턴스에 얹은 감싸기 → 프로토타입 update 로 돌아간다
    f.skill._flow = false;
  }
}

// ── 날 각 탭 + 맞는 순간 기하 ──
const tap = tapEdge(Combat, THREE, CONFIG);
let ctx = null; // 바깥 감싸기가 넘기는 { pr, point, S, P } (tap 듣개가 읽는다)
{
  const inner = Combat.prototype.analyze;
  Combat.prototype.analyze = function (pr, point, S, P, predicting = false) {
    const keep = ctx;
    ctx = predicting ? null : { pr, point, S, P };
    try {
      return inner.call(this, pr, point, S, P, predicting);
    } finally {
      ctx = keep;
    }
  };
}
const R2D = 180 / Math.PI;
const COS78 = Math.cos((78 * Math.PI) / 180), COS80 = Math.cos((80 * Math.PI) / 180); // 80 = fighter.js HUMAN.forearmRoll
const _ax = new THREE.Vector3(), _hp = new THREE.Vector3(), _tt = new THREE.Vector3();
const _zf = new THREE.Vector3(), _fz = new THREE.Vector3(), _qf = new THREE.Quaternion(), _qs = new THREE.Quaternion();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const velAt = (st, p) => p.clone().sub(st.com).cross(st.w).negate().add(st.v);
/** a → b 의 칼 축 둘레 부호 있는 각 (양날 — ±90° 로 접음) */
function foldAngle(a, b, axis) {
  let x = Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(axis), a.dot(b));
  if (x > Math.PI / 2) x -= Math.PI;
  if (x < -Math.PI / 2) x += Math.PI;
  return x * R2D;
}
/** 패드 길 → 방향 이름 (dx 오른쪽 +, dy 위 +) */
function padClass(dx, dy) {
  const L = Math.hypot(dx, dy);
  if (L < 0.08) return null;
  const el = Math.atan2(Math.abs(dy), Math.abs(dx)) * R2D;
  if (el >= 60) return dy < 0 ? 'vDown' : 'vUp';
  if (el <= 30) return 'hor';
  return dy < 0 ? 'dDown' : 'dUp';
}
/** 기술 이름 → 방향 (AI): 그 기술 길(from → path 의 가장 긴 토막) */
function techClass(t) {
  if (!t) return null;
  if (t.kind === 'thrust') return 'thrust';
  const pts = [t.from, ...(t.path ?? [])].filter(Boolean);
  let best = null, bl = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    const l = Math.hypot(dx, dy);
    if (l > bl) (bl = l), (best = [dx, dy]);
  }
  return best ? padClass(best[0], best[1]) : null;
}

const recs = []; // 이 판의 칼 닿음 분석 (모든 친 쪽)
const TRACE = +arg('trace', 0); // ai: 칼 면 맞음 N 개의 앞 자취를 찍는다 (--traceCls=vDown+vUp | all)
const TRACE_CLS = String(arg('traceCls', 'vDown+vUp'));
const traces = [];
/** 자취 한 스텝 (측정만) */
function traceSnap(f, ai, k) {
  const r = f.sword.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q), face = new THREE.Vector3(0, 0, 1).applyQuaternion(q), edge = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const hp = f.hitPointVel.clone(); hp.addScaledVector(axis, -hp.dot(axis));
  const fr = f.bodies.farmS.rotation();
  const zf = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(fr.x, fr.y, fr.z, fr.w));
  const w = f.sword.angvel();
  return { k, pad: [f.handOffset.x, f.handOffset.y], el: Math.asin(Math.max(-1, Math.min(1, axis.y))) * 180 / Math.PI, v70: hp.length(), ea70: hp.length() > 0.3 ? Math.abs(hp.dot(edge)) / hp.length() : null,
    lag: f.edgeLag * 180 / Math.PI, mov: f.edgeMoving ?? 0, roll: Math.acos(Math.min(1, Math.abs(face.dot(zf)))) * 180 / Math.PI, wT: axis.x * w.x + axis.y * w.y + axis.z * w.z,
    flow: f.ibFlowOn ? 1 : 0, brake: f.wristBrake ? 1 : 0, sw: f.skill.swinging ? 1 : 0, tech: ai?.tech?.name ?? '-', phase: ai?.phase ?? '-', mode: ai?.mode ?? '-', grip: f.gripping ? 1 : 0, clash: k - lastClash };
}
let stepK = 0;
let lastClash = -1e9; // 칼끼리 닿은 마지막 스텝 (combat.bladeClash 에 쌍이 있던 때)
let measure = null; // (att) → 잴 쪽인가
let aiOf = new Map(); // 검객 → AI
const padHist = new Map(); // 검객 → [{k, x, y}] 최근 패드
tap.listeners.add((rec, r) => {
  if (!ctx || !measure?.(rec.att)) return;
  const { pr, point, S, P } = ctx;
  const att = rec.att;
  const axis = Y.clone().applyQuaternion(S.q);
  const face = Z.clone().applyQuaternion(S.q);
  const rel = r.dir.clone().multiplyScalar(r.speed);
  const perp = rel.clone().addScaledVector(axis, -rel.dot(axis));
  const n = new THREE.Vector3().crossVectors(axis, perp);
  const nl = n.length();
  if (nl > 1e-6) n.divideScalar(nl);
  const yaw = att.yaw;
  const fwd = X.clone().applyQuaternion(yaw), right = Z.clone().applyQuaternion(yaw);
  const nu = n.y, nr = n.dot(right), nf = n.dot(fwd);
  const tilt = Math.asin(Math.min(1, Math.abs(nu))) * R2D;
  const stabCand = rec.kind === 'stab' || (rec.isBlade && rec.along > STRIKE.stabAlign - (att.weaponCfg.thrustStyle?.window ?? 0) && rec.t > 0.8 - (att.weaponCfg.thrustStyle?.window ?? 0));
  let geo;
  if (stabCand) geo = 'thrust';
  else if (tilt < 30) geo = nr < 0 ? 'vDown' : 'vUp';
  else if (tilt > 60) geo = 'hor';
  else geo = nr < 0 ? 'dDown' : 'dUp';
  // 칼 속도 · 맞은 몸 속도 (상대 속도의 몫)
  const vB = velAt(S, point), vV = velAt(P, point);
  const vBp = vB.clone().addScaledVector(axis, -vB.dot(axis));
  const vVp = vV.clone().addScaledVector(axis, -vV.dot(axis));
  // 제 칼의 날 세우기 목표(근사 — driveSword 의 'torque' 줄: 칼날 70 % 점 속도 ⊥ 칼 축 → 면 = 축 × 그 속도) ↔ 이상(축 × rel⊥)
  const hp = att.hitPointVel.clone();
  hp.addScaledVector(axis, -hp.dot(axis));
  const nOwn = new THREE.Vector3().crossVectors(axis, hp);
  const ownOk = nOwn.length() > 1e-4 && nl > 1e-6;
  if (ownOk) nOwn.normalize();
  // 아래팔 돌림 (칼 면 ↔ 아래팔 경첩 축 — 손목 밧줄 HUMAN.forearmRoll 80°)
  const fr = att.bodies.farmS.rotation();
  const zf = Z.clone().applyQuaternion(new THREE.Quaternion(fr.x, fr.y, fr.z, fr.w));
  const ai = aiOf.get(att);
  const hist = padHist.get(att) ?? [];
  const at = (dtBack) => { const k0 = stepK - Math.round(dtBack / DT); for (let i = hist.length - 1; i >= 0; i--) if (hist[i].k <= k0) return hist[i]; return hist[0]; };
  const h0 = hist[hist.length - 1];
  const h15 = at(0.15), h30 = at(0.3);
  recs.push({
    k: stepK, att: att.index, vic: rec.vic.index, part: rec.part, kind: rec.kind, isBlade: rec.isBlade, ea: rec.ea, eaDeg: rec.eaDeg, t: rec.t, speed: rec.speed, energy: rec.energy,
    landed: rec.energy >= STRIKE.minEnergy, stabCand, geo, tilt, nr, nf,
    vB: vBp.length(), vV: vVp.length(), vVall: vV.length(),
    targetErr: ownOk ? foldAngle(nOwn, n, axis) : null, // 제 칼 목표 → 이상 면 (°)
    trackErr: ownOk ? foldAngle(face, nOwn, axis) : null, // 실제 면 → 제 칼 목표 (°) — 서보가 못 따라간 몫
    flatErr: nl > 1e-6 ? foldAngle(face, n, axis) : null, // 실제 면 → 이상 면 (°) = ±acos(ea)
    edgeLag: att.edgeLag != null ? att.edgeLag * R2D : null, edgeMoving: att.edgeMoving ?? null,
    roll: Math.acos(Math.min(1, Math.abs(face.dot(zf)))) * R2D,
    ibFlow: !!att.ibFlowOn, wristK: att.wristK ?? 1, ts: att.twistScale,
    tech: ai ? ai.tech?.name ?? null : null, techCls: ai ? (ai.feint ? 'feint' : techClass(ai.tech)) : null, phase: ai ? ai.phase : null, aiMode: ai ? ai.mode : null,
    pad15: h0 && h15 ? padClass(h0.x - h15.x, h0.y - h15.y) : null, pad30: h0 && h30 ? padClass(h0.x - h30.x, h0.y - h30.y) : null,
    tip: att.tipVel.length(),
    sinceClash: (stepK - lastClash) * DT, // 칼끼리 닿은 뒤 지난 시간 (s) — 10/10 날 세우기 조사 §3 '칼끼리 닿은 직후 미끄러져 닿은 칼'
  });
});
function trackPads(fs) {
  for (const f of fs) {
    let h = padHist.get(f);
    if (!h) padHist.set(f, (h = []));
    h.push({ k: stepK, x: f.handOffset.x, y: f.handOffset.y });
    if (h.length > 60) h.shift();
  }
}
/** 사건으로 묶기: (친 쪽, 맞은 쪽, 부위)가 2 스텝 넘게 끊기면 새 사건 (chain_corr 와 같다) */
function events(rs) {
  const last = {};
  const ev = [];
  for (const r of rs) {
    const key = `${r.att}:${r.vic}:${r.part}`;
    if (last[key] == null || r.k - last[key] > 2) ev.push(r);
    last[key] = r.k;
  }
  return ev;
}

// ── 판 ──
const rows = []; // 사건 (무기 · 방향 · 판 열쇠 붙임)
const fights = []; // 판 요약
function runAI() {
  const FOE = arg('foe', 'longsword');
  const SEEDS = range(arg('seeds', '1-30'));
  const DUR = +arg('dur', 30);
  const PROF = +arg('prof', 4);
  const BOTH = !!arg('both', false);
  for (const w of WEAPONS) {
    for (const seed of SEEDS) {
      recs.length = 0;
      padHist.clear();
      stepK = 0;
      const G = newRound({ walls: true, seed, weapon: w, weapon2: FOE, AI2Class: AI, persona: { proficiency: PROF }, persona2: { proficiency: PROF } });
      const P = G.player, E = G.enemy;
      postBuild(P);
      if (FOE === w) postBuild(E);
      aiOf = new Map([[P, G.ai2], [E, G.ai]]);
      lastClash = -1e9;
      { const bc = G.combat.bladeClash.bind(G.combat); G.combat.bladeClash = (world, pairs) => { if (pairs.length) lastClash = stepK; return bc(world, pairs); }; }
      measure = BOTH ? () => true : (f) => f === P;
      const dmg = { P: 0, E: 0 };
      const hits = { P: 0, E: 0 };
      G.onWound = (att, vic, r) => { if (r.severity > 0) { const k = att === P ? 'P' : 'E'; dmg[k] += r.severity; hits[k]++; } };
      let tEnd = null;
      let swings0 = P.skill.swings ?? 0;
      const steps = Math.round(DUR / DT);
      let tipPk = [];
      let curPk = 0;
      const st = { sw: 0, rope: 0, mv: 0, lag: 0, lag45: 0, flip: 0, byTech: {} };
      const ring = []; // --trace: 잰 쪽 스텝 자취 (칼 면 맞음 앞 0.25 s 를 찍는다)
      for (let i = 0; i < steps; i++) {
        stepK = i;
        trackPads([P, E]);
        const nRec = recs.length;
        G.step();
        if (TRACE) {
          ring.push(traceSnap(P, G.ai2, i));
          if (ring.length > 30) ring.shift();
          for (let j = nRec; j < recs.length; j++) {
            const r = recs[j];
            if (r.att === P.index && r.kind === 'flat' && r.landed && !r.stabCand && (TRACE_CLS === 'all' || TRACE_CLS.split('+').includes(r.geo)) && traces.length < TRACE) traces.push({ w, seed, r, ring: ring.slice() });
          }
        }
        { // 스텝 따라감 (잰 쪽 · 휘두르는 동안): 밧줄 끝(돌림 ≥ 78°) 몫 · 움직이는 칼(섞기 ≥ 0.99 · 70 % 점 ≥ 3 m/s)의 날 어긋남
          if (P.skill.swinging) {
            const fr = P.bodies.farmS.rotation(), sr = P.sword.rotation();
            const zf = _zf.set(0, 0, 1).applyQuaternion(_qf.set(fr.x, fr.y, fr.z, fr.w));
            const fz = _fz.set(0, 0, 1).applyQuaternion(_qs.set(sr.x, sr.y, sr.z, sr.w));
            st.sw++;
            const atRope = Math.abs(fz.dot(zf)) < COS78;
            if (atRope) st.rope++;
            const tn = G.ai2.tech?.name ?? '-';
            const bt = (st.byTech[tn] ||= [0, 0]);
            bt[0]++;
            if (atRope) bt[1]++;
            if ((P.edgeMoving ?? 0) >= 0.99 && P.hitPointVel.length() >= 3) {
              st.mv++; st.lag += P.edgeLag; if (P.edgeLag > Math.PI / 4) st.lag45++;
              // 양날 고르기 뒤집힘 조건 (fighter.js rollSide 와 같은 식 — 근사: 목표 = 칼 축 × 70 % 점 속도⊥, 가까운 쪽): 가까운 면이 아래팔 돌림 범위 밖이고 먼 면은 안 → 먼 길로 돌림
              const ax = _ax.set(0, 1, 0).applyQuaternion(_qs);
              const hp = _hp.copy(P.hitPointVel).addScaledVector(ax, -P.hitPointVel.dot(ax));
              const t = _tt.crossVectors(ax, hp);
              if (t.lengthSq() > 1e-6) { t.normalize(); if (t.dot(fz) < 0) t.negate(); if (t.dot(zf) < COS80 && -t.dot(zf) >= COS80) st.flip++; }
            }
          }
        }
        const tv = P.tipVel.length();
        if (tv > curPk) curPk = tv;
        if (P.skill.swinging === false && curPk > 0) { if (curPk > 3) tipPk.push(curPk); curPk = 0; }
        if (tEnd == null && (!P.alive || !E.alive)) tEnd = G.t;
        if (tEnd != null && G.t - tEnd > 0.5) break;
      }
      const ev = events(recs);
      for (const r of ev) rows.push({ ...r, weapon: r.att === P.index ? w : FOE, seed, fight: `${w}:${seed}` });
      fights.push({ weapon: w, seed, end: `${P.state}/${E.state}`, win: E.state === 'dead' && P.state !== 'dead' ? 1 : P.state === 'dead' && E.state !== 'dead' ? 0 : 0.5, dmgDealt: dmg.P, dmgTaken: dmg.E, hitsDealt: hits.P, attacks: G.ai2.stats?.attacks ?? null, tipPk: tipPk.length ? tipPk.sort((a, b) => a - b)[Math.floor(tipPk.length / 2)] : null, t: tEnd ?? DUR, st });
      G.world.free();
    }
    if (!QUIET) console.error(`… ${w} ${SEEDS.length} 판`);
  }
}

// 손가락 길 무리 (패드 m — corr_lib PAD 자리). ch = 감는 자리, end = 끝. v = 손가락 빠르기 (m/s) 는 --v 로
const FAMS = {
  vDown: { ch: PAD.Tag, end: PAD.Alber },
  vUp: { ch: PAD.Alber, end: PAD.Tag },
  dDown: { ch: PAD.ShR, end: PAD.WechselL },
  dDownL: { ch: [-0.4, 0.42], end: [0.38, -0.44] },
  dUp: { ch: PAD.Wechsel, end: PAD.OchsL },
  dUpL: { ch: [-0.4, -0.42], end: [0.22, 0.26] },
  hor: { ch: PAD.Side, end: PAD.SideL },
  horL: { ch: PAD.SideL, end: PAD.Side },
  // 쉼 자리에서 곧장: 감는 자리 = 긴 자세(이베리아 쉼 '곧은 자세' 자리 — schools.js rest 'langort'), 거기서 바로 아래 · 위로
  vDownR: { ch: [0.0, 0.03], end: PAD.Alber },
  vUpR: { ch: [0.0, 0.03], end: PAD.Tag },
  // 이어 긋기: 내려 그은 뒤 0.15 s 안에 곧장 되올림 (이베리아 이어 긋기 흐름이 걸리는 꼴) — 두 획 모두 센다
  chainV: { ch: PAD.Tag, end: PAD.Alber, then: PAD.Tag },
  chainD: { ch: PAD.ShR, end: PAD.WechselL, then: PAD.ShR },
};
const FAM_CLS = { vDown: 'vDown', vUp: 'vUp', vDownR: 'vDown', vUpR: 'vUp', dDown: 'dDown', dDownL: 'dDown', dUp: 'dUp', dUpL: 'dUp', hor: 'hor', horL: 'hor', chainV: 'vDown', chainD: 'dDown' };
const FAM_CLS2 = { chainV: 'vUp', chainD: 'dUp' };
function runPad() {
  const FL = list('fams', 'vDown,vUp,dDown,dUp,hor,chainV');
  const REPS = +arg('reps', 6);
  const VS = list('v', '12,5').map(Number);
  const DISTS = list('dist', '1.4,1.6,1.8').map(Number);
  const FOEM = arg('foe', 'stand'); // stand = 서 있는 과녁 · block = 막기만 하는 AI · ai = 보통 AI
  if (!['stand', 'block', 'ai'].includes(FOEM)) throw new Error(`pad --foe=${FOEM}?`);
  const HOLDS = list('hold', '500').map(Number);
  const JIT = arg('jitter', '1') !== '0'; // 1 = rep 마다 길 흔들기 (0 = 같은 길 — rep 은 과녁 걸음만 다르다) // 감는 자리에서 쥐는 ms (0.6 s 이어짐 창 안 = 감기가 앞 휘두르기로 셈)
  const deps = { Input, CONFIG, DT };
  for (const w of WEAPONS) {
    for (const fam of FL) {
      const F = FAMS[fam];
      if (!F) throw new Error(`모르는 무리 ${fam}`);
      for (const v of VS) for (const dist of DISTS) for (const hold of HOLDS) for (let rep = 0; rep < REPS; rep++) {
        recs.length = 0;
        padHist.clear();
        stepK = 0;
        const seed = 100 + rep;
        // 흔들기 (rep 마다 · 무기와 상관없이 같은 값 — 무기 · 시험끼리 짝지어 비교): 감는 자리 · 끝 ±0.07 패드 · 빠르기 ±20 % · 쥐는 시간 ±80 ms
        let js = (Math.imul(rep + 1, 2654435761) ^ Math.imul(FL.indexOf(fam) + 7, 40503) ^ Math.round(v * 97 + dist * 1009 + hold)) >>> 0;
        const jr = () => ((js = (Math.imul(js, 1664525) + 1013904223) >>> 0), js / 4294967296 - 0.5);
        const J = JIT ? { ch: [F.ch[0] + 0.14 * jr(), F.ch[1] + 0.14 * jr()], end: [F.end[0] + 0.14 * jr(), F.end[1] + 0.14 * jr()], then: F.then ? [F.then[0] + 0.14 * jr(), F.then[1] + 0.14 * jr()] : null, v: v * (1 + 0.4 * jr()), hold: Math.max(0, hold + 160 * jr()) } : { ch: F.ch, end: F.end, then: F.then, v, hold };
        const G = newRound({ walls: false, gap: dist + 0.17, seed, weapon: w, weapon2: 'longsword' });
        const P = G.player, E = G.enemy;
        postBuild(P);
        if (FOEM === 'stand') {
          // 서 있는 과녁: 상대 칼 충돌 끔 · 걷기 rep 마다 다르게(가만 · 옆 · 앞) — 맞은 몸 속도 몫이 들어가게
          const mv = [[0, 0], [0, 0], [1, 0], [-1, 0], [0, 1], [0, 0]][rep % 6];
          G.ai.update = () => E.move.set(mv[0], mv[1]);
          for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
        } else if (FOEM === 'block') G.ai.startAttack = () => false; // 막기 · 간 보기만 (칼끼리 닿음이 들어간다)
        // 'ai' = 보통 AI 그대로 (맞받아 침). 둘 다 죽지 않음
        for (const f of FOEM === 'stand' ? [E] : [E, P]) {
          f.die = () => {};
          const aw = f.applyWound.bind(f);
          f.applyWound = (h) => { if (!(f.decapitated && h.zone === 'neck')) aw(h); };
        }
        P.skill.level = 0.7;
        setCorr(CONFIG, P, CONFIG.SKILL.corr, CONFIG.SKILL.corrTip);
        setPad(P, PAD.Pflug);
        aiOf = new Map();
        lastClash = -1e9;
        { const bc = G.combat.bladeClash.bind(G.combat); G.combat.bladeClash = (world, pairs) => { if (pairs.length) lastClash = stepK; return bc(world, pairs); }; }
        measure = (f) => f === P;
        inputPump(G, deps, { pace: pacer('60', seed) });
        const step = () => { trackPads([P]); G.step(); stepK++; };
        const runUntil = (q, max = 8 / DT) => { let g = 0; while (!q.done && g++ < max) step(); };
        for (let i = 0; i < Math.round(1.5 / DT); i++) step();
        const off0 = [P.handOffset.x, P.handOffset.y];
        runUntil(feedTrace(G, stroke(J.ch[0] - off0[0], J.ch[1] - off0[1], 3, { lift: false, hold: J.hold })));
        const k1 = stepK;
        const cur = [P.handOffset.x, P.handOffset.y];
        const s1 = feedTrace(G, stroke(J.end[0] - cur[0], J.end[1] - cur[1], J.v, { lift: !F.then, down: false, hold: F.then ? 60 : 0 }));
        runUntil(s1);
        let k2 = null;
        if (F.then) {
          k2 = stepK;
          const c2 = [P.handOffset.x, P.handOffset.y];
          runUntil(feedTrace(G, stroke(J.then[0] - c2[0], J.then[1] - c2[1], J.v, { lift: true, down: false })));
        }
        for (let i = 0; i < Math.round(0.6 / DT); i++) step();
        const ev = events(recs.filter((r) => r.k >= k1));
        for (const r of ev) rows.push({ ...r, weapon: w, fam, famCls: k2 != null && r.k >= k2 + 3 ? FAM_CLS2[fam] : FAM_CLS[fam], v, dist, hold, rep, seed, foe: FOEM, fight: `${w}:${fam}:${v}:${dist}:${hold}:${rep}` });
        G.world.free();
      }
      if (!QUIET) console.error(`… ${w} ${fam}`);
    }
  }
}

let SRC = MODE; // 요약 줄의 판 꼴 (sum 은 읽은 파일의 꼴)
if (MODE === 'ai') runAI();
else if (MODE === 'pad') runPad();
else {
  const { readFileSync } = await import('node:fs');
  for (const f of FILES) {
    const d = JSON.parse(readFileSync(f, 'utf8'));
    SRC = d.mode;
    rows.push(...d.rows);
    fights.push(...d.fights);
  }
}

// ── 요약 ──
const CLS = ['vDown', 'vUp', 'dDown', 'dUp', 'hor'];
/** 판(fight) 묶음 붓스트랩 95 % (결정적 난수) */
function boot(evs, B = 400) {
  const by = new Map();
  for (const e of evs) { const a = by.get(e.fight) ?? [0, 0]; a[1]++; if (e.kind === 'flat') a[0]++; by.set(e.fight, a); }
  const cl = [...by.values()];
  if (cl.length < 2) return null;
  let s = 12345;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0), s / 4294967296);
  const vals = [];
  for (let b = 0; b < B; b++) {
    let f = 0, n = 0;
    for (let i = 0; i < cl.length; i++) { const c = cl[Math.floor(rnd() * cl.length)]; f += c[0]; n += c[1]; }
    if (n) vals.push(f / n);
  }
  vals.sort((a, b) => a - b);
  return [vals[Math.floor(0.025 * vals.length)], vals[Math.floor(0.975 * vals.length)]];
}
const cell = (evs) => {
  const cut = evs.filter((e) => e.isBlade && !e.stabCand);
  const n = cut.length, f = cut.filter((e) => e.kind === 'flat').length;
  if (!n) return { n: 0, f: 0, share: null };
  const ci = boot(cut) ?? wilson(f, n);
  return { n, f, share: f / n, lo: ci[0], hi: ci[1] };
};
const fmt = (c) => (c.n ? `${(100 * c.share).toFixed(0).padStart(3)}% [${(100 * c.lo).toFixed(0)}–${(100 * c.hi).toFixed(0)}] n${c.n}` : '—'.padStart(8));
function table(key, title, filt = () => true) {
  console.log(`\n## ${title}  (칼 면 몫 % [판 묶음 95 %] n 사건 — 칼날 · 찌르기 후보 아닌 사건)`);
  console.log(['무기'.padEnd(12), '전체'.padEnd(20), ...CLS.map((c) => c.padEnd(20))].join(' '));
  for (const w of [...new Set(rows.map((r) => r.weapon))]) {
    const R = rows.filter((r) => r.weapon === w && filt(r));
    console.log([w.padEnd(12), fmt(cell(R)).padEnd(20), ...CLS.map((c) => fmt(cell(R.filter((r) => r[key] === c))).padEnd(20))].join(' '));
  }
}
const ALLR = rows;
table('geo', `${SRC} · 칼 길 방향 · 모든 칼날 닿음`);
table('geo', `${SRC} · 칼 길 방향 · 맞음(E ≥ ${STRIKE.minEnergy} J)만`, (r) => r.landed);
if (SRC === 'ai') table('techCls', 'ai · 기술 이름 방향 · 맞음만', (r) => r.landed);
else table('famCls', 'pad · 손가락 길 무리 · 맞음만', (r) => r.landed);
// 찌르기 줄
console.log('\n## 찌르기 후보 (칼끝 축 방향 닿음) — stab 판정 몫 · 칼 면 아님');
for (const w of [...new Set(rows.map((r) => r.weapon))]) {
  const R = ALLR.filter((r) => r.weapon === w && r.stabCand && r.landed);
  console.log(`${w.padEnd(12)} n${R.length} stab ${R.filter((r) => r.kind === 'stab').length}`);
}
// 진단: 칼 면 사건의 어긋남 나눔 (중앙값 |°|)
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).map(Math.abs).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const mean = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
console.log('\n## 진단 (맞음 · 칼날 · 찌르기 아님) — 중앙값: |목표 어긋남| · |따라감 어긋남| · 칼 빠르기⊥ · 몸 빠르기⊥ · 칼날 자리 t · 아래팔 돌림 · 흐름 켬 몫');
for (const w of [...new Set(rows.map((r) => r.weapon))]) {
  for (const sub of ['all', 'flat', 'cut']) {
    const R = ALLR.filter((r) => r.weapon === w && r.landed && r.isBlade && !r.stabCand && (sub === 'all' || (sub === 'flat' ? r.kind === 'flat' : r.kind !== 'flat')));
    if (!R.length) continue;
    const f1 = (x, d = 0) => (x == null ? 'n/a' : x.toFixed(d));
    console.log(`${w.padEnd(12)} ${sub.padEnd(4)} n${String(R.length).padEnd(4)} 목표 ${f1(med(R.map((r) => r.targetErr)))}° · 따라감 ${f1(med(R.map((r) => r.trackErr)))}° · 면 ${f1(med(R.map((r) => r.flatErr)))}° · 칼⊥ ${f1(med(R.map((r) => r.vB)), 1)} · 몸⊥ ${f1(med(R.map((r) => r.vV)), 1)} m/s · t ${f1(med(R.map((r) => r.t)), 2)} · 돌림 ${f1(med(R.map((r) => r.roll)))}° · 흐름 ${f1(100 * mean(R.map((r) => (r.ibFlow ? 1 : 0))))}% · 칼끝 ${f1(med(R.map((r) => r.tip)), 1)} m/s · 칼끼리 뒤 0.125 s ${f1(100 * mean(R.map((r) => (r.sinceClash <= 0.125 ? 1 : 0))))}%`);
  }
}
if (SRC === 'ai') {
  console.log('\n## 판 결과 (시험 무기 쪽): 이김 · 준 심각도 합 · 맞힘 · 공격 수 · 휘두름 칼끝 중앙 (판 평균)');
  for (const w of [...new Set(fights.map((f) => f.weapon))]) {
    const F = fights.filter((f) => f.weapon === w);
    if (!F.length) continue;
    const S = F.map((f) => f.st).filter(Boolean);
    const sum = (k) => S.reduce((a, x) => a + x[k], 0);
    const stTxt = S.length ? ` · 휘두르는 스텝 밧줄 끝 ${(100 * sum('rope') / Math.max(1, sum('sw'))).toFixed(1)}% · 움직이는 칼 날 어긋남 평균 ${((sum('lag') / Math.max(1, sum('mv'))) * R2D).toFixed(1)}° · > 45° ${(100 * sum('lag45') / Math.max(1, sum('mv'))).toFixed(1)}% · 먼 길 뒤집힘 조건 ${(100 * sum('flip') / Math.max(1, sum('mv'))).toFixed(1)}%` : '';
    console.log(`${w.padEnd(12)} 판 ${F.length} 이김 ${(100 * mean(F.map((f) => f.win))).toFixed(0)}% · 준 ${mean(F.map((f) => f.dmgDealt)).toFixed(2)} · 받은 ${mean(F.map((f) => f.dmgTaken)).toFixed(2)} · 맞힘 ${mean(F.map((f) => f.hitsDealt)).toFixed(1)} · 공격 ${mean(F.map((f) => f.attacks ?? 0)).toFixed(1)} · 칼끝 ${(mean(F.map((f) => f.tipPk)) ?? 0).toFixed(1)} m/s${stTxt}`);
  }
}
if (traces.length) {
  console.log(`\n## 자취 — 칼 면 맞음 ${traces.length} 개 (잰 쪽 · 맞기 앞 30 스텝, 2 스텝마다)`);
  for (const T of traces) {
    const r = T.r;
    console.log(`\n# ${T.w} 씨앗 ${T.seed} 스텝 ${r.k} ${r.part} ${r.geo} ea ${r.ea.toFixed(2)} E ${r.energy.toFixed(0)} J 칼⊥ ${r.vB.toFixed(1)} 몸⊥ ${r.vV.toFixed(1)} 목표 ${r.targetErr?.toFixed(0)}° 따라감 ${r.trackErr?.toFixed(0)}° 기술 ${r.tech} ${r.phase}/${r.aiMode}`);
    for (const s of T.ring.filter((_, i, a) => (a.length - 1 - i) % 2 === 0)) console.log(`  ${s.k} pad ${s.pad[0].toFixed(2)},${s.pad[1].toFixed(2)} el ${s.el.toFixed(0)} v70 ${s.v70.toFixed(1)} ea70 ${s.ea70 == null ? ' -  ' : s.ea70.toFixed(2)} lag ${s.lag.toFixed(0)} mov ${s.mov.toFixed(2)} roll ${s.roll.toFixed(0)} wT ${s.wT.toFixed(1)} flow ${s.flow} brake ${s.brake} sw ${s.sw} grip ${s.grip} ${s.tech}/${s.phase}/${s.mode} clash ${s.clash > 999 ? '-' : s.clash}`);
  }
}
console.log(`\n(사건 ${rows.length} · 시험 ${ABL.join(',') || '없음'}${process.env.MONTANTE_HAND ? ' · 쥠 ' + process.env.MONTANTE_HAND : ''})`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ mode: SRC, abl: ABL, args, rows, fights }));
