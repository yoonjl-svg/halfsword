// usage: node classify.cjs <old_keys.json> <new_keys.json> <out.json>
const fs = require('fs');
const [oj, nj, out] = process.argv.slice(2);
const OWNER = [
  /사장님\s*\d{1,2}\/\d{1,2}[^\]\n]{0,40}?결정/,                // 사장님 11/14 결정 / [사장님 11/14 05:1x 결정]
  /\[사장님 \d{1,2}\/\d{1,2}[^\]]*\]/,                          // [사장님 MM/DD …] date tag
  /사장님\s*(\d{1,2}\/\d{1,2})?[^'"‘“\]\n]{0,25}['"‘“][^'"’”]{2,}['"’”]/, // 사장님 MM/DD '…' quote
  /사장님 (값|결정|지시|정함|확정|ok|OK)/,
  /권고대로/,
];
const PROV = [
  /확인 전/, /확인전/, /감독 (안|값|판단|풀이|제안)/, /[는은] 감독(?![가-힣])|값은 감독/, /\[추정|추정\]|값 추정|· 추정/, /작업자 (판단|안|값)/,
  /샛별[^\]\n]{0,40}(값|저장소|첫 값)/, /시작값|첫 값/, /임시/, /미승인/, /답 없음|여쭘/,
];
const NEG = /확인 전 (아님|해제|풀림)|더 이상 확인 전/; // negations, removed before PROV test
function classify(t) {
  const tt = t.replace(NEG, '');
  const o = OWNER.findIndex((r) => r.test(tt)), p = PROV.findIndex((r) => r.test(tt));
  const st = o >= 0 && p >= 0 ? 'MIXED' : o >= 0 ? 'OWNER' : p >= 0 ? 'PROV' : 'NONE';
  return { st, o, p };
}
function run(file) {
  const ks = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const k of ks) { if (k.skipped) continue; k.own = (k.above + ' ' + k.trail).trim(); Object.assign(k, { c: classify(k.own) }); }
  for (const k of ks) { if (k.skipped) continue; let s = k.c.st, via = null, q = k.parent;
    while (s === 'NONE' && q >= 0) { const par = ks[q]; if (par.c.st !== 'NONE') { s = par.c.st; via = par.path; } q = par.parent; }
    k.eff = s; k.via = via; }
  return new Map(ks.filter((k) => !k.skipped).map((k) => [k.path, k]));
}
const O = run(oj), N = run(nj);
const rows = [];
for (const [p, n] of N) { const o = O.get(p); if (!o) continue;
  rows.push({ path: p, value: n.value, oldOwn: o.c.st, newOwn: n.c.st, oldEff: o.eff, newEff: n.eff, oldVia: o.via, newVia: n.via, oldLine: o.line, newLine: n.line, oldText: o.own, newText: n.own, isObj: n.isObj }); }
fs.writeFileSync(out, JSON.stringify(rows));
const tab = (a, b) => { const m = {}; for (const r of rows) { const k = r[a] + '>' + r[b]; m[k] = (m[k] || 0) + 1; } return m; };
const S = ['OWNER', 'MIXED', 'PROV', 'NONE'];
for (const [a, b, lbl] of [['oldOwn', 'newOwn', 'own comment'], ['oldEff', 'newEff', 'effective (inherit from parent if NONE)']]) {
  const m = tab(a, b); console.log('\n' + lbl + ' — rows OLD, cols NEW'); console.log('|OLD\\NEW|' + S.join('|') + '|total|'); console.log('|---|---|---|---|---|---|');
  for (const x of S) console.log('|' + x + '|' + S.map((y) => m[x + '>' + y] || 0).join('|') + '|' + S.reduce((s, y) => s + (m[x + '>' + y] || 0), 0) + '|');
  console.log('|total|' + S.map((y) => S.reduce((s, x) => s + (m[x + '>' + y] || 0), 0)).join('|') + '|' + rows.length + '|');
}
