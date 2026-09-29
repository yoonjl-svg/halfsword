const SNAP = process.env.SNAP || '/tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/tech/snap';
const W = await import(SNAP + '/src/weapons.js');
const list = W.WEAPONS || W.default || Object.values(W).find((x) => Array.isArray(x));
const ids = Object.keys(W).join(',');
console.log('exports', ids);
const arr = Array.isArray(list) ? list : Object.values(list);
for (const s of arr) {
  const parts = s.buildParts?.({}) || [];
  const m = parts.reduce((a, p) => a + p[2][0], 0);
  const blade = parts.find((p) => p[4]);
  console.log(String(s.id).padEnd(14), s.tier?.padEnd?.(8), 'L', s.bladeLength, 'HL', s.hiltLength, 'mass', m.toFixed(2), 'blade', JSON.stringify(blade?.[0]), 'fragile', s.fragile, 'frag', s.fragility, 'power', s.power, 'mat', s.material, 'ignoreArmor', !!s.ignoreArmor);
}
