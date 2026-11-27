// r28 고침(팔 풀이 함수 나눠 씀) 뒤 칸이 고침 앞 칸과 같은 결과를 내는가 (시뮬레이션 없음 — 나온 파일만 견줌)
//  node repair_ident.mjs <고침 앞 나옴> <고침 앞 칸 이름> <고침 뒤 나옴> <고침 뒤 칸 이름>   예: $S/r28/a r28_a $S/r28/repair_a r28r_a
//  json 은 내용(args · 경로 · 시간 빼고) · 글은 칸 이름 · 경로 · 'ms' 시간 · 'duration' 줄을 지우고 견줌. 단위 시험은 깨진 시험 이름 목록으로
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const [A, an, B, bn] = process.argv.slice(2);
const strip = (t) => t.split(an).join('#').split(bn).join('#').replace(/\/tmp\/\S+/g, '@').replace(/[\d.]+ ?ms\b/g, 'T').split('\n').filter((l) => !/duration_ms|^# (duration|start)/.test(l)).join('\n');
const J = (p) => { const j = JSON.parse(readFileSync(p, 'utf8')); delete j.args; delete j.root; delete j.time; return JSON.stringify(j).split(an).join('#').split(bn).join('#'); };
const fails = (p) => [...new Set(readFileSync(p, 'utf8').split('\n').filter((l) => /^\s*not ok /.test(l)).map((l) => l.replace(/^\s*not ok \d+ - /, '').trim()))].sort().join('\n');
const pairs = [['gate_4001-4040.json'], ['gate_4041-4080.json'], ['gate_6001-6040.json'], ['legs.json'], [`fb/${an}/fall_0.json`, `fb/${bn}/fall_0.json`], [`fb/${an}/fall_300.json`, `fb/${bn}/fall_300.json`], ['fp23_cmp.txt'], ['fp_r20cmp.txt'],
  ...['1', '2', '34', 'r1'].map((k) => [`fin/${an}/fin_rows_${k}.txt`, `fin/${bn}/fin_rows_${k}.txt`]),
  ...existsSync(`${A}/pp`) ? readdirSync(`${A}/pp`).filter((f) => f.includes(an) && f.endsWith('.json')).map((f) => [`pp/${f}`, `pp/${f.replace(an, bn)}`]) : []];
let same = 0, diff = 0, miss = 0;
for (const [x, y = x] of pairs) { const pa = `${A}/${x}`, pb = `${B}/${y}`; if (!existsSync(pa) || !existsSync(pb)) { console.log(`없음 ${x}`); miss++; continue; }
  const ok = x.endsWith('.json') ? J(pa) === J(pb) : strip(readFileSync(pa, 'utf8')) === strip(readFileSync(pb, 'utf8')); console.log(`${ok ? '같음' : '다름'} ${y}`); ok ? same++ : diff++; }
if (existsSync(`${A}/tests.txt`) && existsSync(`${B}/tests.txt`)) { const ok = fails(`${A}/tests.txt`) === fails(`${B}/tests.txt`); console.log(`${ok ? '같음' : '다름'} 단위 시험 깨진 이름 목록 (${fails(`${B}/tests.txt`).split('\n').filter(Boolean).length} 개)`); ok ? same++ : diff++; }
console.log(`같음 ${same} · 다름 ${diff} · 없음 ${miss}`);
