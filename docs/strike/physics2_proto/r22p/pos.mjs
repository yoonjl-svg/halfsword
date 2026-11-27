// r22p 자세 증명 표: node pos.mjs <나온 곳> <칸 나옴 폴더...> [--offs=0,300] — fall_cost.mjs --posture 표본(posture_<묶음>.json)의 가운데 값.
//  열: 가만히 선 때(두 발 디딤 · 무게중심 수평 속도 < 0.15 m/s · 서 있음) 더 실린 다리(N 큰 쪽)의 무릎 굽힘 ·
//   디딤 때 무릎 굽힘 — 걸음 꼴별(walk = 보통 걸음 · req = 기술 · AI 가 부탁한 걸음 · catch = 받아 딛기) · 디딘 뒤 0.5 s(60 스텝, 다시 뜨면 거기까지) 안 가장 깊은 굽힘 ·
//   서 있는 동안 골반 높이(땅 위). 각은 도, 높이는 m. 무릎 굽힘 셈은 fall_cost.mjs mechOf 와 같음(엉덩이 ~ 발목 거리 → 코사인 법칙).
import { readFileSync, existsSync } from 'node:fs';
const argv = process.argv.slice(2);
const offs = (argv.find((a) => a.startsWith('--offs=')) ?? '--offs=0,300').slice(7).split(',').map(Number);
const [O, ...cells] = argv.filter((a) => !a.startsWith('--'));
const med = (a) => { if (!a.length) return NaN; a = [...a].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const D = (x) => (x * 180 / Math.PI).toFixed(1);
console.log(`묶음 ${offs.join(' · ')}`);
console.log('| 칸 | 선 채 실린 무릎 ° (표본) | 디딤 walk ° (수) | 디딤 req ° (수) | 디딤 catch ° (수) | 0.5 s 안 가장 깊은 walk ° | … req ° | … catch ° | 골반 높이 m |');
console.log('|---|---|---|---|---|---|---|---|---|');
const rows = {};
for (const c of cells) {
  const P = { still: [], pelvis: [], td: [] }; let n = 0;
  for (const off of offs) { const f = `${O}/${c}/posture_${off}.json`; if (!existsSync(f)) continue; const x = JSON.parse(readFileSync(f, 'utf8')); n++; for (const k in P) P[k].push(...x[k]); }
  const td = (k) => P.td.filter((t) => t[0] === k);
  const r = { n, still: med(P.still), walk: med(td('walk').map((t) => t[1])), req: med(td('req').map((t) => t[1])), catch: med(td('catch').map((t) => t[1])), wMx: med(td('walk').map((t) => t[2])), rMx: med(td('req').map((t) => t[2])), cMx: med(td('catch').map((t) => t[2])), pelvis: med(P.pelvis) };
  rows[c] = r;
  console.log(`| ${c}${n < offs.length ? ` (묶음 ${n}/${offs.length})` : ''} | ${D(r.still)} (${P.still.length}) | ${D(r.walk)} (${td('walk').length}) | ${D(r.req)} (${td('req').length}) | ${D(r.catch)} (${td('catch').length}) | ${D(r.wMx)} | ${D(r.rMx)} | ${D(r.cMx)} | ${r.pelvis.toFixed(3)} |`);
}
// 무효 판정(미리 정한 규칙): 디딤(walk · catch) 또는 선 채 무릎이 바탕(첫 칸)보다 3° 미만으로 움직였으면 무효
const b = rows[cells[0]];
console.log('\n바탕 대비 차 (°) — 3° 미만이면 무효(선 채 · walk 디딤 · catch 디딤 가운데 가장 크게 움직인 것으로 판정):');
for (const c of cells.slice(1)) { const r = rows[c]; const d = { still: (r.still - b.still) * 180 / Math.PI, walk: (r.walk - b.walk) * 180 / Math.PI, catch: (r.catch - b.catch) * 180 / Math.PI }; const mx = Math.max(...Object.values(d).map(Math.abs)); console.log(`  ${c}: 선 채 ${d.still.toFixed(1)} · walk ${d.walk.toFixed(1)} · catch ${d.catch.toFixed(1)} · 골반 ${((r.pelvis - b.pelvis) * 100).toFixed(1)} cm → ${mx >= 3 ? '유효' : '무효'}`); }
