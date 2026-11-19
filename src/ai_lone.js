// ─────────────────────────────────────────────────────────────
//  혼자 싸움 판단 (11/19 사장님 '고수 한 명이 하수 두 명을 이기는 방법은 존재해야 하고, 그래야 의외성이 생겨. 그러려면 단체전 지능의 격차가 존재하거나
//   1:1에서 숙련도별 격차가 확실히 존재해야 함.' — 기록 docs/strike/lone_master_2026-11-19.md · 값 config LONE)
//
//  셋 이상 판(판 사본 me.teamSense)에서 '수가 밀림' — 내 동료와 붙지 않은 서 있는 적 둘 이상이 내 둘레(LONE.range m)에 있을 때만 일한다.
//  규칙 · 몸은 그대로 — 판단만 (사람도 같은 몸으로 할 수 있는 것: 둘째 적의 칼끝에서 한 걸음 비켜 섬). 판 사본을 그 몸의 층 눈(늦음 · 시야)으로 읽는다. 난수를 부르지 않는다.
//  몫 w = 숙련 곡선 MINDSET.profF (본 유파 숙련 6 = 1 · 5 = 0.94 · 4 = 0.75 · 3 = 0.44 · 2 이하 0 — 높을수록 잘함)
//   둘째 칼끝 밖   둘째(겨눈 상대 말고 가장 가까운 떨어진 적)가 그 칼끝 + LONE.out 안이면 그 몸에서 멀어지는 쪽으로 스틱 LONE.outK × w × (가까울수록 · 1 까지) —
//                  치러 오기 전에 (TEAM_FIGHT.lever.evade 는 그 적이 치는 중에만 · 줄 세우기 lineUp 은 겨눈 상대를 축으로 돎 — 이것은 둘째 칼끝에서 물러섬)
//  재어 본 것 (11/19): 쉼 문턱을 올리기(지친 몫은 반 — 이김은 그대로) · 둘째가 못 닿을 때 몰아침 / 둘 다 닿을 때 아낌(이김 바뀜 없음)은 넣지 않음 — 기록 §2
// ─────────────────────────────────────────────────────────────
import { LONE, MINDSET } from './config.js';
import { viewOf, busyWithOther } from './team_sense.js';
import { sameSide } from './team.js';

/** 숙련 몫 w (본 유파 숙련도 — 판단의 격차) */
export function loneW(ai) {
  const p = Math.max(0, Math.min(6, Math.round(ai.mainProficiency ?? ai.proficiency ?? 2)));
  return MINDSET.profF[p] ?? 0;
}

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
  return (ai.loneS = { w, n, ...best });
}

/** 둘째 칼끝 밖 (ai.js teamFeet 끝 — 베는 중 · 비기 빼고): 스틱 (fwd 앞 · side 오른쪽)을 고쳐 돌려준다 */
export function loneFeet(ai, fwd, side) {
  const L = loneOf(ai);
  if (!L) return [fwd, side];
  const gap = L.d2 - L.r2; // 둘째 칼끝까지 남은 길 (− = 칼끝 안)
  if (gap >= LONE.out) return [fwd, side];
  const k = LONE.outK * L.w * Math.min(1, (LONE.out - gap) / LONE.out);
  const h = ai.me.heading;
  const fx = Math.cos(h);
  const fz = -Math.sin(h);
  (ai.stats.lone ??= { out: 0 }).out++;
  return [fwd - k * (L.x2 * fx + L.z2 * fz), side - k * (L.x2 * -fz + L.z2 * fx)]; // 오른쪽 = (−앞.z, 앞.x) — fighter.right
}
