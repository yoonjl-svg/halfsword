// ─────────────────────────────────────────────────────────────
//  wrist_audit.mjs — 손목 검사 (10/24 15:5x 사장님 '손목 고침에 새 작업자 붙이고 다른 동작에서도 저런지 검사해' — docs/strike/wrist_audit_2026-10-24.md)
//   안다레 리솔루토 런지 옆 그림이 '주먹 아래쪽으로 칼날이 나오게 거꾸로 쥔 것' 같다는 지적 → 같은 잣대로 런지 · 탭 찌르기 · 격살 · 고노센 · 유파 자세 · 기술 길 · AI 끼리 싸움을 잰다.
//   잼 (물리 스텝이 끝난 자세 = 그려지는 자세 — joint_range.mjs armAngles 를 그대로):
//    elbow = 칼 팔꿈치 굽힘 (0 = 곧음)
//    wrist = 아래팔-칼 각 (0 = 칼이 아래팔을 곧게 이음 · 90 = 직각 · 설계 칸 HUMAN.gripFlex 163 · '135 ~ 160 부터 무리' — 봉투 손목 칸)
//    dev   = 손 면 안 치우침 (°): 아래팔 방향을 칼 틀(x = 날 · y = 칼끝 · z = 칼 면)로 옮겨 칼 면(x·y) 안 각 φ = atan2(f·y, f·x) 를 재고 dev = 90 − φ.
//            칼 틀은 손 틀이다(주먹은 칼에 붙어 있고 손목 굴림 밧줄 — 아래팔 경첩 축 ↔ 칼 면 ≤ 80 — 이 엎침 · 뒤침이다 · fighter.js gripConeOn). 굴림 0 에서
//            + 90 = 쥔 자세(칼이 아래팔에 직각 · 아래팔이 날 쪽 — HEMA 망치 쥠 '날을 마디 줄에') · 0 = 칼이 아래팔을 곧게 이음 · + = 엄지 쪽(요측 — 칼끝이 엄지 위로 젖혀짐) ·
//            − = 새끼 쪽(척측). 사람 손목은 아래팔 줄에서 새끼 쪽으로 척측 편위 30°(AAOS — docs/motion/grip_rules_2026-10-02.md ③)까지.
//            −45 아래 = 칼이 아래팔 줄보다 '새끼 쪽 수직'에 더 가까움 → 주먹 아래(새끼 쪽)로 칼날이 나오는 거꾸로 쥔 꼴 (이 도구의 '거꾸로' — 두 방향의 가운데라 새 수 아님) ·
//            굴림(엎침 · 뒤침)과 무관하게 손 면에서 잰다 (joint_range wristDev 는 아래팔 경첩 면에서 재어 엎친 손(황소 · 걸이)은 새끼 쪽으로 잘못 읽힘 — devF 로 함께 남김)
//    fe    = 손목 굽힘 · 폄 (아래팔이 칼 면 밖으로 — 손바닥 · 손등 쪽) · roll = 아래팔 굴림 (아래팔 경첩 축 ↔ 칼 면 — 손목 밧줄 HUMAN.forearmRoll 80)
//    along = 손(손목)이 어깨 앞으로 나간 거리 ÷ 팔 길이 (ARM.upper + ARM.fore 0.57 m · '앞' = 내 가슴 → 상대 가슴 가로 방향) · reach = 어깨 ↔ 손 거리 ÷ 팔 길이
//    up    = 아래팔이 위로 선 몫 (아래팔 방향 세로 성분 — 0.5 넘으면 아래팔이 30° 넘게 섬)
//   묶음: 동작마다 스텝 수 · 아래팔-칼 최대 · > 135 몫 · dev 최소 · < −30 몫(사람 척측 한도 밖) · 거꾸로 몫(dev < −45 · 아래팔이 칼 면에서 45° 안) · 거꾸로이며 아래팔이 섬 몫 · along · 팔꿈치 · 굽힘·폄 · 굴림
//   거꾸로 보임: 'Y' = 스텝 10 % 이상이 '거꾸로 · 아래팔 섬'(사장님 그림 꼴) 또는 아래팔-칼 > 135 · '△' = 새끼 쪽이나 아래팔은 눕거나 내려감 · 'N'
//  사용법: node tools/sim/wrist_audit.mjs [--modes=lunge,gyeoksal,gonosen,tap,guards,cuts,ai] [--weapons=…] [--set=SECRET.thrustArm=0] [--json=파일] [--trace=lunge:rapier]
//   lunge    = 안다레 리솔루토 런지 (rapier · dartagnan · balisarda) — 멈춘 상대 · 가슴 사이 1.8 · 2.0 · 2.2 · 2.4 m · 창을 바로 열고 톡 (italian_risoluto.test.mjs 와 같은 자리)
//              단계: guard(내기 전 0.3 s) · prep(찌르기 첫 자리로 옮김) · thrust(찌르는 토막 — 맞힘) · back(뽑음 — thrustArm 1 이면 뻗은 채 머묾) · stiff(굳음 0.6 s) · recover(앞발 거둠) · after · hit(맞힌 스텝의 그려지는 자세)
//   gyeoksal = 동방 격살 네 칼 (허파 찌르기 · 머리 · 팔 · 다리 — qinggang · moye) · gonosen = 일본 고노센 발도 (uchigatana · monohoshizao · 사람 길)
//   tap      = 탭 찌르기 skill.thrust (쟁기 · 황소 · 긴 자세에서 — 멈춘 상대 1.8 m) · guards = 무기 자세표(guardPose.table · 없으면 바탕 표) 자리마다 새 판에서 1.4 s 붙잡고 끝 0.6 s
//   cuts     = 유파 기술 길(TRADITIONS[유파].tech · unique 의 from → path — 준비 0.6 s · 길 토막마다 0.2 s · 끝 0.4 s, 손가락 획과 같은 꼴) · ai = AI 끼리 15 s × 2 (기술 이름 · 자세 이름으로 묶음)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, THREE, CONFIG, AI } from './harness_m.mjs';
import { armAngles } from './joint_range.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { TRADITIONS, playerSecretDef } from '../../src/schools.js';
import { TECH } from '../../src/ai_techniques.js';
import { GUARD_BASE } from '../../src/guards.js';
import { isMain } from './is_main.mjs';

const { ARM } = CONFIG;
const R2D = 180 / Math.PI;
export const ARM_LEN = ARM.upper + ARM.fore; // 팔 길이 (m)
export const REV = -45; // 거꾸로: 칼이 아래팔 줄(0)보다 새끼 쪽 수직(−90)에 더 가까움 — 두 방향의 가운데
export const ULNAR = -30; // 사람 척측 편위 한도 (AAOS 30 — grip_rules ③)
export const WRIST_HI = 135; // 아래팔-칼 '무리' 시작 (봉투 손목 칸 135 ~ 160)
export const FE_IN = 45; // 거꾸로 셈은 아래팔이 칼 면에서 45° 안(굽힘 · 폄보다 치우침이 큰 때)만 — 두 방향의 가운데
export const UP = 0.5; // 아래팔이 섬: 아래팔 방향 세로 몫 > 0.5 (수평에서 30° 넘게 위)

const V = (t) => new THREE.Vector3(t.x, t.y, t.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);

/** 한 스텝 손목 표본 (읽기만). 칼이 없거나 칼 팔이 잘렸으면 null */
export function wristSample(f) {
  const o = armAngles(f);
  if (!o || o.wrist == null || !f.sword || f.armed === false) return null;
  const B = f.bodies;
  const ch = B.chest;
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], (f.side ?? 1) * ARM.shoulder[2]).applyQuaternion(Q(ch.rotation())).add(V(ch.translation()));
  const qf = Q(B.farmS.rotation());
  const W = new THREE.Vector3(0.13, 0, 0).applyQuaternion(qf).add(V(B.farmS.translation()));
  let fwd;
  if (f.foe?.bodies?.chest) {
    const fc = V(f.foe.bodies.chest.translation());
    fwd = new THREE.Vector3(fc.x - ch.translation().x, 0, fc.z - ch.translation().z);
  } else fwd = f.forward(new THREE.Vector3()).setY(0);
  fwd.normalize();
  const fx = new THREE.Vector3(1, 0, 0).applyQuaternion(qf);
  const zF = new THREE.Vector3(0, 0, 1).applyQuaternion(qf);
  const qs = Q(f.sword.rotation());
  const xS = new THREE.Vector3(1, 0, 0).applyQuaternion(qs);
  const yS = new THREE.Vector3(0, 1, 0).applyQuaternion(qs);
  const zS = new THREE.Vector3(0, 0, 1).applyQuaternion(qs);
  let dev = 90 - Math.atan2(fx.dot(yS), fx.dot(xS)) * R2D; // 손 면 안 (위 머리말)
  if (dev > 180) dev -= 360;
  if (dev <= -180) dev += 360;
  return {
    elbow: o.elbow,
    wrist: o.wrist,
    dev,
    devF: o.wristDev,
    fe: Math.asin(THREE.MathUtils.clamp(fx.dot(zS), -1, 1)) * R2D,
    roll: Math.acos(THREE.MathUtils.clamp(zF.dot(zS), -1, 1)) * R2D,
    along: W.clone().sub(S).dot(fwd) / ARM_LEN,
    reach: W.distanceTo(S) / ARM_LEN,
    up: fx.y,
  };
}

/** 동작별 묶음 */
export class WristTally {
  constructor() {
    this.k = new Map();
  }
  add(key, s) {
    if (!s) return;
    let P = this.k.get(key);
    if (!P) this.k.set(key, (P = { n: 0, wMax: -Infinity, w135: 0, devMin: Infinity, ulnar: 0, rev: 0, revUp: 0, aMin: Infinity, aMax: -Infinity, aSum: 0, eMax: -Infinity, wSum: 0, devSum: 0, feMax: 0, rollSum: 0 }));
    P.n++;
    P.wMax = Math.max(P.wMax, s.wrist);
    P.wSum += s.wrist;
    P.devSum += s.dev;
    if (s.wrist > WRIST_HI) P.w135++;
    P.devMin = Math.min(P.devMin, s.dev);
    if (s.dev < ULNAR) P.ulnar++;
    const rev = s.dev < REV && Math.abs(s.fe) < FE_IN; // 손 면 안 몫이 큰 때만 (아래팔이 칼 면에 거의 수직이면 면 안 각은 뜻이 없음)
    if (rev) P.rev++;
    if (rev && s.up > UP) P.revUp++;
    P.aMin = Math.min(P.aMin, s.along);
    P.aMax = Math.max(P.aMax, s.along);
    P.aSum += s.along;
    P.eMax = Math.max(P.eMax, s.elbow);
    P.feMax = Math.max(P.feMax, Math.abs(s.fe));
    P.rollSum += s.roll;
  }
  merge(o, pre = '') {
    for (const [k, Q] of o.k) {
      const key = pre + k;
      let P = this.k.get(key);
      if (!P) {
        this.k.set(key, { ...Q });
        continue;
      }
      P.n += Q.n;
      for (const f of ['w135', 'ulnar', 'rev', 'revUp', 'aSum', 'wSum', 'devSum', 'rollSum']) P[f] += Q[f];
      P.feMax = Math.max(P.feMax, Q.feMax);
      P.wMax = Math.max(P.wMax, Q.wMax);
      P.devMin = Math.min(P.devMin, Q.devMin);
      P.aMin = Math.min(P.aMin, Q.aMin);
      P.aMax = Math.max(P.aMax, Q.aMax);
      P.eMax = Math.max(P.eMax, Q.eMax);
    }
  }
  /** 거꾸로 보이나 (스텝 몫 10 % 이상 — 순간이 아닌 '꽤 오래'): 'Y' = 아래팔이 선 채 칼이 새끼 쪽(거꾸로 · 아래팔 섬) 또는 아래팔-칼 > 135 · '△' = 새끼 쪽이나 아래팔은 눕거나 내려감 · 'N' */
  static flag(P) {
    if (!P.n) return 'N';
    if (P.revUp / P.n >= 0.1 || P.w135 / P.n >= 0.1) return 'Y';
    return P.rev / P.n >= 0.1 ? '△' : 'N';
  }
  rows(label) {
    const L = [];
    for (const [k, P] of this.k) {
      const pc = (x) => Math.round((100 * x) / P.n);
      L.push({ label, key: k, n: P.n, wMax: +P.wMax.toFixed(0), wAvg: +(P.wSum / P.n).toFixed(0), w135: pc(P.w135), devMin: +P.devMin.toFixed(0), devAvg: +(P.devSum / P.n).toFixed(0), ulnar: pc(P.ulnar), rev: pc(P.rev), revUp: pc(P.revUp), aMin: +P.aMin.toFixed(2), aAvg: +(P.aSum / P.n).toFixed(2), aMax: +P.aMax.toFixed(2), eMax: +P.eMax.toFixed(0), feMax: +P.feMax.toFixed(0), rollAvg: +(P.rollSum / P.n).toFixed(0), flag: WristTally.flag(P) });
    }
    return L;
  }
}

function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  const sk = f.skill;
  sk.prev?.set(xy[0], xy[1]);
  sk.aim?.set(xy[0], xy[1]);
  sk.aimRaw?.set(xy[0], xy[1]);
  sk.anchor?.set(xy[0], xy[1]);
  sk.aimVel?.set(0, 0);
  sk.vel?.set(0, 0);
  sk.follow?.set(0, 0);
}

/** 멈춘 상대 판 (상대 AI 끔 · 서로 foe) */
function stillRound(weapon, { gap = 2.2, seed = 9, foeW = 'longsword' } = {}) {
  const g = newRound({ weapon, weapon2: foeW, gap, seed });
  const p = g.player;
  const e = g.enemy;
  g.ai.update = () => {};
  p.foe = e;
  e.foe = p;
  return g;
}

/** 운동학 비기(연환 틀) 단계: 지금 토막 (그려지는 자세는 지난 스텝 afterStep 이 놓은 자리 — 단계도 지난 스텝 값으로 붙인다) */
function comboPhase(p) {
  const I = p.iai;
  if (I?.kind !== 'combo') return null;
  const sg = I.segs?.[I.si];
  if (!sg) return 'prep';
  if (sg.cut) return 'thrust';
  return I.segs.slice(0, I.si).some((s) => s.cut) ? 'back' : 'prep';
}

// ── 런지 (안다레 리솔루토) ──
export function lungeRun(weapon, { gap = 2.2, seed = 9, trace = null } = {}) {
  const g = stillRound(weapon, { gap, seed });
  const p = g.player;
  const e = g.enemy;
  const T = new WristTally();
  let hit = null;
  let res = null;
  try {
    const n0 = Math.round((CONFIG.ARENA.startHold + 0.3) / DT);
    for (let i = 0; i < n0; i++) {
      g.step();
      if (i >= n0 - Math.round(0.3 / DT)) T.add('guard', wristSample(p));
    }
    const pg = new PlayerParryGuard(p, e);
    p.stamina.controller = pg;
    const ps = new PlayerSecretWatch(p, e);
    ps.openWindow({ ev: 'risoluto', path: 'close', held: 0.6 });
    if (!p.skill.secret(ps.fire())) return { T, hit: null, res: null, fired: false };
    let ph = 'prep';
    let hitSeen = false;
    let stiffEnd = null;
    let lastThrust = null;
    for (let i = 0; i < Math.round(2.4 / DT); i++) {
      g.step();
      const s = wristSample(p);
      const sec = p.skill.sec;
      const cur = comboPhase(p);
      // 그려지는 자세 = 지난 스텝이 놓은 자리 → 단계는 지난 스텝 값(ph)
      let label = ph;
      if (!cur && !p.iai) {
        if (sec?.stage === 'stiff') label = 'stiff';
        else if (p.gait?.req?.fwd < 0) label = 'recover';
        else label = 'after';
      }
      if (label === 'thrust') lastThrust = s;
      if (hitSeen && !hit) hit = s; // 맞힌 스텝 다음 스텝에 그 자리가 그려진다
      if (p.iai?.hitM) hitSeen = true;
      T.add(label, s);
      if (trace) trace.push({ t: +(i * DT).toFixed(4), ph: label, ...Object.fromEntries(Object.entries(s ?? {}).map(([k, v]) => [k, +v.toFixed(2)])), gap: +p.foeDistance().toFixed(2) });
      res ??= sec?.lungeRes ?? null;
      ph = cur ?? ph;
      if (!sec && stiffEnd == null && i > 2) stiffEnd = i;
      if (stiffEnd != null && i - stiffEnd > Math.round(0.6 / DT)) break;
    }
    hit ??= lastThrust;
    if (hit) T.add('hit', hit);
    return { T, hit, res: res ?? p.instantResult, fired: true };
  } finally {
    g.world.free();
  }
}

// ── 격살 (동방 — 네 칼) ──
export function gyeoksalRun(weapon, stance, { gap = 1.35, seed = 1 } = {}) {
  const g = stillRound(weapon, { gap, seed });
  const p = g.player;
  const T = new WristTally();
  try {
    p.skill.autoGuard = true;
    while (g.t < 1.0) g.step();
    T.add('guard', wristSample(p));
    if (!p.skill.secret({ S: TRADITIONS.chinese.playerSecret, ctx: { slot: stance, stance } })) return { T, fired: false };
    let ph = 'prep';
    for (let i = 0; i < Math.round(1.5 / DT) && (p.skill.sec || p.iai); i++) {
      g.step();
      const cur = comboPhase(p);
      const label = !cur && !p.iai ? (p.skill.sec?.stage === 'stiff' || p.iaiHoldT > 0 ? 'stiff' : 'after') : ph === 'thrust' ? 'cut' : ph;
      T.add(label, wristSample(p));
      ph = cur ?? ph;
    }
    return { T, fired: true, res: p.instantResult };
  } finally {
    g.world.free();
  }
}

// ── 고노센 발도 (일본 — 사람 길) ──
export function gonosenRun(weapon, { gap = 2.0, seed = 7 } = {}) {
  const g = stillRound(weapon, { gap, seed });
  const p = g.player;
  const T = new WristTally();
  try {
    p.skill.autoGuard = true;
    while (g.t < 1.0) g.step();
    T.add('guard', wristSample(p));
    const S = playerSecretDef('japanese');
    if (!p.skill.secret({ S, ctx: {} })) return { T, fired: false };
    for (let i = 0; i < Math.round(1.8 / DT) && (p.skill.sec || p.iai || p.iaiHoldT > 0); i++) {
      g.step();
      const I = p.iai;
      const label = I ? (I.kind === 'iai' ? ((I.u ?? 0) < (I.ab ?? 0) ? 'draw' : 'cut') : I.kind) : p.iaiHoldT > 0 ? 'stiff' : 'after';
      T.add(label, wristSample(p));
    }
    return { T, fired: true, res: p.instantResult };
  } finally {
    g.world.free();
  }
}

// ── 탭 찌르기 (skill.thrust) ──
const TAP_PADS = { pflug: [0.18, -0.28], ochs: [0.22, 0.26], langort: [0.0, 0.03] };
export function tapRun(weapon, guard, { gap = 1.8, seed = 311 } = {}) {
  const g = stillRound(weapon, { gap, seed });
  const p = g.player;
  const T = new WristTally();
  try {
    p.skill.autoGuard = true;
    while (g.t < 1.4) {
      setHand(p, TAP_PADS[guard]);
      g.step();
    }
    T.add('guard', wristSample(p));
    if (!p.skill.thrust()) return { T, fired: false };
    for (let i = 0; i < Math.round(1.0 / DT) && p.skill.tap; i++) {
      g.step();
      const tp = p.skill.tap;
      if (!tp) break;
      const K = tp.K;
      const label = tp.t < K.aim ? 'aim' : tp.t < K.aim + K.extend ? 'extend' : tp.t < K.aim + K.extend + K.hold ? 'hold' : 'recover';
      T.add(label, wristSample(p));
    }
    return { T, fired: true };
  } finally {
    g.world.free();
  }
}

// ── 자세표 (무기 guardPose.table — 없으면 롱소드 바탕 표 GUARD_BASE) · 자세마다 새 판(앞 자세의 손목 꼬임을 이어받지 않게): 1.4 s 붙잡고 끝 0.6 s ──
//  seq = true 면 한 판에서 표 차례로 1.2 s 씩 (자세 사이를 옮겨 다닐 때 칼이 손목 둘레로 뒤집혀 걸린 채 남는지 — 참고)
export function guardsRun(weapon, { seed = 7, seq = false } = {}) {
  const T = new WristTally();
  const probe = stillRound(weapon, { gap: 2.6, seed });
  const table = (probe.player.guardPose.table ?? GUARD_BASE).filter((G) => G?.pad && !G.finish);
  probe.world.free();
  const hold = (g, p, G, t0, t1) => {
    while (g.t < t1) {
      setHand(p, G.pad);
      g.step();
      if (g.t >= t1 - 0.6 && p.state === 'stand') T.add(G.name, wristSample(p));
    }
  };
  if (seq) {
    const g = stillRound(weapon, { gap: 2.6, seed });
    try {
      g.player.skill.autoGuard = true;
      while (g.t < 0.8) g.step();
      for (const G of table) hold(g, g.player, G, g.t, g.t + 1.2);
    } finally {
      g.world.free();
    }
    return { T };
  }
  for (const G of table) {
    const g = stillRound(weapon, { gap: 2.6, seed });
    try {
      g.player.skill.autoGuard = true;
      hold(g, g.player, G, 0, 1.4);
    } finally {
      g.world.free();
    }
  }
  return { T };
}

// ── 기술 길 (유파 기술 · 고유 동작 — 손가락 획과 같은 꼴) ──
function techList(trad) {
  const S = TRADITIONS[trad];
  const tech = (S?.tech ?? TECH).filter((t) => t.from && t.path?.length);
  const uniq = (S?.unique ?? []).filter((t) => t.from && t.path?.length);
  const out = [];
  const seen = new Set();
  for (const t of [...tech, ...uniq]) {
    if (seen.has(t.name)) continue;
    seen.add(t.name);
    out.push(t);
  }
  return out;
}
export function cutsRun(weapon, { seed = 7, only = null } = {}) {
  const g = stillRound(weapon, { gap: 2.6, seed });
  const p = g.player;
  const T = new WristTally();
  const trad = p.swordArt?.tradition ?? 'german';
  try {
    p.skill.autoGuard = true;
    while (g.t < 0.8) g.step();
    for (const t of techList(trad)) {
      if (only && !only.includes(t.name)) continue;
      const pts = [t.from, ...t.path];
      const LEG = 0.2;
      let t0 = g.t;
      while (g.t < t0 + 0.6) {
        setHand(p, t.from);
        g.step();
      }
      T.add(`${t.name}:ready`, wristSample(p));
      for (let k = 1; k < pts.length; k++) {
        t0 = g.t;
        const a = pts[k - 1];
        const b = pts[k];
        while (g.t < t0 + LEG) {
          const u = Math.min(1, (g.t - t0) / LEG);
          p.handOffset.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
          p.inputActive = true;
          g.step();
          if (p.state === 'stand') T.add(`${t.name}:${t.kind === 'thrust' ? 'thrust' : 'cut'}`, wristSample(p));
        }
      }
      t0 = g.t;
      while (g.t < t0 + 0.4) {
        p.inputActive = false;
        g.step();
        if (p.state === 'stand') T.add(`${t.name}:end`, wristSample(p));
      }
      if (p.state !== 'stand') break;
    }
    return { T, trad };
  } finally {
    g.world.free();
  }
}

// ── AI 끼리 (보통 싸움 — 두 자리 모두 · 기술 이름 · 자세 이름으로 묶음) ──
export function aiRun(weapon, { seed = 11, secs = 15 } = {}) {
  const g = newRound({ seed, weapon, weapon2: weapon, AI2Class: AI, walls: true });
  const T = new WristTally();
  const ais = [g.ai2 ?? null, g.ai].filter(Boolean);
  try {
    while (g.t < secs && g.player.alive && g.enemy.alive) {
      g.step();
      if (g.t < 0.5) continue;
      for (const f of [g.player, g.enemy]) {
        if (f.state !== 'stand') continue;
        const ai = ais.find((a) => a.me === f);
        const s = wristSample(f);
        let key;
        if (f.iai) key = `secret:${f.iai.kind}`;
        else if (f.skill.tap) key = 'tapThrust';
        else if (ai?.mode === 'attack' && ai.tech) key = `${ai.tech.name}:${ai.phase === 'windup' ? 'ready' : ai.tech.kind === 'thrust' ? 'thrust' : 'cut'}`;
        else {
          const i = f.guardPose?.nearest;
          key = `자세:${f.guardPose?.table?.[i]?.name ?? '?'}`;
        }
        T.add(key, s);
      }
    }
    return { T };
  } finally {
    g.world.free();
  }
}

// ── 표 ──
export const HEAD = '| 판 | 동작 · 단계 | 스텝 | 아래팔-칼 최대 · 평균 | > 135 % | dev 최소 · 평균 | < −30 % | < −45 % (거꾸로) | 거꾸로 · 아래팔 섬 % | 손 앞 (팔 길이) 최소 · 평균 · 최대 | 팔꿈치 최대 | 굽힘·폄 최대 · 굴림 평균 | 거꾸로 보임 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|';
export function fmtRow(r) {
  return `| ${r.label} | ${r.key} | ${r.n} | ${r.wMax} · ${r.wAvg} | ${r.w135} | ${r.devMin} · ${r.devAvg} | ${r.ulnar} | ${r.rev} | ${r.revUp} | ${r.aMin} · ${r.aAvg} · ${r.aMax} | ${r.eMax} | ${r.feMax} · ${r.rollAvg} | ${r.flag === 'Y' ? '**Y**' : r.flag} |`;
}

if (isMain(import.meta.url)) {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) throw new Error(`알 수 없는 인자 ${a}`);
    args[m[1]] = m[2] ?? true;
  }
  if (args.set) {
    for (const kv of String(args.set).split(',')) {
      const [path, val] = kv.split('=');
      const ks = path.split('.');
      let o = CONFIG[ks[0]];
      for (const k of ks.slice(1, -1)) o = o[k];
      o[ks.at(-1)] = isNaN(+val) ? val : +val;
    }
  }
  const modes = String(args.modes ?? 'lunge,gyeoksal,gonosen,tap,guards,cuts,ai').split(',');
  const pick = (d) => (args.weapons ? String(args.weapons).split(',') : d);
  const out = [];
  const flaggedOnly = !!args.flagged;
  const print = (label, T) => {
    for (const r of T.rows(label)) {
      out.push(r);
      if (!flaggedOnly || r.flag !== 'N') console.log(fmtRow(r));
    }
  };
  console.log(`손목 검사${args.set ? ` · set ${args.set}` : ''} — 거꾸로 = dev < ${REV}° (칼이 새끼 쪽) · 사람 척측 한도 ${ULNAR}° · 아래팔-칼 무리 > ${WRIST_HI}°`);
  console.log(HEAD);
  const [trM, trW] = String(args.trace ?? '').split(':');
  for (const mode of modes) {
    if (mode === 'lunge') {
      for (const w of pick(['rapier', 'dartagnan', 'balisarda'])) {
        const tot = new WristTally();
        const hits = [];
        for (const gap of [1.8, 2.0, 2.2, 2.4]) {
          const tr = trM === 'lunge' && trW === w && gap === 2.2 ? [] : null;
          const r = lungeRun(w, { gap, trace: tr });
          tot.merge(r.T);
          if (r.hit) hits.push({ gap, ...Object.fromEntries(Object.entries(r.hit).map(([k, v]) => [k, +v.toFixed(2)])), hitOk: !!r.res?.hit, part: r.res?.part, type: r.res?.type });
          if (tr) {
            console.log(`\n추적 런지 ${w} 2.2 m`);
            for (const [i, row] of tr.entries()) if (i % 3 === 0 || row.ph === 'thrust' || row.ph === 'back') console.log(JSON.stringify(row));
          }
        }
        print(`런지 ${w}`, tot);
        console.log(`   맞힌 자세 ${w}: ${hits.map((h) => `${h.gap} m 팔꿈치 ${h.elbow} · 아래팔-칼 ${h.wrist} · dev ${h.dev} · 손 앞 ${h.along} · ${h.hitOk ? `${h.part}:${h.type}` : '못 맞힘'}`).join(' / ')}`);
      }
    } else if (mode === 'gyeoksal') {
      for (const w of pick(['qinggang', 'moye'])) for (const st of ['bongdu', 'geojeong', 'eogeo', 'yoryak']) print(`격살 ${st} ${w}`, gyeoksalRun(w, st).T);
    } else if (mode === 'gonosen') {
      for (const w of pick(['uchigatana', 'monohoshizao'])) print(`고노센 ${w}`, gonosenRun(w).T);
    } else if (mode === 'tap') {
      for (const w of pick(['rapier', 'dartagnan', 'balisarda', 'sabre', 'qinggang', 'moye', 'longsword', 'estoc', 'zweihander', 'tizona', 'uchigatana', 'monohoshizao'])) {
        const tot = new WristTally();
        for (const gd of Object.keys(TAP_PADS)) tot.merge(tapRun(w, gd).T, `${gd}:`);
        print(`탭 찌르기 ${w}`, tot);
      }
    } else if (mode === 'guards') {
      for (const w of pick(['longsword', 'sabre', 'rapier', 'dartagnan', 'balisarda', 'zweihander', 'tizona', 'uchigatana', 'monohoshizao', 'qinggang', 'moye'])) print(`자세 ${w}`, guardsRun(w).T);
    } else if (mode === 'cuts') {
      for (const w of pick(['longsword', 'sabre', 'rapier', 'zweihander', 'tizona', 'uchigatana', 'monohoshizao', 'qinggang', 'moye'])) {
        const r = cutsRun(w);
        print(`기술 ${w} (${r.trad})`, r.T);
      }
    } else if (mode === 'ai') {
      for (const w of pick(['longsword', 'sabre', 'rapier', 'zweihander', 'tizona', 'uchigatana', 'monohoshizao', 'qinggang', 'moye'])) {
        const tot = new WristTally();
        for (let s = 0; s < 2; s++) tot.merge(aiRun(w, { seed: 11 + s }).T);
        print(`AI ${w}`, tot);
      }
    }
  }
  const fl = out.filter((r) => r.flag === 'Y');
  const tri = out.filter((r) => r.flag === '△');
  console.log(`\n합: ${out.length} 줄 · 거꾸로 보임(Y) ${fl.length} · 새끼 쪽(△) ${tri.length} · 깨끗 ${out.length - fl.length - tri.length}`);
  if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
}
