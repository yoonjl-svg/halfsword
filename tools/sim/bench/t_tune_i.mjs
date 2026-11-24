// t_tune_i.mjs — (i) 끝점 힘 방식의 이득 한 벌 고르기: 롱소드 · 땅 135 · 세 획 × 감기 둘 여섯 칸의 잣대 합이 가장 큰 벌. → gains_i.json
//   node t_tune_i.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRapier, HERE, fmt } from './lib.mjs';
import { runCut } from './cuts.mjs';
import { score } from './tune.mjs';
const R = await loadRapier();
const cells = []; for (const size of ['small', 'large']) for (const fam of ['diag', 'vert', 'horiz']) cells.push({ weapon: 'longsword', fam, size, yawCap: 135 });
const res = [];
for (const Kx of [800, 1500]) for (const Dx of [40, 80]) for (const Kth of [20, 40, 80]) for (const Dth of [4, 8]) for (const wnYaw of [12, 20]) for (const Ibrake of [3]) {
  const g = { Kx, Dx, Kth, Dth, wnYaw, Ibrake }; let J = 0; const per = [];
  for (const c of cells) { const r = runCut(R, { ...c, style: 'i', ...g, tEnd: 0.6 }); const j = score(r.sum, r.C); J += Math.max(j, -50); per.push(`${fmt(r.sum.cross?.v70 ?? NaN)}/${fmt(r.sum.cross?.dev ?? NaN, 2)}`); }
  res.push({ g, J, per });
}
res.sort((a, b) => b.J - a.J);
console.log('(i) 이득 고르기 — 위 8 벌 (칸: 작게 빗겨 · 세로 · 가로 · 크게 빗겨 · 세로 · 가로 = 겨눈 선 빠르기 m/s / 벗어남 m)');
for (const r of res.slice(0, 8)) console.log(`Kx ${r.g.Kx} Dx ${r.g.Dx} Kθ ${r.g.Kth} Dθ ${r.g.Dth} ωn_yaw ${r.g.wnYaw} · 합 ${fmt(r.J)} · ${r.per.join('  ')}`);
console.log('맨 아래:', `Kx ${res.at(-1).g.Kx} Dx ${res.at(-1).g.Dx} Kθ ${res.at(-1).g.Kth} Dθ ${res.at(-1).g.Dth} ωn_yaw ${res.at(-1).g.wnYaw} · 합 ${fmt(res.at(-1).J)} · ${res.at(-1).per.join('  ')}`);
writeFileSync(join(HERE, 'gains_i.json'), JSON.stringify({ gains: res[0].g, J: res[0].J, per: res[0].per, table: res.slice(0, 8) }, null, 1));
