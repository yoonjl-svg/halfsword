// usage: node groups.cjs <rows.json> <old>:<new>[,<old>:<new>...] [eff]
const fs = require('fs'); const [rj, spec, mode] = process.argv.slice(2);
const PROV = /확인 전|확인전|감독 (안|값|판단|풀이|제안)|[는은] 감독(?![가-힣])|값은 감독|\[추정|추정\]|값 추정|· 추정|작업자 (판단|안|값)|샛별[^\]\n]{0,40}(값|저장소|첫 값)|시작값|첫 값|임시|미승인|답 없음|여쭘/g;
const pairs = spec.split(',').map((s) => s.split(':'));
const rows = JSON.parse(fs.readFileSync(rj, 'utf8'));
const A = mode ? 'oldEff' : 'oldOwn', B = mode ? 'newEff' : 'newOwn';
const g = new Map();
for (const r of rows) if (pairs.some(([a, b]) => r[A] === a && r[B] === b)) { const k = r.newLine + '|' + r.oldLine; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
let i = 0;
for (const [k, rs] of g) { const r = rs[0];
  const snips = [...new Set([...r.oldText.matchAll(PROV)].map((m) => r.oldText.slice(Math.max(0, m.index - 110), m.index + 40).replace(/\s+/g, ' ')))];
  console.log(`\nG${++i} [${r[A]}→${r[B]}] old L${r.oldLine} new L${r.newLine} keys(${rs.length}): ${rs.map((x) => x.path.split('.').slice(-1)[0] + '=' + x.value).join(', ').slice(0, 300)}  first=${r.path}`);
  console.log('  OLD-PROV: ' + snips.join(' ‖ ').slice(0, 700));
  console.log('  NEW: ' + r.newText.slice(0, 500));
}
