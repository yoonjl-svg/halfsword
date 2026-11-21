// Saengsa exposure: generate tournaments with the game's own rules and count AI fighters whose (character, weapon, persona) hits the feint defect.
// usage: node saengsa_exposure.mjs <checkout> [seeds=2000]
const M = process.argv[2], NSEEDS = +(process.argv[3] || 2000);
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { CHARACTERS_BY_ID, aiAtProficiency } = await import(M + '/src/characters.js');
const W = await import(M + '/src/weapons.js');
const { resolveSwordArt } = await import(M + '/src/sword_art.js');
const { AI_PROFICIENCY, SAENGSA } = await import(M + '/src/config.js');
const R = await import(M + '/src/saengsa_rules.js');
const RO = await import(M + '/src/saengsa_roster.js');
const { profOfEntry } = await import(M + '/src/saengsa_match.js');
const cfg = { ...SAENGSA, testMode: true }; // no clock waits; same bracket / pool / aiArm / aiPick rules
// replica of main.js teamAiOf (lines 707-721), minus bodyProficiency (not read by resolveSwordArt feints)
function teamAiOf(e) {
  const ch = CHARACTERS_BY_ID[e.id] ?? null, top = AI_PROFICIENCY.levels.length - 1;
  const p = e.prof ? Math.max(0, Math.min(top, Math.round(profOfEntry(e)))) : null;
  const school = W.getWeapon(e.weapon).id;
  if (ch) { const base = p != null ? aiAtProficiency(ch, p) : ch.ai; return { level: base.level, persona: { ...base.persona, ...(e.prof ? { proficiency: { ...e.prof } } : {}), ...(e.weapon !== ch.weapon && !ch.noSwordsmanship ? { school } : {}) } }; }
  const q = p ?? AI_PROFICIENCY.ofLevel.normal;
  return { level: AI_PROFICIENCY.levels[q] ?? 'normal', persona: { proficiency: e.prof ? { ...e.prof } : q, school } };
}
const cache = new Map();
function affected(f) {
  const k = f.id + '|' + f.weapon + '|' + JSON.stringify(f.prof) + '|' + f.school;
  if (cache.has(k)) return cache.get(k);
  const { level, persona } = teamAiOf(f);
  const art = resolveSwordArt(W.getWeapon(f.weapon), persona, { proficiency: persona.proficiency ?? AI_PROFICIENCY.ofLevel[level] ?? AI_PROFICIENCY.ofLevel.normal, aiKit: true }); // ai.js:230-232
  const v = (art.school.feints ?? []).some((x) => !art.school.techByName[x.fake]);
  cache.set(k, v); return v;
}
console.log('roster', RO.SAENGSA_ROSTER.length, 'has bran', RO.SAENGSA_ROSTER.includes('bran'), 'bran_mad', RO.SAENGSA_ROSTER.includes('bran_mad'), 'renji', RO.SAENGSA_ROSTER.includes('renji'));
const D = RO.SAENGSA_DATA;
const myW = ['longsword', 'kriegsmesser', 'rapier'];
let rs = 7; const rnd = () => ((rs = (rs * 1103515245 + 12345) >>> 0) / 4294967296);
const S = { myApp: 0, myAff: 0, myMatches: 0, myMatchAff: 0, allApp: 0, allAff: 0, allMatches: 0, allMatchAff: 0, tMine: 0, tAny: 0, initFoeMembers: 0, initFoeAff: 0, brokenRuns: 0 };
const pairs = {}, pairsAll = {};
for (let s = 0; s < NSEEDS; s++) {
  const comp = []; while (comp.length < 2) { const c = RO.HIRE_ROSTER[Math.floor(rnd() * RO.HIRE_ROSTER.length)]; if (c === R.NAMELESS || !comp.includes(c)) comp.push(c); }
  const seed = R.hash32('audit', s);
  const t = R.createTournament({ day: '2026-11-21', seed, at: 0, companions: comp, roster: D.roster, weapons: myW, drawWeapon: D.drawWeapon, drawPool: D.drawPool, signatureOf: D.signatureOf, weaponInfo: D.weaponInfo, profOf: (id) => (id === 'player' ? { german: 3, italian: 3, iberian: 3, japanese: 3, chinese: 3, none: 3 } : RO.profOf(id)), owned: myW, cfg });
  for (const tm of t.teams.slice(1)) for (const f of tm.members) { S.initFoeMembers++; if (affected(f)) S.initFoeAff++; }
  let mine = false, any = false, now = 1, guard = 0;
  while (t.status !== 'done' && guard++ < 50) {
    const before = t.matches.filter((m) => m.result).length;
    R.advance(t, now, cfg);
    for (const m of t.matches) if (m.result && !m._seen) { m._seen = true; if (m.result.by !== 'quick') continue; S.allMatches++; let hit = false; for (const side of ['a', 'b']) { const [A, B] = R.sidesOf(t, m); const team = side === 'a' ? A : B; for (const k of m.result.entrants[side]) { const f = m.result.pre[side].find((x) => x.key === k); S.allApp++; if (affected(f)) { S.allAff++; hit = true; const key = f.id + ' x ' + f.weapon; pairsAll[key] = (pairsAll[key] || 0) + 1; } } } if (hit) { S.allMatchAff++; any = true; } }
    if (t.status === 'done') break;
    const m = R.myMatch(t);
    if (m && R.matchState(t, m, now, cfg) === 'ready') {
      const picks = t.teams[0].members.filter((f) => R.pickable(f, cfg) && typeof f.weapon === 'string').map((f) => f.key).slice(0, cfg.entrantsMax);
      const setup = R.matchSetup(t, m, picks, now, cfg);
      if (!setup) break;
      const foeSide = setup.mineSide === 'a' ? 'b' : 'a';
      S.myMatches++; let hit = false;
      for (const f of setup.sides[foeSide]) { S.myApp++; if (affected(f)) { S.myAff++; hit = true; const key = f.id + ' x ' + f.weapon; pairs[key] = (pairs[key] || 0) + 1; } }
      if (hit) { S.myMatchAff++; mine = true; any = true; }
      R.finishMine(t, m, picks, now, null, cfg); m._seen = true;
    } else if (t.matches.filter((x) => x.result).length === before) { now += 1; if (now > 20) break; }
    now++;
  }
  if (mine) S.tMine++; if (any) S.tAny++;
}
const pct = (a, b) => `${a}/${b} = ${(100 * a / b).toFixed(2)}%`;
console.log('seeds', NSEEDS);
console.log('foe members at sign-up holding affected combo:', pct(S.initFoeAff, S.initFoeMembers));
console.log('PLAYER matches (engine fights): foe AI appearances affected', pct(S.myAff, S.myApp), '| matches with >=1 affected foe', pct(S.myMatchAff, S.myMatches), '| tournaments with such a match', pct(S.tMine, NSEEDS));
console.log('AI-vs-AI quick matches (no engine): appearances affected', pct(S.allAff, S.allApp), '| matches', pct(S.allMatchAff, S.allMatches));
console.log('tournaments with an affected fighter anywhere (player path or bracket):', pct(S.tAny, NSEEDS));
console.log('top pairs, player matches:', Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ' ' + v).join('; '));
console.log('top pairs, AI-vs-AI:', Object.entries(pairsAll).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ' ' + v).join('; '));
