// 생사전 로스터와 무기 뽑기 범위에 걸리는 조합이 있는지 (읽기만)
// 쓰는 법: node saengsa_check.mjs <본판 폴더>
const M = process.argv[2];
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const R = await import(M + '/src/saengsa_roster.js');
const roster = R.SAENGSA_ROSTER;
console.log('로스터', roster.length, '김씨(renji)', roster.includes('renji'), '브란(bran)', roster.includes('bran'));
let s = 12345; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
const seen = {};
for (let i = 0; i < 4000; i++) { for (const w of R.SAENGSA_DATA.drawPool(rnd, 6, [])) { const id = w.weapon ?? w; seen[id] = (seen[id] || 0) + 1; } }
const ids = Object.keys(seen).sort((a, b) => seen[b] - seen[a]);
console.log('뽑히는 무기', ids.length, ids.join(','));
const blunt = ['tree_branch', 'rubber_chicken', 'frozen_tuna', 'morgenstern', 'brothers_sword', 'druid_whip'];
console.log('둔기류 6종 가운데 뽑히는 것:', blunt.filter((b) => seen[b]).map((b) => b + ' ' + (100 * seen[b] / 4000).toFixed(1) + '%').join(', ') || '없음');
