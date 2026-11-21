// D audit runner (11/21): varied hybrid AI-vs-AI duels — ten representative weapons, character sheets (persona, look incl. plate/horned helmet, revive).
// env: N (fights, default 48), S0 (first seed), SECS (max secs, 45), J_COUNTS=1 print counters, J_ABL=name ablate, PERTURB=1 → 1e-6 perturbation of BODY.uprightStiffness
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';
import { getWeapon } from '../../src/weapons.js';
// 게임 규칙(main.js:619 · :715): 인물이 제 무기가 아닌 무기를 들면 유파 꾸러미도 그 무기 것으로 (noSwordsmanship 은 그대로)
const realPersona = (c, w) => (c && w !== c.weapon && !c.noSwordsmanship ? { ...c.ai.persona, school: getWeapon(w).id } : c?.ai.persona);
const W = ['longsword', 'kriegsmesser', 'rapier', 'pappenheimer', 'zweihander', 'flamberge', 'uchigatana', 'monohoshizao', 'hwando', 'qinggang'];
const CH = ['margarethe', 'isolde', 'heinrich', 'liao', 'artoria', 'omari', 'tome', 'eira'];
if (process.env.PERTURB) { const k = +process.env.PERTURB; CONFIG.BODY.uprightStiffness *= 1 + 1e-6 * k; }
const PROF = +(process.env.PROF || 0);
if (process.env.AI_ABL) globalThis.__AI_ABL = new Set(process.env.AI_ABL.split(','));
const N = +(process.env.N || 48), S0 = +(process.env.S0 || 1), SECS = +(process.env.SECS || 45);
globalThis.__JC = globalThis.__JC || {};
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const out = [];
for (let seed = S0; seed < S0 + N; seed++) {
  const i = seed - 1;
  const wP = W[i % 10], wE = W[(i * 3 + 5) % 10];
  const ch = CHARACTERS_BY_ID[CH[i % CH.length]];
  const pc = i % 3 === 0 ? CHARACTERS_BY_ID[CH[(i + 3) % CH.length]] : null; // every 3rd fight the player slot also wears a character look (plate variety)
  seedRand(seed);
  const G = newRound({ walls: true, seed, weapon: wP, weapon2: wE, look: pc ? pc.look : LOOKS.player, look2: ch.look, revive: ch.revive, persona: PROF ? { ...(realPersona(ch, wE) ?? {}), proficiency: PROF } : realPersona(ch, wE), difficulty: ch.ai.level, AI2Class: AI, persona2: PROF ? { ...(pc?.ai.persona ?? {}), proficiency: PROF } : pc ? pc.ai.persona : null });
  const P = G.player, E = G.enemy;
  let downs = 0, revives = 0; const prev = { P: 'stand', E: 'stand' }; let tDead = null, tEnd = null;
  const wasRev = { P: false, E: false };
  const JC = process.env.J_COUNTS ? globalThis.__JC : null; const am = new Map();
  for (let k = 0; k < SECS / DT; k++) {
    G.step();
    for (const [n, f] of [['P', P], ['E', E]]) {
      if (prev[n] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[n] = f.state;
      const r = !!f.revival; if (r && !wasRev[n]) revives++; wasRev[n] = r;
    }
    if (JC) for (const a of [G.ai, G.ai2]) { const m = a.mode, pm = am.get(a); if (m !== pm) { am.set(a, m); const tr = a.me.swordArt?.tradition ?? '?'; const inc = (k) => (JC[k] = (JC[k] || 0) + 1);
      inc('ai.mode.' + m); if (m === 'attack') { inc('ai.tech.' + tr + '.' + (a.tech?.name ?? '?')); inc('ai.why.' + String(a.why ?? '?').slice(0, 24)); } if (m === 'secret') inc('ai.secret.' + tr); } }
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = G.t;
    if (tDead != null && G.t - tDead > 2) { tEnd = G.t; break; }
  }
  const plates = [P, E].reduce((s, f) => s + (f.platesBroken ?? 0) + (f.helmetType && !f.hasHelmet ? 1 : 0), 0);
  out.push({ seed, m: `${wP}/${wE}:${ch.id}${pc ? '+' + pc.id : ''}`, end: `${P.state}/${E.state}`, tDead: tDead == null ? null : +tDead.toFixed(1), downs, revives, plates, cause: [P.causeOfDeath, E.causeOfDeath].filter(Boolean).join('+'), bp: +P.blood.toFixed(4), be: +E.blood.toFixed(4) });
  G.world.free();
}
const deaths = out.filter((o) => o.end.includes('dead')).length;
const winP = out.filter((o) => o.end.endsWith('dead') && !o.end.startsWith('dead')).length;
const downs = out.reduce((s, o) => s + o.downs, 0);
const revives = out.reduce((s, o) => s + o.revives, 0);
const plates = out.reduce((s, o) => s + o.plates, 0);
const causes = {}; for (const o of out) if (o.cause) for (const c of o.cause.split('+')) causes[c] = (causes[c] || 0) + 1;
const tD = out.filter((o) => o.tDead != null).map((o) => o.tDead); const meanT = tD.reduce((a, b) => a + b, 0) / Math.max(1, tD.length);
console.log(JSON.stringify({ abl: process.env.J_ABL || (process.env.PERTURB ? 'perturb' + process.env.PERTURB : 'base'), N, deaths, winP, downs, revives, armorBroken: plates, meanTDead: +meanT.toFixed(1), causes }));
const JC = globalThis.__JC; const keys = Object.keys(JC).sort();
if (process.env.J_COUNTS) console.log(JSON.stringify(Object.fromEntries(keys.map((k) => [k, +JC[k].toFixed(3)]))));
console.log(out.map((o) => `${o.seed}:${o.m}=${o.end}${o.tDead != null ? '@' + o.tDead : ''} d${o.downs}${o.revives ? ' R' : ''}${o.cause ? ' ' + o.cause : ''}`).join('\n'));
