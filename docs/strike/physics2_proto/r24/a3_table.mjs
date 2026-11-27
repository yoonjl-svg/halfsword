// r24 A3 표: 축마다 (가) 근육 토크 부호 바뀜 수(서기 4 s + 앞 걷기 4 s + 런지 2 판 · 연속 스텝)와 (나) 30 s 서기의 60 Hz 몫을 바탕(엔진 모터)과 견줌.
//  node a3_table.mjs <폴더 = $S/r24/a13> <바탕 TAG> <시험 TAG>   (파일: <TAG>_stand.jsonl · _walk · _lunge · _stand30 — run_a13.sh 가 씀)
//  판정: 축마다 시험 ≤ 바탕 이면 PASS (바뀜 수는 세 장면 합 · 60 Hz 는 stand30). 셈은 a13.mjs 와 같은 것(그 파일을 --json 으로 부름).
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const [dir, B, T] = process.argv.slice(2);
const A13 = join(dirname(fileURLToPath(import.meta.url)), 'a13.mjs');
const get = (tag) => JSON.parse(execFileSync('node', [A13, '--a3only', '--json', `s=${join(dir, tag + '_stand.jsonl')}`, `w=${join(dir, tag + '_walk.jsonl')}`, `l=${join(dir, tag + '_lunge.jsonl')}`, `stand30=${join(dir, tag + '_stand30.jsonl')}`]).toString().trim().split('\n').pop());
const b = get(B), t = get(T);
const AX = ['abd', 'rot', 'flex', 'knee', 'ankInv', 'ankRot', 'ankle'].flatMap((a) => ['F', 'B'].map((l) => a + l));
let okF = true, okA = true;
console.log(`축       바뀜 수 (서기+걷기+런지) ${B} / ${T}    60 Hz 몫 (30 s 서기 · rad/s) ${B} / ${T}`);
for (const a of AX) {
  const n = (o) => ['s', 'w', 'l'].reduce((x, k) => x + (o[k].flips[a]?.n ?? 0), 0);
  const fb = n(b), ft = n(t), ab = b.stand30.a60[a], at = t.stand30.a60[a];
  okF &&= ft <= fb; okA &&= at <= ab;
  console.log(`${a.padEnd(8)} ${String(fb).padStart(6)} / ${String(ft).padEnd(6)} ${ft <= fb ? 'PASS' : 'FAIL'}            ${ab.toFixed(4)} / ${at.toFixed(4)} ${at <= ab ? 'PASS' : 'FAIL'}`);
}
const tot = (o) => AX.reduce((x, a) => x + ['s', 'w', 'l'].reduce((y, k) => y + (o[k].flips[a]?.n ?? 0), 0), 0);
console.log(`합       ${tot(b)} / ${tot(t)}`);
console.log(`A3 (가) 부호 바뀜 ${okF ? 'PASS' : 'FAIL'} · (나) 60 Hz ${okA ? 'PASS' : 'FAIL'} → A3 ${okF && okA ? 'PASS' : 'FAIL'}`);
