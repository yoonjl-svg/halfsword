// usage: node show.cjs <rows.json> <oldStatus> <newStatus> [eff]
const fs = require('fs'); const [rj, a, b, mode] = process.argv.slice(2);
const PROV = /확인 전|확인전|감독 (안|값|판단|풀이|제안)|[는은] 감독(?![가-힣])|값은 감독|\[추정|추정\]|값 추정|· 추정|작업자 (판단|안|값)|샛별[^\]\n]{0,40}(값|저장소|첫 값)|시작값|첫 값|임시|미승인|답 없음|여쭘/g;
const rows = JSON.parse(fs.readFileSync(rj, 'utf8'));
const A = mode ? 'oldEff' : 'oldOwn', B = mode ? 'newEff' : 'newOwn';
let i = 0;
for (const r of rows) if (r[A] === a && r[B] === b) {
  const snips = [...r.oldText.matchAll(PROV)].map((m) => r.oldText.slice(Math.max(0, m.index - 70), m.index + 30).replace(/\s+/g, ' '));
  console.log(`#${++i} ${r.path} = ${r.value} (old L${r.oldLine} new L${r.newLine}) oldLen=${r.oldText.length}${r.newVia ? ' via ' + r.newVia : ''}`);
  console.log('  OLDPROV: ' + snips.slice(0, 3).join(' ‖ '));
  console.log('  NEW: ' + r.newText.slice(0, 400));
}
