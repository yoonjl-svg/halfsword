// ─────────────────────────────────────────────────────────────
//  한 판의 물리 스텝 차례 — 1:1 · 2:1 · 2:2 같은 길 (동시 대전 1단계 배관, 사장님 10/29 14:2x 생사전 ·
//  docs/strike/team_fight_2026-10-29.md)
//
//  지금(1단계)은 시뮬 하니스(tools/sim/jelly_harness.mjs newMatch)만 부른다. main.js 의 스텝 고리는 아직 제 줄 그대로이고
//  (3단계에서 이 함수로 바꾼다) 차례는 그 고리와 똑같다:
//   ① 상대 · 바라볼 곳   f.foe = foeOf(f) · f.faceTarget = 상대 골반 · AI 의 겨눈 상대(ai.setFoe — 1:1 은 늘 같아 아무 일 없음)
//   ② 조종               1 편 → 0 편, 편 안에서 자리 차례, 사람 몸(human)의 조종은 맨 뒤 (orderControllers)
//   ③ 몸                 자리 차례로 f.step → (hooks.afterFighters) → 자리 차례로 f.cacheState
//   ④ 물리 · 전투        world.step → combat.afterStep → (hooks.afterWorld)
//  1:1 의 상대 고르기 = 다른 하나 (산 · 죽음 상관없이 — 예전 그대로). 셋 이상은 임시 짝(pairFoe) — 2단계에서 상대 고르기로 바꾼다
// ─────────────────────────────────────────────────────────────
import { sameSide, teamOfIndex } from './team.js';

/**
 * 판 하나를 묶는다. o = { world, eventQueue, combat, fighters(자리 차례 — fighters[i].index === i), controllers([{ me, update(dt), setFoe?(f) }] — AI 들), foeOf?(f, M) }
 *  돌려줌 M = { ...o, order(조종 부르는 차례), t }. 판 도중에 조종을 바꾸면 M.order = orderControllers(M.controllers)
 */
export function createMatch(o) {
  const M = { foeOf: null, controllers: [], ...o, t: 0 };
  M.fighters.forEach((f, i) => {
    if (f.index !== i) throw new Error(`match: fighters[${i}].index = ${f.index}`);
  });
  M.order = orderControllers(M.controllers);
  return M;
}

/**
 * 조종 부르는 차례: 1 편 먼저, 편 안에서는 자리 차례, 사람 몸(human)을 조종하는 것은 맨 뒤.
 *  1:1 시뮬(fights12 — 상대 AI 다음에 자리 0 을 모는 AI)과 main.js(상대 AI 다음에 플레이어 비기 창 · 막기 단추)의 지금 차례와 같다.
 *  AI 를 만드는 차례도 이 차례로 한다 (AI 생성자의 Math.random 차례 — jelly_harness newMatch)
 */
export function orderControllers(list) {
  const key = (c) => (c.me.human ? 100 : 0) + (1 - c.me.team) * 10 + c.me.index;
  return list.map((c, i) => [c, i]).sort((a, b) => key(a[0]) - key(b[0]) || a[1] - b[1]).map(([c]) => c);
}

/** f 의 상대 편 싸움꾼들 (자리 차례) */
export function foesOf(M, f) {
  return M.fighters.filter((g) => !sameSide(g, f));
}

/** 같은 편 (자기 빼고, 자리 차례) */
export function matesOf(M, f) {
  return M.fighters.filter((g) => g !== f && sameSide(g, f));
}

/** 가장 가까운(가슴 수평 거리) 상대. alive 면 산 상대만 — 없으면 null */
export function nearestFoe(M, f, { alive = true } = {}) {
  const c = f.bodies.chest.translation();
  let best = null;
  let bd = Infinity;
  for (const g of M.fighters) {
    if (sameSide(g, f) || (alive && !g.alive)) continue;
    const p = g.bodies.chest.translation();
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < bd) (bd = d), (best = g);
  }
  return best;
}

/**
 * 기본 상대 고르기. 둘뿐이면 다른 하나 (1:1 — 예전 그대로). 셋 이상이면 임시 짝 (1단계 — 상대 고르기는 2단계):
 *  마주 선 짝(자리 0 ↔ 1 · 2 ↔ 3)이 살아 있으면 그 짝, 아니면 가장 가까운 산 상대, 모두 죽었으면 지금 상대 그대로
 */
export function pairFoe(f, M) {
  const F = M.fighters;
  if (F.length === 2) return F[1 - f.index];
  const mate = F[f.index ^ 1];
  if (mate && mate.alive && !sameSide(mate, f)) return mate;
  return nearestFoe(M, f) ?? f.foe ?? nearestFoe(M, f, { alive: false });
}

/** 편마다 서 있는(산) 싸움꾼 수 [0 편, 1 편] — 판 끝(한 편이 0)은 2단계 */
export function standing(M) {
  const n = [0, 0];
  for (const f of M.fighters) if (f.alive) n[f.team]++;
  return n;
}

/**
 * 시작 자리 (평지 · 원점 둘레). teams[i] = 자리 i 의 편 (안 주면 자리의 홀짝). 0 편은 x = −gap/2 에서 +x 를, 1 편은 +gap/2 에서 −x 를 본다.
 *  한 편에 둘이면 옆(z)으로 mateGap 만큼 벌린다 — 편 안 첫째(자리 0 · 1)가 −z 쪽이라 0 ↔ 1 · 2 ↔ 3 이 마주 선다. 혼자면 z 0 (1:1 은 예전 자리 그대로)
 */
export function spawnSpots(count, { gap, mateGap, teams = null } = {}) {
  const team = (i) => (teams ? teams[i] : teamOfIndex(i));
  const size = [0, 0];
  for (let i = 0; i < count; i++) size[team(i)]++;
  const seen = [0, 0];
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = team(i);
    const k = seen[t]++;
    const z = size[t] > 1 ? (k - (size[t] - 1) / 2) * mateGap : 0;
    out.push({ x: t === 0 ? -gap / 2 : gap / 2, z, heading: t === 0 ? 0 : Math.PI, team: t });
  }
  return out;
}

/**
 * 물리 한 스텝 (위 ①~④). hooks(모두 없어도 됨):
 *  faceOf(f, M) → 바라볼 점 (없으면 상대 골반) · afterControl(M, dt) — 조종 뒤 몸 전 (main.js 플레이어 비기 창 · 막기 단추 · 시뮬 G.before) ·
 *  afterFighters(M, dt) — 몸 스텝 뒤 cacheState 전 (main.js tickDebris) · afterWorld(M, dt) — 전투 뒤 (용암 화상 · 칼 잔상 띠)
 */
export function stepMatch(M, dt, hooks = {}) {
  const F = M.fighters;
  const foeOf = M.foeOf || pairFoe;
  // ① 상대 · 바라볼 곳 (모두 정한 뒤 바라볼 곳 — 1:1 의 예전 차례)
  for (const f of F) f.foe = foeOf(f, M);
  for (const f of F) {
    const t = hooks.faceOf?.(f, M) ?? f.foe?.bodies.pelvis.translation();
    if (t) f.faceTarget = t;
  }
  for (const c of M.order) if (c.setFoe && c.me.foe && c.foe !== c.me.foe) c.setFoe(c.me.foe);
  // ② 조종
  for (const c of M.order) c.update(dt);
  hooks.afterControl?.(M, dt);
  // ③ 몸
  for (const f of F) f.step(dt);
  hooks.afterFighters?.(M, dt);
  for (const f of F) f.cacheState();
  // ④ 물리 · 전투
  M.world.step(M.eventQueue, M.combat.physicsHooks);
  M.combat.afterStep(M.world, M.eventQueue);
  hooks.afterWorld?.(M, dt);
  M.t += dt;
}
