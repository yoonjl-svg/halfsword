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
//
//  level: 0 = 보정 없음(날것 그대로의 물리 조작), 1 = 숙련된 검사
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SKILL, WEAPON, THRUST, WHOLE, COMMIT, STROKE } from './config.js';
import { FINISH } from './finish.js';
import { guardAt } from './guards.js';

const D2R = Math.PI / 180;
const _yawInv = new THREE.Quaternion();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _tq = new THREE.Quaternion();
const _g = {}; // guardAt 결과 (획을 시작할 때 휘두르는 면을 정하는 데만 쓴다)
const _ga = new THREE.Vector3();
const _gb = new THREE.Vector3();

// 손가락 궤적 조각 표시 (input.js TRACE_REPLAY·TRACE_LIFT 와 같은 값. 검술 층은 입력 모듈을 들이지 않는다)
const T_REPLAY = 1;
const T_LIFT = 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
/** 최소 저크 곡선 (0 → 1) */
const sj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));
/** 덧씌움 봉투: a → b 에 최소 저크로 1 까지, c 까지 버티고, d 에서 0 (d 가 없으면 계속 버틴다) */
const env = (u, a, b, c, d) => (u <= a ? 0 : u < b ? sj((u - a) / (b - a)) : u <= c || d == null ? 1 : 1 - sj((u - c) / (d - c)));
/** 몸 목표 네 점(u0 v0 → k1 v1 → k2 v2 → k3 v3)을 최소 저크로 잇는다 */
const keys = (u, u0, v0, k1, v1, k2, v2, k3, v3) =>
  u <= k1 ? v0 + (v1 - v0) * sj((u - u0) / (k1 - u0)) : u <= k2 ? v1 + (v2 - v1) * sj((u - k1) / (k2 - k1)) : v2 + (v3 - v2) * sj((u - k2) / (k3 - k2));
// 베기 무리 (config.js STROKE.path): 준비 자세 → 끝 자세 방향을 붙여 둔다
const FAMS = Object.entries(STROKE.path).map(([name, p]) => {
  const dx = p.end[0] - p.ch[0];
  const dy = p.end[1] - p.ch[1];
  const n = Math.hypot(dx, dy);
  return { name, ...p, dir: [dx / n, dy / n] };
});
const FAM_BY = Object.fromEntries(FAMS.map((f) => [f.name, f]));

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
    this.autoGuard = false; // 플레이어만 true (main.js)
    this.cutPending = false; // 베기를 했고 아직 자세로 돌아가지 않음
    this.idle = 0; // 손가락(마우스)이 움직이지 않은 시간
    this.recovering = false;
    // 5) 탭 찌르기: 진행 중인 찌르기(tap)와 자세 지도 위에 덧씌우는 자세(thrustPose, guards.js guardAt 이 w 만큼 섞는다)
    this.tap = null;
    this.thrusts = 0;
    this.thrustPush = false; // 지금 칼끝을 뻗는 구간인가 (겨눈 뒤 ~ 뻗고 버티기 끝). combat.js 가 팔 유효 질량을 이때만 싣는다
    const b = THRUST.body;
    this.thrustPose = { w: 0, hand: [0, 0, 0], dir: [1, 0, 0], pelvisYaw: b.pelvisYaw * D2R, chestYaw: b.chestYaw * D2R, pitch: b.pitch * D2R, drop: b.drop };
    // 6) 결심 베기 (온몸 베기 L1). detect: 손가락 궤적으로 결심을 판정하는 파이터(플레이어, main.js). trace: 그 손가락 궤적(input.fingerTrace)
    this.detect = false;
    this.trace = null;
    this.clock = 0; // 이 검술 층의 시계 (초)
    this.wasSwinging = false;
    this.swingEnd = -1e9; // 마지막 휘두르기가 끝난 때 (clock). 올려베기 판정이 쓴다
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
    this.cutPose = { w: 0, wBody: 0, pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0, hand: [0, 0, 0], cockEl: 0, cockAz: 0, over: 0, n: [0, 0, 1], rel: false };
    // 결심 판정 상태 (손가락 원래 궤적을 읽은 자리와 지금 긋고 있는 한 획의 후보)
    this.det = { read: null, t: -1e9, lifted: true, px: 0, py: 0, sx: 0, sy: 0, st: 0, len: 0, peak: 0, lastSp: 0, dwx: 1e9, dwy: 1e9, dwt0: 0, dwell: 0, sinceSwing: 1e9, stage: 0, lx: 0, ly: 0, tA: 0, quiet: 0, blocked: false, stopped: false };
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
    //  팔이 이미 굽어 있으면(황소처럼 손이 머리 옆) 당길 필요가 없다 — 어깨에서 손까지 거리로 가늠한다.
    //  (쓰러진 상대는 겨눔 자세가 이미 칼끝을 몸 위로 띄워 두어 당기지 않는다)
    const ext = Math.hypot(h0[0], h0[1] - 0.1, h0[2] - 0.2); // 어깨(가슴 기준 [0, 0.1, 0.2])에서 손까지
    const ch = tp.down ? 0 : T.chamber * THREE.MathUtils.clamp((ext - 0.36) / 0.12, 0, 1);
    const a = THREE.MathUtils.clamp(t / K.aim, 0, 1);
    const s = THREE.MathUtils.clamp((t - K.aim) / K.extend, 0, 1);
    const e = -ch * a * a * (3 - 2 * a) + (ch + K.reach) * s * s * (3 - 2 * s);
    for (let k = 0; k < 3; k++) pose.hand[k] = h0[k] + _q.getComponent(k) * e;
    // 칼끝: 겨누는 동안은 지금 손(칼자루)에서 목표점 너머 past 의 점을 향해 돌리고, 뻗기 시작하면 그 방향을 붙잡는다.
    //  뻗는 동안 손은 거의 칼 축 방향으로 가는데(측정 0.96), 방향을 계속 고쳐 잡으면 손목이 5~9° 늦게 따라 돌며
    //  칼끝이 옆으로 쓸려 칼 축 방향 성분이 0.7까지 떨어졌다 → 붙잡아 두면 칼끝은 손과 함께 칼 축을 따라 나간다
    //  (쓰러진 상대를 내리찌를 때는 칼이 거의 수직이라 손이 칼 선에서 벗어나는 만큼을 계속 고쳐 잡는 편이 낫다 — 측정)
    if (t < K.aim || !tp.dir || tp.down) {
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

  update(dt) {
    if (dt <= 0) return;
    const f = this.f;
    const L = this.level;
    const off = f.handOffset;
    const R = WEAPON.reach;
    if (off.length() > R) off.setLength(R);
    this.clock += dt;

    // 6) 결심 베기: 손가락 궤적으로 판정하고(플레이어), 진행 중인 획 프로그램을 한 스텝 넘긴다.
    //  (돌려주기가 시작되면 handOffset·anchor·prev 를 획 패드 자리로 맞추므로 아래 손 목표 속도보다 먼저)
    const cm = f.commit;
    if (WHOLE.on && WHOLE.commit && this.detect && this.trace) this.detectCommit(dt);
    if (cm.on) this.updateCut(dt);

    // 손 목표 속도 (손가락 떨림을 거르기 위해 살짝 부드럽게)
    const rx = (off.x - this.prev.x) / dt;
    const ry = (off.y - this.prev.y) / dt;
    this.prev.copy(off);
    const k = 1 - Math.exp(-dt * 25);
    this.vel.x += (rx - this.vel.x) * k;
    this.vel.y += (ry - this.vel.y) * k;
    const sp = this.vel.length();
    const swinging = sp > SKILL.swingSpeed && f.alive && f.armed;
    // 휘두르는 중인 정도 (0~1): 휘두르기 시작하면 빨리 1로, 멈추면 천천히 0으로 (몸을 크게 쓰는 건 벨 때뿐)
    this.activity += ((swinging ? 1 : 0) - this.activity) * Math.min(1, dt / (swinging ? 0.04 : 0.4));

    // 0) 가죽끈: anchor는 손가락(off)이 반경(inputDeadRadius)을 넘어야 그만큼만 끌려간다.
    //  반경 안의 떨림은 anchor를 전혀 움직이지 못한다 — 어디서 떨든(자세 경계라도) 걸러진다.
    //  큰 움직임(진짜 베기)은 반경이 순식간에 다 채워져 손가락과 거의 같이 움직인다(지연 ≈ 반경/속도).
    if (SKILL.handDynamicsOn) {
      const adx = off.x - this.anchor.x;
      const ady = off.y - this.anchor.y;
      const ad = Math.hypot(adx, ady);
      const dead = SKILL.inputDeadRadius;
      if (ad > dead) {
        const k = (ad - dead) / ad;
        this.anchor.x += adx * k;
        this.anchor.y += ady * k;
      }
    } else {
      this.anchor.copy(off);
    }

    // 1) 이어 베기: 휘두르는 동안 움직이는 방향으로 목표를 더 밀어 두었다가 천천히 되돌린다
    if (swinging) this.follow.addScaledVector(this.vel, dt * SKILL.followGain * L);
    this.follow.multiplyScalar(Math.exp(-dt / SKILL.followDecay));
    const fm = SKILL.followMax * L;
    if (this.follow.length() > fm) this.follow.setLength(fm);
    this.aimRaw.copy(this.anchor).add(this.follow);
    if (this.aimRaw.length() > R) this.aimRaw.setLength(R);
    // 손 목표를 "딱 멈추는"(임계 감쇠) 2차 필터로 거른다: 목표가 순간이동해도 손은 가속·감속하며 간다.
    //  (사람의 손도 순간적으로 속도를 바꾸지 못한다. 목표가 튀면 근육이 그 충격을 몸통에 그대로 전해 출렁인다)
    // 휘두르는 순간엔 근육을 긴장시켜(공동 수축) 더 빠르고 단단하게 따라간다
    const wT = swinging ? SKILL.aimFilterStrike : SKILL.aimFilter;
    this.filterW = (this.filterW ?? wT) + (wT - (this.filterW ?? wT)) * Math.min(1, dt * 30);
    const w = this.filterW;
    const ax = w * w * (this.aimRaw.x - this.aim.x) - 2 * w * this.aimVel.x;
    const ay = w * w * (this.aimRaw.y - this.aim.y) - 2 * w * this.aimVel.y;
    this.aimVel.x += ax * dt;
    this.aimVel.y += ay * dt;
    this.aim.x += this.aimVel.x * dt;
    this.aim.y += this.aimVel.y * dt;
    // 6) 결심 중엔 획 패드가 손 목표다 (거르지 않는다: 획 프로그램이 이미 매끄럽다). 이어 베기는 0, 몸은 벨 때처럼.
    //  돌려주기·그만두기 동안엔 손가락 쪽(anchor)과 섞는다. 다 돌려주면 위 거르기가 지금 자리·빠르기에서 이어 간다
    if (cm.on && cm.padW > 0) {
      const pw = cm.padW;
      const x = this.anchor.x + (cm.padX - this.anchor.x) * pw;
      const y = this.anchor.y + (cm.padY - this.anchor.y) * pw;
      this.follow.set(0, 0);
      this.aimRaw.set(x, y);
      this.aimVel.set((x - this.aim.x) / dt, (y - this.aim.y) / dt);
      this.aim.set(x, y);
    }
    if (cm.on) this.activity = Math.max(this.activity, cm.w);

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
    if (canRecover && this.cutPending && !swinging && !f.handHeld && this.idle > SKILL.recoverDelay && !(cm.on && !cm.ended)) {
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
      //  결심 베기 중(1단계부터)에도 걸지 않는다: 확정 전엔 걸음이 없고, 확정되면 L3 걸음이 대신한다
      if (f.move.y > -0.2 && !this.holdFeet && !cm.on && f.foeDistance() > SKILL.lungeMin) f.move.y = Math.max(f.move.y, SKILL.lungeMove * L);
    }

    // 5) 탭 찌르기
    if (this.tap) {
      this.updateThrust(dt);
      this.activity = Math.max(this.activity, this.thrustPose.w); // 찌르는 동안엔 몸도 벨 때처럼 빠르게 따라온다
    }
    if (this.wasSwinging && !swinging) this.swingEnd = this.clock;
    this.wasSwinging = swinging;
  }

  // ─────────────────────────────────────────────────────────────
  //  6) 결심 베기 (온몸 베기 L1, docs/whole_body_strike.md L1)
  // ─────────────────────────────────────────────────────────────

  /** 결심 베기를 할 수 있는 몸인가. 누가 부르든 같은 제한: 검술, 서 있음·무릎 꿇음, 칼을 쥠, 찌르기 중 아님, 쓰러진 상대 마무리 중 아님 */
  canCommit() {
    const f = this.f;
    return this.level >= COMMIT.minLevel && f.alive && f.armed && (f.state === 'stand' || f.state === 'kneel') && !this.tap && !(f.finish?.amt > 0.5);
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
      //  끊긴 뒤 첫 조각은 한 프레임 동안 움직인 것으로 본다 (끊긴 시간 전체로 나누면 빠르기가 작게 잡힌다)
      const gap = t - d.t;
      const still = d.lifted || gap > C.stillGap;
      if (still) this.slowPoint(d.px, d.py, Math.max(d.t, t - C.frameGuess), d.t);
      d.lifted = false;
      const L = Math.hypot(dx, dy);
      const sp = (L / Math.max(1, still ? Math.min(gap, C.frameGuess) : gap)) * 1000;
      const nx = d.px + dx;
      const ny = d.py + dy;
      if (sp < C.slowV || L < 1e-9) this.slowPoint(nx, ny, t, d.t);
      else this.movePiece(nx, ny, dx / L, dy / L, L, sp, t);
      d.px = nx;
      d.py = ny;
      d.t = t;
    }
    // 조각이 한동안 안 오면 손가락이 멈춘 것이다
    d.quiet = n > 0 ? 0 : d.quiet + dt;
    if (d.quiet * 1000 > C.stillGap) {
      if (d.stage === 'A') this.fadeCut(false);
      else if (d.stage === 'B') this.retarget(d.px, d.py);
    }
    if (d.stage === 'A' && this.clock - d.tA > C.aTimeout) this.fadeCut(true); // 1단계 뒤 0.25초 안에 확정 못 함
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
    d.sinceSwing = this.wasSwinging ? 0 : this.clock - Math.max(this.f.commit.endT, this.swingEnd);
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

  /** 1단계 "감기 시작": 획 프로그램을 잠정 c 로 시작한다 (걸음·몸 싣기·쏠림·확정 신호는 아직 없다) */
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

  /** 2단계 "확정": c 를 정하고 획 시간·크기를 그 c 로 (u 는 그대로 이어진다). 확정 신호는 onCommit 고리가 낸다 (main.js) */
  confirmCut(vbar) {
    const f = this.f;
    const cm = f.commit;
    if (!cm.on || cm.fading || cm.hb) return;
    cm.c = this.commitPower(vbar, cm.start);
    cm.stage = 'B';
    this.det.stage = 'B';
    this.sizeCut();
    this.startPad();
    this.lunge = 0; // 조이스틱 내딛기는 걸지 않는다 (걸음은 L3 가 대신한다)
    f.onCommit('B', cm.c, cm.fam);
  }

  /** 확정 못 함·그만두기: 덧씌움을 fadeTime 에 걸쳐 0 으로, 칼은 손가락 자리로 (보통 팔 움직임). 대가 없음 */
  fadeCut(timeout) {
    const cm = this.f.commit;
    const d = this.det;
    if (cm.on && !cm.hb) cm.fading = true;
    d.stage = 0;
    if (timeout) d.blocked = true; // 끝까지 느리게 끄는 긋기가 1단계를 거듭 걸지 않게 (다음 멈춤까지)
  }

  /**
   * 결심 베기 시작 (획 프로그램). 플레이어는 결심 판정이 1단계에서 부른다. AI 는 L8 에서 부른다.
   * @param o.fam 무리, o.start 'chambered' | 'auto' | 'here', o.c 결심 세기, o.stage 'A' | 'B'
   * @returns 시작했으면 true (누가 부르든 canCommit 의 제한이 같다)
   */
  commit(o) {
    const f = this.f;
    const P = FAM_BY[o.fam];
    if (!(WHOLE.on && WHOLE.commit) || !P || !this.canCommit()) return false;
    const C = COMMIT;
    const cm = f.commit;
    cm.on = true;
    cm.stage = o.stage ?? 'B';
    cm.fam = o.fam;
    cm.start = o.start ?? 'here';
    cm.c = o.c ?? 1;
    cm.t = 0;
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
    cm.tAuto = cm.start === 'auto' ? C.autoTime[0] + C.autoTime[1] * (1 - clamp(this.level, 0, 1)) : 0;
    cm.mx = P.mid[0];
    cm.my = P.mid[1];
    cm.ex = P.end[0];
    cm.ey = P.end[1];
    cm.padOn = false;
    cm.armW = 0; // 팔·손목 덧씌움(손 더함·칼 젖히기)의 정도: 확정한 뒤 armRamp 초에 걸쳐 1 로 (1단계는 몸만 감는다)
    cm.bodyW = C.stageABody; // 몸 덧씌움의 정도: 1단계는 조금만 감고(확정 못 한 1단계가 몸을 크게 흔들지 않게), 확정한 뒤 armRamp 초에 1 로
    cm.padX = this.aim.x;
    cm.padY = this.aim.y;
    cm.padW = 0;
    this.sizeCut();
    cm.u0 = -cm.tAuto / cm.Tc; // 자동 감기 동안은 u < 0
    cm.u = cm.u0;
    if (cm.stage === 'B') this.startPad();
    const bp = f.bodyPose;
    cm.v0p = bp.pelvisYaw;
    cm.v0c = bp.chestYaw;
    cm.v0t = bp.pitch;
    cm.v0d = bp.drop;
    this.updateCut(0);
    return true;
  }

  /**
   * 획 패드를 몰기 시작한다 (확정 순간. 곧바로 확정으로 시작하면 그때). 패드 경로: 지금 손 목표(aim)에서 출발 →
   * (자동 감기면 준비 자세 쪽으로 autoFrac 만큼 먼저) → 가운데 → 끝 자세. 지금 자리에서 시작하면 경로가 짧아져도 획 시간은
   * 줄이지 않는다 (크기는 몸이 채운다).
   *  1단계(감기 시작) 동안은 손 목표가 손가락을 그대로 따르고 몸만 감는다: 확정 못 한 1단계(자세 바꾸기·막기)가 칼을
   *  붙잡거나 들어 올리지 않게 (1단계는 값이 싸야 한다). 그래서 패드는 확정한 자리에서 출발한다
   */
  startPad() {
    const cm = this.f.commit;
    const C = COMMIT;
    const P = cm.path;
    cm.padOn = true;
    // 자동 감기: 칼은 확정한 뒤에 들어 올린다 → 획 시계를 자동 감기 처음으로 (1단계 동안 몸이 감긴 만큼은 작아 이어진다)
    if (cm.start === 'auto') cm.u = cm.u0;
    cm.p0x = this.aim.x;
    cm.p0y = this.aim.y;
    const auto = cm.start === 'auto';
    cm.pbx = auto ? cm.p0x + (P.ch[0] - cm.p0x) * C.autoFrac : cm.p0x;
    cm.pby = auto ? cm.p0y + (P.ch[1] - cm.p0y) * C.autoFrac : cm.p0y;
    // 늦게 확정하면(u > padStart) 패드는 확정 순간부터 출발한다 (경로 앞쪽을 건너뛰지 않게)
    cm.padU0 = Math.max(C.padStart, cm.u);
    cm.padX = cm.p0x;
    cm.padY = cm.p0y;
    // 1단계 동안 손가락을 따라 이미 움직이던 손 목표의 빠르기를 이어받아 출발한다 (확정 순간 멈췄다 다시 가속하지 않게).
    //  경로 첫 방향으로의 빠르기를 정규화한 처음 기울기 sv (0 = 멈춘 채 출발하는 최소 저크, COMMIT.padInherit 까지). 자동 감기는 들어 올린 뒤라 0
    cm.sv = 0;
    if (!auto) {
      const L1 = Math.hypot(cm.mx - cm.pbx, cm.my - cm.pby);
      const Lt = L1 + Math.hypot(cm.ex - cm.mx, cm.ey - cm.my);
      if (L1 > 1e-6 && Lt > 1e-6) {
        const vp = (this.aimVel.x * (cm.mx - cm.pbx) + this.aimVel.y * (cm.my - cm.pby)) / L1;
        cm.sv = clamp((vp * (C.padEnd - cm.padU0) * cm.Tc) / Lt, 0, C.padInherit);
      }
    }
    // 휘두르는 면 (몸 기준): 출발 자리와 끝 자세의 칼끝 방향 둘 다에 수직. 지나가기가 이 축으로 칼끝을 끝 너머로 더 돌린다
    guardAt(cm.pbx, cm.pby, _g);
    _ga.set(_g.dir[0], _g.dir[1], _g.dir[2]);
    guardAt(cm.ex, cm.ey, _g);
    _gb.set(_g.dir[0], _g.dir[1], _g.dir[2]);
    _ga.cross(_gb);
    if (_ga.lengthSq() < 1e-6) _ga.set(0, 0, -cm.sgn);
    _ga.normalize();
    const n = this.cutPose.n;
    n[0] = _ga.x;
    n[1] = _ga.y;
    n[2] = _ga.z;
  }

  /** 결심 세기 c 로 획 시간과 크기를 정한다 (1단계 잠정 c, 확정 때 다시). 설계서 L1 (b) 목표값·획 시간·약해지는 방식 */
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
    // 비틀기는 코드 부호로 (updateBodyPose 처럼 guards.js 규약의 부호를 바꾼다). 왼쪽 무리는 한 번 더 바꾼다
    const pk = -D2R * C.pelvisL1 * body * trunk * (f.state === 'kneel' ? 0.3 : 1) * cm.sgn;
    const hr = C.hipRoom; // 뒷발 벌림과 합쳐 엉덩이 비틀림 한도를 넘지 않게 (딛은 발이 비틀리지 않게)
    cm.pw = clamp(B.pelvis[0] * pk, -hr, hr);
    cm.ph = clamp(B.pelvis[1] * pk, -hr, hr);
    cm.pe = clamp(B.pelvis[2] * pk, -hr, hr);
    const ck = -D2R * body * trunk * cm.sgn;
    cm.cw = B.chest[0] * ck;
    cm.ch = B.chest[1] * ck;
    cm.ce = B.chest[2] * ck;
    cm.tw = B.pitch[0] * D2R * body;
    cm.th = B.pitch[1] * D2R * body;
    cm.te = B.pitch[2] * D2R * body;
    cm.dw = B.drop[0] * body;
    cm.dh = B.drop[1] * body;
    cm.de = B.drop[2] * body;
    // 손 더함 (가슴 기준 [앞, 위, 칼 든 쪽]). 왼쪽 무리는 옆 값의 부호를 바꾼다
    cm.hw0 = B.wind[0] * amp;
    cm.hw1 = B.wind[1] * amp;
    cm.hw2 = B.wind[2] * amp * cm.sgn;
    cm.hr = (B.reach + (one ? 0.05 : 0)) * amp;
    cm.he0 = B.end[0] * amp;
    cm.he1 = B.end[1] * amp;
    cm.he2 = B.end[2] * amp * cm.sgn;
    cm.cockEl = B.cock[0] * D2R * lv;
    cm.cockAz = B.cock[1] * D2R * lv * cm.sgn;
    cm.over = B.over * D2R * clamp(Math.sqrt(Ir), 0.7, 1.6); // 무거운 칼은 더 지나간다
  }

  /**
   * 획 프로그램 한 스텝 (설계서 L1 (b)). u = t / Tc. 몸 목표는 감기 → 닿기 → 끝 값을 최소 저크로 잇는다:
   *  골반 감기 u 0.10 → 닿기 0.75 → 끝 1.45, 가슴 0.25 → 0.92 → 1.55 (감긴 채 버티다 뒤따른다), 숙이기·낮추기 0.20 → 1.00 → 1.50.
   *  패드는 u padStart → padEnd 동안 한 번의 최소 저크로 경로(준비 → 가운데 → 끝)를 간다. 손 감기 더함 0 → 0.20 (0.35 까지 버티고
   *  0.70 까지 뺀다), 손 뻗기 0.55 → 1.00 (1.35 까지 뺀다), 칼 젖히기 0 → 0.20 (0.50 까지, 0.75 까지 푼다), 끝 더함·지나가기 1.00 → 1.40.
   *  → 최고 회전 빠르기가 골반 → 가슴 → 손 → 칼 순서로 나온다
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
    cm.t += dt;
    let du = dt / cm.Tc;
    if (cm.stuckT > 0) {
      du *= C.stuckSlow; // 칼이 박힌 동안 획 시간을 늦춘다 (combat.js)
      cm.stuckT -= dt;
    }
    cm.u += du;
    const u = cm.u;
    // 결과 없이 패드 경로 끝을 지났다 → 헛침
    if (!cm.result && !cm.fading && cm.stage === 'B' && u >= C.padEnd) this.strikeResult('miss', null);
    // 결과가 나오거나 닿기를 지나면 칼을 손가락에 돌려준다 (칼의 관성은 물리가 지킨다)
    if (!cm.hb && !cm.fading && cm.padOn && (cm.result || u >= C.handbackU)) this.startHandback();
    if (cm.hb) cm.handback = Math.min(1, cm.handback + dt / C.handback);
    // 덧씌움 w: 확정 못 함·그만두기는 fadeTime 에, 획이 끝나면(u endU) 회복 시간 동안 0 으로
    if (cm.fading) cm.w -= dt / C.fadeTime;
    else if (u >= C.endU) {
      if (!cm.ended) {
        cm.ended = true;
        cm.endT = this.clock;
        const r = cm.result;
        const rec = r === 'hit' || r === 'through' ? C.recover.hit : r === 'blocked' || r === 'glance' ? C.recover.blocked : C.recover.miss;
        cm.recT = rec * (1 + 0.6 * (1 - clamp(this.level, 0, 1)));
      }
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
    // 획 패드 (확정한 뒤): 자동 감기(u < 0) 동안은 준비 자세 쪽으로, 그 뒤 경로를 길이 기준으로
    if (!cm.padOn) {
      // 1단계: 손 목표는 손가락을 따른다
    } else if (u < 0) {
      const a = sj((u - cm.u0) / -cm.u0);
      cm.padX = cm.p0x + (cm.pbx - cm.p0x) * a;
      cm.padY = cm.p0y + (cm.pby - cm.p0y) * a;
    } else {
      const L1 = Math.hypot(cm.mx - cm.pbx, cm.my - cm.pby);
      const L2 = Math.hypot(cm.ex - cm.mx, cm.ey - cm.my);
      // 처음 기울기 sv 를 가진 최소 저크 (sv = 0 이면 보통 최소 저크): 끝에서 빠르기·가속 0
      const tau = clamp((u - cm.padU0) / (C.padEnd - cm.padU0), 0, 1);
      const v = cm.sv;
      const t3 = tau * tau * tau;
      const s = (v * tau + (10 - 6 * v) * t3 + (8 * v - 15) * t3 * tau + (6 - 3 * v) * t3 * tau * tau) * (L1 + L2);
      if (s <= L1) {
        const a = L1 > 1e-6 ? s / L1 : 1;
        cm.padX = cm.pbx + (cm.mx - cm.pbx) * a;
        cm.padY = cm.pby + (cm.my - cm.pby) * a;
      } else {
        const a = L2 > 1e-6 ? (s - L1) / L2 : 1;
        cm.padX = cm.mx + (cm.ex - cm.mx) * a;
        cm.padY = cm.my + (cm.ey - cm.my) * a;
      }
    }
    cm.padW = !cm.padOn ? 0 : cm.fading ? cm.w : 1 - cm.handback;
    if (cm.padOn) {
      cm.armW = Math.min(1, cm.armW + dt / C.armRamp);
      cm.bodyW = Math.min(1, cm.bodyW + dt / C.armRamp);
    }
    const aw = cm.armW;
    // 몸 목표 (코드 단위). 네 점의 u 는 COMMIT.keyU (감기 → 닿기 → 끝)
    const K = C.keyU;
    cp.pelvisYaw = keys(u, cm.u0, cm.v0p, K.pelvis[0], cm.pw, K.pelvis[1], cm.ph, K.pelvis[2], cm.pe);
    cp.chestYaw = keys(u, cm.u0, cm.v0c, K.chest[0], cm.cw, K.chest[1], cm.ch, K.chest[2], cm.ce);
    cp.pitch = keys(u, cm.u0, cm.v0t, K.lean[0], cm.tw, K.lean[1], cm.th, K.lean[2], cm.te);
    cp.drop = keys(u, cm.u0, cm.v0d, K.lean[0], cm.dw, K.lean[1], cm.dh, K.lean[2], cm.de);
    // 손 더함: 감기 → 뻗기 → 끝 (봉투 u 는 COMMIT.envU)
    const E = C.envU;
    const eW = env(u, E.wind[0], E.wind[1], E.wind[2], E.wind[3]);
    const eR = env(u, E.reach[0], E.reach[1], E.reach[2], E.reach[3]);
    const eE = env(u, E.end[0], E.end[1]);
    cp.hand[0] = (cm.hw0 * eW + cm.hr * eR + cm.he0 * eE) * aw;
    cp.hand[1] = (cm.hw1 * eW + cm.he1 * eE) * aw;
    cp.hand[2] = (cm.hw2 * eW + cm.he2 * eE) * aw;
    // 칼 젖히기 (손목 감기)와 지나가기
    const eC = env(u, E.cock[0], E.cock[1], E.cock[2], E.cock[3]) * aw;
    cp.cockEl = cm.cockEl * eC;
    cp.cockAz = cm.cockAz * eC;
    cp.over = cm.over * cm.overK * eE * aw;
    cp.rel = u >= C.releaseFrom && u <= C.releaseTo;
    cp.w = cm.w;
    cp.wBody = cm.w * cm.bodyW;
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
    this.follow.set(0, 0);
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
    if (d.stopped || !cm.on || cm.fading || cm.hb || cm.u >= C.retargetBefore) return;
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
    this.cutPose.w = 0;
    this.cutPose.wBody = 0;
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
    if (cm.u < COMMIT.resultFrom) return;
    cm.result = kind;
    if (kind === 'hit') cm.overK = COMMIT.hitOvershoot; // 맞히면 덜 지나간다
    f.onStrikeResult(kind, info);
  }
}
