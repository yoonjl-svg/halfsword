// AI 속임수 목록이 가리키는 기술이 그 AI의 기술표에 있는지: 인물 × 무기 전수 대조 (읽기만)
// 쓰는 법: node feint_check.mjs <본판 폴더>
const M = process.argv[2];
const { CHARACTERS_BY_ID } = await import(M + '/src/characters.js');
const W = await import(M + '/src/weapons.js');
const { resolveSwordArt } = await import(M + '/src/sword_art.js');
const { AI_PROFICIENCY } = await import(M + '/src/config.js');
const specs = W.WEAPONS ?? W.default ?? {};
const list = Array.isArray(specs) ? specs : Object.values(specs);
const bad = new Map(); let n = 0, err = 0;
for (const ch of Object.values(CHARACTERS_BY_ID)) {
  const persona = ch.ai?.persona; if (!persona) continue;
  for (const spec of list) {
    if (!spec?.id) continue;
    let art;
    try { art = resolveSwordArt(spec, persona, { proficiency: persona.proficiency ?? AI_PROFICIENCY.ofLevel[ch.ai.level] ?? AI_PROFICIENCY.ofLevel.normal, aiKit: true }); } catch (e) { err++; continue; }
    n++;
    const miss = (art.school.feints ?? []).filter((f) => !art.school.techByName[f.fake]).map((f) => f.name + '→' + f.fake);
    if (miss.length) bad.set(`${ch.id}(${art.tradition}, 꾸러미 ${persona.school ?? '-'}) × ${spec.id}`, miss);
  }
}
console.log('조합', n, '만들다 오류', err, '속임수가 없는 기술을 가리키는 조합', bad.size);
const byChar = {};
for (const k of bad.keys()) { const c = k.split('(')[0]; byChar[c] = (byChar[c] || 0) + 1; }
console.log('인물별:', JSON.stringify(byChar));
let i = 0; for (const [k, v] of bad) { if (i++ < 12) console.log(' ', k, '|', v.join(', ')); }
// 덧: 인물마다 걸리는 무기와 제 무기
const own = (ch) => ch.weapon ?? ch.weaponId ?? ch.ai?.weapon ?? ch.loadout?.weapon ?? '?';
const per = {};
for (const k of bad.keys()) { const [c, w] = k.split(' × '); (per[c] ??= []).push(w); }
const seen = new Set();
for (const [c, ws] of Object.entries(per)) { const key = ws.join(','); if (seen.has(key)) continue; seen.add(key); console.log('무기 묶음', ws.length, ':', key, '| 보기 인물', c); }
const ownBad = [];
for (const ch of Object.values(CHARACTERS_BY_ID)) { const o = own(ch); for (const k of bad.keys()) if (k.startsWith(ch.id + '(') && k.endsWith(' × ' + o)) ownBad.push(k); }
console.log('제 무기로 걸리는 인물:', ownBad.length, ownBad.slice(0, 10).join(' ; '));
console.log('인물 보기 키:', Object.keys(Object.values(CHARACTERS_BY_ID)[0]).join(','));
