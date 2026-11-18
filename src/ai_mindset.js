// ─────────────────────────────────────────────────────────────
//  유파 마음가짐 (가칭 · 11/18 — [사장님 11/18 승인] · 집요함 설계 [사장님 11/18 결정 '네 권고대로 하마'] ·
//   설계 docs/design/school_mindset_2026-11-18.md · 기록 docs/strike/school_mindset_2026-11-18.md)
//
//  다섯 항목 점수 → 손잡이. 값 표는 schools.js SCHOOL_MINDSET (끝 값 config MINDSET.knob — 점수 1 · 5 에서의 값, 사이는 곧은 줄).
//   선공 · 거리 · 일격 · 횡보 = 유파의 바탕 점수. 집요함 = 상대 상태에 반응해 그 넷을 바탕에서 얼마나 옮길 수 있나 — 폭 (집요함 − 1) × MINDSET.band 점
//   (일본 1 → 0 — 제 페이스 · 독일 ±0.5 · 이베리아 ±1 · 이탈리아 ±1.5 · 동방 ±2) · 옮긴 점수는 1 ~ 5 안.
//   사장님 11/18: '집요함은 상대의 상태에 반응하는 정도야. 출혈, 기력 회복 저하, 부상, 칼 떨어짐 등 모든 상태 이상이나 상대 전략(6초, 10초 기억)을 통해서
//                 나의 움직임이나 공격을 유리한 쪽으로 수정함.'
//
//  ① 상대 상태 읽기 (mindTick — 매 스텝 · 본 것만): 칼 떨어짐 · 지침(탈진 · 기력 낮음 · 기력 회복 저하 — 맹호은림 사냥 겹) · 출혈(나보다 더) · 다리 · 칼 팔 부상 ·
//     본 특수 공격(그 뒤 MINDSET.specialMem 동안 기억) · 본 비기(MINDSET.secretMem 동안) · 상대 비기가 남음(이 유파 · 이 몸이 아직 쓸 수 있음).
//     상태마다 세기 0 ~ 1 → MINDSET.ramp 로 부드럽게 따라감(들고 남이 끊기지 않게) → 항목마다 Σ 세기 × 미는 쪽(MINDSET.react) 을 −1 ~ 1 로 자름 × 폭 = 옮긴 점수.
//     쓰러짐 · 무릎 꿇음은 옛 끝내기 셈 그대로 (여기서 밀지 않음).
//  ② 옮긴 점수로 손잡이 (바탕 손잡이 + 기울기 × 옮긴 점수 — 기질 굴림 값(ai.pers)은 그 위에 옮긴 몫만 더함):
//     선공 mindAggr · mindPatienceT · mindNeed · mindOppK · mindAnsK — 공격 성향 · 참을성 · 공격 거는 문턱 · 먼저 치는 빈틈 / 받아 치는 몫 곱
//     거리 mindMargin · mindGap · mindCreep · mindGive — 간 보는 여유 · 선 여유(MEASURE.gap 대신 · 바닥) · 다가드는 잔걸음 · 다가오면 물러나는 몫
//     일격 mindReward → mindTechW · mindRiskK · mindChain — 입힐 피해와 받을 피해 가운데 무엇으로 판단하나 (기술 고르기 · 공격 절제 · 이어 치기)
//     횡보 mindCircle · mindSide · mindSideK — 간 보기 · 물러남 걸음 옆 몫을 목표(1 점 0 % · 5 점 50 %)로
//  마음가짐이 있는 몸은 옛 '상대 상태 반응'(피를 더 흘리는 상대엔 기다림 hurry cautious · 지친 상대 문턱 −0.2 / −0.45)을 쓰지 않는다 — 집요함이 갈음 (일본 = 반응 없음).
//  ai.mind 가 없는 몸(무유파 · 숙련도 0)은 이 파일의 셈을 하나도 안 탐 — 옛 셈 그대로.
//  굴림 없음 — 곱 · 문턱 · 지수 평균 · 옆 크기 제어만 (난수 차례는 옛 굴림 그대로 — 굴림 몫만 바뀜).
// ─────────────────────────────────────────────────────────────
import { MINDSET, SECRET } from './config.js';
import { SCHOOL_MINDSET } from './schools.js';
import { secretLeft, playerSecretOf } from './secret.js';
import { kitOff } from './skill_kit.js';
import { huntN } from './cn_hunt.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/** 항목 순서 (옮긴 점수 칸) */
export const AXES = Object.freeze(['initiative', 'distance', 'decisive', 'lateral']);
const AX = { initiative: 0, distance: 1, decisive: 2, lateral: 3 };
const SC = { initiative: 0, distance: 1, tenacity: 2, decisive: 3, lateral: 4 }; // SCHOOL_MINDSET.score 칸 차례
/** 손잡이 값 (점수 s — 소수 가능) */
export const knobAt = (k, s) => { const [a, b] = MINDSET.knob[k]; return a + ((b - a) * (s - 1)) / 4; };
/** 손잡이 기울기 (점수 1 점마다) */
const slope = (k) => (MINDSET.knob[k][1] - MINDSET.knob[k][0]) / 4;
/** 상태 이름 (MINDSET.react 칸 차례) */
export const STATES = Object.freeze(Object.keys(MINDSET.react));

/** 이 AI 의 마음가짐 줄 — 다섯 유파만 · 숙련도 0(무 — 기질도 무유파)이면 없음 (null → 모든 셈이 옛 셈) */
export function mindOf(tradition, proficiency, planOn = true) {
  if (planOn && proficiency === 0) return null;
  return SCHOOL_MINDSET[tradition] ?? null;
}

/** 집요함 폭 (점) */
export const bandOf = (M) => (M.score[SC.tenacity] - 1) * MINDSET.band;

// ───────── ① 상대 상태 읽기 ─────────
/** 상대가 아직 비기를 쓸 수 있나 (AI = 비기를 쥠 · 사람 = 열린 유파 비기 · 비기 칸 · 판당 쓸 수가 남음 — 고노센 읽기 gnsUser 와 같은 규칙) */
function foeSecretLeft(foe) {
  if (!foe || secretLeft(foe) <= 0) return false;
  if (foe.aiControlled) return !!foe.aiCtl?.secret;
  return SECRET.openSchools.includes(foe.swordArt?.tradition) && !!playerSecretOf(foe) && !kitOff(foe, 'secret');
}

/**
 * 상대 상태 세기 (지금 본 것 — 0 ~ 1): s = 늦게 본 상대 모습 (칼 쥠 · 서 있음) · 몸 표식(피 · 다리 · 팔 · 기력 막대 · 사냥 겹)은 화면에 보이는 것.
 *  본 특수 공격 · 비기는 낸 순간을 기억(ai.mindSeen) — 그 기억 창 안이면 1.
 */
export function foeStates(ai, s) {
  const foe = ai.foe, me = ai.me;
  const t = ai.sense.t;
  const out = ai.mindRaw ??= new Float64Array(STATES.length);
  out.fill(0);
  if (!foe?.alive) return out;
  const stand = s.state === 'stand';
  const I = (k, v) => { out[STATES.indexOf(k)] = clamp(v, 0, 1); };
  I('disarmed', stand && !s.armed ? 1 : 0);
  const st = foe.stamina;
  const hunt = Math.min(1, (huntN(foe) ?? 0) / 3); // 기력 회복 저하 (맹호은림 겹 — 3 겹이면 가득)
  I('tired', Math.max(st?.exhausted ? 1 : st?.level === 2 ? 0.7 : st?.level === 1 ? 0.4 : 0, 0.6 * hunt));
  const loss = (f) => 1 - f.blood + f.bleed * 8; // hurry() 와 같은 셈 (흘린 피 + 흐르는 빠르기)
  I('bleed', foe.bleed > 0.005 ? (loss(foe) - loss(me)) / 0.24 : 0);
  I('leg', (1 - foe.legHealth) / 0.5);
  I('arm', (1 - (foe.limbs?.armS ?? 1)) / 0.5);
  const S = ai.mindSeen;
  I('special', t - S.special < MINDSET.specialMem ? 1 : 0);
  I('secretUsed', t - S.secret < MINDSET.secretMem ? 1 : 0);
  I('secretReady', foeSecretLeft(foe) ? MINDSET.readyK : 0);
  return out;
}

/**
 * 매 스텝 (update — 상대 몸을 늦게 본 뒤): ① 상대 상태 세기 → 부드럽게 → 옮긴 점수 ② 횡보 — 고요한 꼴 동안 내 걸음 옆 · 앞뒤 몫 지수 평균.
 */
export function mindTick(ai, dt, s) {
  const M = ai.mind;
  if (!M) return;
  const pp = ai.me.bodies?.pelvis?.translation?.();
  if ((ai.mode === 'watch' || ai.mode === 'withdraw') && !ai.staminaRest && !(pp && Math.hypot(pp.x, pp.z) > 4.6)) {
    // 내가 고른 걸음 (기력 쉼 · 울타리 띠 빼고 — 물러나 숨 고르기 · 울타리 빠짐은 고른 걸음이 아님) (지난 스텝 스틱 옆 · 앞뒤 — 몸 흔들림 · 돌아섬 · 밀림이 아니라 고른 것)
    const a = Math.min(1, dt / MINDSET.latTau);
    const mv = ai.me.move;
    ai.mindLat = (ai.mindLat ?? 0) + (Math.abs(mv?.x ?? 0) - (ai.mindLat ?? 0)) * a;
    ai.mindRad = (ai.mindRad ?? 0) + (Math.abs(mv?.y ?? 0) - (ai.mindRad ?? 0)) * a;
  }
  // 상대 특수 공격 · 비기를 본 때 (몸 셈이 바뀐 스텝 + 반응 시간 — 보이고 나서야 앎)
  const foe = ai.foe;
  const S = (ai.mindSeen ??= { special: -Infinity, secret: -Infinity, nSp: foe?.specialN ?? 0, nSe: foe?.secretUsed ?? 0 });
  const t = ai.sense.t;
  if ((foe?.specialN ?? 0) !== S.nSp) (S.nSp = foe.specialN), (S.special = t + ai.level.reaction);
  if ((foe?.secretUsed ?? 0) !== S.nSe) (S.nSe = foe.secretUsed), (S.secret = t + ai.level.reaction);
  const band = M.band ?? bandOf(M);
  const sm = (ai.mindI ??= new Float64Array(STATES.length));
  const sh = (ai.mindShift ??= new Float64Array(AXES.length));
  if (!(band > 0)) return void sh.fill(0);
  const raw = foeStates(ai, s);
  const a = Math.min(1, dt / MINDSET.ramp);
  for (let i = 0; i < STATES.length; i++) sm[i] += (raw[i] - sm[i]) * a;
  for (let k = 0; k < AXES.length; k++) {
    let v = 0;
    for (let i = 0; i < STATES.length; i++) v += sm[i] * MINDSET.react[STATES[i]][k];
    const base = M.score[SC[AXES[k]]];
    sh[k] = clamp(base + band * clamp(v, -1, 1), 1, 5) - base;
  }
}

/** 옮긴 점수 (항목 이름) — 없으면 0 */
export const mindShiftOf = (ai, axis) => ai.mindShift?.[AX[axis]] ?? 0;
/** 지금 점수 (바탕 + 옮긴 점수) */
export const mindScore = (ai, axis) => ai.mind.score[SC[axis]] + mindShiftOf(ai, axis);

// ───────── ② 손잡이 ─────────
/** 선공 — 공격 성향 (기질 굴림 값 + 옮긴 몫) */
export const mindAggr = (ai) => ai.pers.aggr + slope('aggr') * mindShiftOf(ai, 'initiative');
/** 선공 — 참을성 실제 초 */
export const mindPatienceT = (ai) => Math.max(1, ai.pers.patienceTime + slope('patienceTime') * mindShiftOf(ai, 'initiative'));
/** 선공 — 공격 거는 문턱에 더할 몫 (watch need) */
export const mindNeed = (ai) => knobAt('need', mindScore(ai, 'initiative'));
/** 선공 — 빈틈 점수 곱 [먼저 치는 빈틈(참다 · 칼끝 비킴 · 다침 · 기우뚱), 받아 치는 빈틈(헛친 뒤 · 들어옴)] (opportunity — 쓰러진 상대는 1) */
export const mindOppK = (ai) => { const s = mindScore(ai, 'initiative'); return [knobAt('first', s), knobAt('answer', s)]; };
/** 선공 — 받아 치는 몫 곱 (헛친 뒤 붙잡기 seize · 맞받아 베기 respond · 달려듦 · 칼 듦 맞받기 preThreat): answer 손잡이 */
export const mindAnsK = (ai) => knobAt('answer', mindScore(ai, 'initiative'));
/** 거리 — 간 보는 여유 m (holdDist — 기질 굴림 값 + 옮긴 몫) */
export const mindMargin = (ai) => ai.pers.margin + slope('margin') * mindShiftOf(ai, 'distance');
/** 거리 — 간 보는 거리 가까이 다가드는 잔걸음 끝 m/s (moveFeet — 옛 0.18 · 가까이 서는 유파는 더 다가듦) */
export const mindCreep = (ai) => knobAt('creep', mindScore(ai, 'distance'));
/** 거리 — 상대가 다가오면 물러나는 몫 곱 (moveFeet — 옛 1 · 멀리 서는 유파는 더 · 가까이 서는 유파는 덜) */
export const mindGive = (ai) => knobAt('give', mindScore(ai, 'distance'));
/** 거리 — 간격과 박자 선 여유 m (ai_measure.js msLine — 마음가짐이 없으면 undefined → MEASURE.gap 그대로) */
export const mindGap = (ai) => (ai.mind ? knobAt('gap', mindScore(ai, 'distance')) : undefined);
/** 일격 — 입힐 피해로 판단하는 몫 0 ~ 1 */
export const mindReward = (ai) => clamp(knobAt('reward', mindScore(ai, 'decisive')), 0, 1);
/** 횡보 — 간 보기 걸음 옆 몫 목표 */
const mindLatShare = (ai) => clamp(knobAt('latShare', mindScore(ai, 'lateral')), 0, 0.5);

// ── 일격: 입힐 피해 · 받을 피해 ──
/**
 * 기술 하나의 입힐 피해 · 받을 피해 어림 (굴림 없음 — 내 칼 · 내 손 자리 · 기술 꼴만):
 *  입힐 피해 = 무기 배율(베기 mCut · 찌르기 mThrust ÷ 큰 쪽) × 칼을 드는 높이(1 + 준비 자리 높이 — 머리 위에서 내리는 칼이 무게 · 빠르기를 실음) × (눌러 베기 1.2) × (빠른 칼 0.6 — 짧게 든 칼)
 *  받을 피해 = 칼이 나를 덮지 못하는 길이 — 지금 손에서 준비 자리까지(cd) + 드는 높이 × ½ (빠른 칼은 × ½)
 *  둘 다 크게 드는 칼에서 큼 — 무엇으로 판단하나(입힐 피해 몫)가 큰 칼 · 작은 칼을 가름
 */
export function techStakes(ai, t, cd) {
  const cfg = ai.me.weaponCfg;
  const mc = cfg?.mCut ?? 1, mt = cfg?.mThrust ?? 1;
  const h = 1 + (t.from?.[1] ?? 0);
  const reward = ((t.kind === 'thrust' ? mt : mc) / Math.max(mc, mt, 1e-6)) * h * (t.presses ? 1.2 : 1) * (t.fast ? 0.6 : 1);
  const risk = (cd + 0.5 * h) * (t.fast ? 0.5 : 1);
  return [reward, risk];
}
/** 후보 기술들의 피해 어림 (pickTech 머리 — 한 번): { v: [[입힐, 받을] …], r · q: 후보 평균, k: 입힐 피해 몫 } · 마음가짐 없으면 null */
export function mindStakes(ai, techs, hand, padDist) {
  if (!ai.mind) return null;
  const v = techs.map((t) => (t ? techStakes(ai, t, padDist(hand, t.from)) : [0, 0]));
  const n = Math.max(1, techs.filter(Boolean).length);
  const r = v.reduce((a, x) => a + x[0], 0) / n || 1;
  const q = v.reduce((a, x) => a + x[1], 0) / n || 1;
  return { v, r, q, k: mindReward(ai) };
}
/** 기술 고르기 곱 (pickTech): e^(rewardK × (k × 입힐 ÷ 평균 − (1 − k) × 받을 ÷ 평균)) — 1 이면 입힐 피해만 · 0 이면 받을 피해만으로 판단 (큰 칼 덤은 따로 없음) */
export function mindTechW(stakes, i) {
  const [r, q] = stakes.v[i];
  return Math.exp(MINDSET.rewardK * (stakes.k * (r / stakes.r) - (1 - stakes.k) * (q / stakes.q)));
}
/** 공격 절제 몫 배율 (ai_intercept.js discHold · ai_measure.js msInsideHold): 2 × (1 − 입힐 피해 몫) — 받을 피해로 판단할수록 더 참음 (마음가짐 없으면 1) */
export const mindRiskK = (ai) => (ai.mind ? 2 * (1 - mindReward(ai)) : 1);
/** 이어 치기 마음 (afterStrike): × (1.4 − 0.8 × 입힐 피해 몫) — 받을 피해로 판단하면 지지 않는 작은 칼을 잇고 · 입힐 피해로 판단하면 끊고 다시 큰 칼 */
export const mindChain = (ai, want) => (ai.mind ? want * (1.4 - 0.8 * mindReward(ai)) : want);

// ── 횡보 ──
/**
 * 옆 돌기 박자 (moveFeet — 돌기 박자의 굴림 · 유파 플랜 몫 뒤): 목표 옆 몫 τ (지금 점수 — 1 점 0 · 5 점 0.5) 가 0 이면 돌지 않음.
 *  아니면 멈추지 않고 굴린 쪽(없으면 즐겨 도는 쪽)으로 기질 빠르기(circleRate + 옮긴 몫) — 크기는 mindSide 가 목표 몫에 맞춰 늘이고 줄임
 */
export function mindCircle(ai, circle) {
  const tau = mindLatShare(ai);
  if (!(tau > 0)) return 0;
  const dir = Math.sign(circle) || ai.pers.circleDir;
  return dir * Math.max(0.05, ai.pers.circleRate + slope('circleRate') * mindShiftOf(ai, 'lateral'));
}
/** 옆으로 도는 거리 더함 (moveFeet — 간 보는 거리 + 0.6 위로 m): 2 × 옆 몫 목표 (5 점은 1 m 더 먼 데서도 돎) */
export const mindCircleOut = (ai) => 2 * mindLatShare(ai);
/**
 * 간 보기 · 물러남 걸음의 옆 스틱 (moveFeet — 꼴마다 걸음을 정한 뒤 · 울타리 줄 앞): 목표 옆 몫 τ 가 0 이면 0.
 *  아니면 옆 크기 = (정한 옆 스틱 · 없으면 돌기 쪽 × 빠르기) × 크기 g — g 는 내 걸음 옆 몫 σ(지수 평균)가 τ 보다 모자라면 커지고 넘치면 작아짐 (처음 1.5 · 0 ~ 8 · latTau 마다 latGain × (τ − σ))
 *  → 옆 · 앞뒤 고름이 목표 몫 가까이 (5 점 = 앞뒤와 옆을 비슷하게)
 */
export function mindSide(ai, side, dt) {
  const tau = mindLatShare(ai);
  if (!(tau > 0)) return 0;
  const L = ai.mindLat ?? 0, R = ai.mindRad ?? 0;
  const sig = L + R > 1e-4 ? L / (L + R) : tau;
  ai.mindG = clamp((ai.mindG ?? 1.5) + (dt / MINDSET.latTau) * MINDSET.latGain * (tau - sig), 0, 8);
  const base = side || (Math.sign(ai.circle) || ai.pers.circleDir) * Math.max(0.05, ai.pers.circleRate);
  return clamp(base * ai.mindG, -1, 1);
}
/** 옆으로 비킬 몫 (moveFeet — 너무 붙었을 때 물러나며 옆으로): 지금 옆 몫 목표가 0 이면 곧게 물러남 */
export const mindSideK = (ai) => (ai.mind && !(mindLatShare(ai) > 0) ? 0 : 1);
