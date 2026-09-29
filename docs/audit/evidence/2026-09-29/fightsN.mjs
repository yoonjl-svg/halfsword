import { newRound, THREE, DT, AI, CONFIG } from './jelly_harness.mjs';
const es = +(process.argv[2] || CONFIG.STRIKE.energyScale);
CONFIG.STRIKE.energyScale = es;
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const out = [];
const N = +(process.env.N || 12), S0 = +(process.env.S0 || 1);
let tSteps = 0, tMs = 0;
for (let seed = S0; seed < S0 + N; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7; // seed = 무기 파손 굴림 씨앗
  G.ai2 = new AI(P, E, 'normal');
  const hits = []; G.combat.hooks.onWound = (att, vic, r) => hits.push(r);
  let downs = 0; const prev = { P: 'stand', E: 'stand' }; let tDead = null;
  for (let i = 0; i < 30 / DT; i++) {
    const _t0 = performance.now(); G.step(); tMs += performance.now() - _t0; tSteps++;
    for (const [k, f] of [['P', P], ['E', E]]) { if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[k] = f.state; }
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = +G.t.toFixed(1);
  }
  out.push({ seed, end: `${P.state}/${E.state}`, tDead, downs, opened: hits.filter((h) => h.type !== 'blunt' && h.severity > 0).length, cuts: hits.filter(h => h.type === 'cut').length, maxE: Math.round(Math.max(0, ...hits.map(h => h.energy))) });
}
const winP = out.filter(o=>o.end.endsWith('dead')&&!o.end.startsWith('dead')).length;
const sumDowns = out.reduce((s,o)=>s+o.downs,0), sumOpen = out.reduce((s,o)=>s+o.opened,0), meanE = out.reduce((s,o)=>s+o.maxE,0)/out.length;
console.log(JSON.stringify({N:out.length, winP, sumDowns, sumOpen, meanMaxE:+meanE.toFixed(1), msPerStep:+(tMs/tSteps).toFixed(3)}));
const dead = out.filter(o => o.end.includes('dead')).length;
console.log(`energyScale ${es}: dead ${dead}/${N}, downs/fight ${(out.reduce((s, o) => s + o.downs, 0) / N).toFixed(1)}, opened/fight ${(out.reduce((s, o) => s + o.opened, 0) / N).toFixed(1)}`);
console.log(out.map(o => `${o.seed}:${o.end}${o.tDead ? '@' + o.tDead : ''} d${o.downs} o${o.opened} E${o.maxE}`).join('  '));
