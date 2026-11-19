// ─────────────────────────────────────────────────────────────
//  혼자 싸움 판단 (11/19 사장님 '고수 한 명이 하수 두 명을 이기는 방법은 존재해야 하고, 그래야 의외성이 생겨. 그러려면 단체전 지능의 격차가 존재하거나
//   1:1에서 숙련도별 격차가 확실히 존재해야 함.' — 기록 docs/strike/lone_master_2026-11-19.md · 값 config LONE)
//
//  셋 이상 판(판 사본 me.teamSense)에서 '수가 밀림' — 내 동료와 붙지 않은 서 있는 적 둘 이상이 내 둘레(LONE.range m)에 있을 때만 일한다.
//  규칙 · 몸은 그대로 — 판단만 (사람도 같은 몸으로 할 수 있는 것: 둘째 적의 칼끝에서 한 걸음 비켜 섬). 판 사본을 그 몸의 층 눈(늦음 · 시야)으로 읽는다. 난수를 부르지 않는다.
//  몫 w = 숙련 곡선 MINDSET.profF (본 유파 숙련 6 = 1 · 5 = 0.94 · 4 = 0.75 · 3 = 0.44 · 2 이하 0 — 높을수록 잘함)
//   둘째 칼끝 밖   (마음가짐 줄에 many.out 이 있는 유파만 — 지금 일본 1.5 · 이탈리아 0) 둘째(겨눈 상대 말고 가장 가까운 떨어진 적)가 그 칼끝 + LONE.out 안이면 그 몸에서 멀어지는 쪽으로
//                  스틱 LONE.outK × w × (1 − (1 − many.out) × w) × (가까울수록 · 1 까지) —
//                  치러 오기 전에 (TEAM_FIGHT.lever.evade 는 그 적이 치는 중에만 · 줄 세우기 lineUp 은 겨눈 상대를 축으로 돎 — 이것은 둘째 칼끝에서 물러섬)
//  다적의 자리 (유파 마음가짐 many — 11/19 [사장님 결정] '다수전에 특별히 강한 유파 = 일본' · 무사시 『오륜서』 물의 권 多敵の位: 적들을 한 줄로 꿰고 먼저 오는 적부터 치며 멈춰 서지 않는다):
//   마음가짐 줄에 many 가 있는 유파(지금 일본만)가 수가 밀리면 ai.manyGo = w —
//   기다리지 않음(ai.tsFree — 고노센 준비 제자리 · 고노센 지킴 · 일본 서 있기 jpStill 0) · 공격 문턱 − many.press × w(먼저 닿는 적을 몰아침) ·
//   줄 세우기 — 둘째가 겨눈 상대에게서 벌어진 각만큼 겨눈 상대를 축으로 돌아 둘째를 그 뒤로(옆 스틱 many.line × w × min(1, 각 ÷ 0.8 rad) — TEAM_FIGHT.lever.lineUp 과 같은 꼴 위에 더함)
//   둘째 칼끝 밖 더 세게 — many.out 1.5 (아래 결투 고집과 같은 곱 1 − (1 − 값) × w — 1 보다 크면 셈)
//  결투 고집 (유파 마음가짐 many.lever · many.out · many.fix — 11/19 [사장님 결정] '이탈리아가 … 적어도 하위가 되도록'): 수가 밀려도 한 적과의 찌르기 거리 싸움 —
//   둘러싸임 비켜 서기(TEAM_FIGHT.flank) · 줄 세우기 · 피하기(TEAM_FIGHT.lever — ai.js teamFeet) 몫과 둘째 칼끝 밖 몫을 1 − (1 − 값) × w 로 (이탈리아 lever 0 · out 0 → 숙련 6 은 둘째를 보고 걷지 않음) ·
//   상대 바꿈 기다림(TEAM_FIGHT.target hold · attackHold — targeting.js)을 1 + fix × w 배로 (fix 20 — 겨눈 상대가 쓰러지기 전엔 거의 안 바꿈)
//  재어 본 것 (11/19 · 기록 §5): 둘째 칼끝 밖을 다섯 유파 모두에 (고른 판 셋 칸 합 −2 점 — 없음과 같아 일본 마음가짐에만) · 쉼 문턱을 올리기 · 둘째가 못 닿을 때 몰아침 / 둘 다 닿을 때 아낌은 넣지 않음
// ─────────────────────────────────────────────────────────────
import { LONE } from './config.js';
import { manyProfW, manyMul } from './ai_mindset.js'; // 결투 고집 곱 · 숙련 몫 (수가 밀릴 때 · 동료가 있을 때 한곳 — 11/19)
import { viewOf, busyWithOther } from './team_sense.js';
import { sameSide } from './team.js';

/** 숙련 몫 w (본 유파 숙련도 — 판단의 격차 · ai_mindset.js manyProfW — 결투 고집의 '동료가 있을 때' 몫과 한곳) */
export const loneW = manyProfW;

/**
 * 수가 밀리나 (스텝마다 한 번 셈 — ai.loneS): { w, n(둘레의 떨어진 적 수), d2 · r2(둘째까지 거리 · 그 칼끝) · x2 · z2(둘째 쪽 단위 벡터) } 또는 null.
 *  둘째 = 겨눈 상대 말고 가장 가까운 떨어진 적 (판 사본 장 — 내 눈에 보이는 몸만)
 */
export function loneOf(ai) {
  const now = ai.sense?.t ?? 0;
  if (ai.loneT === now) return ai.loneS;
  ai.loneT = now;
  ai.loneS = null;
  const w = loneW(ai);
  const v = w > 0 && ai.foe ? viewOf(ai) : null;
  if (!v) return null;
  const S = ai.me.teamSense;
  let n = 0;
  let best = null;
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || sameSide(S.fighters[v.i], S.fighters[j])) continue;
    const g = v.fr.b[j];
    if (!g.live || !g.stand || !v.sees(j) || busyWithOther(S, v.fr, v.i, j)) continue;
    const x = g.x - v.me.x;
    const z = g.z - v.me.z;
    const d = Math.hypot(x, z);
    if (d > LONE.range) continue;
    n++;
    if (j === ai.foe.index || d < 1e-6) continue;
    if (!best || d < best.d2) best = { d2: d, r2: g.reach, x2: x / d, z2: z / d };
  }
  if (n < 2 || !best) return null;
  const t = v.fr.b[ai.foe.index];
  const dt = Math.hypot(t.x - v.me.x, t.z - v.me.z) || 1;
  return (ai.loneS = { w, n, ...best, xt: (t.x - v.me.x) / dt, zt: (t.z - v.me.z) / dt });
}

/** 다적의 자리 몫 (ai.js updateCombat — 스텝마다 ai.manyGo): 마음가짐 줄에 many.go 가 있고(일본) 수가 밀리면 w · 아니면 0 */
export function manyW(ai) {
  if (!ai.mind?.many?.go) return 0;
  const L = loneOf(ai);
  return L ? L.w : 0;
}

/** 결투 고집 곱 (마음가짐 many.lever · many.out — 이탈리아 · 없으면 1): 1 − (1 − 값) × w (숙련이 높을수록 유파다움 — 2 이하 1) · 셈은 ai_mindset.js (동료가 있을 때 many.ally 와 한곳) */
export { manyMul };

/**
 * 결투 고집 — 겨눈 상대 붙듦 (마음가짐 many.fix · 이탈리아 · targeting.js chooseTarget): 수가 밀리면 상대 바꿈 기다림
 *  (TEAM_FIGHT.target.hold · attackHold — '나를 치는 적으로 돎'도)을 1 + fix × w 배로 · 아니면 1 (사람 · 1:1 · 수가 안 밀림 · 다른 유파)
 */
export function fixHoldK(f) {
  const ai = f.aiCtl;
  const fix = ai?.mind?.many?.fix;
  if (!fix || !f.teamSense) return 1;
  const L = loneOf(ai);
  return L ? 1 + fix * L.w : 1;
}

/** 둘째 칼끝 밖 · 다적의 자리 줄 세우기 (ai.js teamFeet 끝 — 베는 중 · 비기 빼고): 스틱 (fwd 앞 · side 오른쪽)을 고쳐 돌려준다 */
export function loneFeet(ai, fwd, side) {
  const L = loneOf(ai);
  if (!L) return [fwd, side];
  const h = ai.me.heading;
  const fx = Math.cos(h);
  const fz = -Math.sin(h);
  const St = (ai.stats.lone ??= { out: 0, line: 0 });
  if (ai.manyGo > 0) {
    const ang = (x, z) => Math.atan2(x * -fz + z * fx, x * fx + z * fz); // 내 눈 기준 각 (오른쪽 +)
    let da = ang(L.x2, L.z2) - ang(L.xt, L.zt);
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    side -= Math.sign(da || 1) * ai.mind.many.line * ai.manyGo * Math.min(1, Math.abs(da) / 0.8); // 둘째가 겨눈 상대보다 오른쪽이면 왼쪽으로 돌아 둘째를 그 뒤로
    St.line++;
  }
  if (ai.mind?.many?.out == null) return [fwd, side]; // 둘째 칼끝 밖은 마음가짐 줄에 many.out 이 있는 유파만 (11/19 고른 판: 다섯 유파 모두에 걸면 셋 칸 합 −2 점 — 없음과 같음 · 기록 §4)
  const gap = L.d2 - L.r2; // 둘째 칼끝까지 남은 길 (− = 칼끝 안)
  if (gap >= LONE.out) return [fwd, side];
  const k = LONE.outK * L.w * manyMul(ai, 'out') * Math.min(1, (LONE.out - gap) / LONE.out);
  St.out++;
  return [fwd - k * (L.x2 * fx + L.z2 * fz), side - k * (L.x2 * -fz + L.z2 * fx)]; // 오른쪽 = (−앞.z, 앞.x) — fighter.right
}
