// ─────────────────────────────────────────────────────────────
//  iberian_finish_arms.mjs — 이베리아 마무리 공격의 팔 관절 재기 (10/24 13:2x 사장님 '이베리아 마무리 공격도 팔 관절이 이상하게 꺾이지 않는지 확인해봐')
//   두 읽기를 같은 잣대로 잰다 — docs/strike/iberian_finish_arms_2026-10-24.md:
//    spin   = 싱지르(휘감아 돌기) 한 바퀴 ~ 받아 멈춤 ~ 따라 지나감 ~ 굳음 (iberian_spin_form.mjs 와 같은 자리 · 곧장 냄)
//    cleave = 대검 마무리 쪼개 내려치기 (greatsword_finish.mjs gsTrial 과 같은 자리 — 누운 상대 · 무릎 꿇은 상대)
//    plunge = 같은 칼로 전 찍기 (FINISH.cleave.player 끔 — 견줌)
//    cuts   = 같은 칼 보통 베기 (손가락 획 — 가로 · 세로 · 사선, 바탕)
//    ai     = 같은 칼 AI 끼리 15 s (보통 싸움 바탕 — 0 번 자리만 잼)
//   잼: 물리 스텝이 끝난 자세(그려지는 자세)마다 — joint_range.mjs armAngles(팔꿈치 부호 있는 굽힘 · 어깨 · 손목) + 아래 덧칸
//    elbowOff · elbowOffO = 아래팔이 팔꿈치 경첩 면 밖으로 나간 각 (경첩 축 옆으로 꺾임 — 0 이어야 함)
//    roll     = 아래팔 경첩 축 ↔ 칼 면 각 (아래팔 엎침 · 뒤침 — HUMAN.forearmRoll 80, 손목 밧줄)
//    gripGap  = 두 손 칼: 빈손(아래팔 끝) ↔ 쥘 자리(칼 원점 + gripAlong) 거리 (m) · cross = 빈손이 칼 든 손보다 칼끝 쪽 (손이 엇갈림)
//    pen      = 팔 넷(위팔 · 아래팔 · 칼 쪽 · 빈 쪽)이 제 몸통(골반 · 배 · 가슴) · 머리에 파고든 깊이 (m — 캡슐 반지름 뺀 가운데 선)
//    spine    = 척추 비틀림 (envelope_check sample — 어깨선 − 엉덩이선)
//   범위 (넘으면 '밖' 스텝으로 셈 — 참고 수): 팔꿈치 과신전 < −5 · 굽힘 > 145 · 경첩 밖 > 5 · 손목 굽힘 · 폄 ±70 (JOINTS.wristFE — 끝 스프링) ·
//    아래팔-칼 > 163 · 굴림 > 80 · 들림 면 > 130 (밧줄 한도 — 밧줄은 한도에 딱 붙어 있어 +2 ~ 3° 여유를 둠: 165 · 82 · 132) · 어깨 폄 > 60 · 들림 면 < −45 (들림 60 ~ 160) ·
//    위팔 돌림 −70 ~ 90 (들림 120 아래) · 척추 ±45 · 두 손 > 0.10 m (쥔 동안) · 파고듦 > 0.03 m (빈팔 위팔은 쉼 자세에서도 가슴 상자와 1 ~ 2 cm 겹침)
//  사용법: node tools/sim/iberian_finish_arms.mjs [--modes=spin,cleave,plunge,cuts,ai] [--weapons=zweihander,flamberge,tizona,durandal]
//          [--starts=tag,ochsR,langort,wechselR,ochsL] [--dirs=0,-1] [--targets=none,stand] [--n=1] [--trace=무기:모드:판번호] [--json=파일]
//   스위치(이 도구 안에서만): --set=SECRET.ibSpin.armRoll=0 처럼 config 값을 바꿔 견준다 (쉼표로 여럿)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, THREE, CONFIG, AI } from './harness_m.mjs';
import { armAngles } from './joint_range.mjs';
import { sample as envSample, partDist } from './envelope_check.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { G as PADS } from '../../src/ai_techniques.js';
import { Combat } from '../../src/combat.js';
import { Fighter } from '../../src/fighter.js';
import { FINISH } from '../../src/finish.js';
import { isMain } from './is_main.mjs';

const R2D = 180 / Math.PI;
// 범위 (도 · m) — 위 머리말
export const RANGE = {
  elbow: [-5, 145], elbowO: [-5, 145], elbowOff: [-5, 5], elbowOffO: [-5, 5], wristFE: [-70, 70], wrist: [-Infinity, 165], roll: [-Infinity, 82],
  shBack: [-Infinity, 60], shPlane: [-45, 132], shRot: [-70, 90], spine: [-45, 45], gripGap: [-Infinity, 0.1], pen: [-Infinity, 0.03],
};
const KEYS = Object.keys(RANGE);
// 한도에 붙은 스텝 (밖은 아니지만 사람 몸으로는 끝까지 꺾인 자세 — 몫 %): 아래팔-칼 ≥ 150 ('135 ~ 160 부터 무리' — HUMAN.gripFlex 주석) · 굴림 ≥ 78 (밧줄 80) ·
//  들림 면 ≥ 128 (밧줄 130) · 팔꿈치 ≤ 3 (다 펴서 잠금) · 두 손 ≥ 0.15 m (쥔 동안)
export const NEAR = {
  wrist150: (s) => s.wrist != null && s.wrist >= 150,
  roll78: (s) => s.roll != null && s.roll >= 78,
  plane128: (s) => s.shPlane != null && s.shPlane >= 128,
  elbow3: (s) => s.elbow != null && s.elbow <= 3,
  grip15: (s) => s.gripping && s.gripGap != null && s.gripGap >= 0.15,
};

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const qOf = (b) => _q.set(b.rotation().x, b.rotation().y, b.rotation().z, b.rotation().w).clone();
const pOf = (b) => new THREE.Vector3(b.translation().x, b.translation().y, b.translation().z);
const capsule = (b) => {
  const s = b.collider(0).shape;
  return { hh: s.halfHeight ?? 0, r: s.radius ?? 0 };
};
// 몸체 축(캡슐 세로 = 몸체 y — alongX 팔도 충돌체가 돌려져 있어 충돌체 틀로 잼)
function segOf(b) {
  const c = b.collider(0);
  const r = c.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const t = c.translation();
  const o = new THREE.Vector3(t.x, t.y, t.z);
  const { hh, r: rad } = capsule(b);
  return { a: new THREE.Vector3(0, -hh, 0).applyQuaternion(q).add(o), b: new THREE.Vector3(0, hh, 0).applyQuaternion(q).add(o), rad };
}
const TORSO = ['pelvis', 'abdomen', 'chest', 'head'];

/** 한 스텝 팔 표본 (읽기만 — 그려지는 자세 = world.step 뒤) */
export function armSample(f) {
  const o = armAngles(f);
  if (!o) return null;
  const B = f.bodies;
  // 경첩 밖 (칼 팔): 아래팔 x 가 위팔 경첩 축 z 쪽으로 기운 각
  const zU = new THREE.Vector3(0, 0, 1).applyQuaternion(qOf(B.uarmS));
  const fx = new THREE.Vector3(1, 0, 0).applyQuaternion(qOf(B.farmS));
  o.elbowOff = Math.asin(THREE.MathUtils.clamp(fx.dot(zU), -1, 1)) * R2D;
  if (B.uarmO && B.farmO) {
    const zO = new THREE.Vector3(0, 0, 1).applyQuaternion(qOf(B.uarmO));
    const fo = new THREE.Vector3(0, -1, 0).applyQuaternion(qOf(B.farmO));
    o.elbowOffO = Math.asin(THREE.MathUtils.clamp(fo.dot(zO), -1, 1)) * R2D;
  } else o.elbowOffO = null;
  if (f.sword && f.armed !== false) {
    const zF = new THREE.Vector3(0, 0, 1).applyQuaternion(qOf(B.farmS));
    const zS = new THREE.Vector3(0, 0, 1).applyQuaternion(qOf(f.sword));
    o.roll = Math.acos(THREE.MathUtils.clamp(zF.dot(zS), -1, 1)) * R2D;
    if (f.weaponCfg.twoHand && B.farmO && f.limbs?.armO > 0.3) {
      const qs = qOf(f.sword);
      const sp = pOf(f.sword);
      const grip = new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(qs).add(sp);
      const hand = new THREE.Vector3(0, -0.135, 0).applyQuaternion(qOf(B.farmO)).add(pOf(B.farmO));
      o.gripGap = hand.distanceTo(grip);
      const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(qs);
      o.cross = Math.sign(hand.clone().sub(sp).dot(ax)) !== Math.sign(f.weaponCfg.gripAlong) && o.gripGap < 0.25; // 빈손이 칼 든 손보다 칼끝 쪽 (쥔 채)
      o.gripping = !!f.gripping;
    } else o.gripGap = null;
  } else o.roll = o.gripGap = null;
  // 팔이 제 몸통 · 머리에 파고듦
  let pen = 0;
  let penAt = null;
  for (const n of ['uarmS', 'farmS', 'uarmO', 'farmO']) {
    const b = B[n];
    if (!b || f.detachedParts?.has?.(n)) continue;
    const s = segOf(b);
    for (const t of TORSO) {
      if (!B[t]) continue;
      // 어깨 관절에 붙은 위팔 머리는 가슴 상자와 늘 겹친다 (관절로 이어진 쌍) — 위팔은 팔꿈치 쪽 절반만 가슴과 견줌
      const i0 = (n === 'uarmS' || n === 'uarmO') && t === 'chest' ? 5 : 0;
      for (let i = i0; i <= 10; i++) {
        const p = s.a.clone().lerp(s.b, i / 10);
        const d = s.rad - partDist(B[t], p);
        if (d > pen) {
          pen = d;
          penAt = `${n}>${t}`;
        }
      }
    }
  }
  o.pen = pen;
  o.penAt = penAt;
  try {
    o.spine = envSample(f).spineTwist;
  } catch {
    o.spine = null;
  }
  return o;
}

/** 범위 밖인가 (null = 이 스텝은 그 칸을 재지 않음) */
export function outOf(k, s) {
  const v = s[k];
  if (v == null || !Number.isFinite(v)) return false;
  if (k === 'shPlane' && s.shPlane == null) return false;
  if (k === 'shRot' && s.shRot == null) return false;
  if (k === 'gripGap' && !s.gripping) return false; // 쥐지 않은 동안(빈손이 아직 뻗는 중)은 두 손 칸을 보지 않는다
  const [lo, hi] = RANGE[k];
  return v < lo || v > hi;
}

/** 단계별 묶음 */
export class Tally {
  constructor() {
    this.ph = new Map();
  }
  add(ph, s, t) {
    if (!s) return;
    let P = this.ph.get(ph);
    if (!P) this.ph.set(ph, (P = { n: 0, min: {}, max: {}, out: {}, first: {}, cross: 0, near: {} }));
    P.n++;
    for (const [k, fn] of Object.entries(NEAR)) if (fn(s)) P.near[k] = (P.near[k] ?? 0) + 1;
    for (const k of KEYS) {
      const v = s[k];
      if (v == null || !Number.isFinite(v)) continue;
      if (k === 'gripGap' && !s.gripping) continue;
      P.min[k] = Math.min(P.min[k] ?? Infinity, v);
      P.max[k] = Math.max(P.max[k] ?? -Infinity, v);
      if (outOf(k, s)) {
        P.out[k] = (P.out[k] ?? 0) + 1;
        P.first[k] ??= t;
      }
    }
    if (s.cross) P.cross++;
  }
  merge(o) {
    for (const [ph, Q] of o.ph) {
      let P = this.ph.get(ph);
      if (!P) this.ph.set(ph, (P = { n: 0, min: {}, max: {}, out: {}, first: {}, cross: 0, near: {} }));
      P.n += Q.n;
      for (const k of Object.keys(NEAR)) if (Q.near?.[k]) P.near[k] = (P.near[k] ?? 0) + Q.near[k];
      P.cross += Q.cross;
      for (const k of KEYS) {
        if (Q.min[k] != null) P.min[k] = Math.min(P.min[k] ?? Infinity, Q.min[k]);
        if (Q.max[k] != null) P.max[k] = Math.max(P.max[k] ?? -Infinity, Q.max[k]);
        if (Q.out[k]) P.out[k] = (P.out[k] ?? 0) + Q.out[k];
      }
    }
  }
}

// ── 판 하나: 싱지르 (iberian_spin_form.mjs 와 같은 자리) ──
function spinPhase(P) {
  const S = P.ibSpin;
  const sec = P.skill.sec;
  if (S) return S.settle ? 'settle' : S.tp < S.pre ? 'pre' : S.free ? 'free' : S.t < S.r ? 'ramp' : 'wind';
  if (sec) return sec.stage === 'stiff' ? 'stiff' : 'follow';
  return 'after';
}
export function spinRun({ weapon, start = 'langort', dir = 0, target = 'stand', gap = 2.3, seed = 7, trace = null }) {
  const { SKILL } = CONFIG;
  const G = newRound({ seed, weapon, weapon2: 'longsword', gap: target === 'none' ? 8 : gap, walls: false });
  const P = G.player;
  const E = G.enemy;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  G.ai.update = () => E.move.set(0, 0);
  E.die = () => {};
  if (target === 'stand') for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  const pad = PADS[start];
  const T = new Tally();
  const base = new Tally();
  let t0 = null;
  let fired = false;
  let tEnd = null;
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    P.move.set(0, 0);
    if (t0 == null) {
      if (G.t > 1.2) P.handOffset.set(pad[0], pad[1]);
      if (G.t > 2.6) {
        const ctx = { ev: 'spin' };
        if (dir) ctx.turnDir = dir;
        fired = P.skill.secret({ S: W.S, ctx });
        t0 = G.t;
      }
    }
  };
  while (G.t < 9) {
    G.step();
    if (t0 == null) {
      if (G.t > 2.0) base.add('stand', armSample(P), G.t);
      continue;
    }
    if (!fired) break;
    const ph = spinPhase(P);
    if (ph === 'after') tEnd ??= G.t;
    if (tEnd != null && G.t - tEnd > 0.6) break;
    if (P.state !== 'stand') {
      T.add('fell', armSample(P), G.t - t0);
      continue;
    }
    const s = armSample(P);
    T.add(ph, s, G.t - t0);
    T.add('all', s, G.t - t0);
    if (trace) trace.push({ t: +(G.t - t0).toFixed(4), ph, ...pick(s) });
  }
  G.world.free();
  return { T, base, fired };
}

// ── 판 하나: 보통 베기 (손가락 획 — 자세 → 반대쪽 자세를 0.2 s 에, 0.8 s 쉼) ──
const STROKES = [
  ['ochsR', 'wechselL'], // 오른 위 → 왼 아래 (사선)
  ['ochsL', 'wechselR'],
  ['langort', 'tag'], // 아래 → 위 (세로 되돌림)
  ['tag', 'langort'], // 위 → 앞 (세로)
];
export function cutsRun({ weapon, seed = 7, gap = 2.3, trace = null }) {
  const { SKILL } = CONFIG;
  const G = newRound({ seed, weapon, weapon2: 'longsword', gap, walls: false });
  const P = G.player;
  const E = G.enemy;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  G.ai.update = () => E.move.set(0, 0);
  E.die = () => {};
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  const T = new Tally();
  // 가로 획 (오른 → 왼 · 왼 → 오른)도 패드 끝점으로
  const H = [[0.32, 0.02], [-0.32, 0.02]];
  const plan = [...STROKES.map(([a, b]) => [PADS[a], PADS[b]]), [H[0], H[1]], [H[1], H[0]]].filter(([a, b]) => a && b);
  let i = 0;
  let k = 0;
  let tk = 1.2;
  const LEG = 0.2;
  G.before = () => {
    P.move.set(0, 0);
    if (k >= plan.length) return;
    const [a, b] = plan[k];
    const tt = G.t - tk;
    if (tt < 0.8) P.handOffset.set(a[0], a[1]);
    else if (tt < 0.8 + LEG) {
      const u = (tt - 0.8) / LEG;
      P.handOffset.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
    } else if (tt < 1.6 + LEG) P.handOffset.set(b[0], b[1]);
    else {
      k++;
      tk = G.t;
    }
  };
  while (k < plan.length && G.t < 30) {
    G.step();
    i++;
    if (G.t < 1.2 || P.state !== 'stand') continue;
    const sw = P.skill.swinging || (P.skill.activity ?? 0) > 0.5;
    const s = armSample(P);
    T.add(sw ? 'swing' : 'guard', s, G.t);
    T.add('all', s, G.t);
    if (trace) trace.push({ t: +G.t.toFixed(4), ph: sw ? 'swing' : 'guard', ...pick(s) });
  }
  G.world.free();
  return { T };
}

// ── 판 하나: AI 끼리 (0 번 자리 — 보통 싸움) ──
export function aiRun({ weapon, seed = 7, secs = 15 }) {
  const G = newRound({ seed, weapon, weapon2: weapon, AI2Class: AI, walls: true });
  const P = G.player;
  const T = new Tally();
  while (G.t < secs && P.alive && G.enemy.alive) {
    G.step();
    if (G.t < 0.5 || P.state !== 'stand') continue;
    const s = armSample(P);
    const sw = P.skill.swinging || (P.skill.activity ?? 0) > 0.5 || (P.skill.thrustPose?.w ?? 0) > 0.05;
    T.add(sw ? 'attack' : 'guard', s, G.t);
    T.add('all', s, G.t);
  }
  G.world.free();
  return { T };
}

// ── 마무리 (쪼개 내려치기 · 찍기): greatsword_finish.mjs gsTrial 을 그대로 부르고, 물리 스텝 뒤(Combat.afterStep)에 0 번 자리를 잰다 ──
let FIN = null; // { T, trace, t0 }
const live = [];
{
  const cs = Fighter.prototype.cacheState;
  Fighter.prototype.cacheState = function (...a) {
    if (FIN && this.index === 0) FIN.P = this;
    return cs.apply(this, a);
  };
  const as = Combat.prototype.afterStep;
  Combat.prototype.afterStep = function (...a) {
    const r = as.apply(this, a);
    if (FIN?.P) {
      const P = FIN.P;
      const tp = P.skill.tap;
      if (tp?.down && P.state === 'stand') {
        const ph = tp.ended ? 'end' : tp.go ? 'strike' : tp.upDone ? 'charge' : 'raise';
        FIN.t = (FIN.t ?? 0) + DT;
        const s = armSample(P);
        FIN.T.add(ph, s, FIN.t);
        FIN.T.add('all', s, FIN.t);
        if (FIN.trace) FIN.trace.push({ t: +FIN.t.toFixed(4), ph, ...pick(s) });
      }
    }
    return r;
  };
}
export async function finishRun({ weapon, scen = 'down', guard = '쟁기', dist = 1.1, fall = 'toward', seed = 517, cleave = true, trace = null }) {
  const { gsTrial } = await import('./greatsword_finish.mjs');
  const keep = FINISH.cleave.player;
  FINISH.cleave.player = cleave;
  FIN = { T: new Tally(), trace, P: null };
  let r;
  try {
    r = gsTrial({ weapon, scen, guard, dist, fall, seed, win: 4 });
  } finally {
    FINISH.cleave.player = keep;
  }
  const T = FIN.T;
  FIN = null;
  return { T, r };
}

function pick(s) {
  const o = {};
  for (const k of [...KEYS, 'elbowCmd', 'shElev', 'twistLag', 'wristDev', 'penAt', 'cross', 'gripping']) {
    const v = s[k];
    o[k] = typeof v === 'number' ? +v.toFixed(k === 'gripGap' || k === 'pen' ? 3 : 1) : v;
  }
  return o;
}

// ── 표 ──
const fmt = (P, k) => {
  if (P.min[k] == null) return '-';
  const d = k === 'gripGap' || k === 'pen' ? 2 : 0;
  const lo = P.min[k].toFixed(d);
  const hi = P.max[k].toFixed(d);
  const o = P.out[k] ? ` **${P.out[k]}**` : '';
  return `${lo} ~ ${hi}${o}`;
};
export function table(label, T, phases) {
  const L = [];
  for (const ph of phases ?? [...T.ph.keys()]) {
    const P = T.ph.get(ph);
    if (!P) continue;
    L.push(`| ${label} | ${ph} | ${P.n} | ${KEYS.map((k) => fmt(P, k)).join(' | ')} | ${P.cross} | ${Object.keys(NEAR).map((k) => Math.round((100 * (P.near[k] ?? 0)) / P.n)).join(' · ')} |`);
  }
  return L;
}
export const HEAD = `| 판 | 단계 | 스텝 | ${KEYS.map((k) => `${k} [${RANGE[k].map((x) => (Number.isFinite(x) ? x : '')).join('~')}]`).join(' | ')} | 손 엇갈림 | 한도에 붙은 몫 % (${Object.keys(NEAR).join(' · ')}) |\n|---|---|---|${KEYS.map(() => '---|').join('')}---|---|`;

if (isMain(import.meta.url)) {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) throw new Error(`알 수 없는 인자 ${a}`);
    args[m[1]] = m[2] ?? true;
  }
  const list = (k, d) => String(args[k] ?? d).split(',').filter(Boolean);
  if (args.set) {
    for (const kv of String(args.set).split(',')) {
      const [path, val] = kv.split('=');
      const ks = path.split('.');
      let o = ks[0] === 'FINISH' ? FINISH : CONFIG[ks[0]];
      for (const k of ks.slice(1, -1)) o = o[k];
      o[ks.at(-1)] = isNaN(+val) ? val : +val;
    }
  }
  const modes = list('modes', 'spin,cleave,cuts');
  const weapons = list('weapons', 'zweihander,flamberge,tizona,durandal');
  const starts = list('starts', 'tag,ochsR,langort,wechselR,ochsL');
  const dirs = list('dirs', '0,-1').map(Number);
  const targets = list('targets', 'none,stand');
  const N = +(args.n ?? 1);
  const [tw, tm, ti] = String(args.trace ?? '').split(':');
  const out = {};
  console.log(`팔 관절 재기 · 무기 ${weapons.join(',')} · 모드 ${modes.join(',')}${args.set ? ` · set ${args.set}` : ''}`);
  console.log(HEAD);
  for (const weapon of weapons) {
    for (const mode of modes) {
      const tot = new Tally();
      let idx = 0;
      const traceOf = () => (tw === weapon && tm === mode && +ti === idx ? [] : null);
      const runs = [];
      if (mode === 'spin') {
        for (const target of targets) for (const dir of dirs) for (const start of starts) for (let s = 0; s < N; s++) {
          const tr = traceOf();
          const r = spinRun({ weapon, start, dir, target, seed: 7 + s, trace: tr });
          tot.merge(r.T);
          runs.push({ start, dir, target, seed: 7 + s, T: r.T });
          if (tr) out.trace = { weapon, mode, idx, start, dir, target, rows: tr };
          idx++;
        }
      } else if (mode === 'cuts') {
        for (let s = 0; s < N; s++) {
          const tr = traceOf();
          const r = cutsRun({ weapon, seed: 7 + s, trace: tr });
          tot.merge(r.T);
          if (tr) out.trace = { weapon, mode, idx, rows: tr };
          idx++;
        }
      } else if (mode === 'ai') {
        for (let s = 0; s < N * 2; s++) tot.merge(aiRun({ weapon, seed: 11 + s }).T);
      } else if (mode === 'cleave' || mode === 'plunge') {
        const sc = [];
        for (const guard of ['쟁기', '지붕']) for (const dist of [0.8, 1.1, 1.4]) for (const fall of ['toward', 'away', 'left', 'right']) sc.push({ scen: 'down', guard, dist, fall });
        for (const dist of [1.4, 1.6]) for (const guard of ['쟁기', '지붕']) sc.push({ scen: 'kneel', guard, dist });
        for (const o of sc) for (let s = 0; s < N; s++) {
          const tr = traceOf();
          const r = await finishRun({ weapon, ...o, seed: 517 + 17 * s + Math.round(o.dist * 100), cleave: mode === 'cleave', trace: tr });
          tot.merge(r.T);
          runs.push({ ...o, T: r.T, hit: r.r.hit, go: r.r.go });
          if (tr) out.trace = { weapon, mode, idx, ...o, rows: tr };
          idx++;
        }
      }
      for (const l of table(`${weapon} ${mode}`, tot)) console.log(l);
      // 밖 스텝이 있는 판 (어느 판 · 어느 칸)
      const bad = runs.map((r) => ({ ...r, out: [...r.T.ph.entries()].filter(([ph]) => ph !== 'all').flatMap(([ph, P]) => Object.entries(P.out).map(([k, c]) => `${ph}:${k}×${c}@${P.first[k]?.toFixed(2)}`)) })).filter((r) => r.out.length);
      if (bad.length && args.bad) for (const r of bad) console.log(`   밖: ${JSON.stringify({ start: r.start, dir: r.dir, target: r.target, scen: r.scen, guard: r.guard, dist: r.dist, fall: r.fall })} ${r.out.join(' ')}`);
      out[`${weapon}|${mode}`] = Object.fromEntries([...tot.ph.entries()]);
    }
  }
  if (out.trace) {
    console.log(`\n추적 ${out.trace.weapon} ${out.trace.mode} #${out.trace.idx} ${JSON.stringify({ start: out.trace.start, dir: out.trace.dir, target: out.trace.target, scen: out.trace.scen })}`);
    const cols = ['t', 'ph', 'elbow', 'elbowCmd', 'elbowO', 'elbowOff', 'wristFE', 'wrist', 'roll', 'shElev', 'shBack', 'shPlane', 'shRot', 'spine', 'gripGap', 'pen', 'penAt'];
    console.log(cols.join('\t'));
    const every = +(args.every ?? 4);
    out.trace.rows.forEach((r, i) => {
      if (i % every === 0) console.log(cols.map((c) => r[c] ?? '-').join('\t'));
    });
  }
  if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
}
