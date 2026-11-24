// tune.mjs — 고르는 잣대와 찾기. (ii) 는 칸마다 관절이 켜지는 때(어깨 · 팔꿈치 · 손목 풀림)를 격자로 찾고, (i) 은 한 벌의 이득을 모든 칸에 쓴다(gains_i.json).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HERE } from './lib.mjs';
import { runCut } from './cuts.mjs';

/** 잣대: 겨눈 선을 넘는 순간의 칼날 70 % 빠르기 − 벌점(겨눈 선에서 0.10 m 넘게 벗어남 · 칼날이 덜 뻗은 채 넘음 · 관절 끝에 부딪혀 잃은 에너지) */
export function score(sum, C) {
  if (!sum || sum.bad || !sum.cross) return -1e6 + (sum?.v70 ?? 0);
  return sum.cross.v70 - 40 * Math.max(0, sum.cross.dev - 0.1) - 20 * Math.max(0, 0.8 * C.T[0] - sum.cross.x) - 0.05 * Math.max(0, -sum.resid - 3);
}
const GRID = { tSh: [0, 0.04, 0.08, 0.12, 0.16], tEl: [0, 0.05, 0.1, 0.15, 0.2], tWr: [0.05, 0.1, 0.15, 0.2, 0.25] };
/** (ii) 켜지는 때 찾기: 5 × 5 × 5 격자 → 가장 좋은 칸 둘레 ± 20 ms 로 한 번 더 */
export function searchII(R, base, o = {}) {
  let best = null; let n = 0;
  const tryOne = (tSh, tEl, tWr) => { const r = runCut(R, { ...base, style: 'ii', tSh, tEl, tWr, tEnd: o.tEnd ?? 0.6 }); n++; const J = score(r.sum, r.C); if (!best || J > best.J) best = { J, tSh, tEl, tWr }; };
  for (const tSh of GRID.tSh) for (const tEl of GRID.tEl) for (const tWr of GRID.tWr) tryOne(tSh, tEl, tWr);
  if (o.refine !== false) { const b0 = { ...best }; for (const dS of [-0.02, 0, 0.02]) for (const dE of [-0.02, 0, 0.02]) for (const dW of [-0.02, 0, 0.02]) { if (!dS && !dE && !dW) continue; tryOne(Math.max(0, b0.tSh + dS), Math.max(0, b0.tEl + dE), Math.max(0.02, b0.tWr + dW)); } }
  best.n = n;
  return best;
}
export const GAINS_I_DEFAULT = { Kx: 1500, Dx: 60, Kth: 30, Dth: 8, wnYaw: 20, Ibrake: 3 };
export function gainsI() { const f = join(HERE, 'gains_i.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).gains : GAINS_I_DEFAULT; }
