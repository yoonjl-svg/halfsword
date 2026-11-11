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
//   skill.js update(spinCutPose). 대본이 없으면(f.ibSpin = null) 아무 일도 없다. 10/24 부터 AI 도 쓴다(SECRET.aiOpenSchools 'iberian' — ai.js spinTick → skill.secret · 숙련도 5 이상 이베리아 인물만).
//  10/24 사장님 02:5x '속도가 너무 과도하게 헛돌아. 몸이 종잇장처럼 날라다니듯 기울어' → 빠르기 = 고노센 칼끝의 몫(spinPlan · spinCap — SECRET.ibSpin.share) · 몸 곧게(uprightStep · 골반 높이 · 도는 발 자리 — SECRET.ibSpin.upright).
//  10/24 10:4x '싱지르 개편 뒤에 또 허공 위로 날아가는 싱지르가 많아졌어' · 10:5x '고노센의 70%로' → share 0.7 · 낼 때 손 목표 쉼 자리(spinHandRest) · 몸통 뚜껑(spinLid) · 땅은 막힘 아님(swordContact) —
//   docs/strike/iberian_spin_2026-10-22.md §16.
//  10/24 12:5x '3번째 프레임 같은 발디딤 이상하지 않어?' · 13:0x '두 다리가 딱 붙어서 곧게 편 채 같은 방향을 지지' → 발디딤(feetPlan · feetStep — SECRET.ibSpin.feet):
//   두 발을 끝난 골반 둘레 펜싱 자세 자리에 · 묵은 걸음 부탁 지움 — §17.
//  11/12 특수 공격 '풍차 베기 (싱지르)' 두 마디 (사장님 '먼저 빠르게 돌고 그 다음 발을 내딛으면서베야지' · '앞 디딤발 각도를 90도 정도 틀어서 미리' — SECRET.ibSpin.split · splitStep):
//   앞발 틀어 엉덩이 밑에 딛기 → 그 발 축 제자리 돌기 → 마지막 몫을 돌며 앞발 내디디고 벰 — docs/strike/windmill_2026-11-12.md
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, ARM, SKILL, GAIT } from './config.js';
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
/**
 * 11/12 두 마디 판의 도는 진행 (0~1) — 오름 a 초(smoothstep) · 내림 b 초가 다름: 돌기 마디(가)는 a 초에 올라 그 빠르기로 돌고, 내딛기 마디(나) b 초 동안 내려 0 (spinProgress 의 a = b 판).
 *  가운데 빠르기 = 1 ÷ (T − a/2 − b/2)
 */
export function spinProgress2(t, T, a, b) {
  if (t <= 0) return 0;
  if (t >= T) return 1;
  let F;
  if (t < a) F = a * smoothInt(t / a);
  else if (t < T - b) F = a / 2 + (t - a);
  else {
    const y = (t - (T - b)) / b;
    F = a / 2 + (T - b - a) + b * (y - smoothInt(y));
  }
  return F / (T - a / 2 - b / 2);
}
/** 그때 도는 빠르기의 몫 (최고 = 1) */
export function spinRate(t, T, r) {
  if (t <= 0 || t >= T) return 0;
  return smooth(t / r) * (1 - smooth((t - (T - r)) / r));
}

/**
 * 한 바퀴 계획 (10/24 사장님 02:5x '속도가 너무 과도하게 헛돌아 … 필요 시 싱지르를 더 느리게 바꿔. 지금 고노센의 몇%지?' — SECRET.ibSpin.share):
 *  share > 0 이면 빠르기를 고노센 칼끝 빠르기(secret_instant.js iaiTipSpeed — 같은 칼의 발도 베는 몫)의 몫으로 정한다(격살 gyeoksal.share 와 같은 틀):
 *   칼끝 빠르기 목표 v = share × 고노센 칼끝 빠르기 · 가운데 도는 빠르기 ω = v ÷ 칼끝 거리(검술 풀이 measure.reach — 팔을 다 뻗은 칼끝까지: 가로지를 때 꼴) ·
 *   한 바퀴 T = ramp + 2π ÷ ω (spinProgress — 가운데 빠르기 = 2π ÷ (T − ramp)). 칼끝 빠르기는 v 로 자른다(spinCap — 두 쪽 모두).
 *  share 0 이면 10/22 판(한 바퀴 SECRET.ibSpin.time · 자름 없음). 돌려줌 { T, r, v(칼끝 상한 m/s — 없으면 ∞), w(가운데 rad/s), v0(고노센 칼끝 m/s) }
 */
export function spinPlan(f, shareOver = null) {
  const S = SECRET.ibSpin;
  const share = shareOver != null ? +shareOver || 0 : +S.share || 0; // 11/11 특수 공격 싱지르 = specialShare.cingir (skill.js — requestSpin opt.share)
  if (!(share > 0)) {
    const r = Math.min(S.ramp, S.time / 2);
    return { T: S.time, r, v: Infinity, w: TAU / (S.time - r), v0: null };
  }
  const v0 = iaiTipSpeed(f);
  const v = share * v0;
  const R = f.swordArt?.measure?.reach ?? f.weaponCfg.hiltLength + f.weaponCfg.bladeLength + 0.6;
  const w = v / Math.max(0.5, R);
  const r = S.ramp;
  return { T: r + TAU / w, r, v, w, v0 };
}

/**
 * 칼끝 빠르기 자르기 (10/24 — share 판): 칼끝(칼날 끝 점)의 실제 빠르기가 v 를 넘으면 칼 · 두 팔의 빠르기를 같은 몫으로 줄인다(칼 몸체는 굳은 몸이라 칼끝 빠르기도 그 몫).
 *  놓은 칼이 서보 · 팔 펴짐으로 몸 돌림보다 빨라지는 몫(반대 쪽 가까이서 43 m/s — §11-3)을 막는다. 대본이 칼을 놓은 뒤 ~ 따라 지나감 동안 (iberian_spin.js spinStep · skill.js follow)
 */
const _tp = new THREE.Vector3();
export function spinCap(f, v) {
  if (!(v < Infinity) || !f.armed) return;
  const tip = f.bladePoint(1, _tp);
  const tv = f.sword.velocityAtPoint({ x: tip.x, y: tip.y, z: tip.z });
  const s = Math.hypot(tv.x, tv.y, tv.z);
  if (s <= v) return;
  const k = v / s;
  const scale = (b) => {
    if (!b) return;
    const l = b.linvel();
    const a = b.angvel();
    b.setLinvel({ x: l.x * k, y: l.y * k, z: l.z * k }, true);
    b.setAngvel({ x: a.x * k, y: a.y * k, z: a.z * k }, true);
  };
  scale(f.sword);
  scale(f.bodies.farmS);
  scale(f.bodies.uarmS);
  if (f.weaponCfg.twoHand) {
    scale(f.bodies.farmO);
    scale(f.bodies.uarmO);
  }
  f.spinCapN = (f.spinCapN ?? 0) + 1; // 잘린 스텝 수 (재기)
}

/**
 * 골반이 갈 자리 (수평, 월드) — 축(축발 발바닥 가운데 P) 둘레로 몸과 함께 돌고, 축에서 본 골반 자리 o 는 (처음 몸 기준으로)
 *  처음 '축발 뒤'(o0) → 돌기 첫 SHIFT 몫에 '축발 바로 옆'(oM — 앞뒤 0 · 옆은 그대로: 무게가 축발에 실린다) → 마지막 SHIFT 몫에 '축발 앞'(o1 = 끝 골반(처음 + D) − P).
 *  c(q) = P + R(돈 각) · o(q). (o 를 곧게 옮기면 골반이 축발 둘레 반지름 0.5 m 로 크게 돌아 몸이 옆으로 0.5 m 쏠렸다 — 첫 시험)
 */
const HIP_W = 0.095; // 골반 가운데 → 엉덩이 관절 옆 거리 (m — fighter.js partDefs 허벅지 자리 · gait.js sense 와 같은 몸 수)
const SHIFT = 0.25; // 무게를 축발로 옮기는 몫 · 끝에 내딛는 발로 옮기는 몫 (돌기 진행 q 의 — 시간 값 아님)
const HIP_TWIST = 0.6; // 허벅지 비틀기 한계 (rad — fighter.js jointDefs 골반 → 허벅지 lim y · 있는 몸 수): 발은 골반보다 이만큼까지만 더 틀 수 있다 (무릎 · 발목은 경첩)
const FOOT_LEAD = HIP_TWIST * 0.5; // 11/12 앞발 틀기에서 발이 골반보다 먼저 트는 몫 (rad · 17°) — 넘는 몫은 몸도 먼저 돈다(bp). 한계에 붙이면(0.6) 돌기 내내 엉덩이가 끝까지 비틀렸다(재기 36° · 11/11 판 22°) · 반이면 20 ~ 24° [새 값 · 사장님 확인 전]
/** 11/12 두 마디 판: 낼 때부터 몸이 돈 각 (돌기 진행 q · 발 틀기 동안 먼저 돈 몫 S.bp 를 더함) */
const rotOf = (S, q) => S.bp + (TAU - S.bp) * q;
function pelvisAt(S, q, out) {
  const m = smooth(q / SHIFT);
  const n = smooth((q - ((S.sAt || 1) - SHIFT)) / SHIFT); // 11/11 stride: 끝으로 옮기기를 sAt(SECRET.ibSpin.strideAt) 까지 마침 — 칼이 앞을 가로지르기 전에 (전 판 sAt 1 = 돌기 마지막 몫)
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
 * 발디딤 계획 (10/24 12:5x 사장님 '넘어지지 않으려면 다리가 넓게 딛거나 무릎 관절로 몸을 분산 지지해야 하는데 두 다리가 딱 붙어서 곧게 편 채 같은 방향을 지지하고 있음' —
 *  SECRET.ibSpin.feet · 사장님 확인 전, 확인표 2420): 끝난 골반 E 둘레 펜싱 자세 자리 — gait.js guardSpot · guardYaw 와 같은 기하(걸음 칸 guardLength · guardWidth · weightFront ·
 *  GAIT.rearToe — 모두 있는 수 · 이베리아 0.62 · 0.34 · 0.5). 앞발(F)은 E 앞 · 뒷발(B)은 E 뒤, 옆은 제 쪽 — 골반이 두 발 사이에 서고(다리가 'ㅅ' 꼴로 마주 받침) 두 발이 엇갈리지 않는다
 *  (이베리아 원 걸음 compás curvo — 한 발이 다른 발 둘레를 돌되 두 발은 엇갈리지 않고 자세 너비를 지킨다).
 *  돌려줌 { B1 도는 발 자리 · P1 축발이 옮겨 딛을 자리 (월드 수평) · yawS · yawP 그 발들의 방향 (heading 기준 rad) }
 */
function feetPlan(G, Lp, Ls, E, fwd, rgt) {
  const P = G.P;
  const spot = (l) => {
    const x = l.k === 'F' ? P.guardLength * (1 - P.weightFront) : -P.guardLength * P.weightFront;
    const z = l.side * P.guardWidth * 0.5;
    return new THREE.Vector3(E.x + fwd.x * x + rgt.x * z, 0, E.z + fwd.z * x + rgt.z * z);
  };
  const yaw = (l) => (l.k === 'B' ? -l.side * GAIT.rearToe : 0);
  return { B1: spot(Ls), P1: spot(Lp), yawS: yaw(Ls), yawP: yaw(Lp) };
}

/**
 * 축발 옮겨 딛기 (10/24 12:5x — SECRET.ibSpin.feet): 한 바퀴를 다 돌면(받아 멈춤 들머리 — beginSettle 'done') 도는 발은 제 자세 자리(feetPlan B1)에 막 딛었고, 축발을 떼어
 *  받아 멈춤 ramp 초(0.2 s — 시간 사다리 '반응' · 있는 수) 동안 제 자세 자리 P1 으로 한 걸음 옮긴다(spinFootTarget). 한 발 축으로만 다 돌면 골반이 나아간 만큼(advance)
 *  축발이 몸 밑 · 뒤에 남아 두 발이 골반 뒤에 나란히 섰다 — 나아감(맞힘에 걸림: 0.2 m 로 줄이면 곧장 낸 판 서 있는 과녁 맞힘 15 → 0 / 18)은 그대로 두고 발만 따라 옮긴다.
 *  돌던 중에 바꾸면(예 진행 0.75 — 90° 남음) 도는 발의 끝 자리가 그때 몸의 반대쪽이라 두 발이 엇갈렸고(19 / 36 판), 남은 돌기를 새로 딛은 뒷발 하나로 받치면 그 발이 0.2 ~ 0.6 m 끌렸다
 */
function feetStep(f, S) {
  const G = f.gait;
  const Ln = G.legs[S.sk]; // 도는 발 (막 딛음)
  const Lo = G.legs[S.pk]; // 축발 → 떼어 옮김
  if (!Ln.stance) G.touchdown(Ln, 0.5);
  S.feet.step = { f0: new THREE.Vector3(Lo.ankle.x, 0, Lo.ankle.z), y0: Lo.yaw, e: 0 };
  Lo.yawTD = Lo.yaw;
  G.begin(Lo, 'spin', S.r);
  G.footMass(Lo, false);
  S.pk = Ln.k; // 받아 멈춤의 축(발 돌림을 늦춤) = 딛은 발 · 들린 발(spinFootTarget) = 옮기는 발
  S.sk = Lo.k;
}

/**
 * 가까운 상대 — 뒷발 축 (11/05 — SECRET.ibSpin.near · 사장님 확인 전 · docs/strike/singir_fall_2026-11-05.md): 낼 때 두 발로 서 있고 상대 가슴이
 *  '내 맞닿기 거리(검술 풀이 measure.contact) + 나아감(SECRET.ibSpin.advance)' 안이면(앞발 축으로 나아가면 맞닿기 거리 안으로 들어가는 거리) true — 모두 있는 수 · 새 수 없음.
 *  잰 원인 — 싱지르를 낸 뒤 1 s 안 넘어짐은 모두 맞아서(휘청 게이지 · 머리 둔타)였고 몸 균형(발 밖 · 기울기)은 0. 앞발 축 대본은 처음 0.1 ~ 0.2 s 에 무게를 앞발로 옮기며
 *  골반을 상대 쪽으로 0.3 m(대본 골반 3.5 m/s · 실제 5 ~ 6 m/s) 내밀어, 이미 들어오던 상대 칼에 내 허리 · 도는 다리 · 배가 들이받아 맞음 에너지가 커졌다
 *  (내 몸 빠르기를 맞음 셈에서 빼면 롱소드 AI 상대 1 s 안 넘어짐 14 → 6 / 93). 가까우면 뒷발을 축으로 돈다 — 처음 무게는 상대에게서 먼 뒷발로 옮겨지고(물러남),
 *  나아감은 그대로라 한 바퀴 끝에 칼과 함께 앞으로 나간다(끝난 골반 · 두 발 자리는 전 판과 같음 — feetPlan). 멀면 전 판 그대로(앞발 축).
 *  near 1 = 위 · 'place' = 뒷발 축 · 제자리(나아감 0 — 칼끝 거리 안일 때만 · 견줌) · 'contact' = 제자리 · 맞닿기 거리 안만(견줌) · 0 = 전 판(늘 앞발 축) · `?ibNear=0`
 */
export function spinNear(f) {
  const S = SECRET.ibSpin;
  if (!S.near) return false;
  const M = f.swordArt?.measure;
  if (!M?.contact || !f.foe) return false;
  const d = f.foeDistance();
  if (S.near === 'contact') return d < M.contact; // 견줌
  if (S.near === 'place') return d < Math.min(M.reach ?? Infinity, M.contact + (S.advance ?? 0)); // 견줌: 제자리에서도 칼이 닿는 거리(칼끝 거리) 안
  return d < M.contact + (S.advance ?? 0);
}

/**
 * 대본을 건다 (플레이어 비기 — skill.js secret). 서서 한 발 이상 딛고 있어야 한다. 시작했으면 true.
 *  dir: 도는 쪽 (+1 = heading + = 왼쪽으로 — 칼 든 쪽이 오른쪽인 몸은 왼쪽으로 돌며 칼이 오른쪽 뒤에 감겨 따라오다 오른쪽 → 왼쪽으로 가로 벤다 = 탈류)
 *  want: 바라는 쪽 (10/23 스틱 판 — 돌린 쪽 · ±1). SECRET.ibSpin.reverse 면 그쪽으로(칼 든 쪽의 반대면 ws = −1 — 감는 자세 · 끝 각 · 몸 비틀기 거울 = 레베스), 아니면 칼 든 쪽이 정함
 *  (10/23 torso) 칼(손 · 칼날)이 내 가슴 점보다 높게 있으면 pre = ramp 초 동안 돌지 않고 먼저 감은 자세로 내린다 — 높은 자세에서 낸 칼이 도는 동안 머리 위로 치솟지 않게
 */
export function requestSpin(f, want = 0, opt = {}) {
  const G = f.gait;
  if (!G?.active || f.state !== 'stand' || f.ibSpin) return false;
  if (!G.legs.F.stance && !G.legs.B.stance) return false; // 두 발이 다 떠 있으면(뛰듯 걷는 한순간) 축발이 없다
  const S = SECRET.ibSpin;
  const plan = spinPlan(f, opt.share ?? null); // 10/24 share 판: 칼마다 한 바퀴 시간 · 칼끝 상한 (share 0 = 10/22 판 time) · 11/11 특수 공격 = specialShare.cingir
  // 11/11 한 걸음 나가며 (사장님 '싱지르는 … 돌때 한 걸음 앞으로 나가며 치게 동작을 바꾸자. 지금 맞추기가 매우 어려움' — 특수 공격 싱지르만 · SECRET.ibSpin.stride):
  //  거리와 상관없이 앞발 축(가까운 상대 뒷발 축 near 안 씀) · 골반은 한 바퀴에 stride m 상대 쪽으로(두 발 앞뒤 거리 · advance 상한 안 씀) · strideAt 까지 다 나아감
  const stride = opt.special && S.stride > 0 ? S.stride : 0;
  // 11/12 두 마디 (사장님 '다리 하나를 축 삼아 돌고 있는데 그러면 안 되지. 먼저 빠르게 돌고 그 다음 발을 내딛으면서베야지' · '돌려면 앞 디딤발 각도를 90도 정도 틀어서 미리 바꿔야 할 수도 있어' —
  //  SECRET.ibSpin.split · 기록 docs/strike/windmill_2026-11-12.md): (가-0) 앞발 틀기 → (가) 앞발 축으로 제자리 돌기(골반은 축발 위로만 · 뒷발은 끝 자세 뒷발 자리에 딛음) →
  //  (나) 마지막 몫을 돌며(디딘 뒷발 앞꿈치 축) 앞발을 stride 만큼 내딛고 벰. 한 바퀴 시간 = split.turn + split.step (칼끝 상한은 그대로 specialShare 몫 — 놓은 칼만 자름 · splitStep). 끄면(split.on 0) 11/11 판(돌며 나아감)
  const SP = stride > 0 && S.split?.on && S.upright && S.feet ? S.split : null;
  const T = SP ? SP.turn + SP.step : plan.T;
  const r = plan.r;
  const fwd = f.forward(new THREE.Vector3());
  const rgt = f.right(new THREE.Vector3());
  // 축발 = 앞발 (펜싱 자세면 칼 든 쪽). 걷는 중이면 디딘 발이 축 — 떠 있던 발은 그 자리에서 도는 발로 이어받는다
  const both = G.legs.F.stance && G.legs.B.stance;
  const near = both && !stride && spinNear(f);
  // 11/12 두 마디 발 틀기(prepFoot — 아래): 축 = 도는 쪽의 반대편 발(왼쪽으로 돌면 오른발 — 등 돌려 도는 꼴 · 펜싱 자세면 앞발) · 다른 발은 (떠 있으면 곧장) 딛고 · 축발은 들어 틀어 엉덩이 밑에 딛는다.
  //  걷다 지나 딛는 중(축발이 뒤)이어도 같은 발 — 앞에 있는 발을 축으로 고르면 도는 쪽 발이 되어(몸 쪽으로 도는 꼴) 몸이 먼저 돌 때 뒤에 남은 발이 반대편으로 넘어가 두 발이 엇갈렸다
  const prepFoot = !!(SP && (SP.foot > 0 || SP.under));
  const dir0 = S.reverse && (want === 1 || want === -1) ? want : f.side >= 0 ? 1 : -1; // 아래 dir 과 같은 셈
  const pk0 = prepFoot ? (G.legs.F.side === dir0 ? 'F' : 'B') : both ? G.frontLeg(fwd) : G.legs.F.stance ? 'F' : 'B';
  const pk = near ? (pk0 === 'F' ? 'B' : 'F') : pk0; // 11/05 near: 상대가 가까우면 뒷발이 축 (위 spinNear)
  const sk = pk === 'F' ? 'B' : 'F';
  const Lp = G.legs[pk];
  const Ls = G.legs[sk];
  const P = new THREE.Vector3(Lp.pinC.x, 0, Lp.pinC.z); // 축 = 축발 발바닥 가운데 (땅)
  const B0 = new THREE.Vector3(Ls.ankle.x, 0, Ls.ankle.z);
  const rx = B0.x - P.x;
  const rz = B0.z - P.z;
  const lon = Math.abs(rx * fwd.x + rz * fwd.z); // 두 발 사이 앞뒤 거리 = 나아가는 거리
  const lat = rx * rgt.x + rz * rgt.z; // 옆 거리 (그대로 둔다 — 디딘 뒤 다리가 엇갈리지 않게)
  // 도는 발이 딛는 자리: 10/22 판 = 축발 앞 lon(앞뒤가 뒤집힌 채 끝남 — 걸음이 펜싱 자세로 고쳐 딛으며 앞에 딛은 뒷발을 몸 뒤로 물리면 몸이 두 발 앞에 남아
  //  균형 걸음이 0.3 m 더 끌려 나갔다: 비기 끝 + 0.6 s 골반 옮김 0.57 ~ 0.85 m — docs/strike/iberian_spin_2026-10-22.md §13) ·
  //  10/24 upright = 나아간 골반 바로 옆(옆 거리 그대로): 골반은 두 발 위에 서고, 걸음은 칼 든 쪽 앞발만 앞으로 고쳐 딛는다(몸은 그 자리 — 서 있는 과녁 앞 0.43 ~ 0.51 m)
  const place = near && (S.near === 'place' || S.near === 'contact'); // 11/05 견줌: 뒷발 축 · 제자리 (나아감 0)
  const adv = stride > 0 ? stride : place ? 0 : S.upright ? Math.min(lon, S.advance ?? lon) : lon; // 골반이 나아가는 거리 (10/24 upright: 상한 advance — 걷다 내면 두 발 앞뒤가 0.65 m 까지 벌어져 그만큼 나아갔다)
  let B1 = near ? B0.clone().addScaledVector(fwd, adv) : P.clone().addScaledVector(fwd, S.upright ? adv - lon : lon).addScaledVector(rgt, lat); // upright: 나아간 골반 바로 옆 (adv = lon 이면 축발 옆 · 못 미치면 그만큼 축발 뒤 — 축발이 앞발인 펜싱 자세) · near(뒷발 축): 도는 앞발은 제 자리 + 나아감 (feet 1 이면 아래 feetPlan 이 덮음)
  const nat = f.side >= 0 ? 1 : -1; // 칼 든 쪽이 정하는 쪽 (10/22 판)
  const dir = S.reverse && (want === 1 || want === -1) ? want : nat;
  const pre0 = S.torso && f.armed && swordTop(f) > f.bodies.chest.translation().y ? r : 0;
  // 11/12 앞발 틀기 (split.foot ° · split.under): 앞발(축발)을 들어 도는 쪽으로 ft 만큼 틀어 디딘다(under 1 = 제 엉덩이 밑으로 당겨 딛음 — 몸무게 밑에 축을 두어
  //  돌기 동안 골반이 축발로 옮겨 가며 떠돌지 않게 · 돌아온 뒷발이 축발 앞쪽에 엇갈리지 않고 딛게). 발은 골반보다 허벅지 비틀기 한계(HIP_TWIST)까지만 더 틀 수 있어
  //  그 반(FOOT_LEAD)을 넘는 몫(bp)만큼 몸(골반 · 몸통)도 같은 쪽으로 먼저 돈다 — 그동안 뒷발은 디딘 채 몸과 함께 돈다(앞꿈치 돌기). 틀기 시간 split.prep (먼저 감기 pre0 와 겹침)
  const ft = prepFoot ? (SP.foot || 0) * D2R : 0;
  const pre = prepFoot ? Math.max(pre0, SP.prep) : pre0;
  const pel = f.bodies.pelvis.translation();
  const c0 = new THREE.Vector3(pel.x, 0, pel.z);
  const D = fwd.clone().multiplyScalar(SP ? 0 : adv); // 11/12 두 마디: 도는 동안 골반은 제자리 (나아감은 내딛기 마디에서 — sp.D)
  // 10/24 12:5x 발디딤 (SECRET.ibSpin.feet · 사장님 확인 전, 확인표 2420): 두 발이 끝난 골반(E = c0 + D) 둘레 펜싱 자세 자리(걸음 칸 guardLength · guardWidth · weightFront —
  //  있는 수)에 서게 한다. 도는 발은 한 바퀴 끝에 제 자리에 딛고, 축발은 받아 멈춤 동안 제 자리로 한 걸음 옮긴다(feetStep · spinFootTarget).
  //  전(10/24 02:5x upright): 도는 발 = 낼 때 그 발의 골반 기준 자리 그대로 + 나아감 · 축발 = 제자리 → 골반이 축발 위 · 앞으로 나가 두 발이 골반 뒤에 나란히(앞뒤 0 ~ 0.2 m),
  //  두 다리가 같은 쪽으로 기울어 받침(무게 가운데가 발바닥 앞 끝 — docs/strike/iberian_spin_2026-10-22.md §17)
  const FT = S.upright && S.feet ? feetPlan(G, Lp, Ls, c0.clone().add(D), fwd, rgt) : null;
  if (FT) B1 = FT.B1;
  // 11/12 두 마디: 끝 두 발 자리 (끝난 골반 E = c0 + stride 앞 둘레 펜싱 자세 — feetPlan 같은 기하 · 발 열쇠 대신 맡은 일로): 도는 발 → 뒷발 자리 RB (돌기 끝에 딛음) · 축발 → 앞발 자리 FP (내딛기)
  const E = SP ? c0.clone().addScaledVector(fwd, stride) : null;
  const FE = SP ? splitSpots(G, Lp, Ls, E, fwd, rgt) : null;
  // 도는 발 길 (몸 기준 — 골반 원점 · x 앞 · z 오른쪽): 처음 자리 b0 → 끝 자리 b1 (끝 골반 = c0 + D 기준). 각은 짧은 쪽(둘 다 그 발 쪽 옆이라 바깥 옆을 지난다)
  const toBody = (x, z) => ({ x: x * fwd.x + z * fwd.z, z: x * rgt.x + z * rgt.z });
  const b0 = toBody(B0.x - c0.x, B0.z - c0.z);
  const b1 = toBody(B1.x - c0.x - D.x, B1.z - c0.z - D.z);
  const a0 = Math.atan2(b0.z, b0.x);
  const da = wrap(Math.atan2(b1.z, b1.x) - a0);
  f.spinLow = false; // 가로질렀거나 막혔나 (spinCutPose — 그 뒤 칼끝을 가슴 높이로)
  f.ibSpin = {
    t: 0, T, r, dir, ws: dir * nat, pre, tp: 0, settle: null, h0: f.heading, q: 0, rate: 0, vmax: plan.v, v0: plan.v0,
    pk, sk, P, B0, B1, br0: Math.hypot(b0.x, b0.z), br1: Math.hypot(b1.x, b1.z), a0, da,
    c0, D, lon, near, // near: 11/05 가까운 상대 — 뒷발 축 (spinNear)
    stride, sAt: stride > 0 ? clamp(S.strideAt ?? 1, 2 * SHIFT, 1) : 1, // 11/11 한 걸음 나가며 (특수 공격 — 나아감 m · 끝으로 옮기기를 마치는 진행)
    o0: new THREE.Vector3(c0.x - P.x, 0, c0.z - P.z), o1: new THREE.Vector3(c0.x + D.x - P.x, 0, c0.z + D.z - P.z),
    oM: rgt.clone().multiplyScalar(-Lp.side * HIP_W), // 축발 엉덩이가 축발 바로 위 (골반 가운데 = 축발에서 엉덩이 폭만큼 안쪽)
    arm: null, // 두 팔 · 칼 대본: 처음 손 · 칼날 (몸 기준) · 지난 스텝 놓은 자리 (빠르기 셈)
    footYaw0: Ls.footYaw, pivotYaw0: Lp.yaw, pinC0: Lp.pinC.clone(), pinT0: Lp.pinT.clone(), plant0: Lp.plant.clone(),
    feet: FT && { yawFix: wrap(f.heading + FT.yawS - Ls.footYaw), P1: FT.P1, yaw1: FT.yawP, step: null }, // 10/24 12:5x 발디딤 (끔이면 null): 도는 발 방향 고침 · 축발이 옮겨 딛을 자리 · 그 발 방향(heading 기준) · 옮기는 중 { f0 · y0 · e 지난 s }
    free: false, // 두 팔 · 칼을 틀에서 놓았나
    blocked: false, // 상대 칼에 닿아 멈췄나
    touchT: null, // 칼이 상대에 처음 닿은 때 (s)
    freeT: null,
    want: new THREE.Vector3(), // 골반이 가려는 빠르기 (fighter.driveBalance 의 want)
    stats: { tipMax: 0, tipAtTouch: null, cutTipMax: 0 },
  };
  // 10/24 12:5x feet: 기술이 부탁해 둔 걸음(gait.req — 공격 원을 그리는 획이 '내딛기' 지나 딛기를 부탁해 두면 그 걸음 중에 싱지르가 나간다)을 대본이 이어받으므로 지운다.
  //  대본 동안 걸음은 쉬어 그 부탁이 늙지 않고(gait update 의 age 셈이 대본 뒤에 있음) 대본이 끝나자마자 뒷발이 앞발을 지나 한 걸음 더 나가 몸이 두 발 뒤에 남았다(원 판 18 / 18)
  if (FT) G.req = null;
  if (SP) {
    // 11/12 두 마디 (splitStep): sp 판 몫 — 몸이 먼저 돈 각 bp · 마디 시간 T1 · T2 · (가) 끝 진행 q1 · 돈 각 rot1 · 끝 골반 E · 끝 두 발 자리 FE · 축발 · 다른 발 열쇠(마디마다 pk · sk 를 바꿔 씀)
    const I = f.ibSpin;
    let bp = Math.max(0, ft - FOOT_LEAD);
    if (bp > 0) {
      // 몸을 먼저 돌리는 몫은 다른 발이 몸의 제 쪽에 남는 만큼까지 (걷다 지나 딛는 중 — 다른 발이 골반 앞에 있으면 조금만 돌린다: 그대로 돌리면 앞에 있던 발이 몸의 반대편이 되어 두 발이 엇갈렸다)
      const ox = Ls.ankle.x - c0.x;
      const oz = Ls.ankle.z - c0.z;
      let ok = 0;
      for (let a = 0; a <= bp + 1e-9; a += 2 * D2R) {
        const h = f.heading + dir * a;
        if (Ls.side * (ox * Math.sin(h) + oz * Math.cos(h)) < 0) break;
        ok = a;
      }
      bp = Math.min(bp, ok);
    }
    const fte = Math.min(ft, bp + FOOT_LEAD); // 발이 실제로 트는 각 (몸이 덜 돌면 발도 덜 틈 — 엉덩이 비틀림 FOOT_LEAD 안)
    const q1 = spinProgress2(SP.turn, T, r, SP.step);
    Object.assign(I, { sp: SP, ft: fte, bp, prepFoot, T1: SP.turn, T2: SP.step, q1, rot1: bp + (TAU - bp) * q1, E, FE, axisK: pk, otherK: sk, stepPh: null, stepped: false });
    I.axisPin = { pinC0: I.pinC0, pinT0: I.pinT0, plant0: I.plant0, yaw0: I.pivotYaw0 }; // 축발 디딘 자리 · 방향 (발 틀기면 beginTurn 이 틀어 디딘 자리로 다시)
    if (prepFoot) {
      // 발 틀기 동안: 앞발(축발)은 들려 ft 틀며 제 엉덩이 밑(under — 몸이 bp 돈 뒤 엉덩이 관절 자리)이나 제자리에 딛고(spinFootTarget 디딤 바꿈 길) · 뒷발이 디딘 채 몸과 함께 돈다 → 그동안 디딘 발(pk) = 뒷발
      const at = new THREE.Vector3(Lp.ankle.x, 0, Lp.ankle.z);
      const ha = f.heading + dir * bp;
      const to = SP.under ? new THREE.Vector3(c0.x + Math.sin(ha) * Lp.side * HIP_W, 0, c0.z + Math.cos(ha) * Lp.side * HIP_W) : at.clone();
      I.feet.step = { f0: at, y0: Lp.yaw, e: 0, T: pre, P1: to, yawAbs: Lp.yaw + dir * fte };
      I.prepPin = { pinC0: Ls.pinC.clone(), pinT0: Ls.pinT.clone(), plant0: Ls.plant.clone(), yaw0: Ls.yaw };
      I.pk = sk;
      I.sk = pk;
      if (!Ls.stance) {
        // 걷는 중 뒷발이 떠 있었으면 그 자리에 곧장 딛음 (발 틀기 동안 몸을 받치고 몸과 함께 돎)
        G.touchdown(Ls, 0.5);
        I.prepPin = { pinC0: Ls.pinC.clone(), pinT0: Ls.pinT.clone(), plant0: Ls.plant.clone(), yaw0: Ls.yaw };
      }
      Lp.yawTD = Lp.yaw;
      G.begin(Lp, 'spin', pre);
      G.footMass(Lp, false);
    }
  }
  if (!pre) {
    if (SP) beginTurn(f, f.ibSpin); // 11/12 두 마디: 골반 · 도는 발 길을 세우고 뒷발을 듦
    else {
      G.begin(Ls, 'spin', T);
      G.footMass(Ls, false);
    }
  }
  return true;
}

/** 11/12 두 마디 끝 두 발 자리 — feetPlan 과 같은 기하(걸음 칸 guardLength · guardWidth · weightFront · GAIT.rearToe)를 발 열쇠 대신 맡은 일로: 축발 Lp → 앞발 자리 · 도는 발 Ls → 뒷발 자리 (제 쪽 옆) */
function splitSpots(G, Lp, Ls, E, fwd, rgt) {
  const P = G.P;
  const spot = (l, front) => {
    const x = front ? P.guardLength * (1 - P.weightFront) : -P.guardLength * P.weightFront;
    const z = l.side * P.guardWidth * 0.5;
    return new THREE.Vector3(E.x + fwd.x * x + rgt.x * z, 0, E.z + fwd.z * x + rgt.z * z);
  };
  return { FP: spot(Lp, true), RB: spot(Ls, false), yawFP: 0, yawRB: -Ls.side * GAIT.rearToe };
}

/**
 * 손 목표를 쉼 자세로 (10/24 10:4x 사장님 '싱지르 개편 뒤에 또 허공 위로 날아가는 싱지르가 많아졌어. 몸통을 겨누기로 했었는데' — SECRET.ibSpin.handRest · 사장님 확인 전, 확인표 2384):
 *  잰 원인(docs/strike/iberian_spin_2026-10-22.md §16-2) — 공격 원 판은 원을 그리는 손가락이 손 목표(handOffset)를 원이 끝난 자리(큰 원이면 손 닿는 끝 0.62 m 에 걸린 옆 · 아래)에
 *  둔 채 싱지르가 나간다. 대본은 두 팔 · 칼(감기)과 덧씌우기 자세(손 · 칼끝 방향)를 쥐지만, 몸통 비틀기 목표는 덧씌우기 몫이 숙련도 몫뿐이라(fighter.updateBodyPose kt = w · s)
 *  나머지와 '손이 안 닿으면 더 트는 몫'(순서 결합) · 가슴 비틀기의 손 쪽 몫(applyPose −aim.x)이 그 낡은 손 목표 · 이어 베기(follow)를 끝까지 따른다 → 몸통이 원 끝 쪽으로 틀린 채 돌다
 *  칼을 놓으면 그 비틀림에 칼이 머리 위로 솟았다(원 판 큰 원 · 칼 든 쪽 4 ~ 9 %). 공격 하나 · 스틱 판은 손 목표가 자세 패드에 그대로라 0 %.
 *  → 사람이 싱지르를 내는 순간 손 목표를 유파 쉴 자세(sword_art restGuard — 이베리아 긴 자세)로 옮기고, 손 움직임 셈(앞 자리 · 빠르기 · 이어 베기 · 가죽끈 · 거르기 전 목표)을 그 자리로 비운다.
 *  걸러진 손(skill.aim)은 그대로 둬 거르기(aimFilter)로 부드럽게 따라가게 한다(한 스텝에 옮기면 몸 목표가 튄다). 대본 · 굳음 동안 손 목표는 main.js 가 움직이지 않는다(secBusy). 새 수 없음
 */
export function spinHandRest(f) {
  const sk = f.skill;
  const pad = f.swordArt?.restGuard?.pad ?? SKILL.homeGuard;
  f.handOffset.set(pad[0], pad[1]);
  for (const k of ['anchor', 'aimRaw', 'prev']) sk[k]?.copy(f.handOffset);
  sk.follow?.set(0, 0);
  sk.vel?.set(0, 0);
  if (sk.inputMotion) {
    sk.inputMotion.prev.copy(f.handOffset);
    sk.inputMotion.vel.set(0, 0);
  }
  sk.tempoInput = null;
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
  if (S.feet && G) G.req = null; // 10/24 feet: 대본 동안 들어온 걸음 부탁도 버린다 (requestSpin 과 같은 까닭)
  // 한 바퀴를 다 돌았으면 heading 을 같은 방향의 작은 각으로 (몸 자세는 그대로)
  f.heading = wrap(f.heading);
  f.yaw.setFromAxisAngle(_w.set(0, 1, 0), f.heading);
  if (G) G.prevHead = f.heading;
  f.ibSpinDone = { why: S.settle?.why ?? why, blocked: S.blocked, touchT: S.touchT, freeT: S.freeT, q: S.q, ws: S.ws, pre: S.pre, stats: S.stats, vmax: S.vmax, T: S.T, travel:Math.hypot(f.bodies.pelvis.translation().x - S.c0.x, f.bodies.pelvis.translation().z - S.c0.z) };
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
  if (G && S.feet && why === 'done' && !S.stepped) feetStep(f, S); // 10/24 12:5x 발디딤: 다 돌았으면 축발을 제 자세 자리로 옮긴다 (막혔으면 돌던 중이라 그대로 · 11/12 두 마디는 내딛기로 이미 자세 자리 — stepped)
  S.free = true;
  S.settle = { t: 0, why, h: f.heading };
}
function settleStep(f, S, dt) {
  const st = S.settle;
  st.t += dt;
  const V = SECRET.ibSpin;
  if (S.feet?.step) S.feet.step.e += dt; // 10/24 feet: 옮겨 딛는 걸음 (ramp 초 — 받아 멈춤 끝에 딛음 · finish)
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
  if (V.upright) uprightStep(f, V.track, 1, dt); // 10/24 받아 멈추는 동안도 몸통을 곧게 (붙드는 몫은 줄이지 않음 — 놓은 칼이 아직 돈다)
  spinCap(f, S.vmax); // 10/24 share 판: 받아 멈추는 동안도 칼끝 상한
  spinLid(f); // 10/24 10:4x 몸통 뚜껑
}

/**
 * 몸통 세워 두기 (10/24 사장님 02:5x '몸이 종잇장처럼 날라다니듯 기울어' — SECRET.ibSpin.upright · 사장님 확인 전, 확인표 2365):
 *  잰 원인(docs/strike/iberian_spin_2026-10-22.md §13) — 골반은 기준 막대(fighter uprightJoint)가 곧게 붙들지만(≤ 3°), 배 · 가슴 · 머리는 대본 틀이 수평 빠르기 · 도는 빠르기만
 *  다시 세우고 앞뒤 · 옆 기울기는 근육 몫으로 남겨 두었다. 앞으로 뻗어 놓은 두 팔 · 큰 칼의 무게(느리게 돌아도 15°)와 돌기 시작할 때 칼 · 팔의 당김(플랑베르주 +20 ~ 30°)이
 *  척추 근육 한도(허리 500 · 등 440 N·m)를 넘어 가슴이 앞으로 30 ~ 55° 꺾였다(골반 → 머리 줄 기울기 — 칼을 놓지 않고 몸으로 돌려도 24°).
 *  → 대본(돌기 · 받아 멈춤) 동안 몸통 틀의 목표에 '곧게'를 더한다: 가슴의 위 축이 세로에서 벗어난 각 θ(돌림 축 n — 수평)를
 *   ① k(1/s — 골반 따라가기 track 과 같은 세기)로 메우고 ② 남는 몫은 맞서 기울기로 쌓는다(몸 기준 앞 · 옆 두 칸에 θ 를 쌓아 k²/4 로 — 칼 · 팔이 한쪽으로 늘 당기는 몫을
 *   그만큼 반대로 기울여 받음. 쌓인 몫은 LEAN_MAX 까지 = 허리 관절이 뒤로 젖혀지는 한계 0.3 rad(fighter.js jointDefs 골반 → 배 lim z — 있는 몸 수)).
 *   기울기 빠르기 Ω = k · θ · n + (k² / 4) · ∫θ · n 를 배 · 가슴 · 머리에 같이(제 무게 가운데 둘레 — 돌기 빠르기 몫만 · 자리 빠르기는 건드리지 않음: 자리 몫까지 주면 골반이 0.4 m 주저앉았다).
 *  골반은 기준 막대 몫이라 건드리지 않는다. hold = 붙드는 몫(0 ~ 1)
 */
const _up = new THREE.Vector3();
const _uq = new THREE.Quaternion();
const TORSO = ['abdomen', 'chest', 'head'];
const LEAN_MAX = 0.3; // 맞서 기울기 상한 (rad — 허리 뒤로 젖힘 한계 · 쌓인 몫 k²/4 · ∫θ ÷ k 가 이 각을 넘지 않게)
function uprightStep(f, k, hold, dt) {
  const S = f.ibSpin;
  const ch = f.bodies.chest;
  const r = ch.rotation();
  _up.set(0, 1, 0).applyQuaternion(_uq.set(r.x, r.y, r.z, r.w));
  const s = Math.hypot(_up.x, _up.z);
  const th = Math.atan2(s, _up.y);
  const ex = s > 1e-6 ? (-_up.z / s) * th : 0; // 기운 몫 θ · n (월드 수평 — u × ŷ 쪽)
  const ez = s > 1e-6 ? (_up.x / s) * th : 0;
  // 몸 기준으로 쌓는다 (몸이 돌아도 칼 · 팔이 당기는 쪽은 몸 기준으로 거의 그대로): 앞 = (cos h, −sin h) · 오른쪽 = (sin h, cos h)
  const cf = Math.cos(f.heading);
  const sf = Math.sin(f.heading);
  const I = (S.lean ??= { a: 0, b: 0 });
  I.a += (ex * cf - ez * sf) * dt;
  I.b += (ex * sf + ez * cf) * dt;
  const ki = (k * k) / 4; // 쌓는 세기 (임계 감쇠 — 넘치지 않게)
  const m = Math.hypot(I.a, I.b) * ki;
  if (m > k * LEAN_MAX) {
    I.a *= (k * LEAN_MAX) / m;
    I.b *= (k * LEAN_MAX) / m;
  }
  const lx = (I.a * cf + I.b * sf) * ki;
  const lz = (-I.a * sf + I.b * cf) * ki;
  const w = ch.angvel();
  const dX = (k * ex + lx - w.x) * hold;
  const dZ = (k * ez + lz - w.z) * hold;
  for (const n of TORSO) {
    const b = f.bodies[n];
    if (!b) continue;
    const a = b.angvel();
    b.setAngvel({ x: a.x + dX, y: a.y, z: a.z + dZ }, true);
  }
}

/**
 * 몸통 뚜껑 (10/24 10:4x 사장님 '싱지르 개편 뒤에 또 허공 위로 날아가는 싱지르가 많아졌어. 몸통을 겨누기로 했었는데' — SECRET.ibSpin.lid · 사장님 확인 전, 확인표 2385 ·
 *  10/23 '높이가 몸통부를 넘지 않게 휘둘러야 함'): 칼을 놓은 뒤(대본 안 free · 받아 멈춤 · 따라 지나감) 칼끝이 몸통 위 끝(어깨 관절 높이 = 가슴 점 + ARM.shoulder[1] — 10/23 torso 와 같은 줄)
 *  쪽으로 오르는 빠르기를 '남은 높이 × SECRET.ibSpin.track'(골반 따라가기와 같은 세기 10 /s — 줄에 다가갈수록 0, 넘었으면 그만큼 내려 보냄)까지로 자른다.
 *  잰 원인(§16-2): 손 목표를 쉼 자세로 옮긴 뒤에도(spinHandRest) 놓는 순간 칼에 남는 물리 몫 — 감은 칼자루가 제 배 몸체에 2 ~ 5 cm 파고든 채(대본이 스텝마다 자리를 놓음 · BODY.humanLimits
 *  제 칼 ↔ 제 몸통 충돌) 놓이면 밀어내는 힘 · 두 손 쥠 용수철 — 이 칼을 위로 차 올려(칼 각속도 30 ~ 50 rad/s) 서보(가슴 높이 겨눔)가 막기 전에 머리 위로 넘겼다.
 *  고침은 칼 몸체만 칼 손(칼 몸체 원점) 둘레로 돌려(Δω = r × Δv ÷ |r|² — 칼날에 수직인 몫 · 놓은 칼은 거의 수평이라 위아래 몫이 거의 다 고쳐지고 가로 빠르기는 거의 그대로) 한다. 새 수 없음
 */
const _lt = new THREE.Vector3();
export function spinLid(f) {
  const V = SECRET.ibSpin;
  if (!V.lid || !f.armed) return;
  const lid = f.bodies.chest.translation().y + ARM.shoulder[1];
  const tip = f.bladePoint(1, _lt);
  const vt = f.sword.velocityAtPoint({ x: tip.x, y: tip.y, z: tip.z });
  const allow = V.track * (lid - tip.y);
  if (vt.y <= allow) return;
  const o = f.sword.translation();
  const rx = tip.x - o.x;
  const ry = tip.y - o.y;
  const rz = tip.z - o.z;
  const r2 = rx * rx + ry * ry + rz * rz;
  if (r2 < 1e-6) return;
  const dvy = allow - vt.y; // 위로 넘친 몫 (음수)
  const dwx = (-rz * dvy) / r2; // Δω = r × (0, dvy, 0) / |r|²
  const dwz = (rx * dvy) / r2;
  const w = f.sword.angvel();
  f.sword.setAngvel({ x: w.x + dwx, y: w.y, z: w.z + dwz }, true);
  const c = f.sword.worldCom(); // 무게 가운데 빠르기도 원점 둘레 같은 돌림 몫: Δv = Δω × (c − o)
  const cx = c.x - o.x;
  const cyy = c.y - o.y;
  const cz = c.z - o.z;
  const v = f.sword.linvel();
  f.sword.setLinvel({ x: v.x + -dwz * cyy, y: v.y + (dwz * cx - dwx * cz), z: v.z + dwx * cyy }, true);
  f.spinLidN = (f.spinLidN ?? 0) + 1; // 자른 스텝 수 (재기)
}

/**
 * 내 칼이 무엇에 닿아 있나 (Rapier 접촉 — 읽기만): 'body' = 칼날이 상대 몸에(접촉 쌍 — 베는 칼은 물리대로 지나간다) ·
 *  'other' = 칼(칼날 · 칼자루)이 싸움꾼 밖의 것(무대 벽 · 땅 · 석상)에 실제로 닿음(접촉 거리 ≤ 0) · null = 없음. 상대 칼은 여기서 보지 않는다(칼끼리 feel.touching).
 *  무대 벽 곁에서 돌면 감은 칼이 벽에 걸린다 — 놓지 않으면 다음 스텝 대본 자리로 다시 놓여 칼이 튄다(브라우저 시험: 칼끝 73 m/s) → 막힘과 같이 놓고 멈춘다
 *  10/24 10:4x 땅 (SECRET.ibSpin.floor · 사장님 확인 전, 확인표 2386 — 사장님 '작게 그으면 싱지르가 나가다 말고 좀 이상한 작은 동작이 되어 실패'): 공격 원을 다 그린 순간 칼이 아래(칼끝이 땅 가까이)에
 *  있으면 감기 첫 0.0x s 에 칼이 땅을 스쳐 'other' → 막힘 → 한 바퀴를 거의 못 돌고(진행 0 ~ 0.01) 받아 멈춤 · 굳음 1.3 s 로 끝났다(원 판 2.5 % — §16-3). 대본이 칼을 감은 자세로 들어 올리는 길이라
 *  땅은 막는 것이 아니다 → 맞닿은 면이 누운 접촉(면의 법선이 수평보다 세로에 가까움 — 바닥)은 셈하지 않는다. 벽 · 석상(선 면)은 그대로 막힘
 */
function swordContact(f) {
  const W = f.world;
  const foe = f.foe;
  if (!W || !f.armed) return null;
  const mine = new Set([...Object.values(f.bodies).map((b) => b.handle), f.sword.handle]);
  const foeB = new Set(foe?.bodies ? Object.values(foe.bodies).map((b) => b.handle) : []);
  const foeSword = foe?.sword?.handle;
  const blades = new Set(f.bladeColliders ?? []);
  const floorOK = !!SECRET.ibSpin.floor;
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
        if (!body && floorOK) {
          const n = m.normal();
          if (Math.abs(n.y) > Math.hypot(n.x, n.z)) return; // 바닥 (10/24 floor) — 막힘 아님
        }
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
  if (S.sp) return splitStep(f, S, dt); // 11/12 두 마디 (아래)
  if (S.tp < S.pre) {
    // 먼저 감기 (10/23 torso): 몸은 돌지 않고 서 있고, 두 팔 · 칼만 지금 자세 → 감은 자세로 (placeArms — 같은 기하). 끝나면 도는 발을 떼고 돌기 시작
    S.tp += dt;
    f.heading = S.h0;
    f.yaw.setFromAxisAngle(_w.set(0, 1, 0), f.heading);
    S.want.set(0, 0, 0);
    S.wt = 0;
    if (SECRET.ibSpin.upright && SECRET.ibSpin.handRest) {
      // 10/24 10:4x: 먼저 감는 동안도 몸 곧게 · 골반 높이 (돌기와 같은 uprightStep · dvy — 전엔 돌기부터). 큰 원을 그린 뒤 높은 칼을 내리는 0.2 s 에 몸이 25 ~ 50° 숙고
      //  골반이 0.2 m 주저앉아 넘어진 판이 있었다(§16-2). 새 수 없음 — handRest 와 함께 켜고 끈다(0 이면 10/24 02:5x 판 그대로)
      const K = SECRET.ibSpin.track;
      const pel = f.bodies.pelvis;
      const dvy = f.gait?.h ? K * (f.gait.h - pel.translation().y) - pel.linvel().y : 0;
      for (const k of UPPER) {
        const b = f.bodies[k];
        if (!b) continue;
        const v = b.linvel();
        b.setLinvel({ x: v.x, y: v.y + dvy, z: v.z }, true);
      }
      uprightStep(f, K, 1, dt);
    }
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
  // 10/24 upright: 골반 높이도 틀의 목표로 (걸음 높이 gait.h — 같은 세기 track 로 메움). 몸통을 곧게 세운 채 칼 · 팔이 앞으로 당기면 골반이 0.3 m 주저앉았다 (§13)
  const dvy = SECRET.ibSpin.upright && f.gait?.h ? K * (f.gait.h - ca.y) - pv.y : 0;
  // 도는 틀의 구심 몫 (대본이 낸다): 지난 스텝 곧게 나간 만큼(바깥으로 ω² · r · dt) 틀 안 빠르기에서 뺀다 — 안 빼면 칼 · 팔이 바깥으로 쏠려 몸을 끌어 넘어뜨린다(첫 시험: 칼끝 40 m/s · 넘어짐)
  const cen = wa * wa * dt;
  const rebase = (b) => {
    if (!b) return;
    const p = b.translation();
    const v = b.linvel();
    const w = b.angvel();
    const rx = p.x - ca.x;
    const rz = p.z - ca.z;
    b.setLinvel({ x: v.x + dvx + dw * rz - cen * rx, y: v.y + dvy, z: v.z + dvz - dw * rx - cen * rz }, true);
    b.setAngvel({ x: w.x, y: w.y + dw, z: w.z }, true);
  };
  for (const k of UPPER) rebase(f.bodies[k]);
  if (SECRET.ibSpin.upright) uprightStep(f, K, 1, dt); // 10/24 몸통 세워 두기 (틀의 목표 = 곧게 · 따라가기 track · 맞서 기울기)
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
  if (S.free) spinCap(f, S.vmax); // 10/24 share 판: 놓은 칼의 칼끝 빠르기 상한 (share 0 이면 ∞ — 아무 일 없음)
  if (S.free) spinLid(f); // 10/24 10:4x 몸통 뚜껑: 놓은 칼끝이 몸통 위 끝을 넘어 오르지 않게
  // 재기 (읽기만): 칼끝 빠르기
  if (f.armed) {
    const tv = f.tipVel.length();
    if (tv > S.stats.tipMax) S.stats.tipMax = tv;
    if (S.free && tv > S.stats.cutTipMax) S.stats.cutTipMax = tv;
  }
}

/**
 * 몸 틀 빠르기 다시 세우기 (spinStep 몸 틀 몫과 같은 셈 — 11/12 두 마디 판이 마디마다 부름): 골반이 갈 자리 (cx, cz) · 그 자리의 빠르기 (vx, vz) · 도는 빠르기 om (rad/s · heading +).
 *  골반 · 배 · 가슴 · 머리를 틀로 다시 세우고(구심 몫 · 골반 높이 · 몸 곧게 uprightStep 포함) 같은 틀로 다른 몸체를 다시 세우는 함수를 돌려준다 (들린 다리)
 */
function driveBody(f, S, cx, cz, vx, vz, om, dt) {
  const pel = f.bodies.pelvis;
  const ca = pel.translation();
  const K = SECRET.ibSpin.track;
  const vtx = vx + (cx - ca.x) * K;
  const vtz = vz + (cz - ca.z) * K;
  S.want.set(vtx, 0, vtz);
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
  const dvy = SECRET.ibSpin.upright && f.gait?.h ? K * (f.gait.h - ca.y) - pv.y : 0;
  const cen = wa * wa * dt;
  const rebase = (b) => {
    if (!b) return;
    const p = b.translation();
    const v = b.linvel();
    const w = b.angvel();
    const rx = p.x - ca.x;
    const rz = p.z - ca.z;
    b.setLinvel({ x: v.x + dvx + dw * rz - cen * rx, y: v.y + dvy, z: v.z + dvz - dw * rx - cen * rz }, true);
    b.setAngvel({ x: w.x, y: w.y + dw, z: w.z }, true);
  };
  for (const k of UPPER) rebase(f.bodies[k]);
  if (SECRET.ibSpin.upright) uprightStep(f, K, 1, dt);
  return rebase;
}

/** 디딘 발을 발바닥 가운데 둘레로 turn 만큼 돌린 자리 · 방향에 붙든다 (ref = 디딜 때 자리 { pinC0 · pinT0 · plant0 · yaw0 }) · 발 몸체 도는 빠르기 om — spinStep 축발과 같은 셈 */
function turnPinned(f, L, ref, turn, om) {
  const fb = f.bodies[L.foot];
  const fw = fb.angvel();
  fb.setAngvel({ x: fw.x, y: om, z: fw.z }, true);
  const cs = Math.cos(turn);
  const sn = Math.sin(turn);
  const rot = (src, out) => {
    const x = src.x - ref.pinC0.x;
    const z = src.z - ref.pinC0.z;
    out.x = ref.pinC0.x + x * cs + z * sn;
    out.z = ref.pinC0.z - x * sn + z * cs;
  };
  rot(ref.plant0, L.plant);
  rot(ref.pinT0, L.pinT);
  L.pinC.x = ref.pinC0.x;
  L.pinC.z = ref.pinC0.z;
  L.yaw = ref.yaw0 + turn;
}

/** 재기 (읽기만): 칼끝 빠르기 — spinStep 끝과 같은 칸 */
function tipStats(f, S) {
  if (!f.armed) return;
  const tv = f.tipVel.length();
  if (tv > S.stats.tipMax) S.stats.tipMax = tv;
  if (S.free && tv > S.stats.cutTipMax) S.stats.cutTipMax = tv;
}

/**
 * 11/12 두 마디 대본 (SECRET.ibSpin.split — 특수 공격 싱지르 · 사람 · AI 같은 실행부 · 기록 docs/strike/windmill_2026-11-12.md):
 *  사장님 11/12 '다리 하나를 축 삼아 돌고 있는데 그러면 안 되지. 먼저 빠르게 돌고 그 다음 발을 내딛으면서베야지' · '돌려면 앞 디딤발 각도를 90도 정도 틀어서 미리 바꿔야 할 수도 있어'.
 *  원반던지기 · 몬탄테 바퀴 돌기와 같은 차례 — 한 발 축으로 돌고 · 다른 발이 돌아와 딛고 · 축발이 내디디며 내보냄 (피게이레두 단순 규칙 13 '왼발을 축으로 나사처럼' · 복합 규칙 15 '돌려면 오른발을 내디디며 탈류'):
 *  (가-0) 발 틀기 (pre 초 — split.foot > 0 · 두 발로 서 있을 때): 앞발을 들어 제자리에서 도는 쪽으로 ft 틀어 디딤(등 돌려 도는 쪽이라 발끝을 안으로 오므림) ·
 *         몸은 발이 먼저 트는 몫(FOOT_LEAD — 허벅지 비틀기 한계의 반)을 넘는 몫 bp 만 먼저 돎 · 뒷발은 디딘 채 몸과 함께 돎(앞꿈치 돌기) · 두 팔 · 칼 감기
 *  (가) 돌기 (split.turn 초 — 처음 ramp 초에 올라 그 빠르기 그대로): 틀어 디딘 앞발을 축으로 rot1 까지 돈다. 골반은 처음 몫에 축발 위로 옮기고 그 위에서 돎(**축발 둘레를 떠돌며 나아가지 않음**) ·
 *       축발은 몸이 틀어 둔 각을 따라잡을 때까지 그대로, 그 뒤 몸과 함께 돎 · 뒷발은 들려 몸과 함께 돌아 끝 자세의 뒷발 자리(FE.RB)에 딛음 · 칼은 몸에 감긴 채 따라옴
 *  (나) 내딛기 (split.step 초): 몸은 남은 각(2π − rot1)을 돌며 0 으로 내려 섬(디딘 뒷발 앞꿈치 축) · 앞발을 들어 stride 앞 앞발 자리(FE.FP)로 내딛고 골반도 끝 자리 E 로 —
 *       (나) 들머리에 칼을 놓아 몸이 서는 동안 칼이 관성 · 서보로 상대 앞을 가로지름(놓은 칼 칼끝 상한 = 고노센 × specialShare 몫 그대로) · 앞발이 딛으면 받아 멈춤(ramp — 두 발이 이미 자세 자리라 따라붙는 걸음 없음)
 *  막히면(돌기 중 상대 칼 · 벽) 그 자리에서 받아 멈춤(내딛기 없음 — 전 판과 같음). 넘어지면 끊음(spinStep 머리)
 */
function splitStep(f, S, dt) {
  const G = f.gait;
  if (S.tp < S.pre) {
    S.tp += dt;
    const k = smooth(S.tp / S.pre);
    const kn = smooth((S.tp + dt) / S.pre);
    const rot = S.bp * k;
    const om = (S.dir * S.bp * (kn - k)) / dt;
    f.heading = S.h0 + S.dir * rot;
    f.yaw.setFromAxisAngle(_w.set(0, 1, 0), f.heading);
    driveBody(f, S, S.c0.x, S.c0.z, 0, 0, om, dt);
    if (S.feet?.step) S.feet.step.e += dt; // 앞발 틀기 걸음 (spinFootTarget)
    turnPinned(f, G.legs[S.pk], S.prepPin ?? S.axisPin, S.dir * rot, om); // 디딘 발 (발 틀기면 뒷발 — 몸과 함께 돎 · 아니면 축발 그대로)
    if (f.armed) placeArms(f, S, dt);
    tipStats(f, S);
    if (S.tp >= S.pre) beginTurn(f, S);
    return;
  }
  S.t += dt;
  const { T, r, T1, T2 } = S;
  if (S.t < T1) {
    // (가) 돌기
    if (!S.free && f.armed) {
      // 칼이 무엇에 닿았나 — spinStep 과 같은 셈 (상대 몸이면 놓음 · 상대 칼 · 벽이면 놓고 멈춤)
      const on = f.feel?.touching ? 'other' : swordContact(f);
      if (on) {
        S.free = true;
        S.freeT = S.t;
        if (S.touchT == null) S.touchT = S.t;
        S.stats.tipAtTouch = +f.tipVel.length().toFixed(2);
        if (on === 'other') S.blocked = true;
      }
    }
    if (S.blocked) return beginSettle(f, S, 'blocked');
  } else if (!S.stepPh) beginStepPhase(f, S);
  if (S.stepPh) S.feet.step.e += dt; // (나) 내딛는 앞발 (spinFootTarget)
  if (S.stepPh && S.t >= T) {
    // 앞발이 딛음 → 받아 멈춤 (두 발이 이미 끝 자세 자리 — 따라붙는 걸음 없음 · stepped)
    S.feet.step = null;
    S.stepped = true;
    return beginSettle(f, S, 'done');
  }
  const q = spinProgress2(S.t, T, r, T2);
  const qn = spinProgress2(S.t + dt, T, r, T2);
  S.q = q;
  const ro = rotOf(S, q);
  const rn = rotOf(S, qn);
  const om = (S.dir * (rn - ro)) / dt;
  S.rate = Math.abs(om) / ((TAU - S.bp) / (T - r / 2 - T2 / 2)); // 도는 빠르기의 몫 (최고 = 1)
  f.heading = S.h0 + S.dir * ro;
  f.yaw.setFromAxisAngle(_w.set(0, 1, 0), f.heading);
  const c1 = splitPelvis(S, S.t, ro, _p1);
  const cx = c1.x;
  const cz = c1.z;
  const c2 = splitPelvis(S, S.t + dt, rn, _p2);
  const rebase = driveBody(f, S, cx, cz, (c2.x - cx) / dt, (c2.z - cz) / dt, om, dt);
  if (!S.free && f.armed) placeArms(f, S, dt);
  const Ls = G.legs[S.sk];
  rebase(f.bodies[Ls.thigh]);
  rebase(f.bodies[Ls.shin]);
  rebase(f.bodies[Ls.foot]);
  if (!S.stepPh) {
    // (가) 축발(앞발): 틀어 디딘 각(ft)을 몸이 따라잡을 때까지 그대로 · 그 뒤 몸과 함께 돎 (발바닥 가운데 둘레)
    const tf = Math.max(0, ro - S.ft);
    const tfn = Math.max(0, rn - S.ft);
    turnPinned(f, G.legs[S.pk], S.axisPin, S.dir * tf, (S.dir * (tfn - tf)) / dt);
  } else turnPinned(f, G.legs[S.pk], S.stepPh.hold, S.dir * (ro - S.rot1), om); // (나) 디딘 뒷발: 남은 각을 몸과 함께 돎 (앞꿈치)
  if (S.free) {
    spinCap(f, S.vmax);
    spinLid(f);
  }
  tipStats(f, S);
}

/**
 * 11/12 두 마디 골반 자리 (수평 · 월드): (가) 축발 P 둘레 — 처음 SHIFT 몫에 낼 때 자리 → 축발 위(oM)로 옮기고 그 위에서 돎 ·
 *  (나) (가) 끝 자리 cA → 끝 자리 E (부드럽게). t = 대본 시계 (발 틀기 뒤 · 발 틀기 동안은 splitStep 이 c0 를 줌) · ro = 그때 돈 각
 */
function splitPelvis(S, t, ro, out) {
  if (t >= S.T1) {
    const s = smooth((t - S.T1) / S.T2);
    out.x = S.cA.x + (S.E.x - S.cA.x) * s;
    out.z = S.cA.z + (S.E.z - S.cA.z) * s;
    return out;
  }
  const qa = (ro - S.bp) / Math.max(1e-6, S.rot1 - S.bp); // (가) 안 진행
  const m = smooth(qa / SHIFT);
  const ox = S.o0.x + (S.oM.x - S.o0.x) * m;
  const oz = S.o0.z + (S.oM.z - S.o0.z) * m;
  const a = S.dir * ro;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  out.x = S.P.x + ox * cs + oz * sn;
  out.z = S.P.z - ox * sn + oz * cs;
  return out;
}

/** (가-0) → (가): 앞발을 틀어 디디고(발 틀기였으면) 축 · 골반 길 · 도는 발 길을 지금 몸 틀로 세운 뒤 뒷발을 든다 (발 틀기가 없으면 requestSpin 이 곧장 부름) */
function beginTurn(f, S) {
  const G = f.gait;
  const La = G.legs[S.axisK];
  if (S.prepFoot) {
    if (!La.stance) G.touchdown(La, 0.5); // 틀어 디딤 (plantAt — 디딘 자리 · 방향)
    S.feet.step = null;
    S.pk = S.axisK;
    S.sk = S.otherK;
    S.axisPin = { pinC0: La.pinC.clone(), pinT0: La.pinT.clone(), plant0: La.plant.clone(), yaw0: La.yaw };
  }
  S.P = new THREE.Vector3(La.pinC.x, 0, La.pinC.z);
  // 골반 길: 지금(몸이 bp 돈 때) 낼 때 자리 c0 → 축발 위 oM (o 는 처음 몸 틀 — splitPelvis 가 돈 각만큼 돌림)
  const ox = S.c0.x - S.P.x;
  const oz = S.c0.z - S.P.z;
  const a = -S.dir * S.bp;
  S.o0.set(ox * Math.cos(a) + oz * Math.sin(a), 0, -ox * Math.sin(a) + oz * Math.cos(a));
  S.cA = splitPelvis(S, 0, S.rot1, new THREE.Vector3()); // (가) 끝 골반 (축발 위)
  // 도는 발(뒷발) 길 (몸 기준 — 골반 원점 · x 앞 · z 오른쪽): 지금 자리 → (가) 끝 몸 틀에서 끝 자세 뒷발 자리 RB · 발 방향은 (가) 끝에 끝 자세 뒷발 방향 − 남은 각
  const Lo = G.legs[S.otherK];
  const body = (x, z, h) => ({ x: x * Math.cos(h) - z * Math.sin(h), z: x * Math.sin(h) + z * Math.cos(h) });
  const b0 = body(Lo.ankle.x - S.c0.x, Lo.ankle.z - S.c0.z, f.heading);
  const b1 = body(S.FE.RB.x - S.cA.x, S.FE.RB.z - S.cA.z, S.h0 + S.dir * S.rot1);
  S.a0 = Math.atan2(b0.z, b0.x);
  S.da = wrap(Math.atan2(b1.z, b1.x) - S.a0);
  S.br0 = Math.hypot(b0.x, b0.z);
  S.br1 = Math.hypot(b1.x, b1.z);
  S.footYaw0 = Lo.footYaw;
  S.feet.yawFix = wrap(S.h0 + S.dir * S.bp + S.FE.yawRB - S.footYaw0);
  G.begin(Lo, 'spin', S.T1);
  G.footMass(Lo, false);
}

/** (가) → (나): 도는 발(뒷발)을 딛고 축발(앞발)을 들어 stride 앞 앞발 자리로 내딛기 시작 · 칼을 아직 안 놓았으면 놓음 */
function beginStepPhase(f, S) {
  const G = f.gait;
  const Lb = G.legs[S.sk];
  if (!Lb.stance) G.touchdown(Lb, 0.5);
  const La = G.legs[S.pk];
  La.yawTD = La.yaw;
  S.feet.step = { f0: new THREE.Vector3(La.ankle.x, 0, La.ankle.z), y0: La.yaw, e: 0, T: S.T2, P1: S.FE.FP, rel: wrap(La.yaw - f.heading), relEnd: S.FE.yawFP };
  G.begin(La, 'spin', S.T2);
  G.footMass(La, false);
  S.pk = Lb.k;
  S.sk = La.k;
  S.stepPh = { hold: { pinC0: Lb.pinC.clone(), pinT0: Lb.pinT.clone(), plant0: Lb.plant.clone(), yaw0: Lb.yaw } };
  if (!S.free) {
    S.free = true; // 몸이 서기 시작 — 칼은 관성 · 서보로 상대 앞을 가로지른다
    S.freeT = S.t;
  }
}

/**
 * 11/12 두 마디 도는 발(뒷발) 발목 목표 · 방향 ((가) 동안 — spinFootTarget 이 부름): 몸 기준 극좌표를 (가) 안 진행 qa 로 처음 → 끝 자리 · 골반 = splitPelvis ·
 *  들기는 곧 들고 끝 무렵까지 든 채 (spinFootTarget 과 같은 꼴)
 */
function splitSwingTarget(f, S, out, ankleH, lift) {
  const ro = rotOf(S, S.q);
  const qa = clamp((ro - S.bp) / Math.max(1e-6, S.rot1 - S.bp), 0, 1);
  const a = S.a0 + S.da * qa;
  const rr = S.br0 + (S.br1 - S.br0) * qa;
  const bx = Math.cos(a) * rr;
  const bz = Math.sin(a) * rr;
  const h = f.heading;
  const c = splitPelvis(S, Math.min(S.t, S.T1 - 1e-6), ro, _p1);
  const u = 2 * qa - 1;
  const up = 1 - u * u * u * u * u * u * u * u;
  out.set(c.x + bx * Math.cos(h) + bz * Math.sin(h), ankleH + lift * up, c.z - bx * Math.sin(h) + bz * Math.cos(h));
  return S.footYaw0 + S.dir * (ro - S.bp) + S.feet.yawFix * qa;
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
/**
 * 감는 손의 옆 자리 (가슴 기준 m — 감는 쪽 +). 칼 든 쪽으로 감으면(ws ≥ 0) SECRET.ibSpin.windSide 1 = 칼 든 어깨의 옆 거리 ARM.shoulder[2]
 *  (10/24 14:0x 사장님 결정 '손을 칼 든 쪽 옆으로' — 배 앞 가운데(wind.hand[2])에서 감으면 손목이 칼을 팔꿈치 쪽으로 146 ~ 156° 젖혔다 · 확인표 2426) ·
 *  반대 쪽으로 감으면(레베스) · windSide 0 이면 wind.hand[2] 그대로. 대본 놓기(placeArms)와 덧씌우기 감은 자세(spinCutPose 'wind')가 같은 값을 읽는다
 */
function windHandZ(ws) {
  const V = SECRET.ibSpin;
  return ws >= 0 && V.windSide ? ARM.shoulder[2] : V.wind.hand[2];
}
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
    S.arm = { AH, AD, WH: new THREE.Vector3(Wp.hand[0], Wp.hand[1], sd * windHandZ(S.ws ?? 1)), WD: new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e), sd * Math.cos(e) * Math.sin(a)), prev: new Map() };
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
  const Fp = S.feet;
  if (Fp?.step) {
    // 10/24 feet — 디딤을 바꾼 뒤 축발이었던 발: 바꾼 때 자리 → 제 자세 자리 P1 (월드 · 부드럽게 · 들었다 끝에 내림 — 아래 도는 발과 같은 꼴) · 방향은 그때 방향 → 끝 heading + yaw1
    //  11/12 두 마디(splitStep): 같은 길을 앞발 틀기(제자리 · 방향만) · 내딛기(stride 앞)에도 씀 — 걸음 시간 st.T · 자리 st.P1 · 끝 방향 st.yawAbs (없으면 위 그대로)
    const st = Fp.step;
    const P1 = st.P1 ?? Fp.P1;
    const u = clamp(st.e / (st.T ?? S.r), 0, 1);
    const s = smooth(u);
    const w = 2 * u - 1;
    const up = 1 - w * w * w * w * w * w * w * w;
    out.set(st.f0.x + (P1.x - st.f0.x) * s, ankleH + lift * up, st.f0.z + (P1.z - st.f0.z) * s);
    if (st.rel != null) return f.heading + st.rel + wrap(st.relEnd - st.rel) * s; // 11/12 두 마디 내딛기: 몸 방향을 따라 돌며 끝 자세 방향으로 (몸이 남은 각을 도는 동안 엉덩이가 비틀리지 않게)
    return st.y0 + wrap((st.yawAbs ?? S.h0 + S.dir * TAU + Fp.yaw1) - st.y0) * s;
  }
  if (S.sp) return splitSwingTarget(f, S, out, ankleH, lift); // 11/12 두 마디 (가) 도는 뒷발
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
  return Fp ? S.footYaw0 + S.dir * TAU * q + Fp.yawFix * q : S.footYaw0 + S.dir * TAU * q; // feet: 딛을 때 발 방향을 자세 방향으로 (뒷발 발끝 바깥 GAIT.rearToe)
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
  th.hand[2] = m * s * (phase === 'wind' ? windHandZ(ws) : P.hand[2]); // 감은 자세 손 옆 자리 = 대본 놓기와 같은 값 (10/24 14:0x windSide)
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
  // 10/24 upright: 놓은 뒤 · 따라 지나감 · 굳음의 몸 숙임 = SECRET.ibSpin.lean (° — 0 곧게 · − 뒤로). 전: 발도 끝 iaiPath.E 의 앞 숙임 14°(고노센 내딛어 뻗는 런지 몫)를 그대로 써
  //  다 뻗은 큰 칼 무게와 함께 굳음 동안 몸이 앞으로 20 ~ 30° 꺾였다. 낮춤(drop)은 그대로 — 무릎을 굽혀 버틴다
  th.pitch = (phase === 'cut' && V.upright ? V.lean ?? 0 : B.pitch) * D2R;
  th.drop = B.drop;
}
