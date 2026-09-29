// compare counterfactual runs vs base: tip speed ratio per weapon/fam/mode, and hand peak ratio
// 실행: node tools/redesign_probes/cmp_cf.js NAME... (run_cf.sh 결과 tools/redesign_probes/out/cf_*.json 을 읽는다)
const fs = require('fs');
const path = require('path');
const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, 'out', `cf_${n}.json`))).results;
const base = load('base');
const key = (r) => `${r.weapon}/${r.fam}/${r.hz}/${r.v}/${r.mode}`;
const B = Object.fromEntries(base.map((r) => [key(r), r.sm]));
const names = process.argv.slice(2);
const geo = (a) => Math.exp(a.reduce((s, x) => s + Math.log(x), 0) / a.length);
console.log('config'.padEnd(10), 'weapon'.padEnd(10), 'mode'.padEnd(6), 'tip ratio (diagR vert horizR)  | hand ratio | geo-mean tip');
for (const n of names) {
  const R = load(n);
  for (const w of [...new Set(R.map((r) => r.weapon))])
    for (const m of ['arm', 'commit']) {
      const rs = R.filter((r) => r.weapon === w && r.mode === m);
      const tr = rs.map((r) => r.sm.tip / B[key(r)].tip);
      const hr = rs.map((r) => r.sm.hand / B[key(r)].hand);
      console.log(n.padEnd(10), w.padEnd(10), m.padEnd(6), rs.map((r, i) => `${r.fam}:${r.sm.tip}(${tr[i].toFixed(2)})`).join(' ').padEnd(52), hr.map((x) => x.toFixed(2)).join(' '), '|', geo(tr).toFixed(3));
    }
}
// commit/arm ratio within each config
console.log('\ncommit/arm tip ratio within config');
for (const n of ['base', ...names]) {
  const R = load(n);
  const out = [];
  for (const r of R.filter((r) => r.mode === 'commit')) {
    const a = R.find((x) => x.mode === 'arm' && x.weapon === r.weapon && x.fam === r.fam && x.hz === r.hz && x.v === r.v);
    out.push(`${r.weapon.slice(0, 5)}/${r.fam}:${(r.sm.tip / a.sm.tip).toFixed(2)}`);
  }
  console.log(n.padEnd(10), out.join(' '));
}
