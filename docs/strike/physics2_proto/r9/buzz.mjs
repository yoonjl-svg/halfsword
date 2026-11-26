// 떨림 찾기 (읽기만): 몸 토막마다 각속도가 스텝마다 뒤집히는가 (바로 앞 스텝과 반대 방향 · 크기 비슷 = 두 스텝 주기 떨림)
//  node buzz.mjs --root=<나무> --weapon=longsword [--scene=stand|walk]
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const G = H.newRound({ walls: false, weapon: String(args.weapon ?? 'longsword'), seed: 7 });
G.park?.(); const P = G.player; const DT = 1 / 120; const scene = String(args.scene ?? 'stand');
const B = { ...P.bodies, sword: P.sword }; const prev = {}, st = {};
const n = Math.round(7 / DT);
for (let i = 0; i < n; i++) {
  if (scene === 'walk') P.move.set(0, 1); else P.move.set(0, 0);
  G.step(); if (i < 3 / DT) continue;
  for (const k in B) { const b = B[k]; if (!b) continue; const w = b.angvel(); const p = prev[k]; const s = (st[k] ||= { n: 0, flip: 0, osc: 0, mean: 0 });
    if (p) { const half = { x: (w.x - p.x) / 2, y: (w.y - p.y) / 2, z: (w.z - p.z) / 2 }; // 두 스텝 주기 성분의 크기 = |w(t) − w(t−1)| / 2
      const o = Math.hypot(half.x, half.y, half.z); const m = Math.hypot((w.x + p.x) / 2, (w.y + p.y) / 2, (w.z + p.z) / 2); s.n++; s.osc += o; s.mean += m; if (w.x * p.x + w.y * p.y + w.z * p.z < 0 && o > 0.5) s.flip++; }
    prev[k] = { x: w.x, y: w.y, z: w.z }; }
}
const out = Object.entries(st).map(([k, s]) => [k, s.osc / s.n, s.mean / s.n, s.flip / s.n]).sort((a, b) => b[1] - a[1]);
console.log(`${String(args.weapon ?? 'longsword')} · ${scene}: 토막마다 [스텝마다 뒤집히는 각속도 성분 rad/s · 두 스텝 평균 각속도 · 뒤집힌 스텝 몫]`);
console.log('   ' + out.filter((r) => r[1] > 0.05).map(([k, o, m, f]) => `${k} ${o.toFixed(2)}·${m.toFixed(2)}·${(100 * f).toFixed(0)}%`).join('  '));
