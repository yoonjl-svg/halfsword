// Share of journey stages / wander encounters whose foe AI hits the feint defect (1:1 rule main.js:411,619).
// usage: node journey_wander_share.mjs <checkout>
const M = process.argv[2];
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const S = await import(M + '/src/stages.js');
const { WANDER_EXCLUSIVE } = await import(M + '/src/wander_rules.js');
const { CHARACTERS_BY_ID, pickCharacterWeapon } = await import(M + '/src/characters.js');
const { missing, persona1v1 } = await import('./real_persona_check.mjs');
// P(affected) per foe = sum over its weapon outcomes
const pAff = (id) => { const ch = CHARACTERS_BY_ID[id]; const ws = [[pickCharacterWeapon(ch, () => 1), 1 - (ch.weaponAlt?.chance ?? 0)]]; if (ch.weaponAlt) ws.push([pickCharacterWeapon(ch, () => 0), ch.weaponAlt.chance]); return ws.reduce((s, [w, p]) => { const { level, persona } = persona1v1(ch, w); return s + (missing(w, level, persona).length ? p : 0); }, 0); };
const stages = S.STAGE_ORDER;
const js = stages.map((st) => [st, S.STAGE_FOE[st], pAff(S.STAGE_FOE[st])]).filter((x) => x[2] > 0);
console.log('journey stages', stages.length, 'with affected foe:', js.map((x) => `${x[0]}:${x[1]} p=${x[2]}`).join(', '));
const foes = [...new Set([...stages.map((id) => S.STAGE_FOE[id]), ...WANDER_EXCLUSIVE])].filter((id) => CHARACTERS_BY_ID[id]);
const per = foes.map((f) => stages.length * pAff(f)); // wander: stage uniform, foe uniform, independent
const p = per.reduce((a, b) => a + b, 0) / (foes.length * stages.length);
console.log('wander foes', foes.length, 'P(encounter affected) =', (100 * p).toFixed(2) + '%', '| contributors:', foes.filter((f) => pAff(f) > 0).map((f) => f + ' ' + pAff(f)).join(', '));
