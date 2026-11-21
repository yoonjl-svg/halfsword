// usage: node blocktag.cjs <rows.json> <out.tsv>  — BLOCK-TAG pass + '확인 전' kept-rule check
const fs = require('fs'); const [rj, out] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(rj, 'utf8'));
const OWN = /사장님\s*\d{1,2}\/\d{1,2}|사장님 (값|결정|지시|확인|승인)|권고대로|\[사장님 \d/;
const PROVSEG = /확인 전|감독 (안|값|판단|추천)|[는은] 감독(?![가-힣])|\[추정|추정\]|작업자 (판단|안|값)|시작값|임시/;
const KEEPMARK = /확인 전|추정|감독|작업자|시험|설계 값/;
const blockSize = {}; for (const r of rows) blockSize[r.oldText] = (blockSize[r.oldText] || 0) + 1;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const res = []; let viol = [];
for (const r of rows) {
  const leaf = r.path.split('.').pop(); const re = new RegExp('(^|[^A-Za-z0-9_])' + esc(leaf) + '([^A-Za-z0-9_]|$)');
  const segs = r.oldText.split(' / ');
  const ownerSegs = segs.filter((s) => OWN.test(s)), provSegs = segs.filter((s) => PROVSEG.test(s));
  const shared = blockSize[r.oldText] > 1;
  const namedOwner = ownerSegs.some((s) => re.test(s)), namedProv = provSegs.some((s) => re.test(s));
  // '확인 전' rule: old comment put a provisional mark on THIS key (single-key comment, or a segment naming it) and NEW has no mark
  const oldProvForKey = provSegs.length && (!shared || namedProv);
  if (oldProvForKey && !KEEPMARK.test(r.newText)) viol.push(r);
  if (!(r.newOwn === 'OWNER' || r.newOwn === 'MIXED')) continue;
  let cls;
  if (!ownerSegs.length) cls = 'NEW-TAG(no owner text in OLD)';
  else if (!shared) cls = 'OK-own-comment';
  else if (namedOwner) cls = 'OK-named-in-block';
  else if (r.isObj) cls = 'HEADER(object)';
  else cls = namedProv ? 'BLOCK-TAG(old named key as provisional)' : 'BLOCK-TAG';
  res.push({ ...r, cls, namedProv, oldProvForKey });
}
const by = {}; for (const r of res) by[r.cls] = (by[r.cls] || 0) + 1; console.log('owner-tagged NEW keys', res.length, by);
const bt = res.filter((r) => r.cls.startsWith('BLOCK-TAG')); const perTop = {}; for (const r of bt) { const t = r.path.split('.')[0]; perTop[t] = (perTop[t] || 0) + 1; }
console.log('BLOCK-TAG per top-level block', JSON.stringify(perTop));
console.log("'확인 전' kept-rule violations", viol.length, viol.map((r) => r.path).join(' '));
fs.writeFileSync(out, ['class\tpath\tvalue\tnewStatus\tnewTag\toldBlockKeys'].concat(res.filter((r) => r.cls.startsWith('BLOCK') || r.cls.startsWith('NEW-TAG')).map((r) => [r.cls, r.path, r.value, r.newOwn, (r.newText.match(/\[사장님[^\]]*\]/g) || []).join(' '), blockSize[r.oldText]].join('\t'))).join('\n') + '\n');
fs.writeFileSync(out.replace('.tsv', '_viol.tsv'), viol.map((r) => [r.path, r.value, r.oldText.split(' / ').filter((s) => PROVSEG.test(s)).join(' ‖ ').slice(0, 300), r.newText.slice(0, 300)].join('\t')).join('\n') + '\n');
