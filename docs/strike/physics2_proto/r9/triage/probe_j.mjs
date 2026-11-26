// probe (j): airSwing (tools/sim/finger_cut.mjs — the helper the test reads) base / arm 2 / gain 1.5, for two weapons, over seeds and swing speeds
const T = process.argv[2];
const { airSwing } = await import(T + '/tools/sim/finger_cut.mjs');
const { CONFIG } = await import(T + '/tools/sim/harness_m.mjs');
const FC0 = { ...CONFIG.SKILL.fingerCut };
const withFC = (o, fn) => { Object.assign(CONFIG.SKILL.fingerCut, o); try { return fn(); } finally { Object.assign(CONFIG.SKILL.fingerCut, FC0); } };
const r3 = (o) => ({ tip: +o.tip.toFixed(3), hand: +o.hand.toFixed(3) });
const vs = (process.env.VS ?? '4.5').split(',').map(Number);
for (const [weapon, school] of [['longsword', 'german'], ['uchigatana', 'japanese']]) for (const v of vs) for (const seed of process.argv.slice(3).map(Number)) {
  const base = r3(withFC({ arm: 1, gain: 1, hit: 1 }, () => airSwing({ weapon, school, v, seed })));
  const arm = r3(withFC({ arm: 2, gain: 1 }, () => airSwing({ weapon, school, v, seed })));
  const gain = r3(withFC({ arm: 1, gain: 1.5 }, () => airSwing({ weapon, school, v, seed })));
  const ok = (x) => (x.tip > base.tip ? 'T' : 't') + (x.hand > base.hand ? 'H' : 'h');
  console.log(weapon, 'v', v, 'seed', seed, 'base', JSON.stringify(base), 'arm2', JSON.stringify(arm), ok(arm), 'gain1.5', JSON.stringify(gain), ok(gain));
}
process.exit(0);
