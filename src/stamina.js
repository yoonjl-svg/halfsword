import { classifyStroke } from './attack_stroke.js';
import { STAMINA, UNIQUE_ASSIST, CLOSE, WEAPON_ABILITY, SECRET, realS } from './config.js';
import { entersAttackLine, isPreparation } from './stamina_stroke.js';
import { kitOff } from './skill_kit.js'; // 플레이어 스킬트리 몫 (10/21 — 유파 걷기 기력: 일본 보법 J1 · 동방 보법 II C2)
// 표준 시간 (10/25 22:3x): 공격 번호가 살아 있는 시간 · 긋기 꼬리는 실제 초로 적는다 (STAMINA 의 초 · 초당 값은 config 에서 realS · realRate)
const ATTACK_LIFE = realS(1.5); // 공격을 낸 뒤 그 공격 번호가 살아 있는 시간 (막아 받기 청구 · 옛 흘림 판정)
const ATTACK_TAIL = realS(0.35); // 긋는 동안 · 긋기가 끝난 뒤 공격으로 셈하는 꼬리

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 자연 회복 빠르기 (게임 초당): AI 15 · 사람 입력이 모는 몸(fighter.humanInput — main.js 플레이어) 25(사장님 10/29 17:5x) · 그 밖(시뮬 대본 몸) 21 — 쉼 뒤 회복 · 자연 회복 탈진 모두 */
export function recoverRate(f) {
  return f.aiControlled ? STAMINA.recoverPerSecond : f.humanInput ? STAMINA.humanRecoverPerSecond : STAMINA.playerRecoverPerSecond;
}

/** 공통 기력 장부. 유파의 동작/해금과 독립적이며 모든 시간은 물리 시간이다. */
export class Stamina {
  constructor(fighter) {
    this.fighter = fighter;
    this.controller = null;
    this.aweLoss = 0; // 판 시작 최대 기력 깎임 (티소나 '위세' — applyAweStart · 그 판 내내)
    this.maxBonus = 0; // 최대 기력 덧 (대기실 장비 — 케틀 햇 '생존술: 기력 +30', main.js setMaxBonus · 플레이어만). 문턱 0 · −35 · −70 과 그 밖 규칙은 그대로
    this.infinite = false; // 기력 무한 (대기실 장비 — 용사의 눈물 '기력 무한', main.js setInfinite · 플레이어만). 거짓이면 아래 모든 길이 전과 한 글자도 다르지 않다
    this.value = STAMINA.max;
    this.level = 0;
    this.exhaustLeft = 0;
    this.rest = 0;
    this.time = 0;
    this.originalMass = null;
    this.attackId = 0;
    this.attackUntil = -1;
    this.blockedAttack = new WeakMap();
    this.stroke = null;
    this.strokeTail = null;
    this.quiet = Infinity;
    this.strokeStart = null;
    this.distance = 0;
    this.position = null;
    this.lastShots = 0;
    this.pose = 0;
    this.spent = { move: 0, attack: 0, block: 0, secret: 0, push: 0, clinch: 0 };
    this.counts = { cut: 0, thrust: 0, block: 0, secret: 0, push: 0, exhaustion: 0 };
    this.recovered = 0;
    this.action = 'rest';
    this.clinching = false;
    this.clinchSeconds = 0;
    this.clinchStep = null;
  }

  /** 최대 기력: 100(STAMINA.max) + 장비 덧. 기력을 끄면(STAMINA.on false) 덧 없이 100 — 지금 판 그대로 */
  get max() { return STAMINA.on ? STAMINA.max + this.maxBonus - this.aweLoss : STAMINA.max; } // − 위세 깎임(10/24)
  /** 판을 세울 때(main.js newRound — 첫 스텝 전) 장비 덧을 정하고 그 최대에서 시작한다 */
  setMaxBonus(bonus) {
    this.maxBonus = Math.max(0, +bonus || 0);
    if (STAMINA.on) this.value = this.max;
  }
  /**
   * 기력 무한 (용사의 눈물 — main.js newRound 가 판을 세울 때 · 첫 스텝 전 · 플레이어만, docs/import/hero_tear_2026-10-17.md):
   *  늘 가득(최대 — 케틀 햇 덧까지) · 청구(spend — 걷기 · 공격 · 막아 받기 · 박차기 · 비기 · 권총 · 클린치)가 깎지 않는다 →
   *  지침(× 0.7 · × 0.5 · 힘 배율) · 탈진 · 숨 고르기 자세 · 숨소리 · 회복 쉼이 생기지 않는다. 상대가 읽는 내 기력(ai.js 지친 상대 노림)도 늘 생생.
   *  공격 번호(attackId — 상대의 막아 받기 청구)와 횟수 셈(counts)은 전처럼 남는다 — 상대 장부는 그대로. 기력 끔(STAMINA.on 거짓)이면 원래 100 그대로
   */
  setInfinite(on = true) {
    this.infinite = !!on;
    if (this.infinite) this.refill();
  }
  /** 무한 기력의 '늘 가득': 값 = 최대 · 생생 · 탈진 없음 (setInfinite · 스텝마다 — 시험 도구가 값을 바꿔 놓아도 다음 스텝에 되돌린다) */
  refill() {
    this.value = this.max; this.level = 0; this.exhaustLeft = 0; this.pose = 0;
  }
  captureMass(mass) { if (this.originalMass == null && mass > 0) this.originalMass = mass; }
  get weight() {
    this.captureMass(this.fighter.swordMass);
    return clamp(Math.sqrt((this.originalMass ?? STAMINA.weaponReferenceMass) / STAMINA.weaponReferenceMass), 0.75, 1.5);
  }
  get ratio() { return clamp(this.value / (this.max + (STAMINA.on ? this.aweLoss : 0)), 0, 1); } // 머리 위 막대 = 최대(덧 포함)의 몫 — 위세로 깎인 몫은 빈 칸으로 보인다(10/24 — 가득 차도 85 % 쯤)
  get exhausted() { return STAMINA.on && this.exhaustLeft > 0; }
  get speed() { return !STAMINA.on ? 1 : this.exhausted ? 0 : this.level === 2 ? STAMINA.moveSevere : this.level === 1 ? STAMINA.moveTired : 1; }
  get attackSpeed() {
    if (!STAMINA.on) return 1;
    if (this.exhausted) return 0;
    if (!this.level) return 1;
    const severe = this.level === 2;
    if (!STAMINA.attackTempo) return severe ? STAMINA.attackSevere : STAMINA.attackTired;
    const f = this.fighter;
    if (STAMINA.tempoProfiles) {
      if (f.skill?.pom) return severe ? STAMINA.tempoPommelSevere : STAMINA.tempoPommelTired;
      this.captureMass(f.swordMass);
      if (f.skill?.tap && !f.weaponCfg?.thrustStyle && this.originalMass < STAMINA.tempoHeavyMass)
        return severe ? STAMINA.tempoThrustSevere : STAMINA.tempoThrustTired;
    }
    return severe ? STAMINA.tempoRateSevere : STAMINA.tempoRateTired;
  }
  get retimeBody() {
    return STAMINA.on && STAMINA.attackTempo && STAMINA.tempoBody && this.level > 0 && !this.exhausted && !this.guarding
      && !(STAMINA.tempoProfiles && this.fighter.skill?.tap);
  }
  // 막기 자세/신뢰도 보정은 보류한 범위다. 기존 방어 근육의 한도는 유지한다.
  get motorSpeed() { return this.guarding && STAMINA.on && !this.exhausted ? this.level === 2 ? .5 : this.level === 1 ? .7 : 1 : this.attackSpeed; }
  get power() { const tune=STAMINA.attackTempo&&!this.guarding;return !STAMINA.on || this.exhausted ? 1 : this.level === 2 ? (tune ? STAMINA.tempoPowerSevere : STAMINA.severePower) : this.level === 1 ? (tune ? STAMINA.tempoPowerTired : STAMINA.tiredPower) : 1; }
  /** 탈진 회복 진행 0 → 1 (기력 막대 · stamina_hud.js): 자연 회복 탈진은 값이 바닥 → 풀리는 자리(severeAt)로 차는 몫 · 옛 고정 탈진(`?exhaust=fixed`)은 지난 시간 몫 */
  get progress() {
    if (!this.exhausted) return 0;
    return this.exhaustNaturalTarget != null
      ? clamp((this.value - STAMINA.floor) / (this.exhaustNaturalTarget - STAMINA.floor), 0, 1)
      : 1 - this.exhaustLeft / STAMINA.exhaustSeconds;
  }
  get guarding() {
    const c = this.controller;
    return !!this.fighter.armed && (this.fighter.aiControlled
      ? c?.mode === 'defend' && !c.defVoid
      : !!c?.held && !c.broken);
  }
  /** 비기를 낼 기력이 있나 (사장님 10/30 08:2x '기력이 모자라면 못써(다른 비기도 그렇게 해)' · 18:3x '0 이하일 때야' — SECRET.secretStamina · secretStaminaMin): 지금 기력 > secretStaminaMin(0) ·
   *  기력 끔 · 기력 무한 · 스위치 끔이면 늘 참. 사람 창(secret.js) · AI(ai.js secretGo · spinGo · mordGo) · skill.secret 이 본다 */
  get secretReady() { return !SECRET.secretStamina || !STAMINA.on || this.infinite || this.value > (SECRET.secretStaminaMin ?? 0); }
  get inSecret() { return !!(this.fighter.skill?.sec || this.controller?.secretRun); }
  get attacking() {
    const f = this.fighter;
    return f.aiControlled ? this.controller?.mode === 'attack' && this.controller.phase === 'strike'
      : !!(f.skill?.tap || f.skill?.pom || this.stroke?.paid || (this.strokeTail?.paid && this.time <= this.strokeTail.until) || f.iai?.attack); // iai.attack: 탭으로 낸 특수 공격 운동학 칼(10/28 — 칼끝 돌려 빼기 · 날개 접기 · 겹치기)이 끄는 동안
  }

  /** 기존 누르기 단계 + 실제 팔/칼 접촉. 거리만 가깝거나 공격 중인 것은 클린치가 아니다. */
  canClinch(other) {
    if (!STAMINA.on || !CLOSE.on || !(STAMINA.clinchPerSecond > 0) || !other || other === this) return false;
    const a = this.fighter, b = other.fighter;
    if (a.foe !== b || b.foe !== a) return false;
    for (const s of [this, other]) {
      const f = s.fighter, sk = f.skill;
      if (!f.alive || f.revival || f.state !== 'stand' || f.feetHeld || s.exhausted || s.value <= STAMINA.floor || s.inSecret || sk?.swinging || sk?.tap || sk?.pom || (f.gun?.shots ?? 0) > s.lastShots) return false;
    }
    const pressing = (f) => f.canShove && f.barge?.phase === 'press' && f.stickY > 0 && f.foeDistance() <= CLOSE.reach(f.armed ? f.weapon : null) && f.closeTouch();
    return !!(pressing(a) || pressing(b));
  }

  /** 두 Fighter.step 중 먼저 오는 쪽이 양쪽 비용을 확정하고, 뒤쪽은 같은 결과를 소비한다.
   *  양쪽이 밀어도 한 번만 청구하며, 먼저 탈진한 쪽 때문에 뒤쪽 비용이 빠지지 않는다. */
  stepClinch(dt) {
    const other = this.fighter.foe?.stamina;
    let pair = this.clinchStep;
    if (!other) { this.clinching = false; this.clinchStep = null; return false; }
    if (pair?.pending === this && (pair.a === other || pair.b === other)) {
      pair.pending = null;
    } else {
      const active = this.canClinch(other);
      pair = { a: this, b: other, pending: other, active };
      this.clinchStep = other.clinchStep = pair;
      this.clinching = other.clinching = active;
      if (active) {
        // 마지막 스텝도 실제 차감량이 같다. 부동소수점 잔차는 경계에서만 정리한다.
        const amount = Math.min(STAMINA.clinchPerSecond * dt, this.value - STAMINA.floor, other.value - STAMINA.floor);
        for (const s of [this, other]) {
          s.spend('clinch', amount);
          s.clinchSeconds += amount / STAMINA.clinchPerSecond;
          if (s.value < STAMINA.floor + 1e-9) { s.value = STAMINA.floor; s.stages(); }
        }
        if (this.exhausted || other.exhausted) {
          for (const s of [this, other]) {
            s.clinching = false;
            if (s.fighter.barge) { s.fighter.barge = null; s.fighter.bargeEnd = 'exhausted'; }
          }
        }
      }
    }
    if (!pair.active) return false;
    this.rest = 0;
    this.action = this.exhausted ? 'exhausted' : 'clinch';
    this.stroke = null;
    this.quiet = Infinity;
    return true;
  }

  stages() {
    if (this.exhausted) return;
    if (this.value <= STAMINA.floor) {
      this.value = STAMINA.floor;
      // 탈진 (사장님 10/18 22:1x '탈진 규칙은 샛별 것이 맞음' — 원문 '새벽'은 오타, 23:3x 정정 · 샛별 연구 규칙): 이동 · 공격 불가 · 막기를 누르고 있어도 자연 회복 빠르기(recoverRate — 사람 25(10/29 17:5x) · 시뮬 대본 몸 21 · AI 15 /s)로 차서
      //  severeAt(−35)에서 풀린다(심한 지침 단계로) — 바닥 −70 에서 사람 1.4 s(전 1.667) · AI 2.333 s. 옛 규칙(`?exhaust=fixed`): exhaustSeconds 2.5 s 숨 고르기 뒤 0(지침)
      this.exhaustNaturalTarget = STAMINA.exhaustNatural ? STAMINA.severeAt : null;
      this.exhaustLeft = this.exhaustNaturalTarget != null
        ? (this.exhaustNaturalTarget - this.value) / recoverRate(this.fighter)
        : STAMINA.exhaustSeconds;
      this.level = 3;
      this.counts.exhaustion++;
      this.stroke = null;
      this.action = 'exhausted';
    } else if (this.value < STAMINA.severeAt) this.level = 2; // 심한 지침 −35 아래(사장님 10/17 — 그 전 −40 · 처음 −30)
    else if (this.level === 2 && this.value >= STAMINA.severeAt + STAMINA.stageBack - 1e-9) this.level = 1;
    else if (this.level === 0 && this.value < 0) this.level = 1;
    if (this.level === 1 && this.value >= STAMINA.stageBack - 1e-9) this.level = 0;
  }

  spend(kind, amount) {
    if (!STAMINA.on || this.infinite || this.exhausted || !this.fighter.alive || this.fighter.revival || !(amount > 0)) return false; // 기력 무한: 모든 청구가 여기서 멈춘다 (값 · 쉼 시계 · 단계 그대로)
    this.value = Math.max(STAMINA.floor, this.value - amount);
    this.spent[kind] += amount;
    if (kind !== 'move') this.rest = 0;
    this.action = kind;
    this.stages();
    return true;
  }

  attack(kind = 'cut', bundled = this.inSecret, credit = 0) {
    // 탭 같은 명시 입력은 직전 준비를 끝내고 새 동작 한 번만 청구한다.
    this.finishStroke();
    this.chargeAttack(kind, bundled, credit);
  }

  chargeAttack(kind = 'cut', bundled = this.inSecret, credit = 0) {
    if (this.fighter.alive && !this.exhausted) this.fighter.schoolPassive?.strokeStart(bundled || this.inSecret); // 유파 패시브: 칼을 낸 순간 (10/21 켄타이 · 인데스 — school_passive.js, 기력을 꺼도 같은 때)
    if (!STAMINA.on || this.exhausted || !this.fighter.alive) return;
    this.attackId++;
    this.flowAttackKind = kind; this.flowAttackStart = this.time; // 흘림 판정이 읽는 공격 종류(찌르기는 흘리지 않음 — nagashi_redesign.js) · 사람 · AI 같게
    this.attackUntil = this.time + ATTACK_LIFE;
    if (bundled) return;
    this.counts[kind] = (this.counts[kind] ?? 0) + 1;
    // 이어지는 흐름 (이베리아 B6 — 사장님 10/29 14:1x · 14:2x '세 칼마다' · fighter.js ibChainCostK · 확인표 2741): 사람의 사슬 세 칼마다 그 베기는 기력 0 —
    //  공격이라 회복 쉼(0.6 s)은 다른 칼과 같이 다시 셈 (AI · 다른 몸 · 찌르기 · 풍차 베기 칼 · 감는 기력은 그대로)
    const chainK = kind === 'cut' ? this.fighter.ibChainCostK?.() ?? 1 : 1;
    if (chainK === 0) {
      this.rest = 0;
      this.action = 'attack';
      return;
    }
    this.spend('attack', Math.max(0, (kind === 'thrust' ? STAMINA.thrustCost : STAMINA.cutCost) * this.weight * chainK - credit));
  }

  secret() {
    if (this.fighter.alive && !this.exhausted) this.fighter.schoolPassive?.strokeStart(true); // 비기 칼 — 유파 패시브 몫 없음 (school_passive.js)
    if (!STAMINA.on || this.exhausted) return;
    this.attackId++;
    this.flowAttackKind = 'secret'; this.flowAttackStart = this.time;
    this.attackUntil = this.time + ATTACK_LIFE;
    if (this.spend('secret', STAMINA.secretCost)) this.counts.secret++;
  }

  /** 첫 걸음 박차기 (우리 본판 gait.js fastBegin — 박찬 걸음을 뗄 때 한 번): pushCost 12, 무게 배율 없음 · 회복 0.6 s 시계를 다시 센다(공격·막아 받기·비기와 같이).
   *  박차기가 걸리는 몸만 부른다 — 독일 뒤(비스듬히 뒤) · 이베리아 옆(비스듬히 옆) · 지금은 플레이어만(GAIT.stepBurst · burstDe). 박찬 걸음의 걸은 거리는 걷기 비용으로 따로 센다 */
  burst() {
    if (!STAMINA.on || this.exhausted) return;
    if (this.spend('push', STAMINA.pushCost)) this.counts.push++;
  }

  /** 접촉 fresh와 별개로 상대 공격 번호당 한 번만 청구한다. 공격 중 칼 충돌은 공격 비용에 포함. */
  block(attacker) {
    if (!STAMINA.on || this.exhausted || this.inSecret || this.clinchStep?.active || !this.fighter.armed) return;
    const other = attacker?.stamina;
    if (!other || !other.attackId || other.time > other.attackUntil) return;
    if (this.attacking && !this.guarding) return;
    if (this.controller?.opposition?.run) return; // 막아찌르기 동안 맞닿은 막아 받기는 그 찌르기 값에 들어 있다 (10/21 입력형)
    if (this.blockedAttack.get(attacker) === other.attackId) return;
    this.blockedAttack.set(attacker, other.attackId);
    if (this.spend('block', STAMINA.blockCost * this.weight)) {
      this.counts.block++;
      this.blockPayment = { attacker, id: other.attackId, amount: STAMINA.blockCost * this.weight };
    }
  }

  /** 같은 접촉에서 이미 지불한 막기만 공제: 막기+자동 찌르기 총액은 일반 찌르기 한 번. */
  parryThrust(attacker) {
    const credit = this.blockPayment?.attacker === attacker && this.blockPayment.id === attacker.stamina.attackId
      ? this.blockPayment.amount : 0;
    this.blockPayment = null;
    this.attack('thrust', false, credit);
    return credit;
  }

  commitStroke(stroke, kind = stroke?.kind) {
    if (!stroke || stroke.paid || this.exhausted) return;
    stroke.paid = true;
    this.chargeAttack(kind, false);
  }

  /** 지금 손길을 청구 없이 버림 (사람 위에서 내려 찌르기 — 손가락 긋기가 곧 탭 찌르기로 바뀌어 탭 하나만 청구 · unique_assist.js start · 10/27) */
  dropStroke() {
    this.stroke = null;
  }

  /** 긋기를 청구할 손 움직임 바닥 (패드 m): 사람 입력 몸(main.js 플레이어)은 humanStrokeMin(10/31 — 가벼운 손끝 · 미끄러짐은 베기가 아님) · 그 밖은 strokeTravel 그대로 */
  strokeMin() {
    return this.fighter.humanInput ? Math.max(STAMINA.strokeTravel, STAMINA.humanStrokeMin ?? 0) : STAMINA.strokeTravel;
  }

  finishStroke() {
    const s = this.stroke;
    if (!s) return;
    if (!s.paid && s.travel >= STAMINA.strokeTravel && s.travel < this.strokeMin()) this.freeStrokes = (this.freeStrokes ?? 0) + 1; // 재기: 전 판이면 청구됐을 가벼운 손길
    if (s.travel >= this.strokeMin() && !isPreparation(s)) this.commitStroke(s);
    s.until = this.time + ATTACK_TAIL;
    this.strokeTail = s;
    this.stroke = null;
  }

  /** 준비로 보류한 손길도 실제로 칼/몸을 치면 공격이다. 정지한 칼은 이 훅을 부르지 않는다. */
  contactAttack(kind) {
    if (this.fighter.aiControlled || this.guarding || this.inSecret || this.exhausted) return;
    const s = this.stroke ?? (this.time <= this.strokeTail?.until ? this.strokeTail : null);
    if (this.strokeTail?.paid && this.time <= this.strokeTail.until && s && !s.enters && !s.matched) return;
    this.commitStroke(s, kind ?? s?.kind);
  }

  /** 기술 감지의 방향 규칙은 재사용하되, 기력은 준비→실행→회수 단위로 확정한다. */
  observeStroke(dt) {
    const f = this.fighter, sk = f.skill;
    if (f.aiControlled) return;
    if (this.guarding || this.inSecret || sk.tap || sk.pom || sk.recovering || !f.armed || f.weapon?.gun) {
      if (!this.inSecret && !sk.tap && !sk.pom) this.finishStroke();
      else this.stroke = null;
      this.quiet = Infinity;
      this.strokeStart = f.handOffset ? [f.handOffset.x, f.handOffset.y] : null;
      return;
    }
    const at = [f.handOffset?.x ?? 0, f.handOffset?.y ?? 0];
    if (!(sk.inputMotion ? sk.inputSwinging : sk.swinging)) {
      if (this.stroke) {
        this.stroke.travel += Math.hypot(at[0] - this.stroke.end[0], at[1] - this.stroke.end[1]);
        this.stroke.end = at;
      }
      this.quiet += dt;
      if (this.quiet >= STAMINA.strokeQuiet) this.finishStroke();
      this.strokeStart = at;
      return;
    }
    const velocity = sk.inputMotion?.vel ?? sk.vel;
    const vx = velocity.x, vy = velocity.y, n = Math.hypot(vx, vy);
    if (n < 1e-6) return;
    const dir = [vx / n, vy / n];
    const turn = this.stroke ? Math.acos(clamp(dir[0] * this.stroke.dir[0] + dir[1] * this.stroke.dir[1], -1, 1)) * 180 / Math.PI : 180;
    if (!this.stroke || turn > UNIQUE_ASSIST.turnDeg) {
      const start = this.stroke?.end ?? this.strokeStart ?? at;
      this.finishStroke();
      const classified = classifyStroke(start, dir);
      this.stroke = { start, end: start, dir, kind: classified.kind, matched: !!classified.tech,
        enters: entersAttackLine(start, dir), travel: 0, paid: false };
    }
    const s = this.stroke;
    s.travel += Math.hypot(at[0] - s.end[0], at[1] - s.end[1]);
    s.end = at;
    if (s.travel >= this.strokeMin() && (s.matched || s.enters || s.travel >= 0.9)) this.commitStroke(s);
    this.quiet = 0;
  }

  step(dt) {
    if (!(dt > 0)) return;
    const f = this.fighter;
    this.time += dt;
    this.captureMass(f.swordMass);
    const p = f.bodies?.pelvis?.translation();
    const old = this.position;
    this.position = p ? { x: p.x, z: p.z } : null;
    if (!STAMINA.on) {
      this.value = STAMINA.max; this.level = 0; this.exhaustLeft = 0; this.pose = 0; this.rest = 0;
      this.clinching = false; this.clinchStep = null;
      return;
    }
    if (this.infinite) this.refill(); // 기력 무한: 늘 가득 — 아래 길(클린치 짝 셈 · 긋기 확정 · 걸음 셈)은 그대로 돌고 청구만 spend 가 받지 않는다
    // 회복·걷기보다 우선. 이번 스텝 비용으로 탈진했으면 강제 회복은 다음 스텝부터.
    if (this.stepClinch(dt)) {
      if (!this.exhausted) this.pose = Math.max(0, this.pose - dt * 6);
      return;
    }
    if (!f.alive || f.revival) return;
    this.stages();
    if (this.exhausted) {
      const slice = Math.min(dt, this.exhaustLeft);
      const before = this.value;
      this.exhaustLeft = Math.max(0, this.exhaustLeft - slice);
      const target = this.exhaustNaturalTarget ?? 0;
      const rate = this.exhaustNaturalTarget != null
        ? recoverRate(f) : STAMINA.exhaustRecover;
      this.value = Math.min(target, this.value + rate * slice);
      this.recovered += this.value - before;
      this.pose = Math.min(1, this.pose + dt * 6);
      this.action = 'exhausted';
      this.rest = 0;
      if (this.exhaustLeft < 1e-9) {
        // 자연 회복 탈진: −35 · 심한 지침(2)에서 풀림(되돌림 +15 그대로 — 지침으로는 −20 에서) · 옛 고정: 0 · 지침(1)
        this.exhaustLeft = 0; this.value = target;
        this.level = this.exhaustNaturalTarget != null ? 2 : 1;
        this.exhaustNaturalTarget = null;
        this.rest = STAMINA.recoverDelay; // 강제 회복을 마쳤으므로 새 대기 없이 다음 스텝부터 정상 회복 (막기를 쥐고 있으면 다시 멈춤)
      }
      return;
    }
    this.pose = Math.max(0, this.pose - dt * 6);
    this.action = this.guarding ? 'guard' : 'rest';
    this.observeStroke(dt);
    if ((f.aiControlled && this.controller?.phase === 'strike') || (!f.aiControlled && f.skill?.swinging && this.stroke?.paid)) this.attackUntil = this.time + ATTACK_TAIL;
    if (this.exhausted) return;
    const shots = f.gun?.shots ?? 0;
    if (shots > this.lastShots) this.spend('attack', (shots - this.lastShots) * STAMINA.shotCost * this.weight);
    this.lastShots = shots;
    // 걷기 의도가 있는 실제 전진거리만. 정지 흔들림/기술 내딛기/역방향 피격 이동은 제외.
    const mv = f.move;
    if (p && old && f.state === 'stand' && !f.feetHeld && !this.inSecret && !f.gait?.req && !(f.skill?.lunge > 0) && !f.skill?.thrustPush && mv && Math.hypot(mv.x, mv.y) > 0.05) {
      const heading = f.heading ?? 0;
      const dx = p.x - old.x, dz = p.z - old.z;
      const along = dx * (Math.cos(heading) * mv.y + Math.sin(heading) * mv.x) + dz * (-Math.sin(heading) * mv.y + Math.cos(heading) * mv.x);
      if (along > 0) this.distance += Math.min(Math.hypot(dx, dz), STAMINA.maxWalkSpeed * dt);
      const steps = Math.floor((this.distance + 1e-9) / STAMINA.stepDistance);
      if (steps) {
        this.distance -= steps * STAMINA.stepDistance;
        const cost = STAMINA.stepCosts[f.schoolFootwork === false || kitOff(f, 'stepCost') ? 'default' : f.swordArt?.tradition] ?? STAMINA.stepCosts.default; // 유파 걷기 기력은 보법 몫 — 대기실 스킬트리(10/21) 일본 보법 J1 · 동방 보법 II C2 를 안 익힌 플레이어는 보통 1.4
        this.spend('move', steps * cost);
      }
    }
    if (this.exhausted) return;
    const active = Math.max(0, this.rest + dt - STAMINA.recoverDelay) - Math.max(0, this.rest - STAMINA.recoverDelay);
    this.rest += dt;
    if (!this.guarding) {
      const before = this.value;
      const rate = recoverRate(f);
      this.value = Math.min(this.max, this.value + active * rate);
      this.recovered += this.value - before;
    }
    this.stages();
  }
}

/**
 * 티소나 '위세' (사장님 10/21 23:xx — 값 config.js WEAPON_ABILITY · 무기 스펙 awe): 칼 주인(att)의 공격이 상대(vic) 칼에 막혀 끝났다(못 벰 · 칼끼리 닿음).
 *  부르는 곳 = 독일 인데스 '막힘'과 같은 가름 — AI 는 ai.js afterStrike(!hitLanded · bound) · 사람은 skill.js whiffEnd(공격으로 셈 · !landed · bound). 둘 다 공격 하나 끝에 한 번 부른다.
 *  막은 쪽 기력 − aweDrain · 칼 주인 시계(stamina.time)로 aweGap 초 안에는 다시 깎지 않는다(깎았을 때만 시계를 다시 셈).
 *  능력 없는 칼 · 부러진 칼 · 빈손이면 아무 일도 없다(난수 · 몸 · 장부 그대로 — 다른 무기 판은 바이트 같음). 청구는 spend('awe'):
 *  기력 끔 · 기력 무한(용사의 눈물) · 탈진 · 죽음이면 깎이지 않는다. 깎인 값은 머리 위 기력 막대(stamina_hud.js)에 다른 청구처럼 보인다
 */
export function spendAweDrain(att, vic) {
  const W = WEAPON_ABILITY;
  const A = att?.stamina, s = vic?.stamina;
  if (!att?.weapon?.awe || !att.armed || att.weaponBroken || !A || !s || !(W.aweDrain > 0)) return null;
  if (att.aweLast != null && A.time - att.aweLast < W.aweGap - 1e-9) return null;
  s.spent.awe ??= 0;
  s.counts.awe ??= 0;
  const before = s.value;
  if (!s.spend('awe', W.aweDrain)) return null;
  s.counts.awe++;
  att.aweLast = A.time;
  const event = { time: A.time, attacker: att.index, requested: W.aweDrain, before, after: s.value, actual: before - s.value };
  vic.lastAwe = event;
  return event;
}
/**
 * 티소나 '위세' 판 시작 (사장님 10/24 11:3x — config.js WEAPON_ABILITY.aweStart): att 가 위세 칼(weapon.awe)을 들고 판을 시작하면 vic 의 최대 기력을
 *  aweStart(15 — 고정 · 무작위 아님, 사장님 11:4x)만큼 그 판 내내 깎고, 깎인 최대에서 시작한다(기력 무한이면 깎인 최대로 늘 가득 — 청구가 없어 느낄 일 없음).
 *  판을 세울 때 한 번(main.js newRound — 사람 · AI 두 쪽 모두). 돌려줌 { loss } 또는 null(위세 칼 아님 · 끔)
 */
export function applyAweStart(att, vic) {
  const s = vic?.stamina, loss = Math.max(0, Math.round(+WEAPON_ABILITY.aweStart || 0));
  if (!att?.weapon?.awe || !s || !(loss > 0)) return null;
  s.aweLoss = loss;
  if (STAMINA.on) s.value = s.max;
  if (s.infinite) s.refill();
  vic.aweStart = { attacker: att.index, loss };
  return { loss };
}
