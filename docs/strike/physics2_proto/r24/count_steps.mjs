// r24 A5: 세계 스텝 수 세기 (값 재기용 — 벽시계 ÷ 흉내 낸 초).  R24_ROOT=<나무> node --import file://<이 파일> <도구> → 끝에 'steps N sim_s X wall_s Y' 를 stderr 로
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const RAPIER = (await import(pathToFileURL(join(process.env.R24_ROOT, 'node_modules/@dimforge/rapier3d-compat/rapier.mjs')).href)).default;
let n = 0, dt = 1 / 120;
const o = RAPIER.World.prototype.step;
RAPIER.World.prototype.step = function (...a) { n++; dt = this.timestep; return o.apply(this, a); };
const t0 = performance.now();
process.on('exit', () => { const w = (performance.now() - t0) / 1000; process.stderr.write(`steps ${n} sim_s ${(n * dt).toFixed(1)} wall_s ${w.toFixed(1)} wall_per_sim ${(w / Math.max(1e-9, n * dt)).toFixed(4)}\n`); });
