// r35 시제품 — 관문 json 두 벌(바탕 · 시제품)의 rows 를 무리(path · weapon · scene)마다 견줌 (읽기만)
//  node proto_gate_cmp.mjs --a=<바탕 gate json> --b=<시제품 gate json>
//  무리마다: 줄 수 · 글자까지 같은 줄 수 · 첫 다른 줄(씨앗 · rep) · 맞음 수 · 칼끝 가장 빠름 가운데 · > 8 m/s 수
//  AI 무리는 씨앗마다 첫 다른 획의 차례도 적음(싸움이 한 번 갈리면 뒤가 달라짐)
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const A = JSON.parse(readFileSync(String(args.a), 'utf8')).rows, B = JSON.parse(readFileSync(String(args.b), 'utf8')).rows;
const key = (x) => `${x.path} ${x.weapon} ${x.scene}`;
const groups = [...new Set([...A, ...B].map(key))];
const med = (a) => { const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return b.length ? (b[(b.length - 1) >> 1] + b[b.length >> 1]) / 2 : null; };
const f = (x, d = 2) => (x == null ? '-' : x.toFixed(d));
console.log('| 무리 | 줄 바탕 / 시제품 | 같은 줄 | 첫 다름 | 맞음 바탕 / 시제품 | 칼끝 가운데 | > 8 m/s |\n|---|---|---|---|---|---|---|');
for (const g of groups) {
  const a = A.filter((x) => key(x) === g), b = B.filter((x) => key(x) === g);
  let same = 0, first = null;
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i] && b[i] && JSON.stringify(a[i]) === JSON.stringify(b[i])) same++; else if (!first) first = a[i] ?? b[i]; }
  console.log(`| ${g} | ${a.length} / ${b.length} | ${same} | ${first ? `${first.seed} r${first.rep ?? '-'}` : '-'} | ${a.filter((x) => x.hit).length} / ${b.filter((x) => x.hit).length} | ${f(med(a.map((x) => x.tipPk)))} / ${f(med(b.map((x) => x.tipPk)))} | ${a.filter((x) => x.tipPk > 8).length} / ${b.filter((x) => x.tipPk > 8).length} |`);
}
