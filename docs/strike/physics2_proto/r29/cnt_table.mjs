// r29 늘어나는 배율이 걸리는 몫 표: node cnt_table.mjs <cnt.json>
import { readFileSync } from 'node:fs';
const a = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const AX = ['엉덩이 x(벌림 · 모음)', '엉덩이 y(돌림)', '엉덩이 z(굽힘 · 폄)', '무릎', '발목 x(안팎)', '발목 y(비틀기)', '발목 z(발바닥 · 발등)'];
const pc = (x, n) => (n ? ((100 * x) / n).toFixed(1) : '-');
for (const [ph, nm] of [[0, '디딘 다리(받치기)'], [1, '내딛는 다리(끌기)']]) {
  console.log(`\n${nm}: 축 | 부름 | wE > 0 % | 배율 다 참(wE ≥ 1) % | 잘림(한도 닿음) % | 잘림 가운데 wE > 0 % | 잘림 가운데 다 참 %`);
  console.log('|---|---|---|---|---|---|---|');
  const T = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 7; i++) { const o = (ph * 7 + i) * 6, r = a.slice(o, o + 6); r.forEach((v, j) => (T[j] += v));
    console.log(`| ${AX[i]} | ${r[0]} | ${pc(r[1], r[0])} | ${pc(r[2], r[0])} | ${pc(r[3], r[0])} | ${pc(r[4], r[3])} | ${pc(r[5], r[3])} |`); }
  console.log(`| 모두 | ${T[0]} | ${pc(T[1], T[0])} | ${pc(T[2], T[0])} | ${pc(T[3], T[0])} | ${pc(T[4], T[3])} | ${pc(T[5], T[3])} |`);
}
