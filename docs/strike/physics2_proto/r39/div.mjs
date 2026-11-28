// 장검 AI 판 하나: 스텝마다 두 몸 칼 자리 · tapLine 시작 스텝을 적음
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const a = Object.fromEntries(process.argv.slice(2).map((x) => x.replace(/^--/, '').split('=')));
const ROOT = resolve(a.root); const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { AI } = await imp('src/ai.js');
let step = 0; const starts = [];
if (AI.prototype.tapLineHold) { const o = AI.prototype.tapLineHold; AI.prototype.tapLineHold = function (dt) { const had = this.tapLine; const r = o.call(this, dt); if (!had && this.tapLine) starts.push({ step, who: this.me === G.player ? 'P' : 'E', tech: this.tech?.name, vital: this.vital?.kind ?? null }); return r; }; }
const G = H.newRound({ walls: true, seed: +a.seed, weapon: a.w, weapon2: a.w, AI2Class: H.AI });
const rows = []; const thr = [];
for (step = 0; step < 30 * 120; step++) { G.step(); const r = []; for (const f of [G.player, G.enemy]) { const p = f.sword?.translation(); r.push(p ? [p.x, p.y, p.z].map((v) => +v.toFixed(6)) : null); } rows.push(r); thr.push([G.player.skill?.thrusts ?? 0, G.enemy.skill?.thrusts ?? 0]); }
writeFileSync(a.out, JSON.stringify({ rows, starts, thr }));
