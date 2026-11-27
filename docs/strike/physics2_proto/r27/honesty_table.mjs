// r27 C3 곁줄: probe 로 돈 honesty.mjs 장면(stand · walk · back · strafe)의 장부 줄 몇 칸을 옛 → 새 로. node honesty_table.mjs <probe 폴더> <옛> <새>
import { readFileSync } from 'node:fs';
const [dir, A, B] = process.argv.slice(2);
const pick = (t, re) => { const m = t.match(re); return m ? m[1] : '-'; };
const K = [['선 힘 몫(밖) %', /선 힘 몫\(밖[^)]*\)\s+([\d.]+) %/], ['일 몫(밖) %', /일 몫\(밖\)\s+([\d.]+) %/], ['숨은 기울기 토크 평균 N·m', /숨은 기울기 토크 평균 ([\d.]+) N·m/], ['엔진이 봐준 비틀림 마찰 N·m', /엔진이 봐준 비틀림 마찰 ([\d.]+) N·m/], ['땅 법선 ÷ 체중 %', /땅 법선 ÷ 체중\s+([\d.]+) %/], ['골반 높이 평균 m', /골반 높이 평균 ([\d.]+)/]];
console.log('장면 | ' + K.map((k) => k[0]).join(' | '));
for (const sc of ['stand', 'walk', 'back', 'strafe']) {
  const a = readFileSync(`${dir}/${A}_${sc}.log`, 'utf8'), b = readFileSync(`${dir}/${B}_${sc}.log`, 'utf8');
  console.log(`${sc} | ` + K.map(([, re]) => `${pick(a, re)} → ${pick(b, re)}`).join(' | '));
}
