// 싸움 중 떨림 (읽기만): AI 대 AI 20 s — 토막마다 스텝마다 뒤집히는 각속도 성분의 평균 · 그 성분이 1 rad/s 넘는 스텝 몫
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const W = String(args.weapons ?? 'longsword,rapier,zweihander').split(','); const DT = 1 / 120; const st = {};
for (const w of W) for (const seed of [1, 2]) {
  const G = H.newRound({ walls: true, seed, weapon: w, AI2Class: H.AI });
  const prev = new Map();
  for (let i = 0; i < Math.round(20 / DT); i++) { G.step();
    for (const f of [G.player, G.enemy]) { if (f.state === 'dead') continue; const B = { uarmS: f.bodies.uarmS, farmS: f.bodies.farmS, sword: f.sword, uarmO: f.bodies.uarmO, chest: f.bodies.chest, thighF: f.bodies.thighF };
      for (const k in B) { const b = B[k]; if (!b) continue; const v = b.angvel(); const key = f === G.player ? 'P' + k : 'E' + k; const p = prev.get(key);
        if (p) { const o = Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z) / 2; const d = v.x * p.x + v.y * p.y + v.z * p.z; const s = (st[w + ' ' + k] ||= { n: 0, osc: 0, hi: 0 }); s.n++; if (d < 0) { s.osc += o; if (o > 1) s.hi++; } }
        prev.set(key, { x: v.x, y: v.y, z: v.z }); } } }
}
for (const w of W) console.log(`${w.padEnd(10)} ` + ['uarmS', 'farmS', 'sword', 'uarmO', 'chest', 'thighF'].map((k) => { const s = st[w + ' ' + k]; return `${k} ${(s.osc / s.n).toFixed(2)} rad/s·${(100 * s.hi / s.n).toFixed(0)}%`; }).join('  '));
