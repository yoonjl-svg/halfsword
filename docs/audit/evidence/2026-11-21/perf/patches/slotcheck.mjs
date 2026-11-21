// exhaustive check: test(slotGroups(a),slotGroups(b)) === test(a,b) && pairAllowed(a,b)
const T = process.argv[2];
const S = await import(T + '/src/self_contact.js');
const { BIT, BODY_GROUPS, FOOT_GROUPS, WEAPON_GROUPS, HELMET_GROUPS, GROUND_GROUPS, slotGroups, pairAllowed, WEAPON_MASK, SLOTS } = S;
const test = (a, b) => (((a >>> 16) & b) !== 0) && (((b >>> 16) & a) !== 0);
const cls = [['body', BODY_GROUPS, [0, 1, 2]], ['foot', FOOT_GROUPS, [0]], ['blade', WEAPON_GROUPS, [4]], ['weapon', WEAPON_GROUPS, [4]], ['whipseg', WEAPON_GROUPS & ~BIT.weapon, [0]], ['helmet', HELMET_GROUPS, [0]]];
const fighters = [0, 1, 2, 3, 4, 5]; // slot = i < SLOTS ? i : null
const cols = [{ g: GROUND_GROUPS, info: undefined, ghostable: false }];
for (const fi of fighters) for (const [n, g, selves] of cls) for (const self of selves) for (const ghost of [0, 1, 2]) {
  // ghost 1 = revive body (& ~foeWeapon), 2 = ghostSword / pickup ground-only
  const k = fi < SLOTS ? fi : null; const info = { fighter: fi, self };
  let gc = g, gs = slotGroups(g, self, k);
  if (ghost === 1) { gc = g & ~BIT.weapon; gs = gs & ~WEAPON_MASK; }
  if (ghost === 2) { gc = (g & 0xffff0000) | 1; gs = (gs & 0xffff0000) | 1; }
  const hook = k == null || n === 'blade';
  cols.push({ gc, gs, info, hook, d: `${n}/f${fi}/s${self}/g${ghost}` });
}
cols[0].gc = cols[0].gs = GROUND_GROUPS;
let bad = 0, n = 0;
for (const a of cols) for (const b of cols) { n++;
  const want = test(a.gc, b.gc) && pairAllowed(a.info, b.info);
  const got = test(a.gs, b.gs) && (a.hook || b.hook ? pairAllowed(a.info, b.info) : true);
  if (want !== got) { if (bad++ < 10) console.log('MISMATCH', a.d, b.d, want, got); }
}
console.log(`pairs ${n} mismatches ${bad}`);
