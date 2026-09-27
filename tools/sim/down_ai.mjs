// AI 가 쓰러진 상대를 마무리하는가 — 측정 도구
//  플레이어를 여러 방향으로 쓰러뜨려(일어나지 못하게) 두고, 적 AI 를 평소대로 움직인다.
//  정해진 시간 안에 AI 가 쓰러진 플레이어에게 상처(베기·찌르기)를 냈는지, 처음 상처까지 걸린 시간, 휘두른 횟수를 센다.
//  사용법: node tools/sim/down_ai.mjs [판 수(방향마다)] [적 무기 id] [초]
import { newRound, DT } from './harness_m.mjs';

const FALLS = { toward: 0, away: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }; // 플레이어 기준 (적 쪽 = 앞)

export function aiTrial({ fall, seed, weapon2, secs = 8, gap = 2.2 }) {
  const G = newRound({ walls: false, gap, seed, weapon2 });
  const P = G.player;
  const E = G.enemy;
  P.knockDown(true);
  P.downTime = 1e9;
  const a = FALLS[fall] + (Math.random() - 0.5) * 0.5;
  const J = 40 * (1 + (Math.random() - 0.5) * 0.4);
  let first = null;
  let swings = 0;
  let wasAttack = false;
  const t0 = G.t;
  for (let i = 0; i < (secs + 2.5) / DT; i++) {
    if (i * DT < 0.25) for (const k of ['chest', 'head']) P.bodies[k].applyImpulse({ x: Math.cos(a) * J * DT * 4, y: 0, z: Math.sin(a) * J * DT * 4 }, true);
    P.move.set(0, 0);
    G.step();
    const att = G.ai.mode === 'attack' && G.ai.phase === 'strike';
    if (att && !wasAttack) swings++;
    wasAttack = att;
    if (first == null && G.wounds.some((w) => w.att === E && (w.type === 'cut' || w.type === 'stab') && w.severity > 0)) first = G.t - t0;
  }
  const ws = G.wounds.filter((w) => w.att === E);
  return { fall, first, swings, wounds: ws.filter((w) => w.type !== 'blunt' && w.severity > 0).length, blunt: ws.filter((w) => w.type === 'blunt').length, dead: P.state === 'dead' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const N = +(process.argv[2] || 4);
  const weapon2 = process.argv[3] || undefined;
  const secs = +(process.argv[4] || 8);
  const rows = [];
  for (const fall of Object.keys(FALLS)) for (let s = 1; s <= N; s++) rows.push(aiTrial({ fall, seed: 900 + s * 7 + fall.length * 100, weapon2, secs }));
  const hit = rows.filter((r) => r.first != null);
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : '-');
  console.log(`적 무기 ${weapon2 ?? 'longsword'} · 방향마다 ${N}판 · ${secs}초 안`);
  for (const fall of Object.keys(FALLS)) {
    const rs = rows.filter((r) => r.fall === fall);
    console.log(`${fall.padEnd(7)} 상처 낸 판 ${rs.filter((r) => r.first != null).length}/${rs.length} · 첫 상처 ${avg(rs.filter((r) => r.first != null).map((r) => r.first))}초 · 휘두름 ${avg(rs.map((r) => r.swings))} · 상처 ${avg(rs.map((r) => r.wounds))} · 멍 ${avg(rs.map((r) => r.blunt))} · 죽음 ${rs.filter((r) => r.dead).length}`);
  }
  console.log(`전체: 상처 낸 판 ${hit.length}/${rows.length} (${Math.round((100 * hit.length) / rows.length)}%) · 첫 상처까지 평균 ${avg(hit.map((r) => r.first))}초 · 휘두름당 상처 ${(rows.reduce((a, r) => a + r.wounds, 0) / Math.max(1, rows.reduce((a, r) => a + r.swings, 0))).toFixed(2)} · 죽음 ${rows.filter((r) => r.dead).length}/${rows.length}`);
  console.log(JSON.stringify(rows));
}
