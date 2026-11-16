// parrySpeed 역설 — 막기 마디 한 개의 프레임 추적 (같은 씨앗 · 막기가 시작되기 전까지는 두 판이 똑같다)
//  node tools/sim/pf_frames.mjs <parrySpeed> <school> <weaponIdx> <seed> <swap 0|1> [epIndex=0] [step=2]
const H = await import('./harness_m.mjs');
const { WEAPONS } = await import('./ai_ring_measure.mjs');
const [psv, school, wi, seed, swap, epIdx = '0', stepN = '2'] = process.argv.slice(2);
const weapon = WEAPONS[school][+wi];
const pX = { proficiency: 4, level: { parrySpeed: +psv } }, pY = { proficiency: 4 };
const sw = swap === '1';
const g = H.newRound({ seed: +seed * 100 + +wi * 10 + (sw ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: H.AI, difficulty: 'hard', difficulty2: 'hard', persona: sw ? pX : pY, persona2: sw ? pY : pX });
const X = sw ? g.enemy : g.player, Y = sw ? g.player : g.enemy, ai = sw ? g.ai : g.ai2;
const yawOf = (f) => { const q = f.bodies.chest.rotation(); return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z)) * 180 / Math.PI; };
let prev = null, ep = -1, t0 = 0, tail = 0, wounds = [];
g.onWound = (a, v, r) => { if (r.severity > 0) wounds.push(`t=${(g.t - t0).toFixed(3)} ${a === X ? 'X→Y' : 'Y→X'} ${r.zone}:${r.type}`); };
const rows = [];
let clashPrev = 0;
while (g.t < 40) {
  g.step();
  const m = ai.mode;
  if (m === 'defend' && prev !== 'defend') { ep++; if (ep === +epIdx) { t0 = g.t; tail = 0.9; } }
  prev = m;
  if (ep === +epIdx && g.t - t0 < tail && g.t >= t0) {
    const k = Math.round((g.t - t0) / H.DT);
    if (k % +stepN === 0) {
      const tip = X.bladePoint(1), ft = Y.bladePoint(1), hp = H.handPos(X);
      const pad = X.handOffset, tg = ai.hand, aim = X.skill.aim;
      rows.push(`${(g.t - t0).toFixed(3)} ${m.padEnd(8)} tgt=(${tg.x.toFixed(2)},${tg.y.toFixed(2)}) pad=(${pad.x.toFixed(2)},${pad.y.toFixed(2)}) aim=(${aim.x.toFixed(2)},${aim.y.toFixed(2)}) hs=${ai.handSpeed.toFixed(1)} tipV=${X.tipVel.length().toFixed(1)} tip→foeTip=${tip.distanceTo(ft).toFixed(2)} chestYaw=${yawOf(X).toFixed(0)} act=${X.skill.activity.toFixed(2)} clash=${g.clashes - clashPrev}`);
      clashPrev = g.clashes;
    }
  }
  if (ep >= +epIdx && tail && g.t - t0 > tail) break;
}
console.log(`ps=${psv} ${school}#${wi} seed=${seed} swap=${swap} ep#${epIdx} t0=${t0.toFixed(2)}`);
console.log(rows.join('\n'));
console.log('wounds:', wounds.join(' | ') || '-');
