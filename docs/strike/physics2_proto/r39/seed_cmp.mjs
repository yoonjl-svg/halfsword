// r39 D5 (읽기만) — 관문 json 두 벌의 rows 를 길 · 무기마다 씨앗으로 묶어 견줌 (자리로 견주면 한 판이 갈린 뒤 줄이 밀려 모두 다르게 보임)
//  node seed_cmp.mjs --a=<바탕 gate json> --b=<새 gate json>
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const A = JSON.parse(readFileSync(String(args.a), 'utf8')).rows, B = JSON.parse(readFileSync(String(args.b), 'utf8')).rows;
const g = (x) => `${x.path} ${x.weapon}`;
for (const k of [...new Set(A.map(g))]) {
  const seeds = [...new Set([...A, ...B].filter((x) => g(x) === k).map((x) => x.seed))].sort((x, y) => x - y);
  const diff = seeds.filter((s) => JSON.stringify(A.filter((x) => g(x) === k && x.seed === s)) !== JSON.stringify(B.filter((x) => g(x) === k && x.seed === s)));
  const rowsSame = seeds.filter((s) => !diff.includes(s)).reduce((n, s) => n + A.filter((x) => g(x) === k && x.seed === s).length, 0);
  console.log(`${k}: 판 ${seeds.length} · 다른 판 ${diff.length}${diff.length && diff.length <= 12 ? ' (' + diff.join(' ') + ')' : ''} · 같은 판의 줄 ${rowsSame} / ${A.filter((x) => g(x) === k).length}`);
}
