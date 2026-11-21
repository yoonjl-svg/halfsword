// Affected-combination test using the persona the real game builds (main.js newRound 1:1 rule, main.js teamAiOf saengsa rule).
// usage: node real_persona_check.mjs <checkout>
const M = process.argv[2];
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { CHARACTERS_BY_ID, aiAtProficiency, pickCharacterWeapon } = await import(M + '/src/characters.js');
const W = await import(M + '/src/weapons.js');
const { resolveSwordArt } = await import(M + '/src/sword_art.js');
const { AI_PROFICIENCY } = await import(M + '/src/config.js');
export const missing = (weaponId, level, persona) => {
  const art = resolveSwordArt(W.getWeapon(weaponId), persona ?? {}, { proficiency: persona?.proficiency ?? AI_PROFICIENCY.ofLevel[level] ?? AI_PROFICIENCY.ofLevel.normal, aiKit: true });
  return (art.school.feints ?? []).filter((f) => !art.school.techByName[f.fake]).map((f) => f.name + '>' + f.fake);
};
// main.js:618-619
export const persona1v1 = (ch, weapon) => { const foeAI = ch.ai; return { level: foeAI.level, persona: weapon !== ch.weapon && !ch.noSwordsmanship ? { ...foeAI.persona, school: W.getWeapon(weapon).id } : foeAI.persona }; };
if (process.argv[1].endsWith('real_persona_check.mjs')) {
  const ids = W.WEAPON_LIST.map((w) => w.id);
  let n = 0; const bad = [];
  for (const ch of Object.values(CHARACTERS_BY_ID)) for (const w of ids) { n++; const { level, persona } = persona1v1(ch, w); let m; try { m = missing(w, level, persona); } catch (e) { m = ['ERR ' + e.message]; } if (m.length) bad.push(`${ch.id}×${w}`); }
  console.log('1v1 rule: combos', n, 'affected', bad.length);
  const byW = {}; for (const b of bad) { const w = b.split('×')[1]; byW[w] = (byW[w] || 0) + 1; }
  console.log('affected by weapon:', JSON.stringify(byW));
  const byC = {}; for (const b of bad) { const c = b.split('×')[0]; byC[c] = (byC[c] || 0) + 1; }
  console.log('affected by char:', JSON.stringify(byC));
  const own = Object.values(CHARACTERS_BY_ID).filter((ch) => bad.includes(`${ch.id}×${ch.weapon}`)).map((c) => c.id);
  console.log('own-weapon affected:', own.join(','));
  const alt = Object.values(CHARACTERS_BY_ID).filter((ch) => ch.weaponAlt).map((ch) => { const w = pickCharacterWeapon(ch, () => 0); return `${ch.id}: alt ${w} chance ${ch.weaponAlt.chance} affected=${bad.includes(`${ch.id}×${w}`)}`; });
  console.log('weaponAlt:', alt.join(' | '));
}
