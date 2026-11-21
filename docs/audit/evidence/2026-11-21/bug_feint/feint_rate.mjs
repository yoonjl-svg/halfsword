// Read the foe AI's feint level value (L.feint) for bran / bran_mad by constructing the AI's level the way ai.js does (read only).
// usage: node feint_rate.mjs <checkout>
const M = process.argv[2];
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { CHARACTERS_BY_ID } = await import(M + '/src/characters.js');
const C = await import(M + '/src/config.js');
for (const id of ['bran', 'bran_mad']) { const c = CHARACTERS_BY_ID[id]; console.log(id, 'level', c.ai.level, 'persona.level', JSON.stringify(c.ai.persona.level ?? null), 'AI_LEVELS feint', C.AI_LEVELS?.[c.ai.level]?.feint); }
