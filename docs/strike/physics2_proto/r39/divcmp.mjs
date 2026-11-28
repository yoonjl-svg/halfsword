// 두 div json 의 첫 갈림 스텝 · 그 근처 tapLine 시작
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map((p) => JSON.parse(readFileSync(p, 'utf8')));
let first = -1;
for (let i = 0; i < Math.min(a.rows.length, b.rows.length); i++) if (JSON.stringify(a.rows[i]) !== JSON.stringify(b.rows[i])) { first = i; break; }
const st = b.starts.filter((s) => s.step <= first + 1);
console.log(JSON.stringify({ first, sec: first >= 0 ? +(first / 120).toFixed(3) : null, startsUpTo: st, firstStart: b.starts[0] ?? null, nStarts: b.starts.length }));
