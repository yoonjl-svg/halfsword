// r30 fights12 + 심판(honesty.mjs) 붙임: tools/sim/fights12.mjs 와 같은 12 판(씨앗 1 ~ 12 · 벽 · 30 s · P 숙련 0.7 · AI 'normal' 둘) 에 두 싸움꾼 장부를 건다
//  (honesty.mjs sceneFight 와 같은 붙임). 끝 두 줄은 fights12.mjs 와 같은 꼴 — 심판을 붙여도 싸움이 같은지 견줄 수 있게. 판마다 심판 요약은 --full 일 때만 찍음.
//  node v3_fights12.mjs [--root=<나무>] [--full]
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, resolve, dirname } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const { newRound, DT, AI, CONFIG } = await import(u('tools/sim/jelly_harness.mjs'));
const Hn = await import(u('tools/sim/honesty.mjs'));
const bodiesOf = (f) => { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; };
const es = CONFIG.STRIKE.energyScale; CONFIG.STRIKE.energyScale = es;
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const out = [];
for (let seed = 1; seed <= 12; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7;
  G.ai2 = new AI(P, E, 'normal');
  const LP = Hn.attach(G.world, bodiesOf(P), { fighter: P }), LE = Hn.attach(G.world, bodiesOf(E), { fighter: E }); LP.foe = LE; LE.foe = LP; Hn.hook(G, [LP, LE]);
  const hits = []; G.combat.hooks.onWound = (att, vic, r) => hits.push(r);
  let downs = 0; const prev = { P: 'stand', E: 'stand' }; let tDead = null;
  for (let i = 0; i < 30 / DT; i++) {
    G.step();
    for (const [k, f] of [['P', P], ['E', E]]) { if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[k] = f.state; }
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = +G.t.toFixed(1);
  }
  if (args.full) { console.log(Hn.report(`fights12 P · seed ${seed}`, LP.summary())); console.log(Hn.report(`fights12 E · seed ${seed}`, LE.summary())); }
  out.push({ seed, end: `${P.state}/${E.state}`, tDead, downs, opened: hits.filter((h) => h.type !== 'blunt' && h.severity > 0).length, cuts: hits.filter((h) => h.type === 'cut').length, maxE: Math.round(Math.max(0, ...hits.map((h) => h.energy))) });
}
const dead = out.filter((o) => o.end.includes('dead')).length;
console.log(`energyScale ${es}: dead ${dead}/12, downs/fight ${(out.reduce((s, o) => s + o.downs, 0) / 12).toFixed(1)}, opened/fight ${(out.reduce((s, o) => s + o.opened, 0) / 12).toFixed(1)}`);
console.log(out.map((o) => `${o.seed}:${o.end}${o.tDead ? '@' + o.tDead : ''} d${o.downs} o${o.opened} E${o.maxE}`).join('  '));
