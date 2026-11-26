// probe (a): reckStandoff copied verbatim from tools/sim/gonosen_risk.test.mjs (not exported), imports from the tree given
// usage: node probe_a.mjs <tree> <prof> <seed...>
const T = process.argv[2];
const { newRound, DT } = await import(T + '/tools/sim/harness_m.mjs');
const { PlayerSecretWatch, gnsEnterLine } = await import(T + '/src/secret.js');
const DEEP = 0.05;
function reckStandoff(prof, seed, weapon = 'longsword') {
  const G = newRound({ weapon: 'monohoshizao', weapon2: weapon, seed, persona: { proficiency: prof }, walls: true });
  const p = G.player;
  p.skill.autoGuard = true;
  const ps = new PlayerSecretWatch(p, G.enemy);
  const L = gnsEnterLine(ps.view());
  const out = { creep: 0, reck: 0, ready: 0, fired: 0, cut: 0, minD: 9, L: +L.toFixed(3), creepT: [] , t:0};
  let prev = null, pending = false, wasReady = false, i = 0;
  G.before = () => {
    ps.update(DT, !!p.skill.sec);
    p.move.set(0, 0);
    const W = G.ai.gnsW;
    if (W?.ready && !wasReady) (out.ready++, W.reck && out.reck++);
    wasReady = !!W?.ready;
    if (ps.open && !p.skill.sec) { const o = ps.fire(); if (o) (p.skill.secret(o), out.fired++); }
    const d = p.foeDistance();
    if (ps.iaiArm.armed && G.ai.mode === 'watch') out.minD = Math.min(out.minD, d);
    if (prev != null && prev > L && d <= L && ps.iaiArm.armed && (!W || W.ready) && G.ai.mode === 'watch') pending = true;
    if (d > L) pending = false;
    else if (pending && d <= L - DEEP) (out.creep++, out.creepT.push(+(i * DT).toFixed(2)), (pending = false));
    if (process.env.TR && i % 12 === 0 && i*DT >= +process.env.TR) console.log((i*DT).toFixed(2), 'd', d.toFixed(3), 'mode', G.ai.mode, 'W', W ? JSON.stringify({ready:W.ready,reck:W.reck,ph:W.phase??W.state, n:W.n}) : '-', 'armed', ps.iaiArm.armed, 'sec', !!p.skill.sec, 'pst', p.state, 'est', G.enemy.state, 'tech', G.ai.tech?.name ?? '', 'pend', pending, 'opened', ps.opened, 'open', JSON.stringify(ps.open?.ctx ?? null), 'eSpd', G.enemy.bodies.pelvis.linvel().x.toFixed(2));
    prev = d; i++;
  };
  for (let k = 0; k < 16 / DT && p.alive && G.enemy.alive; k++) G.step();
  out.t = +(i*DT).toFixed(2);
  out.cut = G.ai.gnsW?.n.cut ?? 0;
  out.minD = +out.minD.toFixed(3);
  G.world.free();
  return out;
}
const prof = +process.argv[3];
for (const s of process.argv.slice(4)) console.log(JSON.stringify({ prof, seed: +s, ...reckStandoff(prof, +s) }));
process.exit(0);
