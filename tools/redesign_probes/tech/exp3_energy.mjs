// Experiment 3 (record): AI vs AI duels (arm cuts, the game's normal AI) — every wound analysis result, every fresh
// blade clash impulse, every weapon-impact impulse (clash + bone/helmet/plate rebound). Offline analysis (exp3_scale.mjs)
// then rescales energy by m (tip speed x sqrt(m)) to see lethality, armor and weapon-break effects.
// usage: node exp3_energy.mjs <n fights> <foe look: base|heinrich|margarethe> <seed0> <out.json> [weapon]
import fs from 'node:fs';
const SNAP = '/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/tech/snap';
const H = await import(SNAP + '/tools/sim/harness_m.mjs');
const { CHARACTERS_BY_ID } = await import(SNAP + '/src/characters.js');
const { newRound, DT, AI, CONFIG } = H;
CONFIG.BODY.weightMode = 'hybrid';
const N = +(process.argv[2] || 12);
const LOOK = process.argv[3] || 'base';
const SEED0 = +(process.argv[4] || 1);
const OUT = process.argv[5];
const WEAPON = process.argv[6] || 'longsword';
const DUR = +(process.env.DUR || 30);
const fights = [];
for (let s = SEED0; s < SEED0 + N; s++) {
  const opts = { seed: s, walls: true, weapon: WEAPON, weapon2: WEAPON };
  if (LOOK !== 'base') opts.look2 = CHARACTERS_BY_ID[LOOK].look;
  const G = newRound(opts);
  const P = G.player, E = G.enemy;
  P.skill.level = 0.7;
  G.ai2 = new AI(P, E, 'normal');
  const hits = [], clashes = [], impacts = [];
  G.combat.hooks.onWound = (att, vic, r) => hits.push({ t: +G.t.toFixed(3), att: att.index, zone: r.zone, part: null, type: r.type, E: +r.energy.toFixed(1), eff: r.eff == null ? null : +r.eff.toFixed(1), thr: r.thr == null ? null : +r.thr.toFixed(1), sev: +r.severity.toFixed(3), pass: r.pass, plate: !!r.plate, helmet: !!r.helmet, sp: +r.speed.toFixed(1), mEff: +r.mEff.toFixed(3), t_blade: +r.t.toFixed(2) });
  G.combat.hooks.onClash = (point, sp, info) => { if (info.fresh) clashes.push({ t: +G.t.toFixed(3), J: +info.impulse.toFixed(3), vn: +info.vn.toFixed(2) }); };
  for (const f of [P, E]) {
    const orig = f.absorbWeaponImpact.bind(f);
    f.absorbWeaponImpact = (J, by = null) => { impacts.push({ f: f.index, J: +J.toFixed(3), clash: !!by }); return orig(J, by); };
  }
  let tDead = null, cause = null;
  for (let i = 0; i < DUR / DT; i++) {
    G.step();
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) { tDead = +G.t.toFixed(2); cause = (P.state === 'dead' ? P : E).causeOfDeath; }
  }
  fights.push({ seed: s, look: LOOK, end: `${P.state}/${E.state}`, tDead, cause, broke: [P.weaponBroken, E.weaponBroken], hits, clashes, impacts });
  console.log(`seed ${s} ${LOOK}: ${P.state}/${E.state} ${tDead ?? ''} ${cause ?? ''} hits ${hits.length} clashes ${clashes.length} impacts ${impacts.length} broke ${P.weaponBroken}/${E.weaponBroken}`);
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ N, LOOK, SEED0, DUR, WEAPON, fights }));
