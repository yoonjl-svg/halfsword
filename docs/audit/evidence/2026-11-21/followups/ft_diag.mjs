import { newRound, DT, AI } from '../../../../../tools/sim/harness_m.mjs';
import { lowFinishPosture } from '../../../../../src/finish_entry.js';
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const N = +(process.argv[2] || 12), secs = +(process.argv[3] || 30), W = process.env.W;
const T = { duels:0, oppSteps:0, canStartSteps:0, surfSteps:0, aiAttackSteps:0, picksDown:0, pickCan:0, pickSurf:0, pickTap:0, oppSecs:0, windows:0, windowsWithPick:0, windowsCanStart:0, tapStartsInWindow:0, deadInWindow:0 };
const rows=[];
for (let seed = 1; seed <= N; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed, weapon: W, weapon2: W, AI2Class: AI }); const P = G.player, E = G.enemy; P.skill.level = 0.7; T.duels++;
  const pair = [[G.ai, E, P, 'E'], [G.ai2, P, E, 'P']];
  for (const [ai, me, foe, nm] of pair) { const o = ai.startAttack.bind(ai); ai.startAttack = (tech, why, opt) => { const r = o(tech, why, opt); if (why==='finish' && r && (foe.state==='down'||foe.state==='getup')) { T.picksDown++; if (me.finish.canStart) T.pickCan++; if (me.finish.plunge.surfaceInside||me.finish.plunge.surfaceWalk) T.pickSurf++; rows.push(`seed${seed} t${G.t.toFixed(1)} ${nm} pick kind=${tech.kind} canStart=${me.finish.canStart} surfIn=${me.finish.plunge.surfaceInside} surfWalk=${me.finish.plunge.surfaceWalk} low=${lowFinishPosture(me,foe,false)} me=${me.state} foe=${foe.state} foeH=${foe.bodies.chest.translation().y.toFixed(2)}`);} return r; }; }
  const win = { P:false, E:false };
  const tapSeen = new Set();
  for (let i = 0; i < secs / DT; i++) {
    G.step();
    for (const [ai, me, foe, nm] of pair) {
      const opp = me.alive && me.armed && foe.alive && (foe.state==='down'||foe.state==='getup') && lowFinishPosture(me,foe,false);
      if (opp) { T.oppSteps++; if (me.finish.canStart) T.canStartSteps++; if (me.finish.plunge.surfaceInside||me.finish.plunge.surfaceWalk) T.surfSteps++; if (!win[nm]) { win[nm]=true; T.windows++; } }
      else win[nm]=false;
      const tp = me.skill.tap; if (tp?.down && !tapSeen.has(tp)) { tapSeen.add(tp); T.tapStartsInWindow++; }
    }
  }
}
T.oppSecs = +(T.oppSteps*DT).toFixed(1);
console.log(JSON.stringify(T)); console.log(rows.slice(0,14).join('\n'));
