// AI 대 AI 롱소드 싸움에서 AI 가 고른 기술 이름을 센다 (가로 베기 zwerch 가 나오는가) — node tech_count.mjs --root=<나무> [판 수]
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const root = resolve(process.argv.find((a) => a.startsWith('--root='))?.slice(7) ?? '.');
const H = await import(pathToFileURL(join(root, 'tools/sim/harness_m.mjs')).href);
const N = +(process.argv.find((a) => /^\d+$/.test(a)) ?? 6); const c = {};
for (let s = 3001; s < 3001 + N; s++) { const G = H.newRound({ walls: true, seed: s, weapon: 'longsword', AI2Class: H.AI }); const last = new Map();
  for (let k = 0; k < 30 / H.DT; k++) { G.step(); for (const a of [G.ai, G.ai2]) { const t = a.tech; if (t && t !== last.get(a)) { c[t.name] = (c[t.name] ?? 0) + 1; } last.set(a, t); } }
  try { G.world.free(); } catch { /* */ } }
console.log(JSON.stringify(c));
