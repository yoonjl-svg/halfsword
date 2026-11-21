import { newRound, DT, AI } from '../../../../../tools/sim/harness_m.mjs';
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const N = +(process.argv[2] || 12), secs = +(process.argv[3] || 30), s0 = +(process.argv[4] || 1);
const T = { duels: 0, finishPick: 0, pickFoeDown: 0, pickFoeUnarmed: 0, pickFoeOther: 0, pickStartOk: 0, pickThrust: 0, tapDownStarts: 0, tapDownAbort: 0, tapDownGo: 0, tapDownEnded: 0, finishWounds: 0, finishPowerWounds: 0, powerContactsAny: 0, woundsOnDownFoe: 0, deathsByFinisher: 0, deaths: 0, downTimeFoe: 0, cleaveStarts: 0 };
const ex = [];
for (let seed = s0; seed < s0 + N; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed, ...(process.env.W ? { weapon: process.env.W, weapon2: process.env.W } : {}) }); const P = G.player, E = G.enemy; P.skill.level = 0.7;
  G.ai2 = new AI(P, E, 'normal');
  T.duels++;
  for (const [ai, me, foe] of [[G.ai, E, P], [G.ai2, P, E]]) {
    const o = ai.startAttack.bind(ai);
    ai.startAttack = (tech, why, opt) => { const r = o(tech, why, opt); if (why === 'finish' && r) { T.finishPick++; const fs = foe.state; if (fs === 'down' || fs === 'getup') T.pickFoeDown++; else if (!foe.armed) T.pickFoeUnarmed++; else T.pickFoeOther++; (T['kind_' + (tech?.kind ?? '?')] = (T['kind_' + (tech?.kind ?? '?')] || 0) + 1); } return r; };
  }
  const seen = new Map(); const fins = [];
  G.combat.hooks.onWound = (att, vic, r) => {
    if (r.finish) T.finishWounds++;
    if (r.finishPower) T.finishPowerWounds++;
    if (vic.state === 'down' || vic.state === 'getup') { T.woundsOnDownFoe++; if (r.type === 'stab' && att.skill?.tap?.down) T.powerContactsAny++; }
  };
  const prevState = { P: 'stand', E: 'stand' };
  let dead = null;
  for (let i = 0; i < secs / DT; i++) {
    G.step();
    for (const f of [P, E]) {
      const tp = f.skill?.tap;
      if (tp && tp.down && !seen.has(tp)) { seen.set(tp, 1); T.tapDownStarts++; if (tp.cleave) T.cleaveStarts++; fins.push({ f: f === P ? 'P' : 'E', t: +G.t.toFixed(2), tp, w: f.weapon?.id }); }
    }
    if (!dead && (P.state === 'dead' || E.state === 'dead')) { dead = P.state === 'dead' ? 'P' : 'E'; T.deaths++; }
  }
  for (const x of fins) { if (x.tp.abort) T.tapDownAbort++; if (x.tp.go) T.tapDownGo++; if (x.tp.ended) T.tapDownEnded++; }
  if (seed < s0 + 4) ex.push({ seed, fins: fins.map(x => `${x.f}@${x.t}${x.w} abort=${!!x.tp.abort} go=${!!x.tp.go} ended=${!!x.tp.ended}`) });
}
console.log(JSON.stringify(T)); console.log(JSON.stringify(ex));
