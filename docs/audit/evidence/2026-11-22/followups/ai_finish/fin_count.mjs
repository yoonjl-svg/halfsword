// zz_fin_count.mjs : the ten-weapon, character-sheet duel set of D_fights_real (game pack-swap rule) with counters for the AI finishing tap.
//  env: N (48), S0 (1), SECS (45). Works on trees with or without ai.finGo (counts stay 0 without it).
import { newRound, DT, AI } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';
import { getWeapon } from '../../src/weapons.js';
const realPersona = (c, w) => (c && w !== c.weapon && !c.noSwordsmanship ? { ...c.ai.persona, school: getWeapon(w).id } : c?.ai.persona);
const W = ['longsword', 'kriegsmesser', 'rapier', 'pappenheimer', 'zweihander', 'flamberge', 'uchigatana', 'monohoshizao', 'hwando', 'qinggang'];
const CH = ['margarethe', 'isolde', 'heinrich', 'liao', 'artoria', 'omari', 'tome', 'eira'];
const N = +(process.env.N || 48), S0 = +(process.env.S0 || 1), SECS = +(process.env.SECS || 45);
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const T = { fights: 0, deaths: 0, downs: 0, finishPick: 0, pickFoeDownOrGetup: 0, pickFoeUnarmed: 0, pickFoeOther: 0, finGoCalls: 0, finGoStarted: 0, tapDownStarts: 0, cleaveStarts: 0, finishPowerWounds: 0, woundsOnDownFoe: 0, deathsWhileDownAndFinisherPlunging: 0, deathsOfDownedFoe: 0, downSteps: 0 };
const rows = [];
for (let seed = S0; seed < S0 + N; seed++) {
  const i = seed - 1; const wP = W[i % 10], wE = W[(i * 3 + 5) % 10];
  const ch = CHARACTERS_BY_ID[CH[i % CH.length]]; const pc = i % 3 === 0 ? CHARACTERS_BY_ID[CH[(i + 3) % CH.length]] : null;
  seedRand(seed);
  const G = newRound({ walls: true, seed, weapon: wP, weapon2: wE, look: pc ? pc.look : LOOKS.player, look2: ch.look, revive: ch.revive, persona: realPersona(ch, wE), difficulty: ch.ai.level, AI2Class: AI, persona2: pc ? pc.ai.persona : null });
  const P = G.player, E = G.enemy; T.fights++;
  const row = { seed, m: `${wP}/${wE}`, pick: 0, go: 0, ok: 0, tap: 0, fpw: 0 };
  for (const [ai, foe] of [[G.ai, P], [G.ai2, E]]) {
    if (!ai) continue;
    const o = ai.startAttack.bind(ai);
    ai.startAttack = (tech, why, opt) => { const r = o(tech, why, opt); if (why === 'finish' && r) { T.finishPick++; row.pick++; const fs = foe.state; if (fs === 'down' || fs === 'getup') T.pickFoeDownOrGetup++; else if (!foe.armed) T.pickFoeUnarmed++; else T.pickFoeOther++; } return r; };
    if (typeof ai.finGo === 'function') { const g = ai.finGo.bind(ai); ai.finGo = () => { T.finGoCalls++; row.go++; const r = g(); if (r) { T.finGoStarted++; row.ok++; } return r; }; }
  }
  G.combat.hooks.onWound = (att, vic, r) => { if (r.finishPower) { T.finishPowerWounds++; row.fpw++; } if (vic.state === 'down' || vic.state === 'getup') T.woundsOnDownFoe++; };
  const seen = new Set(); const prev = { P: 'stand', E: 'stand' }; let tDead = null;
  for (let k = 0; k < SECS / DT; k++) {
    G.step();
    for (const [n, f, o] of [['P', P, E], ['E', E, P]]) {
      const tp = f.skill?.tap; if (tp && tp.down && !seen.has(tp)) { seen.add(tp); T.tapDownStarts++; row.tap++; if (tp.cleave) T.cleaveStarts++; }
      if (prev[n] === 'stand' && (f.state === 'down' || f.state === 'getup')) T.downs++;
      if (f.state === 'down') T.downSteps++;
      if (f.state === 'dead' && prev[n] !== 'dead') { if (prev[n] === 'down' || prev[n] === 'getup') { T.deathsOfDownedFoe++; if (o.skill?.tap?.down) T.deathsWhileDownAndFinisherPlunging++; } }
      prev[n] = f.state;
    }
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) { tDead = G.t; T.deaths++; }
    if (tDead != null && G.t - tDead > 2) break;
  }
  rows.push(row); G.world.free();
}
console.log(JSON.stringify(T));
console.log(rows.filter((r) => r.pick || r.go || r.tap).map((r) => `${r.seed}:${r.m} pick${r.pick} go${r.go} ok${r.ok} tap${r.tap} fpw${r.fpw}`).join('\n'));
