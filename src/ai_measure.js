// ─────────────────────────────────────────────────────────────
//  간격과 박자 · 오코리 (11/17 — 사장님 '난 정말 현실적 전투를 원해' · '현실 검술에선 휘두름을 미리 파악해서 막기도 해' · '1과 2 함께 진행해' ·
//   '지금 준비 동작이 없어서 막지 못한다는 생각도 드는데 … 어떤 방향으로 휘두르기 위해 그 반대 방향으로 몸이나 팔을 움직여야 하는데')
//  config MEASURE · OKORI · [사장님 11/17 결정] 'A~E 기본으로 옮기고' — 기본 판 · 기록 docs/strike/measure_okori_2026-11-17.md · 옮긴 기록 docs/strike/ae_port_2026-11-17.md
//
//  ① 간격과 박자 (MEASURE)
//   선 = 상대 칼끝 어림(ai.foeReach — 늦게 본 거리와 같은 잣대) + 유파 여유(gap). 독일은 칼이 붙어 있는 동안(bindT 안) 선이 없다.
//   · 간 보기: holdDist 의 바닥 = 선 + 옛 최소 여유 0.08 · 간 보기 걸음이 앞으로 갈 때 선 + 0.08 안이면 0 (잔걸음이 기어 들지 않음 — 물러남 · 옆 돌기는 그대로)
//   · 칼이 안 붙은 채 끝난 주고받기 뒤 물러남은 선 밖까지 (withdraw 끝 조건)
//   · 새 공격: 선 − deep 보다 깊은 안에서 칼이 자유로운 채 여는 공격은 띠 기울기만큼 참음 (참 빈틈 DISC_OPEN 은 그대로 — ai.js startAttack)
//   · 박자 걸음: 다가감에서 남은 거리(contactDist − 칠 거리)가 0.3 ~ step m 이면 미끄러져 걷는 대신 기술 걸음 하나로 들어감 → 그 걸음 중에 칼이 나감(옛 '닿을 거리' 셈 그대로)
//   · 막는 쪽 읽기: 상대가 내 선 + 0.3 안으로 0.45 m/s 넘게 들어오면(늦게 본 모습) 들어옴 하나에 한 번 read × 띠 기울기 →
//     칼이 있으면 줄 닫기(막기 2.0 미리 줄 닫기 — anticGo) · 빈손이면 물러남
//  ② 오코리 (OKORI) — 칼보다 먼저 움직이는 몸 · 반대로 감았다 푸는 준비
//   · 공격을 고르면(비기 · 이어 치기 · 흐름 · 맞받아 베기처럼 칼이 이미 움직이는 것 · 헛스윙 연습 빼고) 띠의 T 동안 칼이 나가지 않고 몸이 먼저 감긴다:
//     손 = 준비 자리(기술 from) 너머 베기 방향의 반대로 lift × 크기 (손이 이미 준비 자리면 그 너머 몫 × 굴림 몫 luckOf — 높은 띠는 이미 실린 자세에서 곧장: 숨김) ·
//     어깨 · 몸통 = 베기 가로 방향의 반대로 감기(turn × 크기 × 가로 몫) · 숙임 · 낮춤 · 무게를 앞발로(front)
//   · 몸 장치: 몸 목표(fighter.okoriBody → updateBodyPose 의 골반 · 가슴 · 숙임 · 낮춤 — 자세표 덧씌우기와 같은 꼴) · 선 몸의 무게 자리(fighter.okoriFront → gait) · 손 목표(ai.hand)
//   · 보이는 크기(fighter.okoriVis — 몸 목표가 따라가는 것과 같은 2차 거르기)를 AI 눈이 늦게 본 모습으로 읽음 (ai_sense.js s.okori)
//   · 읽기: preThreat 의 '칼 듦' 낌새에 둘을 더함 — (가) 보이는 오코리 ≥ 띠 문턱(see) 이고 그 오코리에 한 번 굴린 read × 띠 기울기 (나) 느린 감기 — 손이 자세 바깥쪽으로
//     windV 넘게 가는데 칼끝은 휘두름 문턱 3.5 m/s 밑 (어느 쪽으로 감든 — 칼 듦은 위로 1.6 m/s 만 봄). 늦게 본 모습 그대로 · 사람 몸에도 같은 (나)
//   · 사람 몸에는 오코리 덧씌우기 · 늦춤이 없다 — AI 는 사람에게서 (가)를 못 읽고 사람 몸이 실제로 보이는 (나) · 칼 듦 · 걸음만 읽음
// ─────────────────────────────────────────────────────────────
import { MEASURE, OKORI, AI_PLAN, SKILL_BODY } from './config.js';
import { tiltOf, bandOf, luckOf } from './ai_plan.js';
import { bladesTouch } from './secret.js';

const tilt = (ai, k) => k * tiltOf(ai.proficiency ?? 2);
const roll = (p) => p >= 1 || (p > 0 && Math.random() < p);
/** 패드 자리를 반지름 0.6 안으로 (손 목표 한도 0.62 — ai.js moveHand — 안쪽이라야 준비가 끝남) */
const inPad = (x, y) => {
  const r = Math.hypot(x, y);
  return r > 0.6 ? [(x * 0.6) / r, (y * 0.6) / r] : [x, y];
};

/** 재기 칸 (AI 하나에 한 번) */
export function msStats() {
  return { inRoll: 0, inHold: 0, tempo: 0, enter: 0, read: 0, close: 0, back: 0, okori: 0, okoriT: 0, okSeen: 0, okRead: 0, chamberSeen: 0 };
}
const ST = (ai) => (ai.stats.ms ??= msStats());

// ───────────────────────── ① 간격과 박자 ─────────────────────────

/** 매 스텝 (updateCombat): 독일 칼 붙음 시각 */
export function msTick(ai) {
  if (ai.art?.tradition === 'german' && bladesTouch(ai.me, ai.foe)) ai.msBindT = ai.sense.t;
}

/** 선 (가슴 사이 m) — 없으면 −Infinity: 빈손 상대 쫓기 · 쓰러진 상대 · 헛스윙 연습 · 내 칼 없음 · 독일이 칼을 붙이고 있음 */
export function msLine(ai) {
  if (ai.chasing || ai.Mup || ai.drillOut || !ai.me.armed) return -Infinity;
  const tr = ai.art?.tradition;
  if (tr === 'german' && ai.msBindT != null && ai.sense.t - ai.msBindT <= MEASURE.bindT) return -Infinity;
  const G = MEASURE.gap;
  return ai.foeReach + (G[tr] ?? G.other);
}

/** holdDist 바닥 — 선 + 옛 최소 여유 0.08 */
export function msHold(ai, h) {
  const L = msLine(ai);
  return L > -Infinity ? Math.max(h, L + 0.08) : h;
}

/** 간 보기 걸음 (moveFeet watch — 유파 플랜 걸음 앞): 앞으로 가려는데 선 + 0.08 안이면 0 (물러남은 그대로) */
export function msFeetV(ai, v, d) {
  if (!(v > 0)) return v;
  const L = msLine(ai);
  return L > -Infinity && d < L + 0.08 ? 0 : v;
}

/** 물러남이 끝나는 거리 (withdraw — 시간이 다 된 뒤): 옛 내 칼끝 거리 · 선 가운데 먼 쪽 */
export function msWdEnd(ai) {
  return Math.max(ai.M.reach, msLine(ai));
}

/** 이어 치기 마음 (afterStrike — 칼이 안 붙은 채 끝난 주고받기): want × (1 − out × 띠 기울기) — 낮은 띠는 그대로 몰아침(행운) · 높은 띠는 선 밖으로 빠져 다시 박자를 잼 */
export function msChainWant(ai, want) {
  return want * (1 - tilt(ai, MEASURE.out));
}

/** 새 공격 문 (startAttack — 참 빈틈 · 이어 치기 · 비기 · 패시브 · 헛스윙 연습 빼고): 선 − deep 보다 깊은 안이면 AI_PLAN.beat 마다 한 번 굴려 참음 → true */
export function msInsideHold(ai) {
  const L = msLine(ai);
  if (!(L > -Infinity) || !(ai.d < L - MEASURE.deep)) return false;
  const t = ai.sense.t;
  const S = ST(ai);
  if (!(t - (ai.msInT ?? -Infinity) < AI_PLAN.beat)) {
    ai.msInT = t;
    ai.msInOk = roll(tilt(ai, MEASURE.inside));
    S.inRoll++;
  }
  if (ai.msInOk) S.inHold++;
  return ai.msInOk;
}

/** 공격 시작 (startAttack 끝): 박자 걸음 칸을 비움 */
export function msAttackStart(ai) {
  ai.msStep = null;
}

/** 다가감 · 준비의 발 (moveFeet 공격 꼴): 박자 걸음 — 남은 거리 0.3 ~ step 이면 기술 걸음 하나 · 그동안 스틱 앞 끝 (못 받으면 다음 스텝에 다시) */
export function msTempoFeet(ai, fwd, gap, dt) {
  const T = ai.msStep;
  if (T) {
    T.t += dt;
    return T.t < T.T ? 1 : fwd;
  }
  if (ai.chasing || ai.secretRun || ai.drillAtk || ai.why === 'stop' || ai.sideStepT != null || ai.foeClosing > 0.5) return fwd;
  if (!(gap >= 0.3 && gap <= MEASURE.step)) return fwd;
  const g = ai.me.gait;
  if (!g?.requestStep || !g.active || ai.me.state !== 'stand') return fwd;
  const thrust = ai.tech?.kind === 'thrust';
  if (g.requestStep({ kind: thrust ? 'lunge' : 'pass', fwd: gap, hold: 0.3 })) {
    ai.msStep = { t: 0, T: g.req?.duration ?? 0.4 };
    ST(ai).tempo++;
    return 1;
  }
  return Math.max(fwd, 0); // 뒤로 당긴 스틱이면 걸음을 안 받음 — 이 스텝은 서서 다음 스텝에 다시
}

/** 준비의 발 (moveFeet windup): 한 걸음으로 닿을 거리면 그 자리에서 든다 — 옛 '제자리' 당김 −0.21 그대로 (검술 층이 빠른 준비 손을 휘두르기로 보고 저절로 내딛지 않게) · 들어감은 다가감 첫머리의 박자 걸음 */
export function msWindupFeet(ai, fwd, d, want) {
  return d <= want + MEASURE.step ? Math.min(fwd, -0.21) : fwd;
}

/**
 * 막는 쪽 — 상대가 내 선 안으로 걸어 듦 (watch 의 preThreat 앞): 들어옴 하나에 한 번 read × 띠 기울기 →
 *  칼이 있으면 줄 닫기(막기 2.0 미리 줄 닫기 — anticGo) · 빈손이면 물러남(0.4 s). 이 스텝을 맡았으면 true
 */
export function msRead(ai, s, d, dt, rearm) {
  const L = msLine(ai);
  const enter = L > -Infinity && ai.foeClosing > 0.45 && d < L + 0.3 && s.state === 'stand' && s.armed;
  if (!enter) {
    ai.msOff = (ai.msOff ?? 0) + dt;
    if (ai.msOff > rearm) ai.msArmed = true;
    return false;
  }
  ai.msOff = 0;
  if (ai.msArmed === false) return false;
  ai.msArmed = false;
  const S = ST(ai);
  S.enter++;
  if (!roll(tilt(ai, MEASURE.read))) return false;
  S.read++;
  if (ai.me.armed) {
    ai.anticGo(s);
    S.close++;
    return true;
  }
  S.back++;
  ai.startWithdraw(0.4);
  return true;
}

// ───────────────────────── ② 오코리 ─────────────────────────

/** 공격 시작 (startAttack 끝 · 준비 · 다가감 꼴일 때): 오코리 칸 — 띠의 시간 · 크기 · 베기 방향의 반대 */
export function okoriStart(ai, opt) {
  ai.okori = null;
  if (opt.chain || opt.secret || opt.drill || opt.skipChamber || ai.secretRun || ai.me.iai || ai.me.iaiReq) return;
  if (ai.phase !== 'windup' && ai.phase !== 'approach') return;
  const t = ai.tech;
  if (!t?.from) return;
  const b = bandOf(ai.proficiency ?? 2);
  const T = OKORI.T[b] ?? 0;
  const A = OKORI.amp[b] ?? 0;
  if (!(T > 0) || !(A > 0)) return;
  const end = t.path?.length ? t.path[t.path.length - 1] : t.from;
  const dx = end[0] - t.from[0];
  const dy = end[1] - t.from[1];
  const n = Math.hypot(dx, dy);
  const cut = t.kind !== 'thrust' && n > 0.1;
  const hx = ai.me.handOffset.x - t.from[0];
  const hy = ai.me.handOffset.y - t.from[1];
  const loaded = Math.hypot(hx, hy) <= 0.06; // 준비 자리에 이미 있음 (startAttack 의 준비 건너뜀과 같은 0.06)
  const k = cut ? OKORI.lift * A * (loaded ? luckOf(ai.proficiency ?? 2) : 1) : 0; // 이미 실린 자세: 높은 띠는 감지 않음(숨김) · 낮은 띠는 그래도 감음
  ai.okori = {
    t: 0, T, A, done: false, loaded,
    bx: cut ? (-dx / n) * k : 0, by: cut ? (-dy / n) * k : 0, // 손: 준비 자리 너머 베기 반대쪽
    yaw: cut ? -(dx / n) : 0.5, // 몸통 감기 쪽 (자세표 몸 돌림 부호 — + = 칼 든 쪽 · 찌르기는 칼 든 어깨를 반만 뒤로)
  };
  const S = ST(ai);
  S.okori++;
  S.okoriT += T;
}

/** 준비 자리 (오코리 너머 몫을 더한 손 목표) — 오코리 없으면 기술 from 그대로 */
export function okoriFrom(ai, from) {
  const O = ai.okori;
  return O ? inPad(from[0] + O.bx, from[1] + O.by) : from;
}

/**
 * 공격 꼴 (attack — 준비 · 다가감 앞): 오코리 시간 동안 칼이 나가지 않고 손을 준비 자리 너머로 감음 (준비 빠르기 · 빠른 준비면 막기 손 빠르기).
 *  위협이 오면 준비 동안과 같이 받음. 시간이 다 되면 done — 옛 준비 · 다가감으로 (손은 그 너머 자리에 둔 채). 이 스텝을 맡았으면 true
 */
export function okoriTick(ai, dt, s, d, th) {
  const O = ai.okori;
  O.t += dt;
  if (th && !ai.actLocked && ai.noticedThreat(th) && !ai.planReck(th) && ai.respond(th, d)) return true;
  if (O.t >= O.T) {
    O.done = true;
    return false;
  }
  // 손: 준비 자리가 멀면 너머 자리까지 곧장 (옛 준비와 같은 손 — 감는 길이 곧 반대로 가는 몸짓) · 이미 준비 자리면 너머 몫을 시간에 맞춰 천천히
  const fr = ai.tech.from;
  const e = O.loaded ? smooth(O.t / O.T) : 1;
  const p = inPad(fr[0] + O.bx * e, fr[1] + O.by * e);
  ai.hand.set(p[0], p[1]);
  const L = ai.level;
  ai.handSpeed = Math.min(OKORI.hand, ai.fastChamber ? L.parrySpeed : L.chamberSpeed); // 감는 손은 휘두르기 문턱(SKILL.swingSpeed 1.5) 밑 — 보이는 감기 · 검술 층이 휘두르기로 보고 저절로 내딛지 않음
  return true;
}

/** 칼이 나감 (startStrike) · 공격 꼴을 떠남: 오코리 끝 (몸은 따라가기로 풀림) */
export function okoriEnd(ai) {
  ai.okori = null;
}

const smooth = (x) => {
  const u = Math.max(0, Math.min(1, x));
  return u * u * (3 - 2 * u);
};

/**
 * 매 스텝 (updateCombat 앞): 몸 덧씌우기 · 무게 자리 · 보이는 크기.
 *  크기 a = A × 시간 몫(부드럽게 0 → 1) — 오코리가 끝나도 칼이 나갈 때까지 그대로 · 없으면 0. 보이는 크기는 몸 목표가 따라가는 것과 같은 2차 거르기(SKILL_BODY 가슴 × 자세 고칠 때 빠르기)
 */
export function okoriBody(ai, dt) {
  const me = ai.me;
  const O = ai.mode === 'attack' ? ai.okori : null;
  if (ai.okori && !O) ai.okori = null;
  const a = O ? O.A * (O.done ? 1 : smooth(O.t / O.T)) : 0;
  const w = SKILL_BODY.chest * SKILL_BODY.holdSpeed;
  me.okoriVel = (me.okoriVel ?? 0) + (w * w * (a - (me.okoriVis ?? 0)) - 2 * w * (me.okoriVel ?? 0)) * dt;
  me.okoriVis = Math.max(0, (me.okoriVis ?? 0) + me.okoriVel * dt);
  if (!O) {
    me.okoriBody = null;
    me.okoriFront = 0;
    return;
  }
  const B = (me.okoriBody ??= { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 });
  const yaw = O.yaw * OKORI.turn * a;
  B.chestYaw = yaw;
  B.pelvisYaw = yaw; // updateBodyPose 가 골반은 ½ 로 (자세표 몸 돌림과 같은 몫)
  B.pitch = OKORI.lean * a;
  B.drop = OKORI.drop * a;
  me.okoriFront = OKORI.front * a;
}

/** 발 (moveFeet 공격 꼴): 오코리 동안은 서서 무게만 옮김 → true */
export function okoriHold(ai) {
  return !!ai.okori && !ai.okori.done && (ai.phase === 'windup' || ai.phase === 'approach');
}

/**
 * 읽기 (preThreat 의 '칼 듦' 자리 — 늦게 본 모습 s): (가) 보이는 오코리 ≥ 띠 문턱 — 그 오코리에 한 번 read × 띠 기울기 굴림 ·
 *  (나) 느린 감기 — 손이 자세 바깥쪽으로 OKORI.windV 넘게 가는데 칼끝은 3.5 m/s 밑(휘두름 아님). 낌새면 true
 */
export function okoriCue(ai, s) {
  const S = ST(ai);
  const see = OKORI.see[bandOf(ai.proficiency ?? 2)] ?? 1;
  const ok = (s.okori ?? 0) >= see;
  let got = false;
  if (ok) {
    if (!ai.okSeenNow) {
      ai.okSeenNow = true;
      ai.okSeenOk = roll(tilt(ai, OKORI.read));
      S.okSeen++;
      if (ai.okSeenOk) S.okRead++;
    }
    got = ai.okSeenOk;
  } else ai.okSeenNow = false;
  const hr = Math.hypot(s.hx, s.hy);
  const out = hr > 1e-3 ? (s.hx * s.hvx + s.hy * s.hvy) / hr : 0;
  const wind = out > OKORI.windV && Math.hypot(s.tvx, s.tvy, s.tvz) < 3.5;
  if (wind && !got) S.chamberSeen++;
  return got || wind;
}
