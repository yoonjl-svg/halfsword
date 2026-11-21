// usage: node open.cjs <rows.json> <open_questions.md> <out.tsv> — step 6 completeness (keyword screen)
const fs = require('fs'); const [rj, oq, out] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(rj, 'utf8')); const open = fs.readFileSync(oq, 'utf8');
const openKeys = [...open.matchAll(/`([A-Z_]+\.[A-Za-z_.]+)`/g)].map((m) => m[1]);
const prov = rows.filter((r) => (r.newOwn === 'PROV' || r.newOwn === 'MIXED') && !r.isObj);
const OUT_TOP = /^(AI_|CAMERA|SOUND|RENDER|IMPACT_FX|SWORD_TRAIL|CAPE|JOINTS|TEAM_SENSE|TEAM_SUPPORT|DIG_PROTO|MINDSET|MEASURE|OKORI|SHOP|SAENGSA|ARMOR)/;
const PLAYER = /사람|플레이어|손가락|스틱|탭|단추|패드/; const LIMIT = /빠르기|힘|세기|거리|길이|닿|창|시간|초|식힘|간격|쿨|배율|한도|상한/;
const AIONLY = /AI 만|AI 의|AI 는|AI 가/; const VIS = /그림|색|소리|화면|깜빡|카메라|불빛|흔들/;
const cand = prov.filter((r) => !OUT_TOP.test(r.path) && PLAYER.test(r.newText) && LIMIT.test(r.newText) && !(AIONLY.test(r.newText) && !/사람/.test(r.newText)) && !VIS.test(r.newText.slice(0, 60)));
const missing = cand.filter((r) => !openKeys.includes(r.path));
console.log('open-table config keys', openKeys, '| PROV+MIXED leaves in NEW', prov.length, '(PROV', prov.filter((r) => r.newOwn === 'PROV').length, 'MIXED', prov.filter((r) => r.newOwn === 'MIXED').length, ') | player-limiting screen', cand.length, '| not in open table', missing.length);
fs.writeFileSync(out, missing.map((r) => [r.path, r.value, r.newOwn, r.newText.slice(0, 220)].join('\t')).join('\n') + '\n');
