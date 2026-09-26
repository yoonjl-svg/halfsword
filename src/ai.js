// ─────────────────────────────────────────────────────────────
//  상대 AI: 사람 검객처럼 싸운다
//
//  AI도 플레이어와 똑같이 "손 목표 위치(패드)"와 "이동 방향"만 조종한다.
//  손은 사람 손 빠르기로만 움직이고, 칼과 몸은 물리가 움직인다 (순간이동 칼질 없음).
//
//  좀비처럼 달려들지 않는다. 리히테나워 검술의 기본을 따른다:
//   1) 간격(Mensur): 상대 칼이 닿지 않는 거리 바로 밖에서 간을 본다. 잔걸음으로 들어갔다 빠졌다,
//      옆으로 돌며 자세를 바꾼다(지붕·황소·쟁기·긴 자세·바보). 서두르지 않는다.
//   2) 빈틈(Blöße): 상대가 헛친 뒤 칼이 길 밖에 있을 때, 간격 안으로 걸어 들어올 때, 비틀거릴 때,
//      자세가 한쪽을 비워 둘 때 → 그 빈틈을 노리는 기술을 골라, 한 걸음 내디디며 친다.
//      친 뒤에는 물러나거나(Abzug), 막혔거나 맞았으면 이어서 친다(Nachschlag).
//   3) 막기: 상대가 치러 오면 난이도에 따라 물러나 헛치게 하거나, 칼을 들어 막거나,
//      같은 순간에 맞받아 베어(Indes) 막으면서 친다. 막은 뒤엔 되받아 친다(Nach).
//   4) 속임수(Fehler), 성격(사람마다 다른 간격·자세·기술 취향), 줄어드는 인내심(판이 늘어지지 않게),
//      다쳤을 때의 판단(피를 더 흘리면 서두르고, 상대가 더 흘리면 기다린다).
//
//  반응 시간: AI는 상대를 reaction초 늦게 본다 (ai_sense.js). 이 물리에서 베기는 시작부터 닿기까지
//  0.3초쯤이라, 보고 나서 막기는 거의 늦다 → 사람처럼 "치려는 낌새"(칼을 들며 간격으로 들어오는 것)를
//  먼저 읽고 물러나거나 먼저 쳐야 한다. 그래서 간격 지키기가 가장 중요한 방어다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { AI_LEVELS, BODY } from './config.js';
import { Senses } from './ai_sense.js';
import { G, WATCH_GUARDS, TECH, TECH_BY_NAME, FEINTS, padDist } from './ai_techniques.js';

const clamp = THREE.MathUtils.clamp;
const rand = (a, b) => a + Math.random() * (b - a);

// 간격 (가슴과 가슴 사이 수평 거리, m). 이 물리 모델에서 직접 재 본 값 (가만히 선 상대에게 베기)
const MEASURE = {
  contact: 1.62, // 베기가 머리·목에 제대로 닿는 거리 (칼날 70% 지점)
  reach: 2.0, // 서 있다가 휘두르며 한 걸음 내디디면 닿는 거리 = 이 안은 위험하다 (상대도 같다)
  clinch: 1.25, // 너무 붙음: 칼을 제대로 못 쓴다 → 떨어진다
  cutTime: 0.3, // 베기를 시작해서 닿기까지 걸리는 시간 (초)
};

// 막기 자세: 상대 칼이 들어오는 곳(내 몸 기준) → 그 칼을 가로막는 손 위치
//  (공격 5가지 × 자세 13가지를 물리로 부딪쳐 보고 가장 잘 막은 자세)
const PARRY = {
  highL: [-0.3, 0.1], // 내 왼쪽 위 (상대 오른쪽 어깨에서 내려오는 분노의 베기): 칼을 왼쪽에 세워 받는다
  highR: G.ochsR, // 내 오른쪽 위: 오른쪽 황소
  highC: G.langort, // 머리 위에서 곧게: 뻗은 칼 위로 떨어지게
  lowL: G.pflugL,
  lowR: G.pflugR,
  thrust: G.pflugL, // 찌르기: 왼쪽으로 비껴 누른다 (Absetzen)
};

export class AI {
  constructor(me, foe, levelName = 'normal') {
    this.me = me;
    this.foe = foe;
    this.sense = new Senses(me, foe);
    this.setLevel(levelName);
    // 성격: 사람마다 다르다 (같은 난이도라도 판마다 다른 검객)
    const guardPref = {};
    for (const g of WATCH_GUARDS) guardPref[g.name] = rand(0.4, 1.6);
    const techPref = {};
    for (const t of TECH) techPref[t.name] = rand(0.6, 1.4);
    this.pers = {
      margin: rand(0.2, 0.5), // 간격 밖에 얼마나 여유를 두고 서는지 (m)
      aggr: rand(0.85, 1.2), // 공격 성향
      circleDir: Math.random() < 0.5 ? -1 : 1, // 즐겨 도는 방향
      circleRate: rand(0.25, 0.6),
      rhythm: rand(1.2, 3.0), // 자세를 바꾸는 박자 (초)
      patienceTime: rand(7, 12), // 인내심이 바닥나는 데 걸리는 시간 (초)
      guardPref,
      techPref,
    };
    this.mode = 'watch'; // watch(간 보기) | attack | defend | withdraw(물러나기)
    this.phase = 'ready'; // attack 안의 단계: windup(준비 자세) | approach(다가감) | strike | follow
    this.hand = new THREE.Vector2(0.12, -0.18); // 손 목표 (패드)
    this.handSpeed = 1.2;
    this.path = []; // 베는 동안 손이 지나갈 점들
    this.guard = null; // 간 볼 때의 자세
    this.guardTimer = rand(0.3, 1.0);
    this.patience = rand(0.55, 0.85); // 처음엔 조금 간을 보다가 들어간다
    this.foeReach = MEASURE.reach + 0.05; // 상대 칼이 닿는 거리 추정 (생각보다 멀리서 맞으면 늘린다)
    this.decideTimer = 0;
    this.timer = 0;
    this.attackT = 0;
    this.shuffle = 0;
    this.shuffleTimer = 0;
    this.circle = 0;
    this.circleTimer = rand(0.5, 1.5);
    this.threatId = 0; // 상대 공격 번호 (한 공격에 한 번만 판단)
    this.threatSeen = -1;
    this.preArmed = true; // "치려는 낌새"에 새로 반응할 수 있나 (한 번 몰아칠 때 한 번만 판단)
    this.preOff = 1;
    this.noThreat = 1; // 위험이 없던 시간
    this.prevFoePain = foe.pain;
    this.prevMyPain = me.pain;
    this.hitLanded = false;
    this.bound = false;
    this.feint = null;
    this.feintPts = 0;
    this.chain = 0;
    this.stepT = 0; // 베며 내딛는 남은 시간
    this.stepDelay = 0;
    this.foeParried = 0; // 상대가 내 공격을 칼로 막은 횟수 (많을수록 속임수를 쓴다)
    this.d = 3;
    this.foeClosing = 0;
    this.foeAggro = 0; // 상대가 얼마나 몰아치는 사람인가 (0~1, 최근 몇 초)
    this.seizeT = 0;
    this.myClosing = 0;
    this.foeLat = 0;
    this.cautious = false;
    this.desperate = false;
    this.stats = { attacks: 0, feints: 0, parries: 0, voids: 0, counters: 0, preempts: 0, followUps: 0, landed: 0, aborted: 0 };
    this.guard = this.pickGuard(null);
  }

  setLevel(name) {
    this.levelName = AI_LEVELS[name] ? name : 'normal';
    this.level = AI_LEVELS[this.levelName];
    this.me.strength = this.level.strength;
    this.me.skill.level = this.level.skill;
  }

  /** 지금 공격 동작 중인가 (평가·디버그용) */
  get attacking() {
    return this.mode === 'attack';
  }

  // ───────────────────────── 매 스텝 ─────────────────────────
  update(dt) {
    const me = this.me;
    const foe = this.foe;
    this.sense.record(dt);
    const L = this.level;

    // 넘어졌거나 일어나는 중: 칼을 머리 위로 들어 가리고, 일어서면 먼저 물러난다
    if (me.state !== 'stand') {
      me.move.set(0, 0);
      this.mode = 'withdraw';
      this.phase = 'ready';
      this.timer = 0.9;
      this.path.length = 0;
      this.hand.set(G.kron[0], G.kron[1]);
      this.handSpeed = 1.4;
      this.prevFoePain = foe.pain;
      this.prevMyPain = me.pain;
      this.moveHand(dt);
      return;
    }

    // ── 보기 (반응 시간만큼 늦게) ──
    const s = this.sense.seen(L.reaction);
    const c = me.bodies.chest.translation();
    // 몸의 움직임은 사람도 앞질러 내다본다 (걸어오는 사람이 지금 어디쯤인지): 본 위치 + 속도 × 반응 시간.
    //  칼을 휘두르기 시작하는 것처럼 갑자기 바뀌는 움직임은 내다볼 수 없다 → 그건 늦게 본다
    const ahead = L.reaction * L.predict;
    const dx = s.cx + s.vx * ahead - c.x;
    const dz = s.cz + s.vz * ahead - c.z;
    const d = Math.max(0.01, Math.hypot(dx, dz));
    const ux = dx / d; // 나 → 상대 방향
    const uz = dz / d;
    this.d = d;
    this.foeClosing = -(s.vx * ux + s.vz * uz); // 상대가 나에게 다가오는 빠르기 (m/s)
    const mv = me.bodies.pelvis.linvel();
    this.myClosing = mv.x * ux + mv.z * uz; // 내가 상대에게 다가가는 빠르기
    const r = me.right(_v1);
    this.foeLat = dx * r.x + dz * r.z; // 상대가 내 오른쪽으로 비껴 선 정도
    // 상대가 얼마나 몰아치는가: 다가오며 휘두르는 사람이면 곧장 벨 수 있는 자세(지붕·황소)로 기다린다
    const aggrNow = (this.foeClosing > 0.6 ? 0.6 : 0) + (Math.hypot(s.hvx, s.hvy) > 3 && d < this.foeReach + 0.6 ? 0.6 : 0);
    this.foeAggro += (Math.min(1, aggrNow) - this.foeAggro) * Math.min(1, dt / 2.5);

    // 맞혔나 / 맞았나 (움찔하는 것은 눈에 보이고, 맞은 것은 느낀다)
    if (foe.pain > this.prevFoePain + 0.05 && this.mode === 'attack') this.hitLanded = true;
    const hurt = me.pain > this.prevMyPain + 0.05;
    this.prevFoePain = foe.pain;
    this.prevMyPain = me.pain;
    if (hurt) {
      // 생각보다 멀리서 맞았으면 상대 칼이 더 멀리 닿는다고 고쳐 생각한다
      if (this.mode !== 'attack') this.foeReach = clamp(Math.max(this.foeReach, d + 0.1), MEASURE.reach, 2.5);
      if (this.mode !== 'attack' || this.phase !== 'strike') this.startWithdraw(0.8);
    }
    this.foeReach += (MEASURE.reach + 0.05 - this.foeReach) * dt * 0.03; // 천천히 원래 생각으로

    // 인내심: 시간이 지나면 줄어든다 → 판이 늘어지지 않는다
    const hurry = this.hurry();
    this.patience = Math.max(0, this.patience - (dt / this.pers.patienceTime) * L.aggression * this.pers.aggr * hurry);

    // 상대 칼이 내 몸 쪽으로 오나
    const th = this.threat(s, c, r, d);
    this.noThreat = th ? 0 : this.noThreat + dt;

    if (this.mode === 'watch') this.watch(dt, s, d, th);
    else if (this.mode === 'attack') this.attack(dt, s, d, th);
    else if (this.mode === 'defend') this.defend(dt, s, d, th);
    else this.withdraw(dt, s, d, th);

    this.moveHand(dt);
    this.moveFeet(dt, d);
  }

  // ───────────────────────── 간 보기 ─────────────────────────
  watch(dt, s, d, th) {
    const L = this.level;
    this.phase = 'ready';
    if (th && this.respond(th, d)) return;
    // 치려는 낌새(간격 가까이서 칼을 들며 다가온다) → 들어오는 순간을 먼저 치거나(Vor), 물러난다
    if (this.preThreat(s, d, dt)) return;
    if (this.seize(s, d, dt)) return;

    // 자세 바꾸기 (잠깐씩 멈추며)
    this.guardTimer -= dt;
    if (this.guardTimer <= 0) {
      this.guardTimer = this.pers.rhythm * rand(0.6, 1.4);
      this.guard = this.pickGuard(s);
    }
    this.hand.set(this.guard.pad[0], this.guard.pad[1]);
    this.handSpeed = 1.25; // 천천히: 휘두르기로 보이지 않게 (검술 층의 자동 내딛기가 걸리지 않는다)

    // 기회를 본다 (사람처럼 가끔씩 판단)
    this.decideTimer -= dt;
    if (this.decideTimer > 0) return;
    this.decideTimer = rand(0.06, 0.14);
    const opp = this.opportunity(s, d);
    const need = 1 - 0.3 * (this.pers.aggr * L.aggression - 0.8);
    if (opp.score >= need && d < this.holdDist() + 0.4) this.startAttack(this.pickTech(s, opp.kind), opp.kind);
  }

  /** 간을 볼 거리: 상대 칼이 닿는 거리 + 여유. 인내심이 줄수록 여유를 줄여 간격 끝에 선다 */
  holdDist() {
    const L = this.level;
    let m = this.pers.margin * (0.3 + 0.7 * this.patience) * (0.6 + 0.4 * L.discipline);
    if (this.guard?.name === 'alber') m -= 0.12; // 바보 자세: 머리를 비워 두고 조금 더 다가가 유인한다
    if (this.cautious) m += 0.2;
    m += (1 - this.me.vigor) * 0.3; // 다쳐서 힘이 빠지면 더 조심스럽게 선다
    return this.foeReach + Math.max(0.08, m);
  }

  /** 급한 정도: 내가 피를 더 흘리면 서두르고(>1), 상대가 더 흘리면 기다린다(<1) */
  hurry() {
    const me = this.me;
    const foe = this.foe;
    const myLoss = 1 - me.blood + me.bleed * 8;
    const foeLoss = 1 - foe.blood + foe.bleed * 8;
    // 기다리면 상대가 쓰러질 만큼 피를 쏟고 있을 때만 기다린다 (피는 곧 굳는다)
    this.cautious = foeLoss > myLoss + 0.12 && foe.bleed > 0.01 && me.blood > 0.7;
    this.desperate = myLoss > foeLoss + 0.12 && me.blood < 0.75;
    if (this.desperate) return 2.2;
    if (this.cautious) return 0.6;
    return 1;
  }

  /** 자세 고르기: 성격 + 상대 자세에 맞서는 자세 */
  pickGuard(s) {
    const L = this.level;
    const cls = s ? this.foeClass(s) : null;
    let best = WATCH_GUARDS[0];
    let bestW = -1;
    for (const g of WATCH_GUARDS) {
      if (g === this.guard) continue;
      let w = this.pers.guardPref[g.name];
      if (cls) {
        // 상대가 칼을 높이 들면 칼끝으로 겨누는 자세(들어오면 찔린다)나 아래 자세, 낮추면 위에서 내려칠 자세
        if (cls.high) w *= 1 + L.read * (g.threat * 0.8 + g.low * 0.4);
        if (cls.low) w *= 1 + L.read * g.high * 0.9;
        if (cls.online) w *= 1 + L.read * g.high * 0.6; // 칼끝이 나를 겨누면 위에서 눌러 벨 준비
      }
      // 인내심이 떨어지면 가장 믿는 기술(분노의 베기)을 준비하는 자세
      const ready = g.name === 'tagR' || g.name === 'ochsR' || g.name === 'tag';
      if (ready) w *= 1 + (1 - this.patience) * 0.8 + this.foeAggro * 2.5 * L.read;
      w *= rand(0.5, 1.5);
      if (w > bestW) {
        bestW = w;
        best = g;
      }
    }
    return best;
  }

  /** 상대 자세 읽기 (상대 기준 패드: x + = 상대의 칼 든 쪽 = 내 쪽에서 보면 왼쪽) */
  foeClass(s) {
    const bx = s.tx - s.mx;
    const by = s.ty - s.my;
    const bz = s.tz - s.mz;
    const c = this.me.bodies.chest.translation();
    const qx = c.x - s.mx;
    const qy = c.y - s.my;
    const qz = c.z - s.mz;
    const cos = (bx * qx + by * qy + bz * qz) / (Math.hypot(bx, by, bz) * Math.hypot(qx, qy, qz) + 1e-6);
    return {
      high: s.hy > 0.28, // 칼을 높이 들었다 → 아래가 빈다
      low: s.hy < -0.18, // 칼을 낮췄다 → 위가 빈다
      right: s.hx > 0.22, // 칼이 상대 오른쪽 → 상대 왼쪽이 빈다
      left: s.hx < -0.22,
      online: cos > 0.88, // 칼끝이 나를 겨눈다 (곧장 들어가면 찔린다)
    };
  }

  // ───────────────────────── 빈틈 읽기 ─────────────────────────
  /** 지금 칠 만한가: { score, kind } */
  opportunity(s, d) {
    const L = this.level;
    let score = 0;
    let kind = 'patience';
    let top = 0;
    const cls = this.foeClass(s);
    const handSp = Math.hypot(s.hvx, s.hvy);
    const swungRecently = this.sense.recentHandSpeed(L.reaction, 0.7) > 3.5;
    const add = (v, k) => {
      if (v > top) {
        top = v;
        kind = k;
      }
      score += v;
    };
    // 1) 헛친 뒤: 칼이 길 밖에 있고 손이 멈췄다 (다시 자세를 잡기 전) → 뒤(Nach)
    if (swungRecently && handSp < 1.8 && !cls.online && d < MEASURE.reach + 0.45) add(0.7 + 0.3 * L.read, 'recover');
    // 2) 간격 안으로 걸어 들어온다 → 들어오는 순간(Vor)
    if (this.foeClosing > 0.45 && d < this.foeReach + 0.3 && !cls.online) add(0.55 + 0.35 * L.read, 'stepin');
    // 3) 비틀거리거나 쓰러져 있다, 칼을 놓쳤다
    if (s.state !== 'stand' || !s.armed) add(1.2, 'finish');
    else if ((s.offBalance > 0.03 && Math.hypot(s.vx, s.vz) < 0.8) || s.balance < 65) add(0.6, 'offbalance');
    // 4) 칼끝이 나를 겨누지 않는다 (들어가도 찔리지 않는다)
    if (!cls.online) add(0.15 + 0.15 * L.read, 'open');
    // 5) 다쳐서 약하다
    add((1 - s.vigor) * 0.5, 'weak');
    // 6) 인내심이 떨어지면 먼저 들어간다 (주도권)
    add((1 - this.patience) * 1.1, 'patience');
    if (this.desperate) add(0.25, 'patience');
    if (this.cautious) score -= 0.2;
    // 내 상태가 나쁘면 참는다
    if (this.me.offBalance > 0.03 || this.me.pain > 0.9) score -= 0.5;
    if (this.foe.state === 'dead') score = -1;
    return { score, kind };
  }

  /**
   * 가까이서 곧장 치는 순간: 상대가 헛치고 다시 자세를 잡기 전(Nach)이거나,
   * 몸을 붙여 밀고 들어오면 물러나기만 하지 않고 짧게 벤다 (붙은 싸움, Krieg)
   */
  seize(s, d, dt) {
    this.seizeT -= dt;
    if (this.seizeT > 0) return false;
    this.seizeT = rand(0.08, 0.16);
    if (d > MEASURE.reach + 0.2 || d < 0.9 || !this.foe.alive) return false;
    const L = this.level;
    const swung = this.sense.recentHandSpeed(L.reaction, 0.6) > 3.5;
    const recovering = swung && Math.hypot(s.hvx, s.hvy) < 1.8;
    const pressing = d < 1.5 && this.foeClosing > 0.1;
    if (!recovering && !pressing) return false;
    if (Math.random() > (recovering ? 0.3 + 0.5 * L.read : 0.1 + 0.35 * L.read)) return false;
    return this.startAttack(this.pickTech(s, 'recover'), recovering ? 'recover' : 'press', { noFeint: true });
  }

  /** 기술 고르기: 노리는 빈틈 × 상대 자세 × 준비 자세까지의 거리 × 성격 */
  pickTech(s, why) {
    const L = this.level;
    const cls = this.foeClass(s);
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    let best = null;
    let bestW = -1;
    for (const t of TECH) {
      let w = this.pers.techPref[t.name] * t.base;
      // 빈틈: 상대 칼이 높으면 아래·찌르기, 낮으면 위, 한쪽으로 치우치면 반대쪽
      const o = t.open;
      const up = o === 'UL' || o === 'UR' || o === 'H';
      const low = o === 'LL' || o === 'LR';
      let fit = 1;
      if (cls.high) fit *= low ? 1.8 : o === 'C' ? 1.6 : up ? 0.7 : 1;
      if (cls.low) fit *= up ? 1.6 : low ? 0.5 : 0.8;
      if (cls.right) fit *= o === 'UL' || o === 'LL' ? 1.5 : 0.8;
      if (cls.left) fit *= o === 'UR' || o === 'LR' ? 1.5 : 0.8;
      // 칼끝이 나를 겨누면: 위에서 그 칼을 눌러 비키며 베는 기술이 낫다. 찌르기는 서로 찔린다
      if (cls.online) fit *= t.presses ? 1.5 : t.kind === 'thrust' ? 0.5 : 0.9;
      if (why === 'finish') fit *= up ? 1.5 : 0.6; // 쓰러진 상대: 위에서 내려친다
      if (why === 'windup' || why === 'stepin') fit *= t.fast ? 1.6 : 1; // 짧은 순간: 빠른 기술
      w *= Math.pow(fit, 0.3 + 0.7 * L.read);
      // 준비 자세가 멀면 크게 들어 올려야 한다 (속내가 드러나고 늦다) → 짧은 기회일수록 지금 자세에서 바로 친다
      const cd = padDist(hand, t.from);
      const quick = why === 'recover' || why === 'stepin' || why === 'windup' || why === 'riposte';
      w *= Math.exp(-cd / ((quick ? 0.3 : 0.55) + 0.4 * (1 - L.read)));
      const noise = 0.2 + 0.5 * (1 - L.read);
      w *= rand(1 - noise, 1 + noise);
      if (w > bestW) {
        bestW = w;
        best = t;
      }
    }
    return best;
  }

  // ───────────────────────── 공격 ─────────────────────────
  /** 공격 시작. why: 어떤 기회였나 (recover/stepin/finish/patience/counter/...) */
  startAttack(tech, why, opt = {}) {
    if (!tech) return false;
    const L = this.level;
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    this.mode = 'attack';
    this.tech = tech;
    this.why = why;
    this.hitLanded = false;
    this.bound = false;
    this.chain = opt.chain ?? 0;
    this.attackT = 0;
    this.stepT = 0;
    this.path.length = 0;
    this.fastChamber = !!opt.fastChamber;
    if (!opt.chain) this.stats.attacks++;
    // 속임수: 먼저 다른 곳을 치는 척하다가 바꾼다 (상대가 잘 막을수록 자주)
    this.feint = null;
    if (!opt.noFeint && (why === 'patience' || why === 'open' || why === 'weak')) {
      const want = L.feint * (1 + Math.min(2, this.foeParried * 0.4));
      if (Math.random() < want) {
        const cands = FEINTS.filter((f) => padDist(hand, TECH_BY_NAME[f.fake].from) < 0.45);
        if (cands.length) {
          this.feint = cands[Math.floor(Math.random() * cands.length)];
          this.tech = TECH_BY_NAME[this.feint.fake];
          this.stats.feints++;
        }
      }
    }
    // 준비 자세가 가까우면 곧바로 친다 (숙련자는 크게 들어 올리지 않는다)
    const cd = padDist(hand, this.tech.from);
    this.phase = cd > 0.06 && !opt.skipChamber ? 'windup' : 'approach';
    this.quick = why !== 'patience' && why !== 'open' && why !== 'weak' && why !== 'offbalance';
    this.timer = this.phase === 'approach' && !this.quick ? L.windup * 0.15 : 0;
    return true;
  }

  attack(dt, s, d, th) {
    const L = this.level;
    const me = this.me;
    const t = this.tech;
    this.attackT += dt;
    if (this.phase === 'windup') {
      // 준비 자세로 (다가가며)
      this.hand.set(t.from[0], t.from[1]);
      this.handSpeed = this.fastChamber ? L.parrySpeed : L.chamberSpeed;
      // 준비하는 동안 상대 칼이 들어오면: 숙련자는 공격을 거두고 막는다
      if (th && Math.random() < L.read && this.respond(th, d)) return;
      if (padDist([me.handOffset.x, me.handOffset.y], t.from) < 0.03) {
        this.phase = 'approach';
        this.timer = this.quick ? 0 : L.windup * 0.25; // 잠깐 자세를 잡는다 (쉬운 상대일수록 길다 = 읽기 쉽다)
      }
      if (this.attackT > 1.2) this.abortAttack();
    } else if (this.phase === 'approach') {
      this.hand.set(t.from[0], t.from[1]);
      this.timer -= dt;
      // 닿을 거리까지 다가간다. 베는 동안(0.3초) 서로 좁혀지는 거리까지 생각해서 미리 친다
      this.need = MEASURE.contact + t.reach + 0.05;
      if (this.timer <= 0 && this.contactDist() <= this.need) {
        this.startStrike();
        return;
      }
      if (th && Math.random() < L.read && this.respond(th, d)) return;
      // 상대가 물러나 따라잡을 수 없거나 너무 오래 걸리면 그만둔다 (좀비처럼 쫓지 않는다)
      if (this.attackT > 1.4 || d > this.holdDist() + 0.8) this.abortAttack();
    } else if (this.phase === 'strike') {
      this.handSpeed = L.strikeSpeed;
      this.checkBind();
      if (!this.path.length) {
        // 손은 끝 자세에 닿았지만 무거운 칼은 아직 날아가는 중이다 → 칼이 지나갈 때까지 버틴다
        this.phase = 'follow';
        this.timer = 0.3;
      }
    } else if (this.phase === 'follow') {
      this.timer -= dt;
      this.checkBind();
      if (this.timer <= 0) this.afterStrike(d);
    }
  }

  abortAttack() {
    this.stats.aborted++;
    this.mode = 'watch';
    this.phase = 'ready';
    this.guardTimer = rand(0.2, 0.6);
  }

  startStrike() {
    const t = this.tech;
    this.phase = 'strike';
    this.path.length = 0;
    if (this.feint) {
      // 속임수: 가짜 기술의 앞부분만 가다가(내딛지 않고) 진짜 길로 바꾼다
      const f = this.feint;
      const a = t.from;
      const b = t.path[0];
      this.path.push([a[0] + (b[0] - a[0]) * f.at, a[1] + (b[1] - a[1]) * f.at]);
      for (const p of f.then) this.path.push(p.slice());
      this.feintPts = 1;
      this.stepT = 0;
    } else {
      for (const p of t.path) this.path.push(p.slice());
      this.feintPts = 0;
      this.stepT = this.stepTime();
    }
    // 베기가 끝나면 손은 끝 자세에 머문다 (이어 베기는 칼의 관성과 검술 층이 만든다)
    const end = this.path[this.path.length - 1];
    this.hand.set(end[0], end[1]);
    // 칼과 발: 손이 먼저 나가고 발이 뒤따라 내디뎌, 칼이 닿을 때쯤 발이 땅에 닿는다
    this.stepDelay = 0.04;
    this.requestedStep = false;
  }

  /** 베며 내딛는 시간: 이미 닿는 거리면 내딛지 않는다 (다가오던 걸음의 관성으로 충분하다) */
  stepTime() {
    const short = this.contactDist() - MEASURE.contact - this.tech.reach;
    return clamp(short * 0.8, 0, 0.3);
  }

  /** 지금 베기 시작하면 칼이 닿을 때쯤의 거리 (서로 다가오는 빠르기 × 베는 시간, 멈춰 서는 몫은 뺀다) */
  contactDist() {
    const closing = Math.max(0, this.myClosing) * 0.7 + Math.max(0, this.foeClosing);
    return this.d - closing * MEASURE.cutTime;
  }

  /** 칼끼리 닿았나 (내 칼날과 상대 칼날 사이 거리) — 손에 느껴진다 */
  checkBind() {
    if (this.bound) return;
    const me = this.me;
    const foe = this.foe;
    if (!me.tipPrev || !foe.tipPrev) return;
    me.bladePoint(0.1, _a0);
    foe.bladePoint(0.1, _b0);
    if (segDist(_a0, me.tipPrev, _b0, foe.tipPrev) < 0.07) this.bound = true;
  }

  /** 친 뒤: 이어 치기(Nachschlag) 또는 물러나기(Abzug) */
  afterStrike(d) {
    const L = this.level;
    if (this.hitLanded) this.stats.landed++;
    if (this.bound && !this.hitLanded) this.foeParried++; // 칼로 막혔다 → 다음엔 속임수가 통한다
    const canChain = this.chain < 2 && d < MEASURE.reach + 0.1 && d > MEASURE.clinch + 0.1 && this.foe.alive;
    const want = this.hitLanded || this.bound ? L.followUp : L.followUp * 0.3;
    if (canChain && Math.random() < want) {
      // 지금 손 위치에서 바로 이어지는 기술 (다시 크게 들지 않는다)
      const hand = [this.me.handOffset.x, this.me.handOffset.y];
      let best = null;
      let bestW = -1;
      for (const t of TECH) {
        if (t === this.tech) continue;
        const cd = padDist(hand, t.from);
        if (cd > 0.35) continue;
        const w = this.pers.techPref[t.name] * t.base * Math.exp(-cd / 0.2) * rand(0.6, 1.4);
        if (w > bestW) {
          bestW = w;
          best = t;
        }
      }
      if (best) {
        this.stats.followUps++;
        this.startAttack(best, 'follow', { chain: this.chain + 1, noFeint: true });
        return;
      }
    }
    // 한 번 주고받았으니 다시 간을 본다 (인내심이 조금 돌아온다)
    this.patience = Math.max(this.patience, rand(0.45, 0.75));
    this.startWithdraw(0.9);
  }

  // ───────────────────────── 물러나기 ─────────────────────────
  startWithdraw(time) {
    this.mode = 'withdraw';
    this.phase = 'ready';
    this.timer = time;
    this.path.length = 0;
    this.stepT = 0;
    // 물러나면서도 칼끝으로 겨눈다 (쟁기·긴 자세). 몰아치는 상대에겐 곧장 벨 수 있는 황소
    const name = this.foeAggro > 0.3 && Math.random() < this.foeAggro ? 'ochsR' : Math.random() < 0.5 ? 'pflugR' : 'langort';
    this.guard = WATCH_GUARDS.find((g) => g.name === name);
  }

  withdraw(dt, s, d, th) {
    const L = this.level;
    this.phase = 'ready';
    this.timer -= dt;
    if (th && this.respond(th, d)) return;
    if (this.seize(s, d, dt)) return;
    if (d < MEASURE.reach + 0.2) {
      // 아직 상대 칼이 닿는 거리: 상대가 칼을 든 쪽에서 올 베기를 가리며 물러난다 (준비 자세를 읽는다)
      const p = this.coverFor(s);
      this.hand.set(p[0], p[1]);
      this.handSpeed = L.parrySpeed * 0.7;
    } else {
      this.hand.set(this.guard.pad[0], this.guard.pad[1]);
      this.handSpeed = 1.4;
    }
    if ((this.timer <= 0 && d > MEASURE.reach) || d > this.holdDist() - 0.05 || this.timer < -1) {
      this.mode = 'watch';
      this.guardTimer = rand(0.3, 0.8);
    }
  }

  /**
   * 상대 준비 자세를 보고 올 베기를 미리 가리는 손 위치.
   * 상대가 칼을 자기 오른쪽 위에 들고 있으면 내 왼쪽 위로 온다 → 왼쪽에 칼을 세운다. 그 반대도 같다.
   */
  coverFor(s) {
    if (s.hy > 0.15) {
      if (s.hx > 0.15) return PARRY.highL;
      if (s.hx < -0.15) return PARRY.highR;
      return PARRY.highC;
    }
    if (s.hy < -0.2) return s.hx >= 0 ? PARRY.lowL : PARRY.lowR;
    return G.langort; // 가운데: 칼끝으로 겨누고 있는다
  }

  // ───────────────────────── 막기 ─────────────────────────
  /**
   * 상대 칼이 들어온다 (th = { id, line, thrust }).
   * 한 공격에 한 번만 판단한다: 맞받아 벨지(Indes), 막을지, 물러나 피할지.
   */
  respond(th, d) {
    const L = this.level;
    if (th.id === this.threatSeen) return false;
    this.threatSeen = th.id;
    if (Math.random() > L.guardChance) return false; // 못 봤거나 늦었다
    this.defLine = th.line;
    // 1) 같은 순간에 맞받아 베기 (Indes): 들어오는 칼을 내 칼로 밀어내며 그대로 벤다
    if (Math.random() < L.counter && d < MEASURE.reach + 0.3 && d > MEASURE.clinch + 0.1) {
      const t = this.counterTech(th);
      if (t) {
        this.stats.counters++;
        this.startAttack(t, 'counter', { noFeint: true, skipChamber: true });
        return true;
      }
    }
    this.mode = 'defend';
    this.phase = 'guard';
    this.path.length = 0;
    this.stepT = 0;
    // 2) 간격 끝에서 오는 공격, 찌르기는 물러나 헛치게 한다 (피하기). 가까우면 칼로 막는다
    const edge = d > this.foeReach - 0.35;
    this.defVoid = Math.random() < (edge || th.thrust ? 0.8 : 0.3);
    if (this.defVoid) this.stats.voids++;
    else this.stats.parries++;
    this.timer = 0.55;
    return true;
  }

  defend(dt, s, d) {
    const L = this.level;
    this.timer -= dt;
    if (this.timer < 0.4 && this.seize(s, d, dt)) return;
    const p = PARRY[this.defLine] || G.langort;
    this.hand.set(p[0], p[1]);
    this.handSpeed = this.defVoid ? L.parrySpeed * 0.6 : L.parrySpeed;
    this.checkBind();
    // 공격이 지나갔다 → 상대가 다시 자세를 잡기 전에 되받아 친다 (Nach)
    if ((this.noThreat > 0.12 && this.timer < 0.35) || this.timer <= 0) {
      if (d < MEASURE.reach + 0.25 && d > MEASURE.clinch + 0.1 && this.foe.alive && Math.random() < L.followUp) {
        this.startAttack(this.pickTech(s, 'recover'), 'riposte', { noFeint: true });
      } else this.startWithdraw(0.6);
    }
  }

  /** 맞받아 베기에 쓸 기술: 들어오는 줄에 맞서 가운데를 차지하며 베는 기술 (지금 손에서 가까운 것) */
  counterTech(th) {
    const hand = [this.me.handOffset.x, this.me.handOffset.y];
    const names = th.line === 'highR' ? ['zornhauL', 'oberhau', 'zornhau'] : ['zornhau', 'oberhau', 'zornhauL'];
    let best = null;
    let bestD = 1e9;
    for (const n of names) {
      const t = TECH_BY_NAME[n];
      const cd = padDist(hand, t.from);
      if (cd < bestD) {
        bestD = cd;
        best = t;
      }
    }
    // 준비 자세가 너무 멀면 제때 못 친다 → 그냥 막는다
    return bestD < 0.3 ? best : null;
  }

  // ───────────────────────── 위험 읽기 ─────────────────────────
  /**
   * 상대 칼끝·타격점이 지금 속도 그대로 0.45초 안에 내 몸(가슴 축 주위 0.55m 원통)에 닿는가.
   * 닿으면 { id, line(내 몸 어디로 오나), thrust }
   */
  threat(s, c, r, d) {
    if (d > this.foeReach + 0.9) return null;
    let hit = null;
    for (let k = 0; k < 2; k++) {
      const px = k ? s.mx : s.tx;
      const py = k ? s.my : s.ty;
      const pz = k ? s.mz : s.tz;
      const vx = k ? s.mvx : s.tvx;
      const vy = k ? s.mvy : s.tvy;
      const vz = k ? s.mvz : s.tvz;
      const sp = Math.hypot(vx, vy, vz);
      if (sp < 3.5) continue;
      const rx = px - c.x;
      const ry = py - c.y;
      const rz = pz - c.z;
      const vh2 = vx * vx + vz * vz;
      const tc = clamp(vh2 > 1e-3 ? -(rx * vx + rz * vz) / vh2 : 0, 0, 0.45);
      const hx = rx + vx * tc;
      const hy = ry + vy * tc;
      const hz = rz + vz * tc;
      if (Math.hypot(hx, hz) > 0.55 || hy < -1.3 || hy > 0.75) continue;
      if (!hit || tc < hit.tc) hit = { tc, hx, hy, hz, vx, vy, vz, sp };
    }
    if (!hit) return null;
    if (this.noThreat > 0.25) this.threatId++; // 잠깐 조용했다가 다시 오면 새 공격
    const lat = hit.hx * r.x + hit.hz * r.z; // + = 내 오른쪽
    // 찌르기: 칼끝이 칼날 방향으로 곧게 움직인다
    const bx = s.tx - s.mx;
    const by = s.ty - s.my;
    const bz = s.tz - s.mz;
    const along = (bx * hit.vx + by * hit.vy + bz * hit.vz) / ((Math.hypot(bx, by, bz) || 1) * hit.sp);
    const thrust = along > 0.75;
    let line;
    if (thrust) line = 'thrust';
    else if (hit.hy > -0.1) line = lat > 0.12 ? 'highR' : lat < -0.12 ? 'highL' : 'highC';
    else line = lat >= 0 ? 'lowR' : 'lowL';
    return { id: this.threatId, line, thrust };
  }

  /**
   * 치려는 낌새: 간격 가까이에서 손을 빠르게 들어 올리거나(준비), 칼을 든 채 빠르게 다가온다.
   * 먼저 읽은 검객은 그 순간을 친다(Vor: 칼을 드는 순간은 빈틈) — 아니면 한 걸음 물러나 헛치게 한다.
   */
  preThreat(s, d, dt) {
    const L = this.level;
    const closing = Math.max(0, this.foeClosing);
    const raising = s.hvy > 1.6 && s.hy > 0.05; // 칼을 들어 올린다 (준비)
    const charging = closing > 0.9; // 달려든다
    const near = d < this.foeReach + closing * 0.4 + 0.3;
    if (!near || (!raising && !charging)) {
      this.preOff += dt;
      if (this.preOff > 0.3) this.preArmed = true;
      return false;
    }
    this.preOff = 0;
    if (!this.preArmed) return false;
    this.preArmed = false; // 한 번 몰아칠 때 한 번만 판단한다
    if (Math.random() > L.guardChance) return false; // 못 읽었다
    // 달려드는 상대는 물러나도 따라잡힌다 (뒷걸음이 더 느리다) → 들어오는 순간을 맞받아 벤다 (Vor).
    // 제자리에서 칼을 드는 상대는 한 걸음 물러나 헛치게 하거나, 드는 순간을 먼저 친다
    const strike = charging ? Math.random() < 0.45 + 0.5 * L.read : d < MEASURE.reach + 0.3 && Math.random() < L.counter + 0.15;
    if (strike) {
      const t = this.pickTech(s, 'stepin');
      if (t) {
        this.stats.preempts++;
        return this.startAttack(t, 'stop', { noFeint: true, fastChamber: true });
      }
    }
    this.stats.voids++;
    this.startWithdraw(0.5);
    return true;
  }

  // ───────────────────────── 손과 발 ─────────────────────────
  /** 손을 목표 쪽으로 제한 속도로 옮긴다 (AI가 순간적으로 칼을 옮기지 못하게) */
  moveHand(dt) {
    const off = this.me.handOffset;
    const striking = this.mode === 'attack' && this.phase === 'strike' && this.path.length > 0;
    let tx = this.hand.x;
    let ty = this.hand.y;
    if (striking) {
      tx = this.path[0][0];
      ty = this.path[0][1];
      // 상대가 옆으로 비껴 있으면 그만큼 손을 옮겨 겨눈다
      tx = clamp(tx + clamp(this.foeLat, -0.4, 0.4) * 0.5, -0.6, 0.6);
    }
    const dx = tx - off.x;
    const dy = ty - off.y;
    const dd = Math.hypot(dx, dy);
    const step = this.handSpeed * dt;
    if (dd > step) {
      off.x += (dx / dd) * step;
      off.y += (dy / dd) * step;
    } else {
      off.set(tx, ty);
      if (striking) {
        this.path.shift();
        // 속임수의 가짜 부분이 끝났다 → 이제 진짜로 내디디며 친다
        if (this.feintPts > 0 && --this.feintPts === 0) this.stepT = this.stepTime();
      }
    }
    if (off.length() > 0.62) off.setLength(0.62);
  }

  /** 발놀림: 간격 조절, 옆으로 돌기, 베며 내딛기, 물러나기 */
  moveFeet(dt, d) {
    const me = this.me;
    const L = this.level;
    let fwd = 0;
    let side = 0;
    const speed = BODY.moveSpeed;
    // 원하는 "다가가는 빠르기"(m/s, + = 다가감) → 조이스틱 값 (뒤로는 75% 빠르기)
    const toStick = (v) => (v >= 0 ? v / speed : v / (speed * 0.75));
    if (this.mode === 'attack') {
      if (this.phase === 'windup') {
        // 준비하는 동안 간격 끝까지 다가간다 (이미 가까우면 멈춤)
        const want = MEASURE.reach + 0.2;
        fwd = d > want ? clamp((d - want) * 1.5, 0.25, 0.8) : 0;
      } else if (this.phase === 'approach') {
        // 성큼성큼이 아니라 미끄러지듯 (빨리 달려들면 베는 동안 멈추지 못하고 상대 몸에 부딪친다).
        //  상대가 다가오고 있으면 제자리에서 기다린다 (뒤로 살짝 당겨 검술 층의 자동 내딛기도 막는다)
        const gap = this.contactDist() - (this.need ?? MEASURE.contact);
        fwd = this.foeClosing > 0.5 ? -0.21 : gap > 0 ? clamp(gap * 3, 0.25, 0.45) : 0;
      } else {
        // 손이 먼저, 발이 뒤따른다. 이미 가까우면 내딛지 않는다 (몸이 부딪친다)
        if (this.stepDelay > 0) this.stepDelay -= dt;
        else if (this.stepT > 0) {
          this.stepT -= dt;
          if (d > MEASURE.contact - 0.1) {
            fwd = 1;
            this.gaitStep();
          }
        }
        // 내디딜 필요가 없으면 멈춰 선다 (다가오던 관성으로 상대 몸에 부딪치지 않게).
        //  뒤로 살짝 당기면 검술 층의 자동 내딛기(skill.js)도 걸리지 않는다
        if (this.stepT <= 0 && this.stepDelay <= 0) fwd = d < MEASURE.contact ? -0.5 : -0.21;
        if (d < MEASURE.clinch) fwd = -0.7; // 너무 붙으면 베며 물러난다
        // 달려드는 상대를 맞받아 벨 때는 옆으로 비켜 선다 (상대 칼이 지나가는 줄에서 벗어난다)
        if (this.why === 'stop') side = this.pers.circleDir * 0.6;
      }
    } else if (this.mode === 'withdraw') {
      // 간격 밖까지 물러난다. 가까워질수록 천천히 (관성으로 너무 멀리 가지 않게)
      //  (-0.2보다 더 당겨야 검술 층이 손 움직임을 휘두르기로 보고 앞으로 내딛지 않는다)
      fwd = Math.min(-0.25, toStick(clamp((d - this.holdDist() - 0.05) * 3, -1.9, -0.3)));
    } else if (this.mode === 'defend') {
      fwd = this.defVoid ? -1 : -0.3; // 막을 때도 살짝 물러선다 (앞으로 쏠리지 않게)
    } else {
      // 간 보기: 상대 칼이 닿는 거리 바로 밖을 지킨다
      const hold = this.holdDist();
      const err = d - hold;
      // 멀면 걸어서 다가가고, 간격 가까이에선 발끝으로 조금씩 파고든다 (성큼 들어가면 상대 칼에 걸린다)
      let v = clamp(err * 1.6, -1.9, d > hold + 0.5 ? 1.2 : 0.18);
      v -= Math.max(0, this.foeClosing) * L.discipline; // 상대가 다가오면 그만큼 물러난다
      if (Math.abs(err) < 0.12 && Math.abs(this.foeClosing) < 0.3) {
        // 제자리: 잔걸음으로 들어갔다 빠졌다 (리듬)
        this.shuffleTimer -= dt;
        if (this.shuffleTimer <= 0) {
          this.shuffleTimer = rand(0.5, 1.2);
          this.shuffle = Math.random() < 0.5 ? 0 : rand(-0.3, 0.18);
        }
        v = this.shuffle;
      }
      fwd = toStick(v);
      // 옆으로 돌기 (가끔 방향을 바꾸고 가끔 멈춘다)
      this.circleTimer -= dt;
      if (this.circleTimer <= 0) {
        this.circleTimer = rand(0.8, 2.2);
        const x = Math.random();
        this.circle = x < 0.3 ? 0 : (x < 0.8 ? this.pers.circleDir : -this.pers.circleDir) * this.pers.circleRate;
      }
      if (d < hold + 0.6) side = this.circle;
    }
    // 너무 붙음 → 떨어진다 (밀쳐내기는 fighter.shove가 뒤로 물러날 때 자동으로)
    if (d < MEASURE.clinch && this.mode !== 'attack') {
      fwd = -1;
      side = side || this.pers.circleDir * 0.5;
    }
    // 울타리에 몰리면 옆으로 빠져 가운데로 (구석에 갇히지 않게)
    const a = me.bodies.pelvis.translation();
    const rA = Math.hypot(a.x, a.z);
    if (rA > 4.6 && !(this.mode === 'attack' && this.phase === 'strike')) {
      const f = me.forward(_v2);
      const r = me.right(_v1);
      const outBack = -(a.x * f.x + a.z * f.z) / rA; // 등이 울타리 쪽이면 +
      const toCenter = -(a.x * r.x + a.z * r.z) / rA; // 가운데가 내 오른쪽이면 +
      const k = clamp((rA - 4.6) * 1.2, 0, 1);
      if (fwd < 0 && outBack > 0.3) fwd *= 1 - k * 0.8; // 뒤로는 더 못 간다
      side = side * (1 - k) + Math.sign(toCenter || 1) * k;
      if (this.mode === 'watch') this.patience = Math.max(0, this.patience - dt * 0.15 * k); // 몰렸으면 먼저 친다
    }
    if (!this.foe.alive) fwd = side = 0;
    me.move.set(clamp(side, -1, 1), clamp(fwd, -1, 1));
  }

  /** 새 다리(gait.js)가 있으면 베는 걸음을 부탁한다 (없으면 조이스틱 내딛기로 충분) */
  gaitStep() {
    const g = this.me.gait;
    if (this.requestedStep || !g?.requestStep || !g.active) return;
    this.requestedStep = true;
    g.requestStep({ kind: this.tech?.kind === 'thrust' ? 'lunge' : 'pass', fwd: 0.6, hold: 0.3 });
  }
}

// ── 도우미 ──
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _a0 = new THREE.Vector3();
const _b0 = new THREE.Vector3();
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _r = new THREE.Vector3();

/** 두 선분(p1-q1, p2-q2) 사이 가장 가까운 거리 */
function segDist(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1);
  _d2.subVectors(q2, p2);
  _r.subVectors(p1, p2);
  const a = _d1.dot(_d1);
  const e = _d2.dot(_d2);
  const f = _d2.dot(_r);
  if (a < 1e-9 || e < 1e-9) return _r.length();
  const b = _d1.dot(_d2);
  const c = _d1.dot(_r);
  const den = a * e - b * b;
  let sN = den > 1e-9 ? clamp((b * f - c * e) / den, 0, 1) : 0;
  let tN = (b * sN + f) / e;
  if (tN < 0) {
    tN = 0;
    sN = clamp(-c / a, 0, 1);
  } else if (tN > 1) {
    tN = 1;
    sN = clamp((b - c) / a, 0, 1);
  }
  return Math.hypot(p1.x + _d1.x * sN - p2.x - _d2.x * tN, p1.y + _d1.y * sN - p2.y - _d2.y * tN, p1.z + _d1.z * sN - p2.z - _d2.z * tN);
}
