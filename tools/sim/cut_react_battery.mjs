// 절삭 반작용 방식 비교 (STRIKE.cutReact legacy / full / same, 10/8 타격 B 질문): N 결투 × 방식, 결정적. 실행: node tools/sim/cut_react_battery.mjs [N=36] [legacy,full,same]
import { newRound, DT, AI, CONFIG } from './jelly_harness.mjs';
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const p90 = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * 0.9)]; };
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dlen = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const N = +(process.argv[2] || 36);
const modes = (process.argv[3] || 'legacy,full,same').split(',');
const res = {};
for (const mode of modes) {
  CONFIG.STRIKE.cutReact = mode;
  globalThis.__cutLog = [];
  let dead = 0, downs = 0, severs = 0, nan = 0; const ends = [];
  for (let seed = 1; seed <= N; seed++) {
    seedRand(seed);
    const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7; G.ai2 = new AI(P, E, 'normal');
    const prev = { P: 'stand', E: 'stand' };
    for (let i = 0; i < 30 / DT; i++) { G.step(); for (const [k, f] of [['P', P], ['E', E]]) { if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[k] = f.state; } }
    if (P.state === 'dead' || E.state === 'dead') dead++;
    severs += (P.severed?.length || 0) + (E.severed?.length || 0);
    for (const f of [P, E]) for (const b of Object.values(f.bodies)) { const t = b.translation(); if (![t.x, t.y, t.z].every(Number.isFinite)) nan++; }
    ends.push(`${P.state[0]}${E.state[0]}`);
  }
  const L = globalThis.__cutLog.filter((c) => c.v1);
  const torso = L.filter((c) => ['chest', 'belly', 'pelvis', 'head', 'neck'].includes(c.part)); const limb = L.filter((c) => !torso.includes(c));
  const stat = (A) => ({ n: A.length, Jsum: med(A.map((c) => c.Jsum)).toFixed(2), Jp90: p90(A.map((c) => c.Jsum)).toFixed(2), dv: med(A.map((c) => dlen(c.v1, c.v0))).toFixed(3), dvp90: p90(A.map((c) => dlen(c.v1, c.v0))).toFixed(3), dw: med(A.map((c) => dlen(c.w1, c.w0))).toFixed(2), dwp90: p90(A.map((c) => dlen(c.w1, c.w0))).toFixed(2), swDrop: med(A.map((c) => len(c.swv0) - len(c.swv1))).toFixed(2), steps: med(A.map((c) => c.steps)) });
  res[mode] = { dead, downs: +(downs / N).toFixed(2), severs, nan, ends: ends.join(' '), all: stat(L), torso: stat(torso), limb: stat(limb) };
  console.log(mode, JSON.stringify(res[mode]));
}
