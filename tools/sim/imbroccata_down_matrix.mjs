// 내려 찌르기(I7 · 10/31) 긋기 방향 × 시작 높이 표 — 머리 없는 판 (60 fps 손가락: 2 물리 스텝마다 한 번 · special_balance fingerBot 과 같은 먹임) · docs/strike/italian_swap_2026-10-31.md §3
// 브라우저 판(tools/browser/italian_swap_shots.mjs down)과 같은 시작 자리 · 길이 · 방향 + → · ↗ · 실행: V=4 REPS=4 node tools/sim/imbroccata_down_matrix.mjs (ROWS=1 이면 획마다)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';

const STARTS = { high: 0.28, mid: 0.06, low: -0.18 };
const DIRS = { '↓': [0, -1], '↙': [-0.7071, -0.7071], '↘': [0.7071, -0.7071], '←': [-1, 0], '→': [1, 0], '↑': [0, 1], '↗': [0.7071, 0.7071] };
const L = 0.34;
const REPS = +(process.env.REPS ?? 4);
const V = +(process.env.V ?? 4);
const rows = [];
let seed = 1;
for (const [hn, hy] of Object.entries(STARTS)) for (const [dn, d] of Object.entries(DIRS)) for (let rep = 0; rep < REPS; rep++) {
  const G = newRound({ walls: true, seed: seed++, weapon: 'rapier', weapon2: 'longsword', persona: { proficiency: 4 } });
  const P = G.player, D = G.enemy;
  G.ai.update = () => {};
  D.applyWound = () => {};
  P.applyWound = () => {};
  const uq = new PlayerUniqueAssist(P, { names: new Set(['imbroccata']) });
  const log = [];
  const det = uq.detect.bind(uq);
  uq.detect = (...a) => { const b = uq.cur; const r = det(...a); if (uq.cur && uq.cur !== b) log.push({ tech: uq.cur.tech, kind: uq.cur.kind, pad: uq.cur.pad, dir: uq.cur.dir.map((x) => +x.toFixed(2)), unique: uq.cur.unique }); return r; };
  const FRAME = 2 * DT;
  const frames = [];
  let fx = P.handOffset.x, fy = P.handOffset.y;
  const to = (p, vel, held) => { for (let k = 0; k < 600; k++) { const dx = p[0] - fx, dy = p[1] - fy, dd = Math.hypot(dx, dy); if (dd < 1e-6) break; const st = Math.min(dd, vel * FRAME); fx += (dx / dd) * st; fy += (dy / dd) * st; frames.push([(dx / dd) * st, (dy / dd) * st, held]); } };
  // 1 s 서서 기다린 뒤 시작 자리로 (휘두르기 문턱 아래 빠르기) · 4 프레임 멈춤 · 긋기
  for (let i = 0; i < 60; i++) frames.push([0, 0, false]);
  const sx = (rep % 2 ? -0.12 : 0.12) * (dn === '↓' ? 1 : 0.5);
  let mark = 0;
  const go = () => { fx = P.handOffset.x; fy = P.handOffset.y; to([sx, hy], CONFIG.SKILL.recoverSpeed, false); for (let i = 0; i < 4; i++) frames.push([0, 0, false]); mark = frames.length; to([sx + d[0] * L, hy + d[1] * L], V, true); for (let i = 0; i < 40; i++) frames.push([0, 0, false]); };
  let step = 0, fed = 0, built = false, n0 = 0, l0 = 0, startHand = null;
  while (G.t < 4) {
    if ((step++ & 1) === 0) {
      if (!built && fed >= 60) { frames.splice(fed); go(); built = true; }
      const f = frames[fed] ?? [0, 0, false];
      if (built && fed === mark) { n0 = uq.stats.fired.imbroccata ?? 0; l0 = log.length; startHand = [+P.handOffset.x.toFixed(2), +P.handOffset.y.toFixed(2)]; }
      fed++;
      const u = P.skill.uniq;
      u?.feed(f[0], f[1], FRAME, false);
      if (!(u ? (u.holdsHand ?? u.running) : false)) { P.handOffset.x += f[0]; P.handOffset.y += f[1]; }
      P.handHeld = f[2];
      if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) P.inputActive = true;
    }
    G.step();
    if (built && fed > frames.length + 5) break;
  }
  const strokes = log.slice(l0);
  rows.push({ start: hn, dir: dn, imb: (uq.stats.fired.imbroccata ?? 0) > n0, n: strokes.length, first: strokes[0] ?? null, startHand });
}
const by = {};
for (const r of rows) { const k = `${r.start} ${r.dir}`; by[k] ??= { n: 0, imb: 0, reads: 0 }; by[k].n++; if (r.imb) by[k].imb++; by[k].reads += r.n; }
console.log(`v ${V} pad m/s · 길이 ${L} · 시작 x ±0.12(↓) ±0.06`);
for (const [k, v] of Object.entries(by)) console.log(k.padEnd(8), `imb ${v.imb}/${v.n}`, `긋기 읽힘 ${(v.reads / v.n).toFixed(1)}/획`);
if (process.env.ROWS) for (const r of rows) console.log(JSON.stringify(r));
