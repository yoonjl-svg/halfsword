// ─────────────────────────────────────────────────────────────
//  거점전 AI — 편의 자리 나눔 (사장님 11/21 거점전 · 설계 docs/design/saengsa_3v3_2026-11-21.md §3-5 'AI 판단' · 기록 docs/strike/capture_mode_2026-11-21.md)
//   사람 편 AI · 상대 AI 같은 규칙. 읽는 것 = 사람에게 보이는 것: 거점 주인 · 쥐는 중인 편 · 남은 초(capture.js) · 우리 편 몸 자리 · 산 상대 수 (벽 너머 적 자리는 안 읽음)
//   자리 나눔 (편마다 CAPTURE_AI.every 초마다 · 우리 편 몸과 자리의 걷는 길 합이 가장 작게):
//    - 상대가 두 거점을 다 쥐고 시계가 돌면: 셋 넘게 남았으면 모두 가까운 거점 하나로(몰아 뺏기) · 둘 이하면 거점마다 하나
//    - 하나: 우리 것이 아닌 가까운 거점 (둘 다 우리 것이면 상대가 쥐는 중인 곳 · 아니면 가까운 곳) — 다만 하나 대 하나면 상대가 두 거점을 다 쥐었을 때만 거점으로 · 그 밖엔 상대와 싸움
//    - 둘: 거점마다 하나
//    - 셋: 둘 + 하나 — 둘은 우리 것이 아닌 거점(하나만 그렇다면 그곳 · 둘 다면 상대가 쥐었거나 쥐는 중인 곳 · 아니면 가까운 곳) · 하나는 다른 거점
//   사람 몸은 AI 가 아니니 가장 가까운 거점 자리를 먼저 차지한 것으로 셈하고 AI 가 나머지를 메운다.
//   몸마다 가는 법 · 싸우는 중이면 맡기는 것은 field_route.js captureSteer.
// ─────────────────────────────────────────────────────────────
import { pointBody } from './capture.js';

export const CAPTURE_AI = Object.freeze({
  every: 0.25, // 자리 나눔을 다시 셈하는 사이 (게임 초)
  stay: 4, // 지금 맡은 거점을 바꾸려면 걷는 길 합이 이만큼(m) 넘게 줄어야 (두 거점 사이에서 떨지 않게)
  mass: 3, // 상대가 두 거점을 다 쥐었을 때 이 수 이상 남았으면 모두 한 거점으로
  // 몸마다 (field_route.js captureSteer):
  engage: 1.5, // 서 있는 상대가 내 칼끝 + 이만큼(m) 안이면 싸움에 맡김 (거점으로 가려고 등을 보이며 베이지 않게)
  threat: 2.5, // 그 상대가 나를 겨누고 있으면 이만큼(m)
  downed: 0.4, // 쓰러진 상대는 칼끝 + 이만큼 안일 때만 (마저 치기)
  inside: 0.4, // 원 테두리에서 이만큼(m) 안쪽까지 들어가 섬
  press: 5, // 싸우는 중이어도 맡은 원이 우리 것이 아니거나(빔 · 상대 것) 상대가 두 거점을 다 쥐었으면, 원 가운데가 이만큼(m) 안일 때 상대를 본 채 원으로 밀고 들어감 (원 밖에서 간만 보다 시계를 내주지 않게)
});

const pelvis = (f) => f.bodies.pelvis.translation();
/** 걷는 길 길이 (막이 너머면 길목을 거쳐 — 지도 꼴 pathLen) */
const walk = (F, f, P) => F.pathLen(pelvis(f), P);

/** 이 편이 채울 자리 (거점 번호 열 — 몸 수만큼) */
function slotsOf(C, team, n, near) {
  const other = 1 - team;
  const P = C.points;
  const notOurs = [0, 1].filter((i) => P[i].owner !== team);
  const pressed = (i) => P[i].owner === other || P[i].by === other; // 상대가 쥐었거나 쥐는 중
  if (C.holder === other) return n >= CAPTURE_AI.mass ? Array(n).fill(near) : Array.from({ length: n }, (_, k) => (near + k) % 2);
  if (n === 1) {
    if (notOurs.length === 1) return [notOurs[0]];
    const hot = [0, 1].filter(pressed);
    return [hot.length === 1 ? hot[0] : near];
  }
  if (n === 2) return [0, 1];
  let main = near;
  if (notOurs.length === 1) main = notOurs[0];
  else {
    const hot = [0, 1].filter(pressed);
    if (hot.length === 1) main = hot[0];
  }
  const out = [main, main, 1 - main];
  while (out.length < n) out.push(main);
  return out;
}

/** 몸 열과 자리 열을 짝지음 — 걷는 길 합이 가장 작은 짝 (지금 맡은 거점을 바꾸면 CAPTURE_AI.stay 만큼 비쌈) · 몸이 셋 이하라 모두 셈 */
function assign(F, points, bodies, slots, prev) {
  const n = bodies.length;
  const cost = bodies.map((f) => [0, 1].map((i) => walk(F, f, points[i]) + (prev.has(f) && prev.get(f) !== i ? CAPTURE_AI.stay : 0)));
  let best = null, bestC = Infinity;
  const perm = (k, used, acc, c) => {
    if (c >= bestC) return;
    if (k === n) { bestC = c; best = acc.slice(); return; }
    for (let j = 0; j < slots.length; j++) {
      if (used & (1 << j)) continue;
      acc.push(slots[j]);
      perm(k + 1, used | (1 << j), acc, c + cost[k][slots[j]]);
      acc.pop();
    }
  };
  perm(0, 0, [], 0);
  return best ?? [];
}

/** 편 자리 나눔 다시 셈 → C.plan[team] = { t, goal: Map(몸 → 거점 번호) } */
function replan(C, F, f) {
  const team = f.team;
  const members = [f, ...(f.mates ?? [])].filter(pointBody).sort((a, b) => a.index - b.index);
  const foesN = (f.foes ?? []).filter((g) => g.alive).length;
  const prev = C.plan?.[team]?.goal ?? new Map();
  const goal = new Map();
  // 하나 대 하나: 상대가 두 거점을 다 쥐고 시계가 돌 때만 거점으로(멈추러) — 그 밖엔 맡은 거점 없이 상대와 싸움 (서로 다른 다리로 엇갈려 거점만 바꿔 쥐며 끝나지 않는 판을 막음)
  const duel = members.length === 1 && foesN === 1 && C.holder !== 1 - team;
  if (members.length && foesN && !duel) {
    // 우리 편 가운데 자리 → 가까운 거점 (몰아 가기 · 하나 남았을 때)
    let sx = 0, sz = 0;
    for (const m of members) { const p = pelvis(m); sx += p.x; sz += p.z; }
    const c = { x: sx / members.length, z: sz / members.length };
    const d = [0, 1].map((i) => F.pathLen(c, C.points[i]));
    const near = d[0] <= d[1] ? 0 : 1;
    let slots = slotsOf(C, team, members.length, near);
    // 사람 몸: 가장 가까운 거점을 맡은 것으로 (AI 가 나머지를 메움)
    const humans = members.filter((m) => m.human);
    for (const h of humans) {
      const i = walk(F, h, C.points[0]) <= walk(F, h, C.points[1]) ? 0 : 1;
      goal.set(h, i);
      const j = slots.indexOf(i);
      slots = j >= 0 ? slots.filter((_, k) => k !== j) : slots.slice(1);
    }
    const ais = members.filter((m) => !m.human);
    assign(F, C.points, ais, slots, prev).forEach((i, k) => goal.set(ais[k], i));
  }
  (C.plan ??= [null, null])[team] = { t: C.t, goal };
}

/** 이 AI 가 맡은 거점 번호 (없으면 −1) — 편 자리 나눔을 CAPTURE_AI.every 초마다 다시 셈 */
export function captureGoal(C, F, f) {
  const plan = C.plan?.[f.team];
  if (!plan || C.t - plan.t >= CAPTURE_AI.every - 1e-9 || !plan.goal.has(f)) replan(C, F, f);
  return C.plan[f.team].goal.get(f) ?? -1;
}
