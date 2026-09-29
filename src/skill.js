// ─────────────────────────────────────────────────────────────
//  검술 층 (숙련도 보정)
//
//  입력(손가락/AI) → [검술 층] → 근육(관절 모터, 근력 한계) → 물리
//
//  이 캐릭터는 이미 검술을 익힌 사람이라고 가정하고, 입력이 "휘두르기"로 보이면
//  훈련된 사람이 저절로 하는 몸놀림을 덧붙인다. 단, 여기서 바꾸는 것은 "목표"뿐이다.
//  실제 움직임은 언제나 근육(힘의 한계)과 물리가 만든다 → 맞으면 흐트러지고, 칼은 여전히 무겁다.
//
//   0) 입력 쪽 관성("가죽끈", SKILL.handDynamicsOn): 손가락 목표 앞에 반지름 작은 원(anchor)을 둔다.
//      손가락이 그 안에서 떨리는 동안은 anchor가 안 움직이고, 반경을 넘어야 그만큼만 끌려간다.
//      → 잘게 떠는 손가락이 자세 경계(guards.js RBF 블렌드)를 스치며 칼끝·몸통을 흔드는 것을 원천에서 막는다.
//      진짜 베기·자세 이동처럼 큰 움직임은 anchor가 거의 즉시 팽팽해져 그대로 전해진다 → 반응은 그대로.
//   1) 이어 베기(follow-through): 짧고 빠르게 그어도 칼이 그 방향으로 끝까지 지나간다
//   2) 검술 자세(guards.js): 손가락 위치를 실제 롱소드 자세로 바꾼다. 몸(골반·가슴)은 손보다 먼저
//      자세를 따라가서, 베기를 시작하면 허리 → 가슴 → 팔 → 칼 순서로 힘이 이어진다 (fighter.updateBodyPose)
//   3) 내딛기: 알맞은 간격에서 휘두르기 시작하면 앞발을 내딛으며 벤다
//   4) 자세로 돌아가기: 베기를 마치고 손가락을 떼면(마우스는 잠깐 멈추면) 교본의 기본 자세(쟁기)로 칼을 되돌린다.
//      숙련된 검사는 베고 나서 칼을 아무 데나 두지 않고 곧바로 자세를 잡는다. (플레이어만. AI는 스스로 자세를 고른다)
//   5) 탭 찌르기(thrust): 화면을 톡 치면 칼끝을 상대 몸통(칼이 높으면 머리, 쓰러졌으면 누운 몸)으로 맞추고 칼 선을 따라
//      손을 뻗은 뒤 자세로 돌아온다 (약 0.45초, 한 걸음 내딛으며). 자세 지도 위에 덧씌우는 자세(thrustPose)로 한다.
//   6) 결심 베기 (온몸 베기 L1, WHOLE.commit, 플레이어만: detect): 크고 빠르게 그은 손가락 원래 궤적(input.fingerTrace)을
//      두 단계로 판정한다 (1단계 "감기 시작"은 대가 없음, 2단계 "확정"). 결심이 되면 손가락 궤적 대신 "획 프로그램"(cutPose)이
//      패드·몸·손을 몬다: 몸이 먼저 감고 → 골반 → 가슴 → 팔 → 칼 순서로 풀고 → 팔을 끝까지 뻗고 → 칼이 끝 자세 너머로 지나간다.
//      손가락 빠르기와 상관없이 같은 크기이되, 세게 그을수록(결심 세기 c) 빠르고 크다. 결과가 나오거나 닿기(u 1)를 지나면
//      칼을 손가락에 돌려준다. 짧게·천천히 그으면 지금 그대로의 팔 베기다 (docs/whole_body_strike.md L1)
//      쟁기(집)에서 그으면 자동 감기: 확정 순간 칼을 준비 자세로 들어 올리고, 칼이 실제로 올라온 뒤에 벤다 (무거운 칼일수록 오래 감는다.
//      힘을 실어 베는 만큼의 지연은 괜찮고, 멈춰 있는 시간과 값을 못 하는 지연은 안 된다 — 사장님 박자 결정)
//
//  level: 0 = 보정 없음(날것 그대로의 물리 조작), 1 = 숙련된 검사
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SKILL, WEAPON, THRUST, WHOLE, COMMIT, STROKE, GESTURE, ARM, INPUT } from './config.js';
import { FINISH } from './finish.js';
import { guardAt } from './guards.js';
import { gunCanFire, gunPose } from './gun.js';

const D2R = Math.PI / 180;
const _yawInv = new THREE.Quaternion();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _g = {}; // guardAt 결과 (획을 시작할 때 휘두르는 면을 정하는 데만 쓴다)
const _ga = new THREE.Vector3();
const _gb = new THREE.Vector3();
const _fs = { x: 0, y: 0 }; // R1: 스텝 시각의 손가락 자리 (fingerTrace.at)
const _fv = { x: 0, y: 0 }; // R1: 실제 조각으로 잰 손가락 빠르기 (fingerTrace.rawVel)

// 손가락 궤적 조각 표시 (input.js TRACE_REPLAY·TRACE_LIFT 와 같은 값. 검술 층은 입력 모듈을 들이지 않는다)
const T_REPLAY = 1;
const T_LIFT = 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
/** 최소 저크 곡선 (0 → 1) */
const sj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));
/** 덧씌움 봉투: a → b 에 최소 저크로 1 까지, c 까지 버티고, d 에서 0 (d 가 없으면 계속 버틴다) */
const env = (u, a, b, c, d) => (u <= a ? 0 : u < b ? sj((u - a) / (b - a)) : u <= c || d == null ? 1 : 1 - sj((u - c) / (d - c)));
/** a va → b vb 를 최소 저크로 */
const seg = (u, a, va, b, vb) => va + (vb - va) * sj((u - a) / (b - a));
/** 몸 목표 네 점(u0 v0 → k1 v1 → k2 v2 → k3 v3)을 최소 저크로 잇는다. 출발(u0)이 이미 지난 점은 건너뛴다 (지금 자리에서 다음 점으로) */
const keys = (u, u0, v0, k1, v1, k2, v2, k3, v3) =>
  k2 <= u0 ? seg(u, u0, v0, k3, v3) : k1 <= u0 ? (u <= k2 ? seg(u, u0, v0, k2, v2) : seg(u, k2, v2, k3, v3)) : u <= k1 ? seg(u, u0, v0, k1, v1) : u <= k2 ? seg(u, k1, v1, k2, v2) : seg(u, k2, v2, k3, v3);
/** 덧씌움 봉투를 출발 u0 뒤로 미룬다: 오르기가 u0 전에 시작하면 u0 에서 (오르는 시간의 절반 이상으로) 오른다 — 한 스텝에 튀지 않게 */
const envFrom = (u, u0, e) => {
  if (e[0] >= u0) return env(u, e[0], e[1], e[2], e[3]);
  const b = Math.max(e[1], u0 + 0.5 * (e[1] - e[0]));
  return env(u, u0, b, Math.max(e[2], b), e[3] == null ? null : Math.max(e[3], b + (e[3] - e[2])));
};
// 베기 무리 (config.js STROKE.path): 준비 자세 → 끝 자세 방향을 붙여 둔다
const FAMS = Object.entries(STROKE.path).map(([name, p]) => {
  const dx = p.end[0] - p.ch[0];
  const dy = p.end[1] - p.ch[1];
  const n = Math.hypot(dx, dy);
  return { name, ...p, dir: [dx / n, dy / n] };
});
const FAM_BY = Object.fromEntries(FAMS.map((f) => [f.name, f]));
const _u = new THREE.Vector3();
const _b = new THREE.Vector3();
const _sq = new THREE.Quaternion();
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _r = new THREE.Vector3();
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** 두 선분(p1–q1, p2–q2) 사이 가장 가까운 거리 (칼날끼리 맞닿았나 — 칼 길 잡기) */
function segDist(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1);
  _d2.subVectors(q2, p2);
  _r.subVectors(p1, p2);
  const a = _d1.dot(_d1);
  const e = _d2.dot(_d2);
  const f = _d2.dot(_r);
  const c = _d1.dot(_r);
  const b = _d1.dot(_d2);
  const den = a * e - b * b;
  let s = den > 1e-9 ? clamp01((b * f - c * e) / den) : 0;
  let t = (b * s + f) / e;
  if (t < 0) {
    t = 0;
    s = clamp01(-c / a);
  } else if (t > 1) {
    t = 1;
    s = clamp01((b - c) / a);
  }
  return _r.copy(p1).addScaledVector(_d1, s).sub(p2).addScaledVector(_d2, -t).length();
}

export class Skill {
  constructor(fighter, level = SKILL.level) {
    this.f = fighter;
    this.level = level;
    this.prev = fighter.handOffset.clone();
    this.vel = new THREE.Vector2(); // 손 목표가 움직이는 속도 (m/s, 몸 앞 평면)
    this.follow = new THREE.Vector2(); // 이어 베기로 더해지는 손 목표
    this.aim = fighter.handOffset.clone(); // 실제로 근육이 따라갈 손 목표 (부드럽게 걸러진 값)
    this.anchor = fighter.handOffset.clone(); // 입력 쪽 관성의 "가죽끈" 중심 (0번 단계)
    this.aimRaw = fighter.handOffset.clone(); // 거르기 전 목표 (가죽끈으로 거른 입력 + 이어 베기)
    this.aimVel = new THREE.Vector2(); // 걸러진 목표가 움직이는 속도
    this.quiet = 1; // 손이 느리게 움직인 시간 (새 휘두르기 시작 판단용)
    this.lunge = 0; // 내딛는 중 남은 시간
    this.holdFeet = false; // AI 가 기술 걸음을 딛는 동안 true: 위 내딛기를 걸지 않는다 (ai.js moveFeet, GAIT.fwdFix)
    this.swings = 0;
    this.activity = 0; // 휘두르는 중인 정도 (0~1)
    // R1 팔 놀림 (CONFIG.ARM): 스텝별 손가락 표본. fc = 읽기 커서(누적 자리·스텝 시각 ms, dt 벽시계 s, g·gdt 게임 시간 s), dF = 이 스텝 손가락 몫(패드 m, handOffset 에 든 것과 같게),
    //  vF = dF ÷ 게임 시간 (앞먹임용), vS = 실제 조각 두 개로 잰 손가락 빠르기(게임 초당 — swinging·목줄 건너뛰기 판정),
    //  vLead = 앞먹임 속도(가죽끈이 손가락에 끌려간 몫), gapE = 가죽끈 뒤 handOffset − anchor
    this.fc = { on: false, x: 0, y: 0, t: 0, dt: 0, g: 0, gdt: 0 };
    this.dF = new THREE.Vector2();
    this.vF = new THREE.Vector2();
    this.vS = new THREE.Vector2();
    this.vLead = new THREE.Vector2();
    this.gapE = new THREE.Vector2();
    this.autoGuard = false; // 플레이어만 true (main.js)
    this.cutPending = false; // 베기를 했고 아직 자세로 돌아가지 않음
    this.idle = 0; // 손가락(마우스)이 움직이지 않은 시간
    this.recovering = false;
    // 5) 탭 찌르기: 진행 중인 찌르기(tap)와 자세 지도 위에 덧씌우는 자세(thrustPose, guards.js guardAt 이 w 만큼 섞는다)
    this.tap = null;
    this.thrusts = 0;
    this.sinceThrust = Infinity; // 바로 앞 찌르기가 끝난 뒤 지난 시간 (탭 연타 억제 — THRUST.bindRest)
    this.thrustPush = false; // 지금 칼끝을 뻗는 구간인가 (겨눈 뒤 ~ 뻗고 버티기 끝). combat.js 가 팔 유효 질량을 이때만 싣는다
    this.flowing = false; // 흐름(SKILL.flow) 중인가 — 끄면 늘 false
    const b = THRUST.body;
    this.thrustPose = { w: 0, hand: [0, 0, 0], dir: [1, 0, 0], pelvisYaw: b.pelvisYaw * D2R, chestYaw: b.chestYaw * D2R, pitch: b.pitch * D2R, drop: b.drop };
    // 6) 결심 베기 (온몸 베기 L1). detect: 손가락 궤적으로 결심을 판정하는 파이터(플레이어, main.js). trace: 그 손가락 궤적(input.fingerTrace)
    this.detect = false;
    this.trace = null;
    this.clock = 0; // 이 검술 층의 시계 (초)
    // 결심 상태 (설계서 4-2): 다른 층(걸음·판정·연출)이 fighter.commit 으로 읽는다. 스텝마다 새로 만들지 않는다
    fighter.commit = {
      on: false, // 결심 베기 중 (1단계부터 회복 끝까지)
      stage: null, // 'A' 감기 시작(대가 없음) | 'B' 확정
      c: 0, // 결심 세기 0.3~1 (1단계에서는 잠정값)
      fam: null, // 무리 diagR diagL vert horizR horizL riseR riseL
      start: null, // 'chambered' 준비 자세에서 | 'auto' 집(쟁기)에서 자동 감기 | 'here' 그 밖
      t: 0, // 시작 뒤 시간
      Tc: 0.3, // 닿기까지 걸리는 시간
      u: 0, // 획의 진행 (t / Tc, 자동 감기 동안은 < 0)
      w: 0, // 덧씌우는 정도 0~1 (회복 동안 0으로)
      step: null, // 부탁한 걸음 (L3)
      result: null, // null | 'hit' | 'miss' | 'blocked' | 'glance' | 'through'
      handback: 0, // 손가락에 돌려주는 중인 정도 0~1
      endT: -1e9, // 획이 끝난 시각 (clock)
    };
    // 획 프로그램이 매 스텝 내는 덧씌움 (fighter.updateBodyPose·driveSword 가 w 만큼 쓴다). 몸은 코드 단위(라디안, updateBodyPose 부호)
    this.cutPose = { w: 0, wBody: 0, yawK: 1, pitch: 0, drop: 0, wLean: 0, over2: 0, n2: [0, 0, 1], plane: 0, pn: [0, 0, 1], pg: 0, pc: [0, -1, 0], pk: 0.5, hand: [0, 0, 0], cockEl: 0, cockAz: 0, over: 0, n: [0, 0, 1], lift: 0, liftA: 0, l0: [1, 0, 0], l1: [0, 1, 0] };
    // 결심 판정 상태 (손가락 원래 궤적을 읽은 자리와 지금 긋고 있는 한 획의 후보)
    // 결심 베기가 끝난 뒤 끝 자세 너머에서 버티는 덧씌움 (끝 손 더함·지나가기). 손가락이 움직이면 푼다
    this.rest = { w: 0, free: false, hand: [0, 0, 0], over: 0, n: [0, 0, 1] };
    this.det = { read: null, t: -1e9, lifted: true, frame: COMMIT.frameGuess, gaps: new Float64Array(8), gi: 0, px: 0, py: 0, sx: 0, sy: 0, st: 0, len: 0, peak: 0, lastSp: 0, dwx: 1e9, dwy: 1e9, dwt0: 0, dwell: 0, sinceSwing: 1e9, fastT: -1e9, stage: 0, lx: 0, ly: 0, tA: 0, quiet: 0, blocked: false, stopped: false };
  }

  /**
   * 탭 찌르기 시작. 칼끝을 상대 몸통으로 (칼이 이미 높은 자세면 머리로, 상대가 쓰러져 있으면 누운 몸으로) 맞추고
   * 칼 선을 따라 손을 뻗었다가 자세로 돌아온다. 찌르는 중엔 다시 받지 않는다.
   * @param opt.step false 면 내딛지 않는다 — AI 는 제 걸음(ai.js gaitStep·stepTime)으로 내딛을지 정하므로 false 로 부른다
   *  (검술 층이 따로 내딛기를 부탁하면 AI 가 "안 내딛는다"고 정한 때도 내딛고, 곧이어 AI 걸음이 그 부탁을 덮어써 두 번 내딛었다)
   * @returns 시작했으면 true
   */
  thrust({ step = true } = {}) {
    const f = this.f;
    if (this.tap || !f.alive || !f.armed || !f.foe || (f.state !== 'stand' && f.state !== 'kneel')) return false;
    // 권총(??? 등급): 찌르기 = 발사. 장전 중이면 쏘지 않는다 (gun.js)
    if (f.weapon?.gun) return gunCanFire(f, { now: true }); // 권총: 찌르는 동작 없이 사격 자세(gunPose, 자동 조준 + 흔들림)의 지금 총신 방향으로 바로 쏜다 (AI 조준 보정은 gunAI)
    // 지금 손 목표 (몸 기준 [앞, 위, 칼 든 쪽]). 검술 보정이 다 걸려 있으면 자세 지도의 손, 덜 걸려 있으면(보정 약·끔)
    //  날것 손 위치와 섞인 실제 손 목표(fighter.handBase)에서 뻗는다 — 자세 지도의 손에서 뻗으면 실제 손보다 뒤에서 시작해 덜 나갔다
    const g = f.guardWeight() >= 1 || !f.handBase ? f.guardPose.hand : f.handBase;
    const down = f.finish.on && f.finish.amt > 0.5; // 쓰러진 상대: 누운 몸을 내리찌른다 (finish.js 가 겨눈 곳)
    // 찌르기 무기(weapons.js THRUST_STYLE)는 더 멀리 찌르고 더 빨리 자세로 돌아온다.
    //  (겨누기·뻗기까지 빠르게 하면 팔이 손 목표를 따라가지 못해 오히려 덜 뻗는다 — 측정: 레이피어 탭 상처 60% → 20%)
    const ts = f.weaponCfg.thrustStyle;
    const K = { aim: THRUST.aim, extend: THRUST.extend, hold: THRUST.hold, recover: THRUST.recover * (ts?.recover ?? 1), reach: THRUST.reach + (ts?.reach ?? 0) };
    // 누운 몸을 내리찌를 때는 팔이 아래로 느리게 내려와(측정: 칼끝이 몸에 못 미친 판이 있었다) 더 길게, 더 오래 뻗는다
    if (down) {
      K.reach += THRUST.downReach;
      K.extend *= THRUST.downExtend;
    }
    this.tap = { t: 0, h0: g ? [g[0], g[1], g[2]] : [0.3, -0.2, 0.12], down, head: !down && this.aimRaw.y > THRUST.headPad, K };
    // 칼 길 잡기(R6): 칼이 맞닿았으면 그 칼 선 (아니면 null). 바로 앞 찌르기가 끝나고 bindRest 초 안의 탭(연타)은 잡지 않는다
    this.tap.bound = down || this.sinceThrust < THRUST.bindRest ? null : this.boundAxis();
    this.thrusts++;
    // 한 걸음 내딛으며 찌른다. 쓰러진 상대는 누운 몸이 한 팔 넘게 떨어져 있을 때만 (가까우면 마무리 자세가 거리를 맞춘다)
    const T = f.finish.target;
    if (step && f.state === 'stand' && (!down || Math.hypot(T[0], T[2]) > THRUST.downStepFrom * (f.finish.k ?? 1))) {
      if (f.gait?.active) f.gait.requestStep({ kind: 'lunge', fwd: THRUST.step, duration: 0.3 });
      else if (!down) this.lunge = SKILL.lungeTime;
      else this.tap.step = true; // 누운 몸은 가슴끼리 거리가 짧아 기존 내딛기 조건에 안 걸린다 → 찌르는 동안 직접 내딛는다
    }
    return true;
  }

  /**
   * 찌르기 목표점 (몸 기준): 쓰러진 상대의 누운 몸 / 머리 / 가슴.
   * 몸통은 가슴을 겨눈다 — 배 쪽은 칼자루를 쥔 상대의 두 팔뚝이 앞을 가려 칼끝이 팔에 먼저 걸린다 (측정: 첫 접촉의 3/4이 팔)
   */
  thrustTarget(out) {
    const f = this.f;
    const tp = this.tap;
    if (tp.down) {
      const T = f.finish.target;
      return out.set(T[0], T[1], T[2]);
    }
    const foe = f.foe;
    out.copy(foe.bodies[tp.head ? 'head' : 'chest'].translation());
    return out.sub(_c).applyQuaternion(_yawInv);
  }

  /**
   * 칼 길 잡기(R6): 찌르기를 시작할 때 내 칼과 상대 칼이 맞닿아(THRUST.bind m 안) 있으면 지금 내 칼 선(몸 기준 단위 벡터)을,
   * 아니면 null. 맞닿은 채로 칼끝을 목표로 크게 돌리면 상대 칼을 쓸고 지나가다 걸리므로, 이 선을 거의 그대로 따라 민다(updateThrust)
   */
  boundAxis() {
    const f = this.f;
    const foe = f.foe;
    if (!(THRUST.bind > 0) || !foe?.armed || foe.weaponBroken) return null;
    if (segDist(f.bladePoint(0, _u), f.bladePoint(1, _b), foe.bladePoint(0, _c), foe.bladePoint(1, _p)) > THRUST.bind) return null;
    const q = f.sword.rotation();
    _sq.set(q.x, q.y, q.z, q.w);
    _yawInv.copy(f.yaw).invert();
    const ax = _u.set(0, 1, 0).applyQuaternion(_sq).applyQuaternion(_yawInv).toArray();
    // 칼끝이 이미 목표 줄에 있을 때만(목표 방향과 bindAim 도 안) 맞댄 채 민다 — 아니면 몸을 비껴간다
    //  (측정: 숨 고르고 찌른 탭에서는 칼 길을 잡은 탭의 상처율이 오히려 낮았다. 효과는 앞 찌르기로 칼이 줄에 놓인 연타에서만 났다)
    if (THRUST.bindAim < 180) {
      const c = f.bodies.chest.translation();
      _c.set(c.x, c.y, c.z);
      const P = this.thrustTarget(_p);
      const h0 = this.tap.h0;
      _b.set(P.x - h0[0], P.y - h0[1], P.z - h0[2]).normalize();
      if (_b.x * ax[0] + _b.y * ax[1] + _b.z * ax[2] < Math.cos(THRUST.bindAim * D2R)) return null;
    }
    return ax;
  }

  /** 매 스텝: 찌르기 자세(thrustPose) 갱신 */
  updateThrust(dt) {
    const tp = this.tap;
    const pose = this.thrustPose;
    const f = this.f;
    const T = THRUST;
    const K = tp?.K; // 이번 찌르기의 시간·뻗는 거리 (무기의 찌르기 장점 반영)
    if (tp) tp.t += dt;
    this.thrustPush = false;
    if (!tp || tp.t >= K.aim + K.extend + K.hold + K.recover || !f.alive || !f.armed || !f.foe) {
      this.tap = null;
      pose.w = 0;
      return;
    }
    // 넘어졌거나(서 있지도 무릎 꿇지도 않음) 내리찌르던 상대가 일어나면 더 뻗지 않고 곧바로 돌아온다:
    //  지금 덧씌운 정도(w)에서 돌아오는 시간 동안 0으로 (한 스텝에 끊으면 칼이 튄다). 팔 유효 질량도 더는 싣지 않는다
    if (!tp.abort && ((f.state !== 'stand' && f.state !== 'kneel') || (tp.down && !f.finish.on))) {
      tp.abort = { t: tp.t, w: pose.w };
    }
    if (tp.abort) {
      const r = (tp.t - tp.abort.t) / K.recover;
      if (r >= 1) {
        this.tap = null;
        pose.w = 0;
      } else pose.w = tp.abort.w * (1 - r);
      return;
    }
    const t = tp.t;
    const end = K.aim + K.extend + K.hold;
    this.thrustPush = t >= K.aim && t < end;
    if (tp.step && t < K.aim + K.extend && f.move.y > -0.2) f.move.y = Math.max(f.move.y, SKILL.lungeMove * this.level);
    // 덧씌우는 정도: 겨누며 빠르게 1로, 뻗은 뒤 자세로 돌아오며 0으로
    pose.w = t < K.aim ? t / K.aim : t < end ? 1 : 1 - (t - end) / K.recover;
    const c = f.bodies.chest.translation();
    _c.set(c.x, c.y, c.z);
    _yawInv.copy(f.yaw).invert();
    const P = this.thrustTarget(_p);
    // 손: 찌르기 시작 때의 손 목표에서 목표점 쪽으로 칼 선을 따라 뻗는다. 겨누는 동안 칼 선 뒤로 조금 당겼다가(준비)
    //  뻗어서 손이 속도를 붙일 거리를 번다
    const h0 = tp.h0;
    _q.set(P.x - h0[0], P.y - h0[1], P.z - h0[2]).normalize();
    // 칼 길 잡기(R6): 칼이 맞닿은 채 찌르면 지금 칼 선을 bindTurn 만큼만 목표 쪽으로 틀어 그 선으로 민다 (칼끝을 크게 돌리지 않는다)
    const bd = tp.bound;
    if (bd) _q.multiplyScalar(THRUST.bindTurn).add(_u.set(bd[0], bd[1], bd[2]).multiplyScalar(1 - THRUST.bindTurn)).normalize();
    //  팔이 이미 굽어 있으면(황소처럼 손이 머리 옆) 당길 필요가 없다 — 어깨에서 손까지 거리로 가늠한다.
    //  (쓰러진 상대는 겨눔 자세가 이미 칼끝을 몸 위로 띄워 두어 당기지 않는다. 칼이 맞닿았으면 당기지 않고 곧게 민다)
    const ext = Math.hypot(h0[0], h0[1] - 0.1, h0[2] - 0.2); // 어깨(가슴 기준 [0, 0.1, 0.2])에서 손까지
    const ch = tp.down || bd ? 0 : T.chamber * THREE.MathUtils.clamp((ext - 0.36) / 0.12, 0, 1);
    const a = THREE.MathUtils.clamp(t / K.aim, 0, 1);
    const s = THREE.MathUtils.clamp((t - K.aim) / K.extend, 0, 1);
    const e = -ch * a * a * (3 - 2 * a) + (ch + K.reach) * s * s * (3 - 2 * s);
    for (let k = 0; k < 3; k++) pose.hand[k] = h0[k] + _q.getComponent(k) * e;
    if (bd) {
      // 칼끝은 민 선 그대로 (돌리지 않는다)
      pose.dir[0] = _q.x;
      pose.dir[1] = _q.y;
      pose.dir[2] = _q.z;
      tp.dir = pose.dir;
    }
    // 칼끝: 겨누는 동안은 지금 손(칼자루)에서 목표점 너머 past 의 점을 향해 돌리고, 뻗기 시작하면 그 방향을 붙잡는다.
    //  뻗는 동안 손은 거의 칼 축 방향으로 가는데(측정 0.96), 방향을 계속 고쳐 잡으면 손목이 5~9° 늦게 따라 돌며
    //  칼끝이 옆으로 쓸려 칼 축 방향 성분이 0.7까지 떨어졌다 → 붙잡아 두면 칼끝은 손과 함께 칼 축을 따라 나간다
    //  (쓰러진 상대를 내리찌를 때는 칼이 거의 수직이라 손이 칼 선에서 벗어나는 만큼을 계속 고쳐 잡는 편이 낫다 — 측정)
    if (!bd && (t < K.aim || !tp.dir || tp.down)) {
      const sp = f.sword.translation();
      P.addScaledVector(_q, T.past);
      _q.set(sp.x, sp.y, sp.z).sub(_c).applyQuaternion(_yawInv);
      P.sub(_q).normalize();
      pose.dir[0] = P.x;
      pose.dir[1] = P.y;
      pose.dir[2] = P.z;
      if (t >= K.aim && !tp.down) tp.dir = [P.x, P.y, P.z];
    }
    const b = tp.down ? FINISH.strike : T.body;
    pose.pelvisYaw = b.pelvisYaw * D2R;
    pose.chestYaw = b.chestYaw * D2R;
    pose.pitch = b.pitch * D2R;
    pose.drop = b.drop;
  }

  /**
   * 흐름 판단(SKILL.flow): 휘두르기가 멈추지 않은 채 끌기 방향이 flowTurn(rad) 넘게 휘어 돌면 흐름(this.flowing)이다.
   *  - 흐르는 동안 반 바퀴(새 베기)마다 한 걸음 내딛는다 (상대가 한 걸음 거리일 때)
   *  - 안전장치: 칼이 세게 막히면(fighter.jolt) 흐름이 끊기고 flowBreak 초 동안 다시 흐르지 못한다
   *  - 손을 멈추면(0.08초) 흐름이 끝나 예전처럼 자세에서 선다
   *  손목 제동을 풀어 칼이 관성으로 돌아 나가게 하는 것은 fighter.js 몫이다(this.flowing 을 읽으면 된다 — 디렉터가 넣는다)
   */
  updateFlow(dt, swinging) {
    const f = this.f;
    this.flowLock = Math.max(0, (this.flowLock ?? 0) - dt);
    if (f.jolt > 0.5) {
      this.flowing = false;
      this.flowTurn = 0;
      this.flowLock = SKILL.flowBreak;
    }
    if (!swinging) {
      this.flowQuiet = (this.flowQuiet ?? 0) + dt;
      if (this.flowQuiet > 0.08) {
        this.flowing = false;
        this.flowTurn = 0;
        this.flowDir = null;
      }
      return;
    }
    this.flowQuiet = 0;
    const a = Math.atan2(this.vel.y, this.vel.x);
    if (this.flowDir != null) {
      const da = Math.abs(Math.atan2(Math.sin(a - this.flowDir), Math.cos(a - this.flowDir)));
      this.flowTurn = (this.flowTurn ?? 0) + da;
      this.flowStepTurn = (this.flowStepTurn ?? 0) + da;
    }
    this.flowDir = a;
    if (!this.flowing && this.flowLock <= 0 && this.flowTurn > SKILL.flowTurn) {
      this.flowing = true;
      this.flows = (this.flows ?? 0) + 1;
      this.flowStepTurn = Math.PI; // 흐르기 시작하는 베기부터 내딛는다
    }
    if (this.flowing && this.flowStepTurn >= Math.PI && f.state === 'stand') {
      this.flowStepTurn = 0;
      const d = f.foeDistance();
      if (d > SKILL.lungeMin && d < SKILL.lungeMax && !(f.finish?.amt > 0.5)) {
        if (f.gait?.active) f.gait.requestStep({ kind: 'pass', fwd: 0.3, duration: 0.3 });
        else this.lunge = SKILL.lungeTime;
      }
    }
  }

  /**
   * 들어가며 막기(R3 — 짧은 한손 칼, weapons.js enterParry): 상대가 휘두른 칼을 내 칼로 받아 낸 순간 한 걸음 앞으로 들어간다.
   *  긴 칼이 닿고 짧은 칼은 못 닿는 띠를 막은 칼로 덮은 채 건너, 긴 칼이 옹색한 안쪽으로 간다 (AI 는 거기서 되받아 친다).
   *  내가 휘두르던 중(내 공격이 막힌 것)이면 아니다
   */
  enterParry(dt) {
    const f = this.f;
    const foe = f.foe;
    this.enterCool = Math.max(0, (this.enterCool ?? 0) - dt);
    if (this.enterCool > 0 || f.jolt < SKILL.enterJolt || f.state !== 'stand' || !foe?.alive) return;
    if (this.activity > 0.5 || (foe.skill?.activity ?? 0) < 0.5) return;
    const d = f.foeDistance();
    if (d < SKILL.enterMin || d > SKILL.lungeMax) return;
    this.enterCool = SKILL.enterCool;
    this.enters = (this.enters ?? 0) + 1;
    if (f.gait?.active) f.gait.requestStep({ kind: 'pass', fwd: SKILL.enterStep, duration: 0.3 });
    else this.lunge = SKILL.lungeTime;
  }

  /**
   * R1: 이 스텝의 손가락 표본 (main.js·harness_m 이 handDeltaAt(stepT) 로 handOffset 에 더한 것과 같은 자리 fingerTrace.at(stepT + predictMs)).
   *  dF = 두 표본 차 × inputScale (죽었거나 권총이면 0 — handOffset 에 안 든다). handOffset 이 손 닿는 끝(R) 밖이면 바깥으로 민 몫 가운데
   *  자르기가 자르는 만큼(|off| − R)만 뺀다. 빠르기는 게임 초당 (멈칫·슬로모션에도 예전 걸러진 vel 과 같은 시계):
   *  vF = dF ÷ 게임 시간, vS = 실제 조각 두 개(한 스텝 이상 떨어진)의 기울기 × inputScale × 벽시계/게임 시간 — 내다본 몫·프레임 몰림이 빠르기로 들지 않는다.
   *  스텝 시각이 같으면(한 프레임에 몰린 멈칫·슬로모션 스텝) 앞 값 유지, 그 게임 시간은 다음 나눗수에 쌓인다
   */
  readFinger(off, R, dt) {
    const f = this.f;
    const c = this.fc;
    const tr = this.trace;
    const s = tr.at(f.stepT + INPUT.predictMs, _fs);
    const d = this.dF;
    c.dt = 0;
    if (!c.on) {
      c.on = true;
      c.g = 0;
      d.set(0, 0);
      this.vF.set(0, 0);
      this.vS.set(0, 0);
    } else {
      const k = f.alive && !f.weapon?.gun ? f.inputScale ?? 1 : 0;
      d.set((s.x - c.x) * k, (s.y - c.y) * k);
      c.g += dt;
      const L = off.length();
      let ux = 0, uy = 0, q = 1; // 손 닿는 끝에서 바깥 몫이 남는 비율
      if (L > R) {
        ux = off.x / L;
        uy = off.y / L;
        const dr = d.x * ux + d.y * uy;
        if (dr > 0) {
          const cut = Math.min(dr, L - R);
          d.x -= cut * ux;
          d.y -= cut * uy;
          q = (dr - cut) / dr;
        }
      }
      c.dt = (f.stepT - c.t) / 1000;
      if (c.dt > 0) {
        c.gdt = c.g;
        c.g = 0;
        this.vF.set(d.x / c.gdt, d.y / c.gdt);
        const w = tr.rawVel(f.stepT, dt * 1000, Math.max(COMMIT.stillGap, COMMIT.stillFrames * (tr.frameDt || 0)), _fv);
        const m = (k * c.dt) / c.gdt;
        const v = this.vS.set(w.x * m, w.y * m);
        const vr = v.x * ux + v.y * uy;
        if (q < 1 && vr > 0) {
          v.x -= vr * (1 - q) * ux;
          v.y -= vr * (1 - q) * uy;
        }
      }
    }
    c.x = s.x;
    c.y = s.y;
    c.t = f.stepT;
    return true;
  }

  /**
   * R1 (d): 앞먹임 속도 = 가죽끈이 손가락에 끌려간 몫. 건너뛰기 중이면 손가락 속도 그대로. 아니면 앞 스텝의 틈(gapE, ≤ 반경)에
   *  손가락 몫(dF)만 더했을 때 가죽끈이 끌리는 만큼 (떨림은 0, 흔들림·자세 복귀·되맞춤처럼 손가락 아닌 이동은 들지 않는다. 크기 ≤ |dF|)
   */
  leadVel(skip, dead) {
    const c = this.fc;
    if (c.dt > 0) {
      if (skip) this.vLead.copy(this.vF);
      else {
        const gx = this.gapE.x + this.dF.x;
        const gy = this.gapE.y + this.dF.y;
        const g = Math.hypot(gx, gy);
        const k = g > dead ? (g - dead) / g / c.gdt : 0;
        this.vLead.set(gx * k, gy * k);
      }
    }
    const off = this.f.handOffset;
    this.gapE.set(off.x - this.anchor.x, off.y - this.anchor.y);
  }

  update(dt) {
    if (dt <= 0) return;
    const f = this.f;
    const L = this.level;
    this.sinceThrust = this.tap ? 0 : this.sinceThrust + dt;
    const off = f.handOffset;
    const R = WEAPON.reach;
    // R1: 손가락을 가진 파이터는 이 스텝의 손가락 표본을 읽는다 (손이 닿는 끝에 자르기 전 — 바깥으로 민 몫은 빼야 하므로)
    const A = ARM;
    const fin = (A.lead || A.rawSwing || A.leashSkip) && INPUT.coalesce && !!this.trace && f.stepT > 0 && this.readFinger(off, R, dt);
    if (off.length() > R) off.setLength(R);
    this.clock += dt;

    // 6) 결심 베기: 손가락 궤적으로 판정하고(플레이어), 진행 중인 획 프로그램을 한 스텝 넘긴다.
    //  (돌려주기가 시작되면 handOffset·anchor·prev 를 획 패드 자리로 맞추므로 아래 손 목표 속도보다 먼저)
    const cm = f.commit;
    //  (R2 손짓 층이 켜지면 옛 결심 판정 대신 손짓 층 — f.commit 은 켜지지 않는다. 옛 경로는 W5 가 지울 때까지 GESTURE.on=false 비교용)
    if (GESTURE.on && f.ges) f.ges.update(dt, f.stepT);
    else if (WHOLE.on && WHOLE.commit && this.detect && this.trace) this.detectCommit(dt);
    if (cm.on) this.updateCut(dt);
    if (this.rest.w > 0) this.updateRest(dt);

    // 손 목표 속도 (손가락 떨림을 거르기 위해 살짝 부드럽게)
    const rx = (off.x - this.prev.x) / dt;
    const ry = (off.y - this.prev.y) / dt;
    this.prev.copy(off);
    const k = 1 - Math.exp(-dt * 25);
    this.vel.x += (rx - this.vel.x) * k;
    this.vel.y += (ry - this.vel.y) * k;
    const sp = this.vel.length();
    // R1 (c): 손가락 원 속도(실제 조각 두 개)로 읽는다 (걸러진 vel 은 τ 40 ms 늦다). 손가락이 없거나 끄면 예전 그대로
    const vf = fin ? this.vS.length() : 0;
    const swinging = (A.rawSwing && fin ? vf : sp) > SKILL.swingSpeed && f.alive && f.armed;
    // 휘두르는 중인 정도 (0~1): 휘두르기 시작하면 빨리 1로, 멈추면 천천히 0으로 (몸을 크게 쓰는 건 벨 때뿐).
    //  결심 베기의 획 프로그램이 도는 동안(확정 뒤)도 휘두르는 중이다 — 확정 순간 1로 뛰지 않고 휘두를 때와 같은 빠르기로 오른다
    //  (1로 뛰면 몸이 팔 베기보다 먼저 돌아 칼이 100 ms 늦었다: 걸어 들어가며 벤 왼쪽 사선이 팔 베기가 맞힌 거리에서 비켜 갔다)
    const prog = cm.on && cm.padOn;
    const act1 = swinging || (prog && !cm.ended && !cm.fading);
    this.activity += ((act1 ? 1 : 0) - this.activity) * Math.min(1, dt / (act1 ? 0.04 : 0.4));

    // 0) 가죽끈: anchor는 손가락(off)이 반경(inputDeadRadius)을 넘어야 그만큼만 끌려간다.
    //  반경 안의 떨림은 anchor를 전혀 움직이지 못한다 — 어디서 떨든(자세 경계라도) 걸러진다.
    //  큰 움직임(진짜 베기)은 반경이 순식간에 다 채워져 손가락과 거의 같이 움직인다(지연 ≈ 반경/속도).
    //  R1 (b) 목줄 건너뛰기: 손가락이 swingSpeed 보다 빠른 동안은 anchor 가 손가락 몫(dF)을 그대로 따라가고(틈을 그대로 두므로 들어갈 때 튀지 않는다),
    //  남은 틈은 넘친 빠르기가 반경을 지나는 만큼 풀린다 (문턱에서 0 → 나올 때도 튀지 않는다). 느린 떨림은 예전 가죽끈 그대로
    const skip = A.leashSkip && fin && vf > SKILL.swingSpeed;
    if (SKILL.handDynamicsOn) {
      const dead = SKILL.inputDeadRadius;
      if (skip) this.anchor.add(this.dF);
      const adx = off.x - this.anchor.x;
      const ady = off.y - this.anchor.y;
      const ad = Math.hypot(adx, ady);
      if (ad > dead) {
        const k = (ad - dead) / ad;
        this.anchor.x += adx * k;
        this.anchor.y += ady * k;
      }
      if (skip) {
        const e = Math.exp((-(vf - SKILL.swingSpeed) * dt) / dead);
        this.anchor.set(off.x - (off.x - this.anchor.x) * e, off.y - (off.y - this.anchor.y) * e);
      }
      if (A.lead && fin) this.leadVel(skip, dead);
    } else {
      this.anchor.copy(off);
      if (A.lead && fin && this.fc.dt > 0) this.vLead.copy(this.vF);
    }

    // 흐름(SKILL.flow, 시제품): 멈추지 않고 휘어 이어지는 끌기를 흐름으로 본다 (끄면 아무 일도 없다 — flowing 은 늘 false)
    if (SKILL.flow) this.updateFlow(dt, swinging);
    // 들어가며 막기 (짧은 한손 칼만 — 다른 무기는 아무 일도 없다)
    if (f.weapon?.enterParry) this.enterParry(dt);
    const fk = this.flowing ? SKILL.flowFollow : 1; // 흐르는 동안은 이어 베기를 더 밀어 칼이 멈추지 않고 돌아 나가게

    // 1) 이어 베기: 휘두르는 동안 움직이는 방향으로 목표를 더 밀어 두었다가 천천히 되돌린다
    if (swinging) this.follow.addScaledVector(this.vel, dt * SKILL.followGain * L * fk);
    this.follow.multiplyScalar(Math.exp(-dt / SKILL.followDecay));
    const fm = SKILL.followMax * L * fk;
    if (this.follow.length() > fm) this.follow.setLength(fm);
    this.aimRaw.copy(this.anchor).add(this.follow);
    // 6) 결심 베기: 획 패드(끝 자세까지 마저 긋는 "획의 손가락")가 손가락 대신 손 목표가 된다. 거르기·이어 베기는 휘두를 때 그대로 —
    //  칼과 몸이 팔 베기처럼 겨눈 선을 따라가고 닿는 때도 같다 (설계서는 이어 베기를 0 으로 두지만, 그러면 칼이 겨눈 선보다 몇 cm
    //  옆으로 지나 1.5 m 더미를 비켜 가는 판이 생겼다). 돌려주기·그만두기 동안엔 손가락 쪽(anchor)과 섞는다
    if (prog && cm.u >= 0) this.leadPad();
    if (cm.on && cm.padW > 0) {
      const pw = cm.padW;
      this.aimRaw.set(this.anchor.x + (cm.padX - this.anchor.x) * pw + this.follow.x, this.anchor.y + (cm.padY - this.anchor.y) * pw + this.follow.y);
    }
    const rawOut = this.aimRaw.length() > R;
    if (rawOut) this.aimRaw.setLength(R);
    // 손 목표를 "딱 멈추는"(임계 감쇠) 2차 필터로 거른다: 목표가 순간이동해도 손은 가속·감속하며 간다.
    //  (사람의 손도 순간적으로 속도를 바꾸지 못한다. 목표가 튀면 근육이 그 충격을 몸통에 그대로 전해 출렁인다)
    // 휘두르는 순간엔 근육을 긴장시켜(공동 수축) 더 빠르고 단단하게 따라간다. 결심 베기의 획 프로그램이 도는 동안도
    //  (자동 감기는 손가락이 이미 멈춘 뒤에 칼을 감고 벤다)
    const wT = swinging || (prog && !cm.ended) ? SKILL.aimFilterStrike : SKILL.aimFilter;
    this.filterW = (this.filterW ?? wT) + (wT - (this.filterW ?? wT)) * Math.min(1, dt * 30);
    const w = this.filterW;
    const ox = this.aim.x;
    const oy = this.aim.y;
    let ax, ay;
    if (A.lead && fin) {
      // R1 (d) 앞섬 보정: 손가락 속도 앞먹임 (aimLead). 고른 끌기에서 지연 (1 − aimLead)·2/ω, 멈추면 앞먹임이 0 이 되어 필터가 선다.
      //  획 패드가 섞이는 만큼(padW)은 손가락 몫이 아니다. 손 목표가 닿는 끝(R)에 잘렸으면 바깥으로 민 몫은 앞서지 않는다
      let lx = this.vLead.x;
      let ly = this.vLead.y;
      if (cm.on && cm.padW > 0) {
        lx *= 1 - cm.padW;
        ly *= 1 - cm.padW;
      }
      if (rawOut) {
        const ux = this.aimRaw.x / R;
        const uy = this.aimRaw.y / R;
        const dr = lx * ux + ly * uy;
        if (dr > 0) {
          lx -= dr * ux;
          ly -= dr * uy;
        }
      }
      const Ld = A.aimLead;
      ax = w * w * (this.aimRaw.x - this.aim.x) + 2 * w * (Ld * lx - this.aimVel.x);
      ay = w * w * (this.aimRaw.y - this.aim.y) + 2 * w * (Ld * ly - this.aimVel.y);
    } else {
      ax = w * w * (this.aimRaw.x - this.aim.x) - 2 * w * this.aimVel.x;
      ay = w * w * (this.aimRaw.y - this.aim.y) - 2 * w * this.aimVel.y;
    }
    this.aimVel.x += ax * dt;
    this.aimVel.y += ay * dt;
    this.aim.x += this.aimVel.x * dt;
    this.aim.y += this.aimVel.y * dt;
    // 자동 감기(u < 0) 동안은 손 목표가 패드를 거르지 않고 따른다 (패드는 이미 최소 저크로 매끄럽다. 거르면 감기 시간(0.1초)
    //  안에 손 목표가 거의 오르지 못해 칼이 감기지 않았다). 확정 뒤 autoBlend 동안은 팔 베기(걸러서 손가락을 따르던 손 목표)에서
    //  들어 올리기로 넘어간다 (kIn 0 → 1): 확정 순간 팔 베기로 나가던 손을 한 스텝에 멈추지 않는다
    if (prog && cm.start === 'auto' && cm.u < 0 && !cm.fading) {
      const k = cm.kIn;
      this.aim.set(this.aim.x + (cm.padX - this.aim.x) * k, this.aim.y + (cm.padY - this.aim.y) * k);
      this.aimVel.set((this.aim.x - ox) / dt, (this.aim.y - oy) / dt);
    }

    // 3) 내딛기: 잠깐 멈췄다가 새로 휘두르기 시작할 때, 상대가 한 걸음 거리에 있으면
    if (swinging && this.quiet > 0.2 && f.state === 'stand') {
      this.swings++;
      const d = f.foeDistance();
      // 쓰러진 상대를 내려찍을 때(finish.js)는 내딛지 않는다: 마무리 자세가 거리를 맞추고, 내딛으면 칼이 누운 몸을 지나 발밑에 떨어진다
      if (d > SKILL.lungeMin && d < SKILL.lungeMax && !(f.finish?.amt > 0.5)) this.lunge = SKILL.lungeTime;
    }
    this.quiet = swinging ? 0 : this.quiet + dt;

    // 4) 자세로 돌아가기
    if (swinging) {
      this.cutPending = true;
      this.recovering = false;
    }
    this.idle = f.inputActive ? 0 : this.idle + dt;
    const canRecover = this.autoGuard && L >= 0.35 && f.alive && f.armed && (f.state === 'stand' || f.state === 'kneel');
    // (결심 베기는 끝 자세 너머로 지나가기를 다 한 뒤에: 획 프로그램이 끝나기(u endU) 전엔 자세로 돌아가기를 시작하지 않는다)
    if (canRecover && this.cutPending && !swinging && !f.handHeld && this.idle > SKILL.recoverDelay && !(prog && !cm.ended)) {
      this.recovering = true;
      this.cutPending = false;
    }
    if (this.recovering) {
      if (f.inputActive || !canRecover) this.recovering = false; // 다시 조작하면 바로 조작이 우선
      else {
        const hx = SKILL.homeGuard[0] - off.x;
        const hy = SKILL.homeGuard[1] - off.y;
        const d = Math.hypot(hx, hy);
        // 휘두르기로 오인되지 않게 휘두르기 기준 속도보다 느리게 옮긴다
        const step = SKILL.recoverSpeed * dt;
        if (d <= step) {
          off.set(SKILL.homeGuard[0], SKILL.homeGuard[1]);
          this.recovering = false;
        } else {
          off.x += (hx / d) * step;
          off.y += (hy / d) * step;
        }
      }
    }
    if (this.lunge > 0) {
      this.lunge -= dt;
      // 물러나려는 중이면 내딛지 않는다 (조작이 우선). AI 가 기술 걸음을 딛는 중(holdFeet, ai.js moveFeet)에도.
      //  결심 베기가 확정된 뒤에는 L3 걸음이 대신한다 (COMMIT.armLunge 가 거짓일 때. R4 전까지는 팔 베기처럼 내딛는다). 1단계는 대가가 없다
      if (f.move.y > -0.2 && !this.holdFeet && !(prog && !COMMIT.armLunge) && f.foeDistance() > SKILL.lungeMin) f.move.y = Math.max(f.move.y, SKILL.lungeMove * L);
    }

    // 5) 탭 찌르기
    if (this.tap) {
      this.updateThrust(dt);
      this.activity = Math.max(this.activity, this.thrustPose.w); // 찌르는 동안엔 몸도 벨 때처럼 빠르게 따라온다
    } else if (this.f.weapon?.gun) this.thrustPose.w = gunPose(this.f, this.thrustPose); // 권총: 한 손 사격 자세를 덧씌운다 (gun.js)
  }

  // ─────────────────────────────────────────────────────────────
  //  6) 결심 베기 (온몸 베기 L1, docs/whole_body_strike.md L1)
  // ─────────────────────────────────────────────────────────────

  /**
   * 결심 베기를 할 수 있는 몸인가. 누가 부르든 같은 제한: 검술, 서 있음·무릎 꿇음, 칼을 쥠, 찌르기 중 아님, 쓰러진 상대 마무리 중 아님,
   *  권총 아님 (권총은 근접전이 없다 — 크게 그어도 몸만 크게 휘두르고 금색 확정 신호가 거짓이 된다. 쏘기는 탭 찌르기 그대로, gun.js)
   */
  canCommit() {
    const f = this.f;
    return this.level >= COMMIT.minLevel && f.alive && f.armed && !f.weapon?.gun && (f.state === 'stand' || f.state === 'kneel') && !this.tap && !(f.finish?.amt > 0.5);
  }

  /**
   * 결심 판정 (설계서 L1 (a)): 손가락 원래 궤적(input.fingerTrace)에 새로 쌓인 조각을 읽는다.
   *  참 시작점 = 손가락이 1 m/s 아래였던 마지막 점. 거기서부터 쌓은 길이 L, 평균 빠르기 v̄(벽시계), 방향(시작점 → 지금)으로
   *  1단계(감기 시작, 대가 없음) → 2단계(확정)를 가른다. 멈칫 뒤 흘려 넣은 조각(replay)은 판정에 쓰지 않는다
   */
  detectCommit(dt) {
    const f = this.f;
    const tr = this.trace;
    const d = this.det;
    const C = COMMIT;
    if (d.read == null) d.read = tr.total - tr.count; // 처음엔 버퍼에 남은 조각부터 (판을 시작할 때 main.js 가 궤적을 비운다)
    let n = tr.total - d.read;
    d.read = tr.total;
    if (n > tr.count) n = tr.count;
    // 쉬고 있으면 손가락 자리를 패드 자리에 맞춘다 (이번 조각들을 더하기 전. handOffset 에는 이미 더해져 있다).
    //  긋는 중에는 맞추지 않는다: handOffset 은 반지름에서 잘리지만 손가락 궤적은 자르지 않는다
    if (d.len === 0 && d.stage === 0) {
      let bx = f.handOffset.x;
      let by = f.handOffset.y;
      for (let k = 0; k < n; k++) {
        const i = tr.idx(k);
        bx -= tr.dx[i];
        by -= tr.dy[i];
      }
      d.px = d.sx = bx;
      d.py = d.sy = by;
    }
    if (tr.frameDt > 0) this.frameGap(tr.frameDt); // 한 화면 프레임 (프레임 시계가 있으면 그것으로, 없으면 조각 사이로)
    for (let k = n - 1; k >= 0; k--) {
      const i = tr.idx(k);
      const t = tr.t[i];
      const dx = tr.dx[i];
      const dy = tr.dy[i];
      const fl = tr.flag[i];
      if (fl & T_REPLAY) {
        // 멈칫 동안 모았다가 흘려 넣은 조각 (L6a): 판정에 쓰지 않는다. 그 뒤는 흘려 넣은 끝에서 새로 본다
        d.px += dx;
        d.py += dy;
        d.t = t;
        if (d.stage === 0) this.startAt(d.px, d.py, t);
        continue;
      }
      if (fl & T_LIFT) {
        this.liftCut(t);
        d.t = t;
        d.lifted = true;
        continue;
      }
      // 조각이 끊겼으면 그동안 손가락이 멈춰 있었다 (움직이지 않으면 이벤트가 없다): 그 자리가 참 시작점.
      //  끊긴 뒤 첫 조각은 한 프레임 동안 움직인 것으로 본다 (끊긴 시간 전체로 나누면 빠르기가 작게 잡힌다).
      //  "끊겼다"는 조각 사이 시각(벽시계)으로 가른다: 화면이 느리면(20~30 fps) 움직이는 중에도 조각 사이가 33~50 ms 라
      //  stillGap 만으로는 멈춤으로 잘못 읽는다 → 움직일 때의 조각 사이(det.frame)의 stillFrames 배까지는 이어진 긋기로 본다
      const gap = t - d.t;
      if (!(tr.frameDt > 0) && !d.lifted && gap > 0) this.frameGap(gap);
      const sg = Math.max(C.stillGap, C.stillFrames * d.frame);
      const still = d.lifted || gap > sg;
      if (still) this.slowPoint(d.px, d.py, Math.max(d.t, t - d.frame), d.t);
      d.lifted = false;
      const L = Math.hypot(dx, dy);
      const sp = (L / Math.max(1, still ? Math.min(gap, d.frame) : gap)) * 1000;
      if (!still && sp >= SKILL.swingSpeed) d.fastT = t; // 휘두르던 손가락 (올려베기 조건. 멈췄다 다시 움직인 첫 조각은 걸린 시간을 모르므로 빼고)
      const nx = d.px + dx;
      const ny = d.py + dy;
      if (sp < C.slowV || L < 1e-9) this.slowPoint(nx, ny, t, d.t);
      else this.movePiece(nx, ny, dx / L, dy / L, L, sp, t);
      d.px = nx;
      d.py = ny;
      d.t = t;
    }
    // 조각이 한동안 안 오면 손가락이 멈춘 것이다. 그 한동안은 벽시계로 (화면 프레임 시계 tr.now, 없으면 물리 시계) —
    //  한 프레임에 물리 스텝이 여럿 도는 느린 화면에서 프레임 사이를 멈춤으로 읽지 않게
    d.quiet = n > 0 ? 0 : tr.now > 0 ? Math.max(0, tr.now - d.t) / 1000 : d.quiet + dt;
    if (d.quiet * 1000 > Math.max(C.stillGap, C.stillFrames * d.frame)) {
      if (d.stage === 'A') this.fadeCut(false);
      else if (d.stage === 'B') this.retarget(d.px, d.py);
    }
    if (d.stage === 'A' && this.clock - d.tA > C.aTimeout) this.fadeCut(true); // 1단계 뒤 0.25초 안에 확정 못 함
  }

  /** 조각 사이 시각으로 한 화면 프레임(det.frame)을 잡는다: 최근 frameN 개 사이의 가장 짧은 값 (멈췄던 긴 사이는 섞이지 않는다) */
  frameGap(gap) {
    const d = this.det;
    const g = d.gaps;
    g[d.gi] = clamp(gap, 4, COMMIT.frameMax);
    d.gi = (d.gi + 1) % g.length;
    let m = COMMIT.frameMax;
    for (let k = 0; k < g.length; k++) if (g[k] > 0 && g[k] < m) m = g[k];
    d.frame = m;
  }

  /** 손가락이 느린 점 (1 m/s 아래, 또는 멈춰 있다 다시 움직임): 머묾을 재고 새 참 시작점으로 */
  slowPoint(x, y, T, tArrive) {
    const d = this.det;
    if (Math.hypot(x - d.dwx, y - d.dwy) > COMMIT.dwellR) {
      d.dwx = x;
      d.dwy = y;
      d.dwt0 = tArrive;
    }
    d.dwell = (T - d.dwt0) / 1000;
    if (d.stage === 'A') this.fadeCut(false); // 확정 전에 손가락이 멈췄다: 보통 팔 움직임으로
    if (d.stage === 'B') {
      this.retarget(x, y);
      return;
    }
    d.blocked = false;
    this.startAt(x, y, T);
  }

  /** 지금 긋는 한 획의 후보를 이 자리·시각에서 새로 시작한다 */
  startAt(x, y, T) {
    const d = this.det;
    d.sx = x;
    d.sy = y;
    d.st = T;
    d.len = 0;
    d.peak = 0;
    // 시작할 때 내 휘두르기가 끝난 지 얼마나 됐나 (올려베기 조건). 긋기 도중에 재면 60 Hz 입력에 휘두르기 판단이 깜빡여
    //  방금 끝난 것으로 잡힌다. 아직 휘두르는 중이면 0
    //  (휘두르기 끝은 손가락 궤적의 마지막 빠른 조각 + riseLag(칼이 손가락보다 늦게 멈춘다)로 잰다: 손 목표 빠르기로 재면 화면이
    //  느릴 때(20~30 fps) 한 프레임에 몰려 온 손가락 이동이 느린 자세 옮기기도 휘두르기로 보이게 해 올려베기를 모두 놓쳤다)
    d.sinceSwing = Math.min(this.clock - this.f.commit.endT, (T - d.fastT) / 1000 - COMMIT.riseLag);
  }

  /** 움직이는 조각 하나 (nx, ny = 조각 끝 손가락 자리, ux·uy = 방향, L = 길이, sp = 빠르기 m/s, t = 시각 ms) */
  movePiece(nx, ny, ux, uy, L, sp, t) {
    const f = this.f;
    const d = this.det;
    const cm = f.commit;
    const C = COMMIT;
    // 그만두기 (속임수, 막기로 바꾸기): 1단계 뒤 u 0.8 전에 손가락이 획 방향과 반대로 빠르게 움직였다. 대가 없음
    if (d.stage !== 0 && cm.on && !cm.fading && !cm.hb && cm.u < C.abortBefore && ux * d.lx + uy * d.ly < C.abortDot && sp > C.abortSpeed) this.fadeCut(false);
    // 꺾이면 다시 본다 (확정 전): 손가락 방향이 turnDeg 넘게 꺾이면 꺾인 자리를 새 시작점으로
    if (d.stage !== 'B' && d.len > 0.02) {
      let rx = d.lx;
      let ry = d.ly;
      if (d.stage === 0) {
        rx = d.px - d.sx;
        ry = d.py - d.sy;
        const rl = Math.hypot(rx, ry);
        rx = rl > 1e-6 ? rx / rl : ux;
        ry = rl > 1e-6 ? ry / rl : uy;
      }
      if (ux * rx + uy * ry < Math.cos(C.turnDeg * D2R)) {
        if (d.stage === 'A') this.fadeCut(false);
        d.blocked = false;
        this.startAt(d.px, d.py, d.t);
      }
    }
    if (d.stage === 'B' || d.blocked) return;
    d.len += L;
    if (sp > d.peak) d.peak = sp;
    d.lastSp = sp;
    const cx = nx - d.sx;
    const cy = ny - d.sy;
    const cl = Math.hypot(cx, cy);
    const vbar = d.len / Math.max(1e-3, (t - d.st) / 1000);
    if (d.stage === 0) {
      if (d.len >= C.aLen && vbar >= C.aSpeed && cl > 1e-6) {
        const e = this.eligible(cx / cl, cy / cl);
        if (e) this.beginCut(e, vbar, cx / cl, cy / cl);
      }
    } else if (d.len >= C.bLen && vbar >= C.bSpeed && this.threatOk()) this.confirmCut(vbar);
  }

  /** 손가락을 뗐다: 1단계였으면 떼며 긋기로 확정하거나(충분히 길고, 뗄 때도 빨랐다) 팔 베기로 */
  liftCut(t) {
    const d = this.det;
    const C = COMMIT;
    if (d.stage === 'A') {
      const vbar = d.len / Math.max(1e-3, (d.t - d.st) / 1000); // 마지막으로 움직인 조각까지
      if ((d.len >= C.bLen || (d.len >= C.flickLen && d.lastSp >= C.flickKeep * d.peak)) && vbar >= C.bSpeed && this.threatOk()) this.confirmCut(vbar);
      else this.fadeCut(false);
    }
    if (d.stage !== 'B') this.startAt(d.px, d.py, t);
  }

  /**
   * 참 시작점(det.sx, sy)과 긋는 방향(ux, uy)으로 무리를 고른다. 결심이 안 되는 긋기면 null.
   *  집(쟁기·왼쪽 쟁기)에서 그으면 집 칸 표로 고르고 자동 감기를 한다. 아니면 경로 방향이 가장 가까운 무리의 준비 쪽 절반에서만
   */
  eligible(ux, uy) {
    const d = this.det;
    const C = COMMIT;
    const sx = d.sx;
    const sy = d.sy;
    let home = false;
    for (const h of C.home) if (Math.hypot(sx - h[0], sy - h[1]) <= C.homeR) home = true;
    if (home) {
      if (!C.autoChamber) return null; // 자동 감기를 끄면 집에서는 결심이 되지 않는다 (지금처럼 작고 빠른 칼질)
      let th = Math.atan2(uy, ux) / D2R;
      if (th < 0) th += 360;
      for (const fam in C.homeBins) {
        const [a, b] = C.homeBins[fam];
        if (a <= b ? th >= a && th < b : th >= a || th < b) return { fam, start: 'auto' };
      }
      return null; // 집에서 위로 긋기 = 황소·지붕으로 올리는 막기
    }
    let best = null;
    let bd = -2;
    for (const F of FAMS) {
      const c = ux * F.dir[0] + uy * F.dir[1];
      if (c > bd) {
        bd = c;
        best = F;
      }
    }
    if (bd < Math.cos(C.angTol * D2R)) return null;
    // 그 무리의 준비 쪽 절반이어야 한다: (시작 − 가운데)를 경로 방향에 투영 ≤ 0, 경로 선에서 옆으로 ≤ halfLat
    const rx = sx - best.mid[0];
    const ry = sy - best.mid[1];
    if (rx * best.dir[0] + ry * best.dir[1] > C.halfAlong || Math.abs(rx * best.dir[1] - ry * best.dir[0]) > C.halfLat) return null;
    // 올려베기는 더 까다롭다: 낮은 자리에 머물렀다가, 내 휘두르기가 끝난 지 한참 뒤에만 (베고 끝난 자리에서 황소로 되돌아가기를 거른다)
    if (best.name.startsWith('rise') && (sy >= C.riseMaxY || d.dwell < C.riseDwell || d.sinceSwing < C.riseAfterStroke)) return null;
    return { fam: best.name, start: Math.hypot(sx - best.ch[0], sy - best.ch[1]) <= C.chamberNear ? 'chambered' : 'here' };
  }

  /** 위협 중에도 확정해도 되는 긋기인가. 올려베기와 높은 자리에서 시작한 가로베기는 막기 모양이라 위협 중엔 확정하지 않는다 */
  threatOk() {
    const fam = this.f.commit.fam;
    const guardLike = fam.startsWith('rise') || (fam.startsWith('horiz') && this.det.sy > COMMIT.threatHighY);
    return !guardLike || !this.threatened();
  }

  /**
   * 위협: 상대 획이 진행 중이고 칼 거리 + threatReach 안이거나, 상대 칼끝이 빠르게 내 몸통 쪽으로 가까이 온다.
   *  AI 는 공격 동작 전체(준비 자세 → 다가감 → 치기 → 지나가기)를 "치는 중"으로 본다: 치기 단계만 보면 AI 칼이 이미 지나간 뒤
   *  (지나가기)에 확정되는 막기 모양 긋기가 남는다
   */
  threatened() {
    const f = this.f;
    const foe = f.foe;
    const C = COMMIT;
    if (!foe || !foe.alive || !foe.armed) return false;
    const fc = foe.commit;
    const ai = foe.ai;
    const stroke = (fc && fc.on && fc.u < 1) || (ai && ai.mode === 'attack');
    if (stroke && f.foeDistance() < (ai?.M?.reach ?? 2.0) + C.threatReach) return true;
    const sp = foe.sword.translation();
    const r = foe.sword.rotation();
    _p.set(0, foe.weaponCfg.hiltLength + foe.weaponCfg.bladeLength, 0).applyQuaternion(_tq.set(r.x, r.y, r.z, r.w));
    const ch = f.bodies.chest.translation();
    _q.set(ch.x - sp.x - _p.x, ch.y - sp.y - _p.y, ch.z - sp.z - _p.z);
    const dist = _q.length();
    return dist > 1e-6 && dist < C.threatR && foe.tipVel.dot(_q) / dist > C.threatV;
  }

  /** 결심 세기 c (확정 순간 평균 빠르기에서). 자동 감기면 줄이고, 칼 든 팔을 다쳤으면 줄인다 */
  commitPower(vbar, start) {
    const C = COMMIT;
    let c = clamp(C.cMin + ((1 - C.cMin) * (vbar - C.cFrom)) / C.cSpan, C.cMin, 1);
    if (start === 'auto') c *= C.autoC;
    return c * Math.min(1, 2 * this.f.limbs.armS);
  }

  /** 1단계 "감기 시작": 무리·시작 자리·잠정 c 만 적는다. 몸·칼은 아직 손가락(팔 베기) 그대로 (대가 없음) */
  beginCut(e, vbar, ux, uy) {
    const f = this.f;
    const d = this.det;
    if (!this.commit({ fam: e.fam, start: e.start, c: this.commitPower(vbar, e.start), stage: 'A' })) return;
    d.stage = 'A';
    d.tA = this.clock;
    d.lx = ux;
    d.ly = uy;
    d.stopped = false;
    f.onCommit('A', f.commit.c, e.fam);
  }

  /** 2단계 "확정": c 를 정하고 그 c 로 획 프로그램을 이 자리에서 시작한다. 확정 신호는 onCommit 고리가 낸다 (main.js) */
  confirmCut(vbar) {
    const f = this.f;
    const cm = f.commit;
    if (!cm.on || cm.fading || cm.hb) return;
    cm.c = this.commitPower(vbar, cm.start);
    cm.stage = 'B';
    this.det.stage = 'B';
    this.startProgram(this.clock - this.det.tA, vbar);
    // 조이스틱 내딛기: L3(R4)가 결심 걸음을 만들기 전까지는 팔 베기와 똑같이 둔다 (COMMIT.armLunge). 없애면 결심 베기가 팔 베기보다
    //  덜 닿는다 (측정: 1.55 m 더미에서 팔 베기는 맞히고 결심 베기는 비켜 가는 판이 생겼다)
    if (!COMMIT.armLunge) this.lunge = 0;
    f.onCommit('B', cm.c, cm.fam);
  }

  /** 확정 못 함·그만두기: 1단계면 판정만 거둔다(몸·칼은 이미 손가락 그대로). 획 프로그램 중이면 덧씌움을 fadeTime 에 걸쳐 0 으로 */
  fadeCut(timeout) {
    const cm = this.f.commit;
    const d = this.det;
    if (cm.on && !cm.hb) cm.fading = true;
    d.stage = 0;
    if (timeout) d.blocked = true; // 끝까지 느리게 끄는 긋기가 1단계를 거듭 걸지 않게 (다음 멈춤까지)
  }

  /**
   * 결심 베기 시작. 플레이어는 결심 판정이 1단계에서 부르고(stage 'A': 판정만 적는다) 확정하면 획 프로그램을 시작한다.
   * AI 는 L8 에서 stage 'B' 로 부른다(곧바로 획 프로그램).
   * @param o.fam 무리, o.start 'chambered' | 'auto' | 'here', o.c 결심 세기, o.stage 'A' | 'B', o.v 획 패드 빠르기 (m/s, 없으면 c 로)
   * @returns 시작했으면 true (누가 부르든 canCommit 의 제한이 같다)
   */
  commit(o) {
    const f = this.f;
    const P = FAM_BY[o.fam];
    if (!(WHOLE.on && WHOLE.commit) || !P || !this.canCommit()) return false;
    const C = COMMIT;
    const cm = f.commit;
    // 앞 획의 덧씌움이 아직 남아 있으면(돌려주는 중·그만두기로 거두는 중) 버티기(rest)로 넘겨 풀리게 한다: 새 1단계가 그 자리에서
    //  0 으로 끊으면 칼과 몸이 한 스텝에 튄다
    if (cm.on && cm.padOn && !cm.ended && this.cutPose.w > 0) this.passToRest(cm.fading ? cm.w : 1);
    cm.on = true;
    cm.stage = o.stage ?? 'B';
    cm.fam = o.fam;
    cm.start = o.start ?? 'here';
    cm.c = o.c ?? 1;
    cm.t = 0;
    cm.u = 0;
    cm.w = 1;
    cm.result = null;
    cm.handback = 0;
    cm.step = null;
    cm.fading = false;
    cm.hb = false;
    cm.ended = false;
    cm.stuckT = 0;
    cm.overK = 1;
    cm.retT = -1;
    cm.path = P;
    cm.base = STROKE[P.base];
    cm.sgn = P.left ? -1 : 1;
    cm.k = P.left ? STROKE.leftScale : 1;
    cm.padOn = false; // 획 프로그램이 도는가 (확정한 뒤). 1단계 동안은 아무것도 덧씌우지 않는다
    cm.padW = 0;
    this.cutPose.w = 0;
    this.cutPose.wBody = 0;
    this.cutPose.lift = 0;
    this.cutPose.pg = 0;
    if (cm.stage === 'B') this.startProgram(0, o.v ?? C.cFrom + ((cm.c - C.cMin) * C.cSpan) / (1 - C.cMin));
    return true;
  }

  /**
   * 획 프로그램 시작 (확정 순간). 획 시계 u 는 1단계부터 흐른 것으로 친다 (설계서: 획 프로그램은 1단계에서 시작한다. 1단계 동안은
   *  덧씌우지 않았으므로 지금 자리에서 그 u 부터 이어 간다). 자동 감기는 확정 순간부터 그 시간만큼 u < 0.
   *  획 패드 = 손가락이 긋던 빠르기(v) 그대로 끝 자세까지 마저 긋는 "획의 손가락": 손가락이 일찍 멈추거나 떼도 끝까지 벤다
   */
  startProgram(stageAT, v) {
    const f = this.f;
    const cm = f.commit;
    const C = COMMIT;
    const P = cm.path;
    cm.t = 0;
    cm.pa = 0; // 획 패드가 경로를 간 길이 (m)
    cm.vs = Math.max(C.padMinV, v); // 획 패드 빠르기 (m/s)
    cm.tAuto = cm.start === 'auto' ? C.autoTime[0] + C.autoTime[1] * (1 - clamp(this.level, 0, 1)) : 0;
    cm.ex = P.end[0];
    cm.ey = P.end[1];
    const bp = f.bodyPose;
    cm.v0t = bp.pitch;
    cm.v0d = bp.drop;
    this.sizeCut();
    cm.u0 = cm.start === 'auto' ? -cm.tAuto / cm.Tc : Math.min(C.fromStageA, stageAT / cm.Tc);
    cm.u = cm.u0;
    // 획 패드 경로: 손가락 자리(가죽끈 anchor)에서 → 끝 자세 (곧게). 자동 감기면 지금 손 목표(aim)에서 먼저 준비 자세 쪽으로
    //  autoFrac 만큼 → 끝 자세 (손가락은 이미 끝 쪽으로 가 있다. 그 자리에서 되감으면 칼이 거꾸로 한 번 더 휘둘렀다).
    //  무리의 가운데 점은 거치지 않는다: 거치면 칼끝 목표가 찌르기 자세(앞을 겨눔)를 오래 지나 칼이 겨눈 선보다 먼저 끝 쪽으로 기울었다
    cm.padOn = true;
    const auto = cm.start === 'auto';
    cm.p0x = auto ? this.aim.x : this.anchor.x;
    cm.p0y = auto ? this.aim.y : this.anchor.y;
    cm.pbx = auto ? cm.p0x + (P.ch[0] - cm.p0x) * C.autoFrac : cm.p0x;
    cm.pby = auto ? cm.p0y + (P.ch[1] - cm.p0y) * C.autoFrac : cm.p0y;
    cm.padX = cm.p0x;
    cm.padY = cm.p0y;
    // 자동 감기는 칼이 준비 자세에 올라온 뒤에 벤다 (updateCut): 그때까지는 베기가 아니다 (닿아도 결과로 치지 않는다)
    cm.cutting = !auto;
    // 자동 감기의 베는 면: 칼자루 → 상대(가슴과 머리 사이 pk)를 품고 긋는 방향(몸 기준 [0, 위, 칼 든 쪽])으로 기운 면 (fighter.cutPlane).
    //  빠르게 들어 올린 팔은 준비 자세에서 그은 팔과 손 자리가 달라(위팔 비틀림이 다른 평형에 머문다) 칼이 겨눈 선 옆·위로 지나갔다
    const cp = this.cutPose;
    cp.pg = auto && !P.plane && C.autoPlane ? 1 : 0;
    if (cp.pg) {
      const L = Math.hypot(cm.ex - cm.pbx, cm.ey - cm.pby) || 1;
      cp.pc[0] = 0;
      cp.pc[1] = (cm.ey - cm.pby) / L;
      cp.pc[2] = (cm.ex - cm.pbx) / L;
      cp.pk = P.pk ?? C.planeK;
    }
    cm.hold = 0;
    cm.liftA = 0;
    cm.kIn = auto && C.autoBlend > 0 ? 0 : 1; // 팔 베기에서 들어 올리기로 넘어간 정도 (update)
    cm.freeK = 1;
    // 자동 감기의 베기 패드 빠르기: 쟁기에서 그은 손가락은 방향만 정했다 (그 세기는 c 로 획 시간에 들어갔다). 준비 자세 → 끝 자세를
    //  Tc × autoPadT 에 긋는 빠르기로 (손가락 빠르기로 그으면 가벼운 한손 칼은 준비 자세에서 끝까지 채찍질해 칼끝이 팔 베기보다 15~29% 빨랐다)
    if (auto && C.autoPadT > 0) cm.vs = Math.max(C.padMinV * 0.5, Math.hypot(cm.ex - cm.pbx, cm.ey - cm.pby) / (C.autoPadT * cm.Tc));
    // 휘두르는 면 (몸 기준): 출발 자리와 끝 자세의 칼끝 방향 둘 다에 수직. 지나가기가 이 축으로 칼끝을 끝 너머로 더 돌린다
    guardAt(cm.pbx, cm.pby, _g);
    _ga.set(_g.dir[0], _g.dir[1], _g.dir[2]);
    // 자동 감기의 칼끝 방향: 지금 칼 방향에서 준비 자세의 칼끝 방향으로 곧장 (들어 올리기, fighter.cutAim). 자세 지도를 따라가면 쟁기와
    //  준비 자세 사이의 자세(칼끝이 앞·아래)를 지나 칼끝이 가까운 상대 몸으로 파고들어 칼이 올라오지 못했다
    if (auto) {
      const r = f.sword.rotation();
      _yawInv.copy(f.yaw).invert();
      _p.set(0, 1, 0).applyQuaternion(_tq.set(r.x, r.y, r.z, r.w)).applyQuaternion(_yawInv);
      // 칼이 이미 돌고 있으면(팔 베기로 나가던 칼) 들어 올리기 칼끝 목표는 그 돌기를 autoCarryT 만큼 이어받은 방향에서 출발한다
      //  (그 자리에서 거꾸로 세우면 칼끝이 한동안 제자리에 머물러 첫 반응이 늦었다)
      const w = f.sword.angvel();
      _q.set(w.x, w.y, w.z).applyQuaternion(_yawInv);
      const wl = _q.length();
      if (wl > 1e-3) _p.applyAxisAngle(_q.multiplyScalar(1 / wl), Math.min(wl * C.autoCarryT, 0.6));
      cp.l0[0] = _p.x;
      cp.l0[1] = _p.y;
      cp.l0[2] = _p.z;
      cp.l1[0] = _ga.x;
      cp.l1[1] = _ga.y;
      cp.l1[2] = _ga.z;
    }
    guardAt(cm.ex, cm.ey, _g);
    _gb.set(_g.dir[0], _g.dir[1], _g.dir[2]);
    _ga.cross(_gb);
    if (_ga.lengthSq() < 1e-6) _ga.set(0, 0, -cm.sgn);
    _ga.normalize();
    const n = this.cutPose.n;
    n[0] = _ga.x;
    n[1] = _ga.y;
    n[2] = _ga.z;
    this.updateCut(0);
  }

  /** 결심 세기 c 로 획 시간과 크기를 정한다 (확정 순간). 설계서 L1 (b) 목표값·획 시간·약해지는 방식 */
  sizeCut() {
    const f = this.f;
    const cm = f.commit;
    const B = cm.base;
    const C = COMMIT;
    const c = cm.c;
    const L = clamp(this.level, 0, 1);
    const lv = 0.6 + 0.4 * clamp((L - 0.2) / 0.6, 0, 1); // 검술이 낮으면 작다
    const vig = f.vigor; // 지치면 작고 느리다
    const Ir = f.swordIhand / C.iLongsword; // 무거운 칼
    const one = !f.weaponCfg.twoHand; // 한손 칼은 몸통을 덜 쓰고 팔을 더 뻗고 빨리 끝난다
    // 획 시간: 세게 그을수록(c)·검술이 좋을수록·힘이 셀수록 빠르고, 칼이 무거울수록·지칠수록 느리다
    cm.Tc = B.Tc0 * (C.powerTc[0] - C.powerTc[1] * c) * (1 + 0.3 * (1 - L)) * Math.pow(f.strength, -0.35) * Math.pow(Ir, 0.25) * (1 + 0.4 * (1 - vig)) * (one ? 0.8 : 1);
    // 크기: 세게 그을수록 크다 (몸·손 더함 모두). 몸 값은 검술 자세 지도를 따르는 정도도 곱한다. 왼쪽 무리는 leftScale
    const amp = (C.powerAmp[0] + C.powerAmp[1] * c) * lv * (0.7 + 0.3 * vig) * cm.k;
    const body = amp * f.guardWeight();
    const trunk = one ? 0.6 : 1;
    // 골반·가슴 비틀기: 획 패드가 지나는 자세 지도 값의 yawK 배 (fighter.updateBodyPose. 닿은 뒤 끝 너머로 더 튼다). 무릎 꿇으면 조금만
    cm.yawK = 1 + C.yawGain * amp * trunk * (f.state === 'kneel' ? 0.3 : 1);
    // 숙이기·낮추기 [감기, 닿기, 끝]. 감기 값은 자동 감기일 때만 (준비 자세·지금 자리에서 시작하면 자세가 이미 감아 두었다)
    const auto = cm.start === 'auto';
    cm.th = B.pitch[1] * D2R * body;
    cm.te = B.pitch[2] * D2R * body;
    cm.tw = auto ? B.pitch[0] * D2R * body : cm.v0t;
    cm.dh = B.drop[1] * body;
    cm.de = B.drop[2] * body;
    cm.dw = auto ? B.drop[0] * body : cm.v0d;
    // 손 더함 (가슴 기준 [앞, 위, 칼 든 쪽]). 왼쪽 무리는 옆 값의 부호를 바꾼다. 손 감기·칼 젖히기는 자동 감기일 때만:
    //  준비 자세에서는 자세가 이미 감기다. 긋기가 시작된 뒤 되감으면 칼이 멈칫하고 겨눈 선을 벗어났다 (측정)
    const hw = auto ? amp : 0;
    cm.hw0 = B.wind[0] * hw;
    cm.hw1 = B.wind[1] * hw;
    cm.hw2 = B.wind[2] * hw * cm.sgn;
    cm.hr = (B.reach + (one ? 0.05 : 0)) * amp;
    cm.he0 = B.end[0] * amp;
    cm.he1 = B.end[1] * amp;
    cm.he2 = B.end[2] * amp * cm.sgn;
    const cw = auto ? lv : 0;
    cm.cockEl = B.cock[0] * D2R * cw;
    cm.cockAz = B.cock[1] * D2R * cw * cm.sgn;
    // 무거운 칼은 더 지나간다. 가벼운 칼(I ≤ I롱소드 × overLight[0])은 지나가지 않고 롱소드(overLight[1])까지 차츰 늘린다: 가벼운 칼은
    //  끝 자세 너머로 앞선 목표에 손목 제동이 늦게 걸려 끝 자세를 지나며 한 번 더 채찍질했다 (라이트세이버 사선 칼끝 팔 베기 26 → 29 m/s)
    const OL = C.overLight;
    cm.over = B.over * D2R * clamp(Math.sqrt(Ir), 0.7, 1.6) * clamp((Ir - OL[0]) / (OL[1] - OL[0]), 0, 1);
  }

  /**
   * 획 프로그램 한 스텝 (설계서 L1 (b)). u = t / Tc (1단계 0, 닿기 1).
   *  - 획 패드: 손가락이 긋던 빠르기로 끝 자세까지 (자동 감기면 먼저 들어 올린다). 손 목표는 팔 베기처럼 걸러서 따라간다
   *  - 몸: 골반·가슴 비틀기는 패드가 지나는 자세를 따라가고 닿은 뒤 yawK 배로 더 튼다. 숙이기·낮추기는 감기 → 닿기 → 끝 값을 최소 저크로
   *  - 손: 닿기 앞뒤로 팔을 끝까지 뻗고(reach), 닿은 뒤 끝 너머로 더 보낸다(end). 칼은 끝 자세 너머로 지나간다(over)
   *  - 끝 더함·지나가기는 획이 끝나도 버틴다 (끝 자세 너머에서 멈춘다 — 되돌아 흔들리지 않는다, updateRest)
   *  1단계(확정 전)에는 아무것도 덧씌우지 않는다
   */
  updateCut(dt) {
    const f = this.f;
    const cm = f.commit;
    const cp = this.cutPose;
    const C = COMMIT;
    // 넘어지거나 칼을 놓치면(또는 온몸 베기를 끄면) 곧바로 끝낸다
    if (!(WHOLE.on && WHOLE.commit) || !f.alive || !f.armed || (f.state !== 'stand' && f.state !== 'kneel')) {
      this.endCut();
      return;
    }
    cp.over2 = 0;
    cp.plane = 0;
    if (!cm.padOn) {
      // 1단계: 판정만 한다 (대가 없음 — 몸·칼은 손가락 그대로). 확정 못 하면 그냥 거둔다
      cm.t += dt;
      cp.w = 0;
      cp.wBody = 0;
      if (cm.fading) this.endCut();
      return;
    }
    cm.t += dt;
    const slow = cm.stuckT > 0 ? C.stuckSlow : 1; // 칼이 박힌 동안 획 시간을 늦춘다 (combat.js)
    // 칼이 박혔으면 끝 너머로 미는 몫(뻗기·끝 손 더함·지나가기)을 거둔다 (이 획에서는 다시 주지 않는다): 박힌 칼은 지나가지 못한다.
    //  계속 밀면 손목이 붙잡는 힘(combat.js)과 맞서 가벼운 칼이 떨며 돌았다 (칼끝 40~65 m/s, 떨림에 더미 상처 200 J 넘게)
    if (cm.stuckT > 0) {
      cm.stuckT -= dt;
      cm.freeK = Math.max(0, cm.freeK - dt / C.stuckFree);
    }
    cm.u += (dt / cm.Tc) * slow;
    // 자동 감기: 패드가 준비 자세에 닿아도(u 0) 칼이 준비 자세에 올라오기(칼과 칼끝 목표 사이 각 chamberTol 안) 전에는 베기를 시작하지
    //  않는다 (u 를 0 에 붙잡는다, chamberWait 까지). 패드만 시간표대로 가면 칼이 아직 오르는 동안 몸과 패드가 벌써 풀려, 칼이 늦게
    //  겨눈 선 옆(머리 옆)으로 내려왔다. 칼이 무거울수록 오래 감는다
    if (!cm.cutting && cm.u >= 0) {
      cm.u = 0;
      cm.hold += dt;
      if (cm.hold >= C.chamberWait || (f.aimErr < C.chamberTol * D2R && f.tipVel.length() < C.chamberV)) this.beginAutoCut();
    }
    const u = cm.u;
    // 결과 없이 닿기를 한참 지났다 → 헛침
    if (!cm.result && !cm.fading && u >= C.missU) this.strikeResult('miss', null);
    // 결과가 나오거나 닿기를 지나면 칼을 손가락에 돌려준다 (칼의 관성은 물리가 지킨다)
    if (!cm.hb && !cm.fading && (cm.result || u >= C.handbackU)) this.startHandback();
    if (cm.hb) cm.handback = Math.min(1, cm.handback + dt / C.handback);
    // 덧씌움 w: 그만두기는 fadeTime 에, 획이 끝나면(u endU) 회복 시간 동안 0 으로
    if (cm.fading) cm.w -= dt / C.fadeTime;
    else if (u >= C.endU) {
      if (!cm.ended) this.endStroke();
      cm.w -= dt / cm.recT;
    }
    if (cm.w <= 0) {
      this.endCut();
      return;
    }
    // 끝 고르기: 끝 자세를 retargetTime 에 걸쳐 손가락이 멈춘 자리로
    if (cm.retT >= 0 && cm.retT < C.retargetTime) {
      cm.retT = Math.min(C.retargetTime, cm.retT + dt);
      const a = sj(cm.retT / C.retargetTime);
      cm.ex = cm.rx0 + (cm.rx1 - cm.rx0) * a;
      cm.ey = cm.ry0 + (cm.ry1 - cm.ry0) * a;
    }
    // 획 패드: 자동 감기(u < 0) 동안은 준비 자세 쪽으로 들어 올리고 (칼이 올라올 때까지 거기서 기다렸다가), 그 뒤 끝 자세까지 곧게 vs 로
    if (u < 0) {
      // 들어 올리기는 확정 순간 곧바로 움직인다: 출발 빠르기 autoKick × 평균 빠르기로 떠나는 5차 곡선 (최소 저크는 처음 30 ms 에 거의
      //  안 움직여 확정 뒤 손·칼이 멈춘 것처럼 보였다 — 쟁기에서 옆으로 그은 가로베기 첫 반응 92~108 ms).
      //  확정 뒤 autoBlend 동안은 손 목표·몸·칼끝 목표가 팔 베기(손가락을 따라 이미 나가던 움직임)에서 들어 올리기로 넘어간다 (kIn,
      //  update·cutAim): 확정 순간 들어 올리기로 바꿔 끼우면 팔 베기로 나가던 손·칼을 한 스텝에 거꾸로 세워, 쟁기에서 옆으로 8 m/s 로
      //  그은 가로베기의 첫 반응이 팔 베기(83 ms)보다 늦은 92 ms 였다. 그 움직임을 들어 올리기 패드에 이어 붙이는 것(빠르기 이어받기)은
      //  반응은 맞췄지만 12 m/s 긋기에서 들어 올리는 길이 27 cm 휘어 사선이 1.46~1.78 m 더미를 7/20 비켜 갔다
      const q = (u - cm.u0) / -cm.u0;
      const h = q * (1 - q) * (1 - q) * (1 - q) * (1 + 3 * q);
      const a = sj(q) + C.autoKick * h;
      if (C.autoBlend > 0) cm.kIn = sj((q * -cm.u0 * cm.Tc) / C.autoBlend);
      cm.liftA = a;
      cm.padX = cm.p0x + (cm.pbx - cm.p0x) * a;
      cm.padY = cm.p0y + (cm.pby - cm.p0y) * a;
    } else {
      // 패드 스스로 나아가기(vs)는 손가락이 멈추거나 뗀 뒤에만: 긋는 동안은 손가락(가죽끈)이 곧 패드다. 화면이 60 Hz 면 손가락 조각은 물리
      //  두 스텝에 한 번 오므로, 그 사이에도 패드가 vs 로 나가면 패드가 손가락보다 앞서 칼이 팔 베기와 다른 길로 갔다 (걸어 들어가며 벤
      //  왼쪽 사선 12 m/s 헛침 0 → 7/20). 감기를 마치기를 기다리는 동안(자동 감기)은 준비 자세에 있다
      if (cm.cutting && !this.fingerMoving()) cm.pa += dt * slow * cm.vs;
      this.leadPad();
      cm.kIn = 1;
    }
    cm.padW = (cm.fading ? cm.w : 1 - cm.handback) * cm.kIn;
    // 몸: 비틀기 배율 (닿기 전에는 자세 지도 그대로 — 팔 베기와 같은 선으로 칼이 간다), 숙이기·낮추기 (COMMIT.keyU.lean)
    const E = C.envU;
    const K = C.keyU.lean;
    cp.yawK = 1 + (cm.yawK - 1) * envFrom(u, cm.u0, E.yaw);
    if (cm.start === 'auto') {
      // 자동 감기: 감기(들어 올리며 몸을 감는다) → 닿기 → 끝
      cp.pitch = keys(u, cm.u0, cm.v0t, K[0], cm.tw, K[1], cm.th, K[2], cm.te);
      cp.drop = keys(u, cm.u0, cm.v0d, K[0], cm.dw, K[1], cm.dh, K[2], cm.de);
      cp.wLean = 1;
    } else {
      // 그 밖: 닿기 앞까지는 자세 지도 그대로 따르다가(팔 베기와 같은 선) K[0] → K[1] 에 닿기 값으로 넘어가고, 끝 값으로
      cp.pitch = u <= K[1] ? cm.th : seg(Math.min(u, K[2]), K[1], cm.th, K[2], cm.te);
      cp.drop = u <= K[1] ? cm.dh : seg(Math.min(u, K[2]), K[1], cm.dh, K[2], cm.de);
      cp.wLean = envFrom(u, cm.u0, K);
    }
    //  (끝난 뒤에는 몸도 끝 자세에서 버틴다: 몸이 먼저 돌아오면 칼이 끝 자리에서 천천히 끌려 올라와 자리 잡기가 길어졌다)
    // 손 더함: 감기(자동 감기) → 뻗기 → 끝. 끝 더함·지나가기는 획이 끝나면 버티기(rest) 무게로, 그 밖의 덧씌움은 w 만큼
    const wa = cm.w;
    const hold = cm.ended ? this.rest.w : wa;
    // 손 감기·칼 젖히기(자동 감기만): 감기(u0 → 0) 동안 오르고 envU 의 두 점까지 버티다 뺀다
    const au = cm.start === 'auto' && cm.u0 < 0;
    //  (들어 올리는 동안에만: 들어 올리기 진행 q 로 오르고 버티다 준비 자세에 닿으면(q 1) 다 뺀다. 베기는 준비 자세에서 그은 베기와 같은
    //  자세에서 시작한다 — 손 감기·칼 젖히기를 베는 동안 남기면 손이 어깨 위·옆으로 벗어나 칼이 칼 든 쪽으로 크게 돌아 머리 위로 지나갔다)
    const lq = u < 0 ? (u - cm.u0) / -cm.u0 : 1;
    const eW = au ? env(lq, 0, E.wind[0], E.wind[1], 1) * wa : 0;
    const eR = envFrom(u, cm.u0, E.reach) * wa * cm.freeK;
    const eE = envFrom(u, cm.u0, E.end) * hold * cm.freeK;
    cp.hand[0] = cm.hw0 * eW + cm.hr * eR + cm.he0 * eE;
    cp.hand[1] = cm.hw1 * eW + cm.he1 * eE;
    cp.hand[2] = cm.hw2 * eW + cm.he2 * eE;
    // 칼 젖히기 (손목 감기, 자동 감기)와 지나가기
    const eC = au ? env(lq, 0, E.cock[0], E.cock[1], 1) * wa : 0;
    cp.cockEl = cm.cockEl * eC;
    cp.cockAz = cm.cockAz * eC;
    // 들어 올리기 칼끝 방향 (자동 감기): 패드와 같은 진행으로 (확정 뒤 kIn 만큼 팔 베기의 칼끝 목표에서 넘어온다), 베기를 시작하면
    //  끈다 (그때 패드는 준비 자세라 자세 지도 방향과 같다)
    cp.lift = au && !cm.cutting ? wa * cm.kIn : 0;
    cp.liftA = u < 0 ? cm.liftA : 1;
    cp.over = cm.over * cm.overK * cm.freeK * envFrom(u, cm.u0, E.over) * hold;
    // 손목이 도는 면 (곧게 내려베기처럼 준비 → 끝 칼 방향이 거의 반대인 무리): 칼끝 목표가 면 안에서 베는 쪽으로만 앞서게
    //  (면은 fighter.cutPlane 이 스텝마다 칼자루 → 상대 몸통 방향으로 세운다. pn 은 상대가 없을 때의 면과 베는 쪽)
    const PN = cm.path.plane;
    //  (닿은 뒤에는 면으로 끌지 않는다: 몸에 박힌 가벼운 칼을 손목이 면으로 비틀어 칼끝 빠르기가 한 스텝 50~60 m/s 로 튀었다)
    if ((PN || cp.pg) && wa > 0 && u < C.planeTo && cm.cutting && !cm.result) {
      cp.plane = C.planeLead * D2R;
      if (PN) for (let k = 0; k < 3; k++) cp.pn[k] = PN[k] * cm.sgn;
    }
    cp.w = 1; // (값마다 이미 무게를 곱했다)
    cp.wBody = hold;
  }

  /**
   * 획 패드 (u ≥ 0): 끝 자세까지 곧게 간 길이(pa)의 자리. 손가락(가죽끈 anchor, 팔 베기의 손 목표 자리)이 획 패드보다 앞서 가면
   *  그것을 따른다 (빠르게 가속하는 긋기는 팔 베기와 같은 때에 닿는다). 손가락이 멈추거나 떼도 패드는 vs 로 끝까지 간다. 칼이 박힌
   *  동안, 자동 감기(손가락은 감기 전에 이미 끝 쪽에 있다)에서는 손가락을 따르지 않는다.
   *  update 가 이번 스텝의 가죽끈을 옮긴 뒤 한 번 더 부른다: 앞 스텝의 가죽끈만 보면 패드가 손가락보다 한 스텝 늦어 (12 m/s 긋기에서
   *  0.05~0.1 m) 칼이 팔 베기보다 늦었다
   */
  leadPad() {
    const cm = this.f.commit;
    const Lt = Math.hypot(cm.ex - cm.pbx, cm.ey - cm.pby);
    const fo = this.anchor;
    if (Lt > 1e-6 && !(cm.stuckT > 0) && cm.start !== 'auto') cm.pa = Math.max(cm.pa, ((fo.x - cm.pbx) * (cm.ex - cm.pbx) + (fo.y - cm.pby) * (cm.ey - cm.pby)) / Lt);
    const a = Lt > 1e-6 ? Math.min(1, cm.pa / Lt) : 1;
    cm.padX = cm.pbx + (cm.ex - cm.pbx) * a;
    cm.padY = cm.pby + (cm.ey - cm.pby) * a;
  }

  /** 손가락이 아직 긋는 중인가 (마지막 조각에서 한 프레임 반이 안 지났고 떼지 않았다). 자동 감기는 손가락을 따르지 않는다 */
  fingerMoving() {
    const d = this.det;
    return this.detect && !!this.trace && this.f.commit.start !== 'auto' && !d.lifted && d.quiet * 1000 < 1.5 * d.frame;
  }

  /**
   * 자동 감기를 마치고 베기를 시작한다. 조이스틱 내딛기(skill.lunge, R4 L3 전까지 팔 베기와 같은 것)도 이때 건다: 쟁기에서 그은 순간
   *  건 내딛기는 칼을 들어 올리는 동안 끝나 버려, 베는 칼이 팔 베기보다 짧게 닿았다 (1.66~1.78 m 헛침)
   */
  beginAutoCut() {
    const f = this.f;
    f.commit.cutting = true;
    const d = f.foeDistance();
    if (COMMIT.armLunge && f.state === 'stand' && d > SKILL.lungeMin && d < SKILL.lungeMax && !(f.finish?.amt > 0.5)) this.lunge = SKILL.lungeTime;
  }

  /** 획이 끝났다 (u endU): 회복 시간을 정하고, 끝 더함·지나가기를 버티기(rest)로 넘긴다 */
  endStroke() {
    const f = this.f;
    const cm = f.commit;
    const C = COMMIT;
    cm.ended = true;
    cm.endT = this.clock;
    const r = cm.result;
    const rec = r === 'hit' || r === 'through' ? C.recover.hit : r === 'blocked' || r === 'glance' ? C.recover.blocked : C.recover.miss;
    cm.recT = rec * (1 + 0.6 * (1 - clamp(this.level, 0, 1)));
    const rs = this.rest;
    rs.w = 1;
    rs.free = false;
    rs.hand[0] = cm.he0 * cm.freeK;
    rs.hand[1] = cm.he1 * cm.freeK;
    rs.hand[2] = cm.he2 * cm.freeK;
    rs.over = cm.over * cm.overK * cm.freeK;
    for (let k = 0; k < 3; k++) rs.n[k] = this.cutPose.n[k];
    rs.yawK = cm.yawK;
    rs.pitch = cm.te;
    rs.drop = cm.de;
  }

  /** 도는 중인 획의 덧씌움(무게 w)을 버티기로 넘긴다: restRelease 에 걸쳐 풀린다 (새 획이 앞 획을 끊을 때) */
  passToRest(w) {
    const cp = this.cutPose;
    const rs = this.rest;
    const k = w > 1e-3 ? 1 / w : 0;
    rs.w = w;
    rs.free = true;
    for (let i = 0; i < 3; i++) (rs.hand[i] = cp.hand[i] * k), (rs.n[i] = cp.n[i]);
    rs.over = cp.over * k;
    rs.yawK = cp.yawK;
    rs.pitch = cp.pitch;
    rs.drop = cp.drop;
  }

  /**
   * 결심 베기가 끝난 뒤의 버티기: 칼은 끝 자세 너머(지나가기)에, 손은 끝 더함 자리에 머문다. 손가락이 다시 움직이거나, 자세로
   *  돌아가기가 시작되거나, 찌르기·넘어짐·새 획이면 restRelease 에 걸쳐 푼다. 획 프로그램이 돌고 있으면 그쪽이 버티기 무게를 쓴다
   */
  updateRest(dt) {
    const f = this.f;
    const rs = this.rest;
    const cm = f.commit;
    const prog = cm.on && cm.padOn;
    if (f.inputActive || this.recovering || this.tap || !f.alive || !f.armed || (f.state !== 'stand' && f.state !== 'kneel') || (prog && !cm.ended)) rs.free = true;
    // 버티는 동안 칼이 상대 몸에 박혔다 (combat.js): 끝 너머로 미는 버티기를 푼다 (박힌 칼을 손목이 계속 밀면 칼이 떨며 돈다)
    if (cm.stuckT > 0) {
      rs.free = true;
      if (!cm.on) cm.stuckT -= dt;
    }
    if (rs.free) rs.w = Math.max(0, rs.w - dt / COMMIT.restRelease);
    const cp = this.cutPose;
    const w = rs.w;
    if (prog) {
      // 새 획 프로그램이 도는 중: 풀리던 버티기를 그 위에 더한다 (한 스텝에 사라지지 않게)
      if (!cm.ended) {
        for (let k = 0; k < 3; k++) (cp.hand[k] += rs.hand[k] * w), (cp.n2[k] = rs.n[k]);
        cp.over2 = rs.over * w;
      }
      return;
    }
    cp.w = w > 0 ? 1 : 0;
    cp.wBody = w;
    cp.yawK = rs.yawK;
    cp.pitch = rs.pitch;
    cp.drop = rs.drop;
    cp.wLean = 1;
    cp.hand[0] = rs.hand[0] * w;
    cp.hand[1] = rs.hand[1] * w;
    cp.hand[2] = rs.hand[2] * w;
    cp.cockEl = cp.cockAz = 0;
    cp.over = rs.over * w;
    cp.over2 = 0;
    cp.lift = 0;
    cp.plane = 0;
    for (let k = 0; k < 3; k++) cp.n[k] = rs.n[k];
  }

  /** 돌려주기 시작: 결심 중에 손가락이 어디로 갔든 칼이 그 자리로 한 번 더 휘두르지 않게 손가락 몫을 지금 획 패드 자리로 맞춘다 */
  startHandback() {
    const f = this.f;
    const cm = f.commit;
    const d = this.det;
    cm.hb = true;
    f.handOffset.set(cm.padX, cm.padY);
    this.anchor.set(cm.padX, cm.padY);
    this.prev.set(cm.padX, cm.padY);
    // 판정도 이 자리에서 새로 본다 (손가락이 한 번 멈추기 전에는 새 결심을 보지 않는다)
    d.px = cm.padX;
    d.py = cm.padY;
    d.stage = 0;
    d.blocked = true;
    this.startAt(d.px, d.py, d.t);
  }

  /** 끝 고르기: 확정 뒤 u retargetBefore 전에 손가락이 가운데보다 앞, 기본 끝에서 retargetR 안에 멈췄으면 그 자리를 끝으로 */
  retarget(x, y) {
    const cm = this.f.commit;
    const d = this.det;
    const C = COMMIT;
    if (d.stopped || !cm.on || cm.fading || cm.hb || cm.u >= C.retargetBefore || cm.start === 'auto') return; // (자동 감기: 손가락은 쟁기에서 그은 방향만 정했다)
    d.stopped = true;
    const P = cm.path;
    if ((x - P.mid[0]) * P.dir[0] + (y - P.mid[1]) * P.dir[1] <= 0 || Math.hypot(x - P.end[0], y - P.end[1]) > C.retargetR) return;
    cm.rx0 = cm.ex;
    cm.ry0 = cm.ey;
    cm.rx1 = x;
    cm.ry1 = y;
    cm.retT = 0;
  }

  /** 획 프로그램을 끝낸다 (회복까지 다 했거나, 넘어졌거나, 확정 못 해 다 사라졌다) */
  endCut() {
    const cm = this.f.commit;
    if (!cm.ended) cm.endT = this.clock;
    cm.on = false;
    cm.stage = null;
    cm.w = 0;
    cm.padW = 0;
    cm.handback = 0;
    const cp = this.cutPose;
    cp.w = 0;
    cp.wBody = 0;
    cp.over2 = 0;
    cp.plane = 0;
    cp.pg = 0;
    cp.lift = 0;
    this.det.stage = 0;
  }

  /** 결심 베기의 결과 (combat.js 가 부른다. 헛침은 updateCut): 'hit' | 'through' | 'blocked' | 'glance' | 'miss'. 처음 것만 */
  strikeResult(kind, info) {
    const f = this.f;
    const cm = f.commit;
    if (!cm.on || cm.result || cm.fading) return;
    if (!cm.padOn) {
      this.fadeCut(false); // 확정 전(1단계)에 칼이 닿았다: 팔 베기의 결과다. 감기를 거둔다
      return;
    }
    // 감는 동안(자동 감기로 칼을 들어 올리는 중 포함)의 닿음은 이 획의 결과가 아니다: 쟁기의 칼끝이 가까운 상대를 건드린 채
    //  시작하면 그 자리에서 돌려주어 칼이 상대에 붙은 채 멈췄다. 획은 그대로 간다
    if (cm.u < COMMIT.resultFrom || !cm.cutting) return;
    cm.result = kind;
    if (kind === 'hit') cm.overK = COMMIT.hitOvershoot; // 맞히면 덜 지나간다
    f.onStrikeResult(kind, info);
  }
}
