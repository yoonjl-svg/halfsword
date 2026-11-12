// ─────────────────────────────────────────────────────────────
//  arm_reach_audit.mjs — 모든 무기 팔 뻗음 점검 (11/12 사장님 '이탈리아 무기들 여전히 팔이 잘 안펴져. 레전드 무기로 오른쪽으로 안 펴지는 경험 …
//   끝까지 안 펴지면서 팔 모양도 이상하더라. 모든 무기 상하좌우 다 테스트해봐.' — 기록 docs/strike/arm_reach_audit_2026-11-12.md). 재기만 한다 (--set 은 이 프로세스 안에서만).
//   몸: 사람 몸(0 번 · humanInput) · 그 무기 유파(schools.js traditionOf — 무유파면 스킬트리 없음) 스킬트리 모두 익힘 · 보정 v2 · 검술 보정 0.7 (main.js 기본 설정) ·
//    고유 공격 강화 · 비기 창 · 막기 단추를 main.js 처럼 붙임 · 상대 롱소드는 5.6 m 에 서 있기만 함(AI 끔).
//   손가락: 실제 src/input.js Input 에 터치 사건(844 × 390 화면 · 폰 세로 1.35 배 기본)을 넣고 main.js playerInputFrame 차례로 읽는다 (school_balance.mjs 와 같은 꼴).
//    판 시작에 패드를 가운데(0, 0)에 두고 손을 뗀 채 2.4 s → 손가락을 대고 곧장 여덟 방향(상 · 하 · 좌 · 우 · 네 대각)으로 패드 0.70 m(반지름 WEAPON.reach 0.62 너머 = 끝까지) 끎:
//     slow = 0.6 패드 m/s (휘두르기 문턱 SKILL.swingSpeed 1.5 밑 — 천천히 끌어) 뒤 손가락을 댄 채 1.5 s 멈춤 · fast = 5 패드 m/s (손가락 봇 3 ~ 5.5 와 같은 손 — 긋기) 뒤 댄 채 1.0 s.
//   잼 (물리 스텝이 끝난 자세 = 그려지는 자세 — 끝 = 멈춘 마지막 0.3 실제 s 평균 · 가장 = 끈 뒤 모든 스텝에서):
//    pad    손 목표 패드 자리 (skill.aim — 걸러진 손 목표 · 반지름 0.62 에 대한 몫)
//    hand   칼 손(손목 = 칼 아래팔 끝) 자리 · 몸 틀(헤딩 yaw · 가슴 가운데 원점) [앞, 위, 칼 든 쪽] m
//    reach  어깨(가슴 틀 ARM.shoulder — armIK 의 S) → 손목 거리 ÷ 팔 길이(ARM.upper + ARM.fore 0.57) · cmd = 손 목표(fighter.handTarget) 거리 ÷ 팔 길이
//    err    손목 ↔ 손 목표(팔 길이 공 안으로 자른 것) 거리 (m) · elbow 칼 팔꿈치 굽힘 (°, 0 = 곧음 · joint_range armAngles)
//   이상 꼴 (끈 뒤 스텝의 10 % 넘게 — 순간이 아닌 '꽤 오래'): hyper 팔꿈치 과신전(< −5°) · flex 굽힘 > 145 · elbowUp 팔꿈치가 어깨 → 손목 줄보다 30° 넘게 위(뒤집힘 · wrist_audit §10) ·
//    shPlane 어깨 수평 벌림 · 모음 밖(−45 / 130 · 들림 60 ~ 160) · shBack 어깨 폄 > 60 · shRot 위팔 돌림 밖(안 70 · 바깥 90) · wristFE 손목 굽힘 · 폄 ±70 밖 · wrist163 아래팔-칼 > 163 ·
//    roll 아래팔 굴림 ≥ 78 (손목 밧줄 80 끝) · oor 손 면 안 각이 사람 범위 밖 10° 넘게 · rev 거꾸로 쥠(dev < −45) · body 칼 팔(팔꿈치 ~ 손목 · 위팔 바깥 2/3)이 제 몸통 · 머리를 2 cm 넘게 뚫음 ·
//    arms 두 팔이 서로 2 cm 넘게 뚫음 · sword 칼날이 제 몸통 · 머리 · 다리에 닿음 · grip 두손 무기 빈손이 칼자루를 놓침
//  node tools/sim/arm_reach_audit.mjs [--weapons=all|rapier,balisarda] [--dirs=all|right,left] [--modes=slow,fast] [--set=SKILL.frameScale=all] [--json=파일] [--md]
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, CONFIG, DT, THREE } from './harness_m.mjs';
import { armAngles } from './joint_range.mjs';
import { wristSample, outOfRange, ARM_LEN, ELBOW_UP_X, ROLL_AT, OOR_X, REV, FE_IN } from './wrist_audit.mjs';
import { setPad } from './corr_lib.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { Input } from '../../src/input.js';
import { WEAPONS, RETIRED_WEAPONS, TIER_LABEL } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { isMain } from './is_main.mjs';

const { ARM, JOINTS, SKILL, INPUT, WEAPON } = CONFIG;
const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const FR = 1 / 60; // 입력 프레임 (실제 s — main.js rAF 한 번)
const S2 = Math.SQRT1_2;
/** 여덟 방향 (패드 — +x = 화면 오른쪽 · +y = 위) */
export const DIRS = { up: [0, 1], upRight: [S2, S2], right: [1, 0], downRight: [S2, -S2], down: [0, -1], downLeft: [-S2, -S2], left: [-1, 0], upLeft: [-S2, S2] };
export const DIR_KO = { up: '상', upRight: '우상', right: '우', downRight: '우하', down: '하', downLeft: '좌하', left: '좌', upLeft: '좌상' };
export const MODES = { slow: { v: 0.6, hold: 1.5 }, fast: { v: 5, hold: 1.0 } };
export const DRAG = 0.7; // 끄는 패드 거리 (m) — 반지름 WEAPON.reach 0.62 너머 (끝까지)
export const SETTLE = 2.4; // 손을 대기 전 (게임 s — 판 시작 정지 ARENA.startHold 2.0 너머)
export const END_WIN = 0.3; // 끝 자세 평균 창 (실제 s)
export const FLAG_FRAC = 0.1; // 이상 꼴: 끈 뒤 스텝의 이 몫 넘게 (wrist_audit flag 와 같은 '꽤 오래' 잣대)
export const PEN = 0.02; // 뚫음 (m): 겉끼리 이만큼 넘게 겹침 (측정 문턱)
export const FLAGS = ['hyper', 'flex', 'elbowUp', 'shPlane', 'shBack', 'shRot', 'wristFE', 'wrist163', 'roll', 'oor', 'rev', 'body', 'arms', 'sword', 'grip'];
export const FLAG_KO = { hyper: '과신전', flex: '팔꿈치 굽힘 끝', elbowUp: '팔꿈치 뒤집힘', shPlane: '어깨 면 밖', shBack: '어깨 폄 밖', shRot: '위팔 돌림 밖', wristFE: '손목 굽힘·폄 밖', wrist163: '아래팔-칼 > 163', roll: '굴림 끝', oor: '손목 범위 밖', rev: '거꾸로 쥠', body: '팔이 몸 뚫음', arms: '두 팔 엇갈려 뚫음', sword: '칼이 제 몸에 닿음', grip: '빈손 놓침' };

/** 무기 목록 (무기 표 WEAPONS 차례) — { weapon, school, tier, frame, retired, gun } */
export function weaponCells(ids = Object.keys(WEAPONS)) {
  return ids.map((id) => {
    const w = WEAPONS[id];
    return { weapon: id, school: traditionOf(w), tier: w.tier, tierKo: TIER_LABEL[w.tier] ?? w.tier, frame: w.frame, grip: w.grip, twoHand: !!w.twoHand, retired: RETIRED_WEAPONS.has(id), gun: !!w.gun || w.frame === 'gun' };
  });
}

// ── 몸 재기 (읽기만) ──
const V = (t) => new THREE.Vector3(t.x, t.y, t.z);
const Qt = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
function segPoint(a, b, p) {
  const u = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(u) / Math.max(1e-9, u.lengthSq())));
  return a.clone().addScaledVector(u, t).distanceTo(p);
}
/** 선분 ↔ 충돌체 겉 거리 (m · 음수 = 뚫음 깊이) — 공 · 상자 · 캡슐 (special_balance segCol 과 같은 꼴, 11 점) */
function segCol(a, b, col) {
  const sh = col.shape;
  const ct = V(col.translation());
  const cq = Qt(col.rotation());
  if (sh.type === 0) return segPoint(a, b, ct) - sh.radius;
  if (sh.type === 2) {
    const ax = new THREE.Vector3(0, sh.halfHeight, 0).applyQuaternion(cq);
    let m = Infinity;
    for (let i = 0; i <= 10; i++) m = Math.min(m, segPoint(ct.clone().sub(ax), ct.clone().add(ax), a.clone().lerp(b, i / 10)));
    return m - sh.radius;
  }
  if (sh.type === 1) {
    const he = sh.halfExtents;
    const inv = cq.clone().invert();
    let best = Infinity;
    for (let i = 0; i <= 10; i++) {
      const q = a.clone().lerp(b, i / 10).sub(ct).applyQuaternion(inv);
      const qx = Math.abs(q.x) - he.x, qy = Math.abs(q.y) - he.y, qz = Math.abs(q.z) - he.z;
      best = Math.min(best, Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0));
    }
    return best;
  }
  return Infinity;
}
/** 선분 ↔ 선분 가장 가까운 거리 (11 × 11 점 어림 대신 한쪽 11 점 · segPoint) */
function segSeg(a, b, c, d) {
  let m = Infinity;
  for (let i = 0; i <= 10; i++) m = Math.min(m, segPoint(c, d, a.clone().lerp(b, i / 10)));
  return m;
}
const TORSO = ['chest', 'abdomen', 'pelvis', 'head'];
const LEGS = ['thighF', 'shinF', 'thighB', 'shinB'];
/** 팔 마디 끝점 (몸 틀 — 세계 좌표): 어깨 관절 · 팔꿈치 · 손목 (몸 정의 partDefs: 위팔 0.30 · 아래팔 0.27 — 가운데에서 ±) */
function armPts(f, side) {
  const B = f.bodies;
  const u = side === 'S' ? B.uarmS : B.uarmO;
  const fa = side === 'S' ? B.farmS : B.farmO;
  if (!u || !fa) return null;
  // 칼 팔 몸은 x 를 따라 눕힘(alongX) · 빈팔은 −y 를 따라 (fighter.js offArmIK 머리말)
  const ax = side === 'S' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const uq = Qt(u.rotation());
  const fq = Qt(fa.rotation());
  const uc = V(u.translation());
  const fc = V(fa.translation());
  const ua = ax.clone().applyQuaternion(uq);
  const fx = ax.clone().applyQuaternion(fq);
  return { sh: uc.clone().addScaledVector(ua, -0.15), el: uc.clone().addScaledVector(ua, 0.15), elF: fc.clone().addScaledVector(fx, -0.135), wr: fc.clone().addScaledVector(fx, 0.135) };
}
/** 한 스텝 표본 (읽기만). 칼이 없거나 칼 팔이 잘렸으면 null */
export function armReachSample(f) {
  const ws = wristSample(f);
  const o = armAngles(f);
  if (!ws || !o) return null;
  const B = f.bodies;
  const ch = B.chest;
  const qc = Qt(ch.rotation());
  const c = V(ch.translation());
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(qc).add(c);
  const pS = armPts(f, 'S');
  const pO = armPts(f, 'O');
  const W = pS.wr;
  const T = f.handTarget.clone();
  const dT = T.clone().sub(S);
  const L = ARM_LEN;
  const Tc = S.clone().addScaledVector(dT, Math.min(1, (L - ARM.slack) / Math.max(1e-9, dT.length())));
  const yi = f.yaw.clone().invert();
  const toBody = (p) => {
    const v = p.clone().sub(c).applyQuaternion(yi);
    return [v.x, v.y, v.z * f.side];
  };
  // 칼 팔이 제 몸을 뚫음: 아래팔(팔꿈치 → 손목) ↔ 몸통(가슴 · 배 · 골반) · 머리 / 위팔 바깥 2/3 ↔ 배 · 골반 · 머리 (팔 캡슐 반지름 0.045 · 0.04 — 겉끼리).
  //  위팔 ↔ 가슴은 재지 않는다: 어깨 관절(가슴 틀 z 0.20 · 앞뒤 0)이 가슴 상자(반 두께 0.11 · 반 폭 0.18) 옆 모서리에 붙어 있어 팔을 몸 앞으로 가로지르면 위팔 뿌리가
  //  늘 상자 모서리를 지난다(관절로 이은 두 몸은 서로 부딪히지 않음 — 몸 꼴의 겹침이지 그려지는 팔의 뚫음이 아님)
  let body = Infinity;
  let bodyAt = null; // 가장 깊이 뚫은 곳 (몸 이름 · 아래팔 F | 위팔 U)
  const upOut = pS.sh.clone().lerp(pS.el, 1 / 3);
  for (const n of TORSO) {
    const col = B[n]?.collider?.(0);
    if (!col) continue;
    const dF = segCol(pS.el, W, col) - 0.04;
    const dU = n === 'chest' ? Infinity : segCol(upOut, pS.el, col) - 0.045;
    if (dF < body) (body = dF), (bodyAt = `${n}F`);
    if (dU < body) (body = dU), (bodyAt = `${n}U`);
  }
  // 두 팔 엇갈려 뚫음: 칼 팔(위팔 바깥 2/3 · 아래팔 손목 6 cm 앞까지) ↔ 빈팔(위팔 · 아래팔 손목 6 cm 앞까지) — 두손 무기는 손끼리 칼자루에서 붙으니 손목 끝은 뺌
  let arms = Infinity;
  if (pO && !f.severed?.some?.((x) => x.limb === 'armO')) {
    const cut = (a, b, m) => a.clone().lerp(b, Math.max(0, 1 - m / a.distanceTo(b)));
    const sF = cut(pS.elF, W, 0.06);
    const oF = cut(pO.elF, pO.wr, 0.06);
    for (const [a, b, ra] of [[upOut, pS.el, 0.045], [pS.elF, sF, 0.04]]) for (const [c2, d2, rb] of [[pO.sh, pO.el, 0.045], [pO.elF, oF, 0.04]]) arms = Math.min(arms, segSeg(a, b, c2, d2) - ra - rb);
  }
  // 칼날이 제 몸에 닿음: 칼날 (코등이 → 칼끝) ↔ 몸통 · 머리 · 다리 (채찍은 덩굴이 휘어 칼날 선이 뜻이 없음 — 재지 않음)
  let sword = Infinity;
  if (f.sword && f.armed !== false && !f.flexWeapon) {
    const b0 = f.bladePoint(0, new THREE.Vector3());
    const b1 = f.bladePoint(1, new THREE.Vector3());
    for (const n of [...TORSO, ...LEGS]) {
      const col = B[n]?.collider?.(0);
      if (col) sword = Math.min(sword, segCol(b0, b1, col));
    }
  }
  const sk = f.skill;
  return {
    pad: [sk.aim.x, sk.aim.y],
    off: [f.handOffset.x, f.handOffset.y],
    hand: toBody(W),
    elbowP: toBody(pS.el),
    shoulder: toBody(S),
    target: toBody(T),
    reach: W.distanceTo(S) / L,
    cmd: dT.length() / L,
    err: W.distanceTo(Tc),
    elbow: o.elbow,
    shPlane: o.shPlane,
    shBack: o.shBack,
    shRot: o.shRot,
    wristFE: o.wristFE,
    wrist: o.wrist,
    dev: ws.dev,
    fe: ws.fe,
    roll: ws.roll,
    elbowUp: ws.elbowUp,
    fix: ws.fix,
    body,
    bodyAt,
    arms,
    sword,
    grip: f.weaponCfg?.twoHand ? !!f.gripping : null,
    swing: !!sk.swinging,
    idle: f.bodyPose?.idle ?? null,
    oor: outOfRange(ws),
  };
}
/** 표본의 이상 꼴 (이름 → 참) */
export function flagsOf(s) {
  return {
    hyper: s.elbow < -5,
    flex: s.elbow > 145,
    elbowUp: s.elbowUp > ELBOW_UP_X,
    shPlane: s.shPlane != null && (s.shPlane < -45 || s.shPlane > 130),
    shBack: s.shBack > 60,
    shRot: s.shRot != null && (s.shRot < JOINTS.twist[0] || s.shRot > JOINTS.twist[1]),
    wristFE: s.wristFE != null && Math.abs(s.wristFE) > 70,
    wrist163: s.wrist != null && s.wrist > 163,
    roll: s.roll >= ROLL_AT,
    oor: s.oor > OOR_X,
    rev: s.dev < REV && Math.abs(s.fe) < FE_IN,
    body: s.body < -PEN,
    arms: s.arms < -PEN,
    sword: s.sword < 0,
    grip: s.grip === false,
  };
}
/** 그림용 자세 (몸 틀 [앞, 위, 칼 든 쪽]) */
export function poseOf(f) {
  const B = f.bodies;
  const c = V(B.chest.translation());
  const yi = f.yaw.clone().invert();
  const tb = (p) => {
    const v = p.clone().sub(c).applyQuaternion(yi);
    return [+v.x.toFixed(4), +v.y.toFixed(4), +(v.z * f.side).toFixed(4)];
  };
  const pS = armPts(f, 'S');
  const pO = armPts(f, 'O');
  const qc = Qt(B.chest.rotation());
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(qc).add(c);
  const So = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], -f.side * ARM.shoulder[2]).applyQuaternion(qc).add(c);
  const o = {
    chest: tb(c), head: tb(V(B.head.translation())), pelvis: tb(V(B.pelvis.translation())), abdomen: tb(V(B.abdomen.translation())),
    shS: tb(S), shO: tb(So), elS: tb(pS.el), wrS: tb(pS.wr), target: tb(f.handTarget.clone()),
  };
  if (pO) Object.assign(o, { elO: tb(pO.el), wrO: tb(pO.wr) });
  if (f.sword && f.armed !== false) {
    o.hilt = tb(V(f.sword.translation()));
    o.guard = tb(f.bladePoint(0, new THREE.Vector3()));
    o.tip = tb(f.bladePoint(1, new THREE.Vector3()));
  }
  return o;
}

// ── 판 하나 ──
const canvas = { addEventListener() {} };
const win = { innerWidth: 844, innerHeight: 390, addEventListener() {}, location: { search: '' } };
// 브라우저 껍데기는 Input 을 부르는 동안만 (늘 두면 칼 그림 모듈이 브라우저로 알고 canvas 를 만들려 함 — corr_lib withBrowser 와 같은 까닭)
const SHIM = { window: win, document: { pointerLockElement: null }, matchMedia: () => ({ matches: true }) };
function inputEnv(fn) {
  const saved = Object.keys(SHIM).map((k) => [k, Object.hasOwn(globalThis, k), globalThis[k]]);
  for (const k in SHIM) globalThis[k] = SHIM[k];
  try {
    return fn();
  } finally {
    for (const [k, had, v] of saved) {
      if (had) globalThis[k] = v;
      else delete globalThis[k];
    }
  }
}

/**
 * 무기 하나 · 방향 하나 · 손 하나 (slow | fast). 돌려줌: { samples(끈 뒤 스텝마다 — keep 일 때만), end, peak, flags, frac, poseEnd, posePeak }
 *  onRound({ G, P }) 꽂개 (재기 · 시험 — 몸 그대로)
 */
export function runDir({ weapon, school = traditionOf(WEAPONS[weapon]), dir, mode = 'slow', seed = 1, keep = false, onRound = null, params = '' }) {
  const kit = school && school !== 'none' ? kitFromNodes(school, allNodeIds(school)) : null;
  const G = newRound({ seed, weapon, weapon2: 'longsword', walls: true, ...(kit ? { kit } : {}), onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  const A = G.enemy;
  G.ai.update = () => A.move.set(0, 0); // 상대는 서 있기만 (칼 · 걸음 없음)
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  P.canShove = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(kit?.unique ?? []) });
  const W = new PlayerSecretWatch(P, A, { locked: !kit?.secret });
  const guard = new PlayerParryGuard(P, A);
  P.stamina.controller = guard;
  const input = inputEnv(() => new Input(canvas, new URLSearchParams(params)));
  input.enabled = true;
  setPad(P, [0, 0]);
  onRound?.({ G, P, A });
  const M = MODES[mode];
  const [ux, uy] = DIRS[dir];
  // 손가락 (화면 px)
  let x = 620;
  let y = 180;
  let hand = false;
  const ev = (kind, dx = 0, dy = 0) => {
    const base = { pointerId: 1, pointerType: 'touch', button: 0, timeStamp: Math.max(1, (G.t / K) * 1000), type: kind, clientX: x, clientY: y };
    if (kind === 'pointerdown') inputEnv(() => input.onDown(base)), (hand = true);
    else if (kind === 'pointerup') inputEnv(() => input.onUp(base)), (hand = false);
    else {
      const sc = INPUT.touchSensitivity / 390;
      x += dx / sc;
      y -= dy / (sc * input.mobileIntent.verticalGain);
      inputEnv(() => input.onMove({ ...base, clientX: x, clientY: y }));
    }
  };
  let phase = 'rest';
  let dragged = 0;
  let tPhase = 0;
  const frame = () => {
    const tr = G.t / K;
    if (phase === 'rest' && G.t >= SETTLE) {
      ev('pointerdown');
      phase = 'drag';
      tPhase = tr;
    }
    if (phase === 'drag') {
      const st = Math.min(M.v * FR, DRAG - dragged);
      ev('pointermove', ux * st, uy * st);
      dragged += st;
      if (dragged >= DRAG - 1e-9) {
        phase = 'hold';
        tPhase = tr;
      }
    } else if (phase === 'hold' && tr - tPhase >= M.hold) phase = 'done';
    // ── main.js playerInputFrame 과 같은 차례 (school_balance.mjs 와 같음 · 막기 단추 없음 · 걸음 없음) ──
    const d = input.consumeHandDelta();
    let taps = input.consumeTaps();
    if (P.stamina.exhausted) (d.x = 0), (d.y = 0), (taps = 0);
    let secBusy = false;
    const swipe = Math.hypot(d.x, d.y) / FR >= SKILL.swingSpeed;
    input.stickMove = { x: 0, y: 0 };
    const atkWin = !!W.open && !W.stickOwns() && !W.circleOwns() && !W.holdOwns();
    const stickGo = !!W.spinStick(FR, input.move, !secBusy && P.alive);
    const circleGo = !!W.spinCircle(FR, d, hand, !secBusy && P.alive);
    if (uq.cingirE && uq.circleTick(FR, d, hand, !secBusy && P.alive)) secBusy = true;
    const gilReady = !!W.S?.do?.gilmok && !!W.gilArm?.armed;
    const secArm = !(CONFIG.SECRET.secretHold && (P.skill.tap || P.skill.pom));
    if ((((atkWin || gilReady) && (taps > 0 || (swipe && !W.S?.do?.tapOnly))) || stickGo || circleGo) && !secBusy && P.alive && secArm) {
      const o = W.open ? W.fire() : W.fireArmed();
      if (o) o.dir = [d.x, d.y];
      if (P.skill.secret(o)) secBusy = true;
    }
    if (!secBusy && P.alive && (taps > 0 || swipe) && W.canBuffer()) W.buffer([d.x, d.y]);
    const bufHold = !secBusy && !!W.bufferHold;
    if (secBusy || bufHold) taps = 0;
    guard.held = false;
    P.pickupPress = false;
    if (guard.broken && (!guard.held || (!P.skill.swinging && !P.skill.tap && !swipe && taps === 0))) guard.broken = false;
    uq.feed(d.x, d.y, FR, bufHold, bufHold);
    if (uq.holdE) {
      const hs = input.holdState();
      uq.holdInput(hs.down && !P.stamina.exhausted, hs.still, !!W.open, W.holdOwns());
    }
    const winding = !!uq.winding;
    if (P.alive && !secBusy && !bufHold && !winding) (P.handOffset.x += d.x), (P.handOffset.y += d.y);
    P.handHeld = hand;
    P.inputActive = !secBusy && !bufHold && !winding && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    const pr = input.press;
    P.handGrip = pr ? pr.moved >= (INPUT.holdPx ?? INPUT.tapPx) : P.inputActive;
    if (taps > 0 && P.alive) P.skill.thrust();
    P.move.set(0, 0);
    P.stickX = 0;
    P.stickY = 0;
  };
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    if (W.queued && !P.skill.sec && P.alive) {
      const o = W.fire();
      if (o) P.skill.secret(o);
    }
    guard.step(DT);
    if (guard.active) (P.inputActive = true), (P.handHeld = true);
  };
  const out = { weapon, school, dir, mode, samples: keep ? [] : null };
  const tally = Object.fromEntries(FLAGS.map((k) => [k, 0]));
  let n = 0;
  let peak = null;
  let posePeak = null;
  const endBuf = [];
  let nextFrame = 0;
  let tHold = null;
  try {
    while (phase !== 'done' && G.t < 30) {
      if (G.t / K >= nextFrame - 1e-8) {
        frame();
        nextFrame += FR;
      }
      G.step();
      if (phase === 'rest') continue;
      const s = armReachSample(P);
      if (!s) continue;
      s.t = +((G.t / K) - SETTLE / K).toFixed(4);
      s.phase = phase;
      if (keep) out.samples.push(s);
      n++;
      const fl = flagsOf(s);
      for (const k of FLAGS) if (fl[k]) tally[k]++;
      if (!peak || s.reach > peak.reach) {
        peak = s;
        posePeak = poseOf(P);
      }
      if (phase === 'hold') {
        tHold ??= G.t / K;
        if (G.t / K - tHold >= M.hold - END_WIN - 1e-9) endBuf.push(s);
      }
    }
    out.poseEnd = poseOf(P);
  } finally {
    G.world.free();
  }
  const avg = (k) => endBuf.reduce((a, s) => a + s[k], 0) / Math.max(1, endBuf.length);
  const avgV = (k) => [0, 1, 2].map((i) => endBuf.reduce((a, s) => a + s[k][i], 0) / Math.max(1, endBuf.length)).slice(0, endBuf[0]?.[k]?.length ?? 3);
  out.n = n;
  out.end = endBuf.length ? { reach: avg('reach'), cmd: avg('cmd'), err: avg('err'), elbow: avg('elbow'), pad: avgV('pad'), hand: avgV('hand'), target: avgV('target'), elbowUp: avg('elbowUp'), body: Math.min(...endBuf.map((s) => s.body)), bodyAt: endBuf.at(-1).bodyAt, sword: Math.min(...endBuf.map((s) => s.sword)) } : null;
  out.peak = peak && { reach: peak.reach, cmd: peak.cmd, elbow: peak.elbow, t: peak.t };
  out.frac = Object.fromEntries(FLAGS.map((k) => [k, n ? tally[k] / n : 0]));
  out.flags = FLAGS.filter((k) => out.frac[k] > FLAG_FRAC);
  out.posePeak = posePeak;
  return out;
}

/** 무기 하나 모든 방향 · 손 */
export function runWeapon(cell, { dirs = Object.keys(DIRS), modes = Object.keys(MODES), seed = 1, params = '' } = {}) {
  const rows = [];
  for (const mode of modes) for (const dir of dirs) rows.push(runDir({ weapon: cell.weapon, school: cell.school, dir, mode, seed, params }));
  return rows;
}

// ── 표 ──
const f2 = (x, k = 2) => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(k));
/** 무기 × 방향 표 (한 손 — mode): 칸 = 끝 뻗음 (가장) · 오차 cm · 이상 꼴 */
export function tableMd(res, mode, { dirs = Object.keys(DIRS) } = {}) {
  const L = [`| 무기 (유파 · 등급 · 틀) | ${dirs.map((d) => DIR_KO[d]).join(' | ')} |`, `|---|${dirs.map(() => '---').join('|')}|`];
  for (const r of res) {
    if (r.cell.gun) {
      L.push(`| ${r.cell.weapon} (${r.cell.school} · ${r.cell.tierKo} · 총) | ${dirs.map(() => '총 — 손가락이 손을 안 옮김').join(' | ')} |`);
      continue;
    }
    const by = Object.fromEntries(r.rows.filter((x) => x.mode === mode).map((x) => [x.dir, x]));
    L.push(`| ${r.cell.weapon}${r.cell.retired ? ' (뺀 무기)' : ''} (${r.cell.school} · ${r.cell.tierKo} · ${r.cell.frame}) | ${dirs.map((d) => cellMd(by[d], mode)).join(' | ')} |`);
  }
  return L.join('\n');
}
export function cellMd(x, mode) {
  if (!x?.end) return '–';
  const v = mode === 'fast' ? `${f2(x.end.reach)} (${f2(x.peak.reach)})` : f2(x.end.reach);
  const fl = x.flags.map((k) => FLAG_KO[k]).join(' · ');
  return `${v} · ${Math.round(x.end.err * 100)}${fl ? ` · **${fl}**` : ''}`;
}

/** --merge=a.json,b.json → 무기 표 차례로 하나 (shard 묶음) */
export function mergeRuns(files) {
  const all = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const order = Object.keys(WEAPONS);
  const res = all.flatMap((j) => j.res).sort((a, b) => order.indexOf(a.cell.weapon) - order.indexOf(b.cell.weapon));
  return { ...all[0], res };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  for (const kv of arg('set', '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
  const pic = arg('pic', null);
  if (pic) {
    // 그림 JSON (tools/sim/arm_reach_draw.py 가 읽음): --pic=무기:손 --from=전.json,후.json --names=전,후 --pout=그림.json [--title=…]
    const [w, m = 'slow'] = pic.split(':');
    const files = arg('from', '').split(',');
    const names = arg('names', files.join(',')).split(',');
    const cols = ['#d93025', '#1a73e8', '#188038'];
    const sets = files.map((f, i) => {
      const J = JSON.parse(readFileSync(f, 'utf8'));
      const r = J.res.find((x) => x.cell.weapon === w);
      const rows = r.rows.filter((x) => x.mode === m);
      return { name: names[i], color: cols[i % cols.length], poses: Object.fromEntries(rows.map((x) => [x.dir, x.poseEnd])), cells: Object.fromEntries(rows.map((x) => [x.dir, `${names[i]} ${f2(x.end.reach)} · ${Math.round(x.end.elbow)}°${x.flags.length ? ` · ${x.flags.map((k) => FLAG_KO[k]).join(' · ')}` : ''}`])) };
    });
    const cell = weaponCells([w])[0];
    writeFileSync(arg('pout', '.tmp/pic.json'), JSON.stringify({ title: arg('title', `${w} (${cell.school} · ${cell.tierKo}) — 손가락 가운데 → 끝까지 ${m === 'slow' ? '천천히 끌어 멈춤' : '빠르게 긋고 댄 채'}`), sub: '칸 = 끈 방향 · 그림 = 멈춘 끝 자세 (몸 틀 — 머리 = 위, 위에서 본 그림은 위 = 상대 쪽)', sets }));
    process.exit(0);
  }
  const picw = arg('picw', null);
  if (picw) {
    // 그림 JSON — 한 방향 · 무기 여럿 (칸 = 무기): --picw=방향:손 --wlist=a,b,c --from=전.json,후.json --names=전,후 --pout=그림.json
    const [dir, m = 'slow'] = picw.split(':');
    const ws = arg('wlist', '').split(',');
    const files = arg('from', '').split(',');
    const names = arg('names', files.join(',')).split(',');
    const cols = ['#d93025', '#1a73e8', '#188038'];
    const sets = files.map((f, i) => {
      const J = JSON.parse(readFileSync(f, 'utf8'));
      const poses = {};
      const cells = {};
      for (const w of ws) {
        const x = J.res.find((r) => r.cell.weapon === w)?.rows.find((r) => r.mode === m && r.dir === dir);
        if (!x) continue;
        poses[w] = x.poseEnd;
        cells[w] = `${names[i]} ${f2(x.end.reach)} · ${Math.round(x.end.elbow)}°${x.flags.length ? ` · ${x.flags.map((k) => FLAG_KO[k]).join(' · ')}` : ''}`;
      }
      return { name: names[i], color: cols[i % cols.length], poses, cells };
    });
    const keys = [...ws, null];
    const order = [];
    for (let i = 0; i < keys.length; i += 3) order.push(keys.slice(i, i + 3));
    const labels = Object.fromEntries(weaponCells(ws).map((c) => [c.weapon, `${c.weapon} (${c.school} · ${c.tierKo})`]));
    writeFileSync(arg('pout', '.tmp/pic.json'), JSON.stringify({ title: arg('title', `${DIR_KO[dir]} 끝까지 — ${m === 'slow' ? '천천히 끌어 멈춤' : '빠르게 긋고 댄 채'}`), sub: '칸 = 무기 · 그림 = 멈춘 끝 자세', sets, order, labels }));
    process.exit(0);
  }
  const mg = arg('merge', null);
  if (mg) {
    const J = mergeRuns(mg.split(','));
    for (const m of J.modes) console.log(`\n### ${m}\n\n${tableMd(J.res, m, { dirs: J.dirs })}`);
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify(J));
    process.exit(0);
  }
  const wsel = arg('weapons', 'all');
  const [si, sn] = arg('shard', '0/1').split('/').map(Number); // --shard=i/n: 무기 차례 i, i + n, … 만 (프로세스 여럿으로 나눠 돌림 — merge 는 --merge)
  const cells = weaponCells(wsel === 'all' ? undefined : wsel.split(',')).filter((_, i) => i % sn === si);
  const dsel = arg('dirs', 'all');
  const dirs = dsel === 'all' ? Object.keys(DIRS) : dsel.split(',');
  const modes = arg('modes', 'slow,fast').split(',');
  const res = [];
  for (const cell of cells) {
    if (cell.gun) {
      res.push({ cell, rows: [] });
      continue;
    }
    const rows = runWeapon(cell, { dirs, modes, params: arg('params', '') });
    res.push({ cell, rows });
    if (!argv.includes('--md')) {
      for (const r of rows) console.log(`${cell.weapon.padEnd(17)} ${cell.school.padEnd(8)} ${r.mode.padEnd(4)} ${r.dir.padEnd(9)} 뻗음 ${f2(r.end?.reach)} (가장 ${f2(r.peak?.reach)}) · 목표 ${f2(r.end?.cmd)} · 오차 ${f2(r.end?.err, 3)} · 팔꿈치 ${f2(r.end?.elbow, 0)} · 패드 ${r.end?.pad.map((v) => f2(v)).join(',')} · 손 ${r.end?.hand.map((v) => f2(v)).join(',')} · ${r.flags.map((k) => `${FLAG_KO[k]} ${Math.round(r.frac[k] * 100)}%`).join(' · ')}`);
    }
  }
  if (argv.includes('--md')) for (const m of modes) console.log(`\n### ${m}\n\n${tableMd(res, m, { dirs })}`);
  const json = arg('json', null);
  if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), dirs, modes, res: res.map((r) => ({ cell: r.cell, rows: r.rows.map((x) => ({ ...x, samples: undefined })) })) }));
}
