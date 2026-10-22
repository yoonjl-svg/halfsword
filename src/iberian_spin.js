// ─────────────────────────────────────────────────────────────
//  이베리아 비기 '휘감아 돌기 (싱지르)' — 한 발을 축으로 몸을 한 바퀴 돌리는 대본 (10/22 사장님)
//   사장님 "충분한 거리가 확보되어 있을 때 … 빙글 한바퀴 돌면서 엄청 강렬한 회전력을 발생시켜 일격을 날리는 거지" ·
//   "물리의 실제 디딤보다는 애니메이션으로 한 발을 축으로 해서 빠르게 빙글 도는 모션을 정하는 게 나을 듯해".
//   설계 · 측정: docs/strike/iberian_spin_2026-10-22.md · 값 config SECRET.ibSpin [사장님 확인 전 — 확인표 2204~2210]
//
//  **물리 원칙의 예외** (발도 secret_instant.js 와 같은 갈래 — 몸놀림만 대본, 맞음은 물리):
//   ① 몸 방향(heading)을 대본이 돌린다 — SECRET.ibSpin.time 초에 한 바퀴(오르고 내리는 ramp 초는 부드럽게). updateHeading(상대 쪽으로 천천히 돎) 대신.
//   ② 몸통(골반 · 배 · 가슴 · 머리)과 도는 뒷다리의 빠르기를 물리 스텝마다 '몸과 함께 도는 틀'로 다시 세운다 —
//      제 몸 안의 움직임(근육이 낸 상대 빠르기)은 그대로 두고 틀의 몫(골반 빠르기 + 도는 빠르기 × 골반에서의 거리 + 구심 몫)만 대본 값으로 바꾼다.
//      두 팔 · 칼은 도는 동안 대본 자세(처음 ramp 초에 지금 자세 → 칼 든 쪽 뒤로 수평으로 감은 자세 SECRET.ibSpin.wind)에 스텝마다 놓고(발도 placeIai 와 같은 틀 —
//      팔은 armIK), 빠르기는 놓은 자리의 실제 움직임(앞 스텝과의 차)으로 준다. 그래서 칼은 실제 빠르기로 돌고, 맞음 · 막힘 · 상처는 지금 물리 판정
//      (combat.js — 날 맞음 · 칼면 맞음 · 갑옷 · 투구) 그대로다. 첫 시험(놓지 않고 서보로 감기)은 무거운 칼이 한 바퀴 내내 감기지 않고 바깥으로 쏠려 몸을 넘어뜨렸다.
//   ③ 축발 = 앞발(보통 칼 든 쪽): 발바닥 가운데를 땅에 붙인 채 제자리에서 몸과 함께 돈다(gait.js pinFeet 가 발 돌림 마찰을 걸지 않음).
//      몸은 축발 세로 축 둘레로 돌고, 골반은 그동안 축발 뒤에서 축발 옆(무게가 축발에)을 지나 축발 앞으로 옮긴다(pelvisAt).
//      뒷발은 몸과 함께 돌며 몸 기준으로는 바깥 옆을 지나 축발 앞(옆 거리는 그대로)에 딛는다 — 몸(골반)은 두 발 사이 앞뒤 거리만큼 나아간다(닿는 거리를 벌충).
//   ④ 도는 빠르기가 줄기 시작할 때(time − ramp) 두 팔 · 칼을 틀에서 놓는다 — 몸이 서는 동안 칼은 제 관성과 서보(덧씌우기 칸의 가로 베기 끝 자세)로
//      앞을 가로질러 친다. 그 전에 칼이 상대 몸에 닿으면 곧장 놓고(베는 칼 · 튕김은 물리대로), 상대 칼 · 무대 벽 · 땅에 닿으면 놓고 몸 돌림도 그 자리에서 멈춘다.
//   카메라는 돌지 않는다 — main.js updateCamera 는 나 → 상대 방향을 보고 몸 방향(heading)을 읽지 않는다.
//  부르는 곳: skill.js secret()(플레이어 — 비기 '휘감아 돌기') → requestSpin · fighter.js step(spinStep · driveBalance 의 want) · gait.js update · poseLegs · pinFeet ·
//   skill.js update(spinCutPose). 대본이 없으면(f.ibSpin = null) 아무 일도 없다 — AI 끼리 판은 바이트 그대로(AI 는 이베리아 비기가 닫혀 있다 SECRET.aiOpenSchools).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, ARM } from './config.js';
import { iaiTipSpeed, ART_MIN } from './secret_instant.js'; // 비기 잔상 밝기 = 칼끝 빠르기 ÷ 고노센 칼끝 빠르기 (10/23 — 연환 · 진 · 츠바메가에시와 같은 체계)

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const clamp = THREE.MathUtils.clamp;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ang = (x, z) => Math.atan2(-z, x); // heading 과 같은 각 (0 = +x · + = 위에서 봐서 왼쪽으로)
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const smoothInt = (x) => x * x * x - (x * x * x * x) / 2; // ∫₀ˣ smoothstep
const UPPER = ['pelvis', 'abdomen', 'chest', 'head'];
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _p1 = { x: 0, z: 0 };
const _p2 = { x: 0, z: 0 };

/** 도는 진행 q(0~1, 몸이 돈 몫) — 빠르기는 ramp 초에 0 → 최고 → 끝 ramp 초에 0 (smoothstep 오름 · 내림, 그 사이 같은 빠르기) */
export function spinProgress(t, T, r) {
  const span = T - r;
  if (t <= 0) return 0;
  if (t >= T) return 1;
  let F;
  if (t < r) F = r * smoothInt(t / r);
  else if (t < T - r) F = r / 2 + (t - r);
  else {
    const y = (t - (T - r)) / r;
    F = r / 2 + (T - 2 * r) + r * (y - smoothInt(y));
  }
  return F / span;
}
/** 그때 도는 빠르기의 몫 (최고 = 1) */
export function spinRate(t, T, r) {
  if (t <= 0 || t >= T) return 0;
  return smooth(t / r) * (1 - smooth((t - (T - r)) / r));
}

/**
 * 골반이 갈 자리 (수평, 월드) — 축(축발 발바닥 가운데 P) 둘레로 몸과 함께 돌고, 축에서 본 골반 자리 o 는 (처음 몸 기준으로)
 *  처음 '축발 뒤'(o0) → 돌기 첫 SHIFT 몫에 '축발 바로 옆'(oM — 앞뒤 0 · 옆은 그대로: 무게가 축발에 실린다) → 마지막 SHIFT 몫에 '축발 앞'(o1 = 끝 골반(처음 + D) − P).
 *  c(q) = P + R(돈 각) · o(q). (o 를 곧게 옮기면 골반이 축발 둘레 반지름 0.5 m 로 크게 돌아 몸이 옆으로 0.5 m 쏠렸다 — 첫 시험)
 */
const HIP_W = 0.095; // 골반 가운데 → 엉덩이 관절 옆 거리 (m — fighter.js partDefs 허벅지 자리 · gait.js sense 와 같은 몸 수)
const SHIFT = 0.25; // 무게를 축발로 옮기는 몫 · 끝에 내딛는 발로 옮기는 몫 (돌기 진행 q 의 — 시간 값 아님)
function pelvisAt(S, q, out) {
  const m = smooth(q / SHIFT);
  const n = smooth((q - (1 - SHIFT)) / SHIFT);
  const ox = S.o0.x + (S.oM.x - S.o0.x) * m + (S.o1.x - S.oM.x) * n;
  const oz = S.o0.z + (S.oM.z - S.o0.z) * m + (S.o1.z - S.oM.z) * n;
  const a = S.dir * TAU * q;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  out.x = S.P.x + ox * cs + oz * sn;
  out.z = S.P.z - ox * sn + oz * cs;
  return out;
}

/**
 * 대본을 건다 (플레이어 비기 — skill.js secret). 서서 한 발 이상 딛고 있어야 한다. 시작했으면 true.
 *  dir: 도는 쪽 (+1 = heading + = 왼쪽으로 — 칼 든 쪽이 오른쪽인 몸은 왼쪽으로 돌며 칼이 오른쪽 뒤에 감겨 따라오다 오른쪽 → 왼쪽으로 가로 벤다 = 탈류)
 *  want: 바라는 쪽 (10/23 스틱 판 — 돌린 쪽 · ±1). SECRET.ibSpin.reverse 면 그쪽으로(칼 든 쪽의 반대면 ws = −1 — 감는 자세 · 끝 각 · 몸 비틀기 거울 = 레베스), 아니면 칼 든 쪽이 정함
 *  (10/23 torso) 칼(손 · 칼날)이 내 가슴 점보다 높게 있으면 pre = ramp 초 동안 돌지 않고 먼저 감은 자세로 내린다 — 높은 자세에서 낸 칼이 도는 동안 머리 위로 치솟지 않게
 */
export function requestSpin(f, want = 0) {
  const G = f.gait;
  if (!G?.active || f.state !== 'stand' || f.ibSpin) return false;
  if (!G.legs.F.stance && !G.legs.B.stance) return false; // 두 발이 다 떠 있으면(뛰듯 걷는 한순간) 축발이 없다
  const S = SECRET.ibSpin;
  const T = S.time;
  const r = Math.min(S.ramp, T / 2);
  const fwd = f.forward(new THREE.Vector3());
  const rgt = f.right(new THREE.Vector3());
  // 축발 = 앞발 (펜싱 자세면 칼 든 쪽). 걷는 중이면 디딘 발이 축 — 떠 있던 발은 그 자리에서 도는 발로 이어받는다
  const pk = G.legs.F.stance && G.legs.B.stance ? G.frontLeg(fwd) : G.legs.F.stance ? 'F' : 'B';
  const sk = pk === 'F' ? 'B' : 'F';
  const Lp = G.legs[pk];
  const Ls = G.legs[sk];
  const P = new THREE.Vector3(Lp.pinC.x, 0, Lp.pinC.z); // 축 = 축발 발바닥 가운데 (땅)
  const B0 = new THREE.Vector3(Ls.ankle.x, 0, Ls.ankle.z);
  const rx = B0.x - P.x;
  const rz = B0.z - P.z;
  const lon = Math.abs(rx * fwd.x + rz * fwd.z); // 두 발 사이 앞뒤 거리 = 나아가는 거리
  const lat = rx * rgt.x + rz * rgt.z; // 옆 거리 (그대로 둔다 — 디딘 뒤 다리가 엇갈리지 않게)
  const B1 = P.clone().addScaledVector(fwd, lon).addScaledVector(rgt, lat);
  const nat = f.side >= 0 ? 1 : -1; // 칼 든 쪽이 정하는 쪽 (10/22 판)
  const dir = S.reverse && (want === 1 || want === -1) ? want : nat;
  const pre = S.torso && f.armed && swordTop(f) > f.bodies.chest.translation().y ? r : 0;
  const pel = f.bodies.pelvis.translation();
  const c0 = new THREE.Vector3(pel.x, 0, pel.z);
  const D = fwd.clone().multiplyScalar(lon);
  // 도는 발 길 (몸 기준 — 골반 원점 · x 앞 · z 오른쪽): 처음 자리 b0 → 끝 자리 b1 (끝 골반 = c0 + D 기준). 각은 짧은 쪽(둘 다 그 발 쪽 옆이라 바깥 옆을 지난다)
  const toBody = (x, z) => ({ x: x * fwd.x + z * fwd.z, z: x * rgt.x + z * rgt.z });
  const b0 = toBody(B0.x - c0.x, B0.z - c0.z);
  const b1 = toBody(B1.x - c0.x - D.x, B1.z - c0.z - D.z);
  const a0 = Math.atan2(b0.z, b0.x);
  const da = wrap(Math.atan2(b1.z, b1.x) - a0);
  f.spinLow = false; // 가로질렀거나 막혔나 (spinCutPose — 그 뒤 칼끝을 가슴 높이로)
  f.ibSpin = {
    t: 0, T, r, dir, ws: dir * nat, pre, tp: 0, settle: null, h0: f.heading, q: 0, rate: 0,
    pk, sk, P, B0, B1, br0: Math.hypot(b0.x, b0.z), br1: Math.hypot(b1.x, b1.z), a0, da,
    c0, D, lon,
    o0: new THREE.Vector3(c0.x - P.x, 0, c0.z - P.z), o1: new THREE.Vector3(c0.x + D.x - P.x, 0, c0.z + D.z - P.z),
    oM: rgt.clone().multiplyScalar(-Lp.side * HIP_W), // 축발 엉덩이가 축발 바로 위 (골반 가운데 = 축발에서 엉덩이 폭만큼 안쪽)
    arm: null, // 두 팔 · 칼 대본: 처음 손 · 칼날 (몸 기준) · 지난 스텝 놓은 자리 (빠르기 셈)
    footYaw0: Ls.footYaw, pivotYaw0: Lp.yaw, pinC0: Lp.pinC.clone(), pinT0: Lp.pinT.clone(), plant0: Lp.plant.clone(),
    free: false, // 두 팔 · 칼을 틀에서 놓았나
    blocked: false, // 상대 칼에 닿아 멈췄나
    touchT: null, // 칼이 상대에 처음 닿은 때 (s)
    freeT: null,
    want: new THREE.Vector3(), // 골반이 가려는 빠르기 (fighter.driveBalance 의 want)
    stats: { tipMax: 0, tipAtTouch: null, cutTipMax: 0 },
  };
  if (!pre) {
    G.begin(Ls, 'spin', T);
    G.footMass(Ls, false);
  }
  return true;
}

/** 칼(손 · 칼날 다섯 점)의 가장 높은 점 (월드 y) */
const _sp = new THREE.Vector3();
function swordTop(f) {
  let y = f.sword.translation().y;
  for (const u of [0, 0.25, 0.5, 0.75, 1]) y = Math.max(y, f.bladePoint(u, _sp).y);
  return y;
}

/** 대본 진행 중인가 */
export const spinActive = (f) => !!f.ibSpin;

/** 끝난 대본의 기록 (skill.js 가 읽고 지운다): { blocked, touchT, freeT, stats } */
function finish(f, why) {
  const S = f.ibSpin;
  const G = f.gait;
  if (!S) return;
  const Ls = G?.legs?.[S.sk];
  if (Ls && !Ls.stance) G.touchdown(Ls, 0.5); // 도는 발을 그 자리에 딛는다
  const Lp = G?.legs?.[S.pk];
  if (Lp) Lp.yawTD = Lp.yaw; // 축발 디딘 방향 = 지금 (엉덩이 비틀기 한계 limitTurn 이 새 방향에서 센다)
  // 한 바퀴를 다 돌았으면 heading 을 같은 방향의 작은 각으로 (몸 자세는 그대로)
  f.heading = wrap(f.heading);
  f.yaw.setFromAxisAngle(_w.set(0, 1, 0), f.heading);
  if (G) G.prevHead = f.heading;
  f.ibSpinDone = { why: S.settle?.why ?? why, blocked: S.blocked, touchT: S.touchT, freeT: S.freeT, q: S.q, ws: S.ws, pre: S.pre, stats: S.stats, travel: Math.hypot(f.bodies.pelvis.translation().x - S.c0.x, f.bodies.pelvis.translation().z - S.c0.z) };
  f.ibSpin = null;
}

/** 대본을 끊는다 (넘어짐 · 칼 놓침 · 비기 끝) */
export function spinAbort(f, why = 'abort') {
  if (f.ibSpin) finish(f, why);
}

/**
 * 마무리 받기 (10/23 사장님 '쓰고나서 마무리 동작이 날아갈 것처럼 너무 휘청거리니까 현실감 있게' — SECRET.ibSpin.settle):
 *  잰 원인 — 대본이 틀을 한 번에 놓으면 ① 막힌 때는 몸이 한 바퀴 빠르기(최고 15.7 rad/s) 그대로 풀려나 골반이 5 m/s · 700°/s 로 날아가고
 *  ② 다 돈 때도 놓은 칼(0.4 s 부터 서보로 가로지름)이 아직 도는 중이라 그 되받음이 틀 없는 몸통을 비틀고, 도는 발은 끝에서야 딛는다.
 *  → 끝(또는 막힘) 순간 도는 발을 곧장 딛고, ramp 초 동안 몸통 틀의 목표를 '멈춤'(도는 빠르기 0 · 골반 수평 빠르기 0)으로 두되 그 붙드는 몫을 1 → 0 으로 부드럽게 줄인다
 *  (큰 칼을 한 바퀴 돌린 사람이 뒷발을 딛고 몸을 받아 멈추는 몫). 그동안 균형 걸음 · 걸음 셈은 쉰다(f.ibSpin 이 남아 있음). 두 팔 · 칼은 이미 놓여 서보대로.
 */
function beginSettle(f, S, why) {
  const G = f.gait;
  const Ls = G?.legs?.[S.sk];
  if (Ls && !Ls.stance) G.touchdown(Ls, 0.5); // 도는 발을 그 자리에 딛는다 (막혔으면 돌던 중 자리)
  S.free = true;
  S.settle = { t: 0, why, h: f.heading };
}
function settleStep(f, S, dt) {
  const st = S.settle;
  st.t += dt;
  if (st.t >= S.r) return finish(f, st.why);
  const g = 1 - smooth(st.t / S.r); // 붙드는 몫
  f.heading = st.h;
  f.yaw.setFromAxisAngle(_w.set(0, 1, 0), f.heading);
  S.want.set(0, 0, 0);
  S.wt = 0;
  const pel = f.bodies.pelvis;
  const ca = pel.translation();
  const pv = pel.linvel();
  const dvx = -pv.x * g;
  const dvz = -pv.z * g;
  const dw = -pel.angvel().y * g;
  for (const k of UPPER) {
    const b = f.bodies[k];
    if (!b) continue;
    const p = b.translation();
    const v = b.linvel();
    const w = b.angvel();
    b.setLinvel({ x: v.x + dvx + dw * (p.z - ca.z), y: v.y, z: v.z + dvz - dw * (p.x - ca.x) }, true);
    b.setAngvel({ x: w.x, y: w.y + dw, z: w.z }, true);
  }
  const Lp = f.gait.legs[S.pk];
  const fb = f.bodies[Lp.foot];
  const fw = fb.angvel();
  fb.setAngvel({ x: fw.x, y: fw.y * (1 - g), z: fw.z }, true);
}

/**
 * 내 칼이 무엇에 닿아 있나 (Rapier 접촉 — 읽기만): 'body' = 칼날이 상대 몸에(접촉 쌍 — 베는 칼은 물리대로 지나간다) ·
 *  'other' = 칼(칼날 · 칼자루)이 싸움꾼 밖의 것(무대 벽 · 땅 · 석상)에 실제로 닿음(접촉 거리 ≤ 0) · null = 없음. 상대 칼은 여기서 보지 않는다(칼끼리 feel.touching).
 *  무대 벽 곁에서 돌면 감은 칼이 벽에 걸린다 — 놓지 않으면 다음 스텝 대본 자리로 다시 놓여 칼이 튄다(브라우저 시험: 칼끝 73 m/s) → 막힘과 같이 놓고 멈춘다
 */
function swordContact(f) {
  const W = f.world;
  const foe = f.foe;
  if (!W || !f.armed) return null;
  const mine = new Set([...Object.values(f.bodies).map((b) => b.handle), f.sword.handle]);
  const foeB = new Set(foe?.bodies ? Object.values(foe.bodies).map((b) => b.handle) : []);
  const foeSword = foe?.sword?.handle;
  const blades = new Set(f.bladeColliders ?? []);
  let out = null;
  for (const c1 of f.swordColliders ?? []) {
    W.contactPairsWith(c1, (c2) => {
      if (out === 'other') return;
      const pb = c2.parent();
      const h = pb?.handle;
      if (h != null && (mine.has(h) || h === foeSword)) return;
      const body = h != null && foeB.has(h);
      if (body && (!blades.has(c1) || out)) return;
      W.contactPair(c1, c2, (m) => {
        for (let i = 0; i < m.numContacts(); i++) if (body || m.contactDist(i) <= 0) { out = body ? 'body' : 'other'; return; }
      });
    });
    if (out === 'other') break;
  }
  return out;
}

/**
 * 매 물리 스텝 (fighter.step 머리 — updateHeading 대신): 몸 방향 · 틀 빠르기 다시 세우기.
 *  넘어지거나 칼을 놓치면 끊는다. 끝(t ≥ time)이면 도는 발을 딛고 끝낸다.
 */
export function spinStep(f, dt) {
  const S = f.ibSpin;
  if (!S) return;
  if (f.state !== 'stand' || !f.alive || !f.gait?.active) return finish(f, 'state');
  if (S.settle) return settleStep(f, S, dt);
  if (S.tp < S.pre) {
    // 먼저 감기 (10/23 torso): 몸은 돌지 않고 서 있고, 두 팔 · 칼만 지금 자세 → 감은 자세로 (placeArms — 같은 기하). 끝나면 도는 발을 떼고 돌기 시작
    S.tp += dt;
    f.heading = S.h0;
    f.yaw.setFromAxisAngle(_w.set(0, 1, 0), f.heading);
    S.want.set(0, 0, 0);
    S.wt = 0;
    if (f.armed) placeArms(f, S, dt);
    if (S.tp >= S.pre) {
      const G = f.gait;
      G.begin(G.legs[S.sk], 'spin', S.T);
      G.footMass(G.legs[S.sk], false);
    }
    return;
  }
  S.t += dt;
  const { T, r } = S;
  // 칼이 무엇에 닿았나 (지난 스텝 접촉 — 칼끼리 feel.touching · 그 밖은 Rapier 접촉 쌍): 상대 몸이면 놓고(베는 칼은 물리대로 지나감) · 상대 칼 · 벽 · 땅이면 놓고 멈춤
  if (!S.free && f.armed) {
    const on = f.feel?.touching ? 'other' : swordContact(f);
    if (on) {
      S.free = true;
      S.freeT = S.t;
      if (S.touchT == null) S.touchT = S.t;
      S.stats.tipAtTouch = +f.tipVel.length().toFixed(2);
      if (on === 'other') S.blocked = true;
    }
  }
  if (S.blocked) return SECRET.ibSpin.settle ? beginSettle(f, S, 'blocked') : finish(f, 'blocked'); // 상대 칼에 막힘 → 몸 돌림도 여기서 멈춘다 (settle: ramp 초에 걸쳐 받아 멈춤)
  if (S.t >= T) return SECRET.ibSpin.settle ? beginSettle(f, S, 'done') : finish(f, 'done');
  if (!S.free && S.t >= T - r) {
    S.free = true; // 도는 빠르기가 줄기 시작 — 칼은 관성 · 서보로 앞을 가로지른다
    S.freeT = S.t;
  }
  const q = spinProgress(S.t, T, r);
  const qn = spinProgress(S.t + dt, T, r);
  S.q = q;
  S.rate = spinRate(S.t, T, r);
  const om = (S.dir * TAU * (qn - q)) / dt; // 이 스텝 도는 빠르기 (rad/s, heading +)
  f.heading = S.h0 + S.dir * TAU * q;
  f.yaw.setFromAxisAngle(_w.set(0, 1, 0), f.heading);
  // 골반이 갈 자리 · 빠르기 (수평): pelvisAt — 다음 스텝 자리와의 차로 빠르기
  const pel = f.bodies.pelvis;
  const ca = pel.translation();
  const c1 = pelvisAt(S, q, _p1);
  const cx = c1.x;
  const cz = c1.z;
  const c2 = pelvisAt(S, qn, _p2);
  const vx = (c2.x - cx) / dt;
  const vz = (c2.z - cz) / dt;
  const K = SECRET.ibSpin.track; // 어긋남을 메우는 세기 (1/s)
  const vtx = vx + (cx - ca.x) * K;
  const vtz = vz + (cz - ca.z) * K;
  S.want.set(vtx, 0, vtz);
  // 골반의 지금 방향 · 도는 빠르기 → 목표 방향(heading + 골반 비틀기)과의 어긋남도 메운다
  const pr = pel.rotation();
  _v.set(1, 0, 0).applyQuaternion(_q.set(pr.x, pr.y, pr.z, pr.w));
  const psiA = Math.hypot(_v.x, _v.z) > 0.3 ? ang(_v.x, _v.z) : f.heading;
  const wt = om + wrap(f.heading + (f.pelvisYawOffset || 0) - psiA) * K;
  S.wt = wt;
  const pv = pel.linvel();
  const wa = pel.angvel().y;
  const dvx = vtx - pv.x;
  const dvz = vtz - pv.z;
  const dw = wt - wa;
  // 도는 틀의 구심 몫 (대본이 낸다): 지난 스텝 곧게 나간 만큼(바깥으로 ω² · r · dt) 틀 안 빠르기에서 뺀다 — 안 빼면 칼 · 팔이 바깥으로 쏠려 몸을 끌어 넘어뜨린다(첫 시험: 칼끝 40 m/s · 넘어짐)
  const cen = wa * wa * dt;
  const rebase = (b) => {
    if (!b) return;
    const p = b.translation();
    const v = b.linvel();
    const w = b.angvel();
    const rx = p.x - ca.x;
    const rz = p.z - ca.z;
    b.setLinvel({ x: v.x + dvx + dw * rz - cen * rx, y: v.y, z: v.z + dvz - dw * rx - cen * rz }, true);
    b.setAngvel({ x: w.x, y: w.y + dw, z: w.z }, true);
  };
  for (const k of UPPER) rebase(f.bodies[k]);
  if (!S.free && f.armed) placeArms(f, S, dt);
  const G = f.gait;
  const Ls = G.legs[S.sk];
  rebase(f.bodies[Ls.thigh]);
  rebase(f.bodies[Ls.shin]);
  rebase(f.bodies[Ls.foot]);
  // 축발: 제자리에서 돈다 (발바닥 가운데 축) — 발 몸체는 도는 빠르기만, 다리 IK 목표(발목 · 발끝 · 발 방향)는 같은 각만큼 돌린다
  const Lp = G.legs[S.pk];
  const fb = f.bodies[Lp.foot];
  const fw = fb.angvel();
  fb.setAngvel({ x: fw.x, y: om, z: fw.z }, true);
  const turn = S.dir * TAU * q;
  const cs = Math.cos(turn);
  const sn = Math.sin(turn);
  const rot = (src, out) => {
    // heading 과 같은 쪽으로 turn 만큼 (y 축 회전: x' = x cos + z sin · z' = −x sin + z cos) — 발바닥 가운데 둘레
    const x = src.x - S.pinC0.x;
    const z = src.z - S.pinC0.z;
    out.x = S.pinC0.x + x * cs + z * sn;
    out.z = S.pinC0.z - x * sn + z * cs;
  };
  rot(S.plant0, Lp.plant);
  rot(S.pinT0, Lp.pinT);
  Lp.pinC.x = S.pinC0.x;
  Lp.pinC.z = S.pinC0.z;
  Lp.yaw = S.pivotYaw0 + turn;
  // 재기 (읽기만): 칼끝 빠르기
  if (f.armed) {
    const tv = f.tipVel.length();
    if (tv > S.stats.tipMax) S.stats.tipMax = tv;
    if (S.free && tv > S.stats.cutTipMax) S.stats.cutTipMax = tv;
  }
}

/**
 * 두 팔 · 칼을 대본 자세에 놓는다 (도는 동안 — 발도 secret_instant.js placeIai 와 같은 기하: 손 자리로 armIK · 위팔 · 아래팔 · 칼 · 두 손 칼이면 빈팔도 칼자루 끝에).
 *  자세 = 처음 손 · 칼날(몸 기준) → ramp 초에 SECRET.ibSpin.wind 로 (부드럽게) · 그 뒤 wind 그대로 (몸과 함께 돈다).
 *  날 = 그 자리에서 도는 틀이 칼날 70 % 지점을 미는 쪽(칼날에 수직인 몫) — 날이 서서 돈다. 빠르기 = 앞 스텝 놓은 자리와의 차 (첫 스텝은 도는 틀의 빠르기)
 */
const _c = new THREE.Vector3();
const _qc = new THREE.Quaternion();
const _qu = new THREE.Quaternion();
const _qf = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3();
const _z = new THREE.Vector3();
function placeArms(f, S, dt) {
  const J = f.jointByName;
  const chest = f.bodies.chest;
  const cr = chest.rotation();
  _qc.set(cr.x, cr.y, cr.z, cr.w);
  const ct = chest.translation();
  _c.set(ct.x, ct.y, ct.z);
  const inv = _qi.copy(f.yaw).invert();
  const sd = (f.side >= 0 ? 1 : -1) * (S.ws ?? 1); // 감는 쪽 (ws −1 = 반대로 돎 — 칼을 칼 없는 쪽 뒤로 감음)
  if (!S.arm) {
    const sw = f.sword.translation();
    const AH = new THREE.Vector3(sw.x - _c.x, sw.y - _c.y, sw.z - _c.z).applyQuaternion(inv);
    const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
    const Wp = SECRET.ibSpin.wind;
    const a = Wp.yaw * D2R;
    const e = Wp.el * D2R;
    S.arm = { AH, AD, WH: new THREE.Vector3(Wp.hand[0], Wp.hand[1], sd * Wp.hand[2]), WD: new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), sd * Math.cos(e) * Math.sin(a)), prev: new Map() };
  }
  const A = S.arm;
  const k = S.pre ? (S.tp < S.pre ? smooth(S.tp / S.pre) : 1) : smooth(S.t / S.r); // 먼저 감았으면(pre) 도는 동안은 감은 자세 그대로
  const H = A.AH.clone().lerp(A.WH, k);
  const D = A.AD.clone().applyQuaternion(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(A.AD, A.WD), k)).normalize();
  const target = H.clone().applyQuaternion(f.yaw).add(_c);
  f.armIK(target);
  const Sh = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(_qc).add(_c);
  _qu.copy(_qc).multiply(J.uarmS.target);
  _qf.copy(_qu).multiply(J.farmS.target);
  const elbow = new THREE.Vector3(0.3, 0, 0).applyQuaternion(_qu).add(Sh);
  const up = new THREE.Vector3(0.15, 0, 0).applyQuaternion(_qu).add(Sh);
  const fp = new THREE.Vector3(0.135, 0, 0).applyQuaternion(_qf).add(elbow);
  const wrist = new THREE.Vector3(0.13, 0, 0).applyQuaternion(_qf).add(fp);
  J.uarmS.prevTarget?.copy(J.uarmS.target);
  // 칼: 칼날 축 y = Dw · 날 x = 도는 틀이 칼날 70 % 지점을 미는 쪽의 Dw 수직 몫
  const Dw = D.clone().applyQuaternion(f.yaw).normalize();
  const p7 = wrist.clone().addScaledVector(Dw, f.weaponCfg.hiltLength + 0.7 * f.weaponCfg.bladeLength);
  const pc = f.bodies.pelvis.translation();
  const w = S.wt ?? 0;
  _x.set(S.want.x + w * (p7.z - pc.z), 0, S.want.z - w * (p7.x - pc.x));
  _x.addScaledVector(Dw, -_x.dot(Dw));
  if (_x.lengthSq() < 1e-6) _x.crossVectors(Dw, _z.set(0, 1, 0));
  if (_x.lengthSq() < 1e-6) _x.set(1, 0, 0).addScaledVector(Dw, -Dw.x);
  _x.normalize();
  _z.crossVectors(_x, Dw).normalize();
  _m.makeBasis(_x, Dw, _z);
  _qs.setFromRotationMatrix(_m);
  const put = (b, p, q) => {
    const pr = A.prev.get(b);
    let v, av;
    if (pr) {
      v = { x: (p.x - pr.p.x) / dt, y: (p.y - pr.p.y) / dt, z: (p.z - pr.p.z) / dt };
      const dq = q.clone().multiply(pr.q.clone().invert());
      if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
      av = { x: (2 * dq.x) / dt, y: (2 * dq.y) / dt, z: (2 * dq.z) / dt };
    } else {
      v = { x: S.want.x + w * (p.z - pc.z), y: 0, z: S.want.z - w * (p.x - pc.x) };
      av = { x: 0, y: w, z: 0 };
    }
    b.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    b.setLinvel(v, true);
    b.setAngvel(av, true);
    A.prev.set(b, { p: p.clone(), q: q.clone() });
  };
  put(f.bodies.uarmS, up, _qu.clone());
  put(f.bodies.farmS, fp, _qf.clone());
  put(f.sword, wrist, _qs.clone());
  if (f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3) {
    const pommel = new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(_qs).add(wrist);
    f.offArmIK(pommel);
    const So = new THREE.Vector3(0, 0.1, -f.side * 0.2).applyQuaternion(_qc).add(_c);
    const quo = _qc.clone().multiply(J.uarmO.target);
    const qfo = quo.clone().multiply(J.farmO.target);
    const eo = new THREE.Vector3(0, -0.3, 0).applyQuaternion(quo).add(So);
    put(f.bodies.uarmO, new THREE.Vector3(0, -0.15, 0).applyQuaternion(quo).add(So), quo);
    put(f.bodies.farmO, new THREE.Vector3(0, -0.14, 0).applyQuaternion(qfo).add(eo), qfo);
  }
}

/** 도는 뒷발의 발목 목표 (월드) · 발 방향 — gait.js poseLegs 가 부른다. out 에 적는다 */
export function spinFootTarget(f, l, out, ankleH, lift) {
  const S = f.ibSpin;
  const q = S.q;
  const a = S.a0 + S.da * q;
  const rr = S.br0 + (S.br1 - S.br0) * q;
  const bx = Math.cos(a) * rr; // 몸 기준 앞
  const bz = Math.sin(a) * rr; // 몸 기준 오른쪽
  const h = f.heading;
  const c = pelvisAt(S, q, _p1);
  const cx = c.x;
  const cz = c.z;
  // 몸 기준 → 월드 (forward = (cos h, −sin h) · right = (sin h, cos h))
  const u = 2 * q - 1;
  const up = 1 - u * u * u * u * u * u * u * u; // 곧 들고 끝 무렵까지 든 채 (끝에 몸이 서기 전 땅에 끌리지 않게 — sin 꼴은 끝 0.1 에 발이 끌려 바깥으로 밀렸다)
  out.set(cx + bx * Math.cos(h) + bz * Math.sin(h), ankleH + lift * up, cz - bx * Math.sin(h) + bz * Math.cos(h));
  return S.footYaw0 + S.dir * TAU * q;
}

/**
 * 비기 잔상 (10/23 사장님 02:0x '잔상과 궤적도 비기에 걸맞는지 체크해' — 감독 지시): 고노센 · 격살 · 죽음의 일격과 같은 그림(sword_trail.js f.instantArc · kind 'combo').
 *  칼을 놓은 뒤(대본 안 free · 받아 멈춤 포함) ~ 따라 지나감 동안 — 맞음이 날 수 있는 가로지르는 몫 — 스텝마다 칼자루 · 칼끝 점을 모으고, 밝기 share = 그동안 칼끝 평균 빠르기 ÷
 *  고노센 칼끝 빠르기(secret_instant.js iaiTipSpeed — artTrailTick speedShare 와 같은 셈 · ART_MIN ~ 1). 굳음에서 멈춘다(호는 sword_trail 이 instantArcLife 동안 옅게).
 *  SECRET.ibSpin.trail: 'cut'(기본 — 위) · 'all'(감는 몫부터 내내 — 견줌) · 0(끔). 물리 · 판정 무관(읽기만)
 */
function spinTrail(f) {
  const mode = SECRET.ibSpin.trail;
  const run = f.skill.sec;
  const st = run?.S?.do?.spin ? run.stage : null;
  const S = f.ibSpin;
  const on = mode && f.armed && (st === 'follow' || (st === 'spin' && S && (mode === 'all' || S.free)));
  if (!on) {
    f.spinArc = null;
    return;
  }
  let A = f.spinArc;
  if (!A) {
    A = f.spinArc = { arc: { id: (f.instantArc?.id ?? 0) + 1, kind: 'combo', share: ART_MIN, pts: [], ...(SECRET.secretArcMin > 0 ? { min: SECRET.secretArcMin } : {}) }, sum: 0, n: 0, v0: Math.max(1, iaiTipSpeed(f)) }; // 10/23 결정타 잔상 바닥(secretArcMin — 다른 비기와 같게 · 감독 병합 때)
    f.instantArc = A.arc;
  }
  const a = f.bladePoint(0, _ta);
  const b = f.bladePoint(1, _tb);
  A.arc.pts.push([a.x, a.y, a.z, b.x, b.y, b.z]);
  A.sum += f.tipVel?.length?.() ?? 0;
  A.n++;
  A.arc.share = clamp(A.sum / A.n / A.v0, ART_MIN, 1);
}
const _ta = new THREE.Vector3();
const _tb = new THREE.Vector3();

/**
 * 팔 · 칼 덧씌우기 자세 (skill.js update 머리 — 플레이어 비기 동안 · 끝난 뒤 걷음): skill.thrustPose 에 손 · 칼날 방향 · 몸 비틀기 목표 (물리 서보 목표).
 *  돌기(틀에 묶인 동안) = SECRET.ibSpin.wind(칼 든 쪽 뒤로 칼을 수평으로 감음) · 놓은 뒤 = 발도 길 끝 SECRET.iaiPath.E 를 거울로(가로로 반대쪽 끝까지 — 길목 지키기 끝과 같은 수) ·
 *  높이 각은 그 순간 내 칼자루 → 상대 몸 자리(SECRET.gilmokAim — 길목 지키기 gilmokCutPose 와 같은 식 · 같은 칸). phase: 'wind' | 'cut' | null(끔 — 0.12 s 에 걷음)
 */
const _gh = new THREE.Vector3();
const _gt = new THREE.Vector3();
export function spinCutPose(f, phase, dt) {
  spinTrail(f);
  const th = f.skill.thrustPose;
  const w0 = f.spinPoseW ?? 0;
  if (!phase && w0 <= 0) return;
  const w = phase ? 1 : Math.max(0, w0 - dt / 0.12);
  f.spinPoseW = w;
  th.w = w;
  if (!phase) return;
  f.skill.activity = 1; // 몸도 벨 때처럼 빠르게 따라온다 (탭 찌르기와 같은 몫)
  const V = SECRET.ibSpin;
  const ws = f.ibSpin?.ws ?? f.spinWs ?? 1; // 반대로 돎(−1) — 감는 쪽 · 끝 각 · 몸 비틀기 거울 (대본이 끝난 뒤 따라 지나감 · 굳음도 같은 쪽: f.spinWs)
  if (f.ibSpin) f.spinWs = ws;
  if (f.ibSpin?.blocked) f.spinLow = true; // 막혔으면 낮게 붙듦 (아래 torso — 막혀 튄 칼을 상대 머리 위로 다시 들지 않게)
  const s = (f.side >= 0 ? 1 : -1) * ws;
  const P = phase === 'wind' ? V.wind : SECRET.iaiPath.E;
  const m = phase === 'wind' ? 1 : -1; // 끝 자세는 발도 끝(칼 든 쪽으로 벰)을 거울로 — 탈류는 칼 든 쪽 → 반대쪽
  th.hand[0] = P.hand[0];
  th.hand[1] = P.hand[1];
  th.hand[2] = m * s * P.hand[2];
  let el = P.el;
  const foe = f.foe;
  let yaw = m * P.yaw;
  let cur = null; // 지금 칼 가로 각 (° — 감는 쪽 + · 몸 앞 0 · 끝 쪽 −)
  if (phase === 'cut' && f.armed) {
    // 가로로 끝까지: 목표 가로 각을 지금 칼 각보다 SECRET.ibSpin.lead 만큼만 앞에 둔다 (끝 각까지) — 감은 칼(칼 든 쪽 뒤)과 끝 각(반대쪽 앞)이 180° 가까이 벌어져
    //  한 번에 끝 자세를 주면 서보가 칼을 머리 위로 넘겨 돌렸다(브라우저 첫 그림). 앞선 목표가 늘 수평으로 lead 만큼이라 칼이 수평으로 앞을 가로지르고 제동도 늦게 걸린다
    const hp = f.bladePoint(0, _gh);
    const tp = f.bladePoint(1, _gt);
    const fx = Math.cos(f.heading);
    const fz = -Math.sin(f.heading);
    const dx = tp.x - hp.x;
    const dz = tp.z - hp.z;
    cur = Math.atan2(s * (dx * -fz + dz * fx), dx * fx + dz * fz) / D2R; // 감는 쪽 + (몸 기준 오른쪽 = (−fz, fx) × s)
    yaw = Math.max(yaw, cur - V.lead);
  }
  if (phase === 'cut' && foe?.bodies?.chest && f.armed) {
    // 겨누는 몸 자리 = 길목 지키기와 같은 칸 SECRET.gilmokAim (사장님 10/11 13:5x '최대한 위를 겨누고 쳐' — 둘러 베는 칼이 명령보다 처지는 몫을 겨눔으로 받는다)
    const hp = f.bladePoint(0, _gh);
    const tp = f.bladePoint(1, _gt);
    const L = hp.distanceTo(tp);
    const Aim = SECRET.gilmokAim;
    const ty0 = Aim === 'chest' || !foe.bodies.head ? foe.bodies.chest.translation().y : foe.bodies.head.translation().y + (Aim === 'headTop' ? foe.headR ?? 0 : 0);
    // 10/23 torso: 칼이 몸 앞 가운데를 지난 뒤(따라 지나감 · 굳음) · 막힌 뒤에는 칼끝을 내 가슴 점 높이로 붙든다 (사장님 '높이가 몸통부를 넘지 않게' — 전 겨눔은 가로지른 뒤
    //  칼을 상대 머리 위로 들어 올렸다 = 끝의 치솟음). 가로지르기 전은 전 겨눔 그대로(빠르게 도는 칼은 명령보다 처진다 — 츠바이핸더 −15° · 맞힘 그대로).
    //  명령 높이 = 가슴 + (가슴 − 지금 칼끝): 처지면 더 위를 · 넘으면 아래를 명령 — 골반 점 ~ 전 겨눔 사이로 자름
    const cy = f.bodies.chest.translation().y;
    if (cur != null && cur < 0) f.spinLow = true; // 한 번 가로질렀으면 끝까지 (따라 지나감 · 굳음)
    //  가로지르기 전이라도 칼끝이 몸통 위 끝(어깨 관절 높이 = 가슴 점 + ARM.shoulder[1] 0.1)을 넘으면 같은 식으로 끌어내린다. 반대로 돎(ws −1 — 레베스: 칼 든 팔이 펴지며
    //  벤다 · 처지지 않음)은 처음부터 이 식 — 전 겨눔을 따르면 플랑베르주가 +15° 로 솟아 넘겼다. 칼 든 쪽으로 돎(탈류 — 팔이 몸 앞을 건넘)은 처지므로 전 겨눔 그대로
    //  (가슴 점부터 끌면 츠바이핸더가 더 처져 서 있는 과녁 맞힘 4 → 2 / 5 — docs/strike/iberian_spin_2026-10-22.md §11)
    const fb = clamp(2 * cy - tp.y, f.bodies.pelvis.translation().y, ty0);
    const ty = V.torso && (f.spinLow || ws < 0 || tp.y > cy + ARM.shoulder[1]) ? fb : ty0;
    if (L > 0) el = Math.asin(clamp((ty - hp.y) / L, -1, 1)) / D2R;
  }
  const a = yaw * D2R;
  const e = el * D2R;
  th.dir[0] = Math.cos(e) * Math.cos(a);
  th.dir[1] = Math.sin(e);
  th.dir[2] = s * Math.cos(e) * Math.sin(a);
  // 몸 비틀기: 덧씌우기 칸 부호 그대로 (끝 = 길목 지키기 탈류 끝과 같은 부호 — 몸이 벤 쪽으로 돌아감)
  const B = P.body ?? { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 };
  th.pelvisYaw = ws * B.pelvisYaw * D2R;
  th.chestYaw = ws * B.chestYaw * D2R;
  th.pitch = B.pitch * D2R;
  th.drop = B.drop;
}
