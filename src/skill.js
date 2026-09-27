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
//
//  level: 0 = 보정 없음(날것 그대로의 물리 조작), 1 = 숙련된 검사
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SKILL, WEAPON, THRUST } from './config.js';
import { FINISH } from './finish.js';

const D2R = Math.PI / 180;
const _yawInv = new THREE.Quaternion();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();

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
    if (canRecover && this.cutPending && !swinging && !f.handHeld && this.idle > SKILL.recoverDelay) {
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
      // 물러나려는 중이면 내딛지 않는다 (조작이 우선)
      if (f.move.y > -0.2 && f.foeDistance() > SKILL.lungeMin) f.move.y = Math.max(f.move.y, SKILL.lungeMove * L);
    }

    // 5) 탭 찌르기
    if (this.tap) {
      this.updateThrust(dt);
      this.activity = Math.max(this.activity, this.thrustPose.w); // 찌르는 동안엔 몸도 벨 때처럼 빠르게 따라온다
    }
  }
}
