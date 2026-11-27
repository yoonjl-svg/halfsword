// r27 run_rest.sh 표: S=<scratch> node rest_table.mjs
import { readFileSync, existsSync } from 'node:fs';
const O = process.env.S + '/r27/rest';
const rd = (f) => (existsSync(`${O}/${f}`) ? readFileSync(`${O}/${f}`, 'utf8') : '');
const lines = (f) => rd(f).split('\n').filter(Boolean);
const t = rd('tests.txt');
const m = (k) => t.match(new RegExp(`^# ${k} (\\d+)`, 'm'))?.[1] ?? '-';
console.log(`단위 시험 (이 나무): 통과 ${m('pass')} · 실패 ${m('fail')} · 실패 이름 ${lines('tests_fail.txt').length} 개 · 39 이름에 없는 새 실패 ${lines('new_fail.txt').length} 개`);
for (const n of lines('new_fail.txt')) console.log('  새 실패: ' + n);
for (const f of ['tri_new.txt', 'tri_base.txt']) if (rd(f)) { const L = lines(f).filter((l) => l.includes('seed')); const fail = L.filter((l) => /# fail [1-9]/.test(l)).length; console.log(`  ${f}: 씨앗 줄 ${L.length} · 진 줄 ${fail}`); }
for (const l of lines('rerun.txt')) console.log('  다시 돌림: ' + l);
const g = rd('gate.txt').trim().split('\n').slice(-3).join(' / ');
console.log(`균형 관문 (lc_10_100 · 씨앗 100-139): ${g || '-'}  (오늘 0.55 ~ 0.56)`);
console.log(existsSync(process.env.S + '/r27/DONE_rest') ? '끝남' : '아직 도는 중');
