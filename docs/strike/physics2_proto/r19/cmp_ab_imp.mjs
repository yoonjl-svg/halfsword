// A/B 표본(probe R19_OUT)에서 세 값 견줌: A/B 실제 모터 · 충격량 읽기(imp) · 다시 센 값(rec). 알려진 답 검산(val.ej)이 5 % 안인 관절만.
//  node cmp_ab_imp.mjs <ab.jsonl>
import { readFileSync } from 'node:fs';
const L = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const acc = {};
let used = 0, skipped = 0;
for (const l of L) l.J.forEach((j, ji) => {
  if (l.val && l.val.ej[ji] > 0.05) { skipped++; return; }
  used++;
  for (const [an, a] of Object.entries(j.ax)) {
    const [imp, ab, mom, rec] = a;
    const tdw = j.st && j.since >= 0 && j.since < 4 ? 'T' : j.st ? 'S' : 'W';
    for (const k of [j.n.replace(/[FB]$/, '') + '.' + an + '.' + (j.st ? 'S' : 'W'), j.n.replace(/[FB]$/, '') + '.' + an + '.' + tdw + '*']) {
      const A = (acc[k] ||= { n: 0, ii: 0, ia: 0, aa: 0, rr: 0, ra: 0, absab: 0, absrec: 0, absimp: 0 });
      if (mom != null) { A.mn = (A.mn || 0) + 1; A.mabs = (A.mabs || 0) + Math.abs(mom); A.mab = (A.mab || 0) + mom * ab; A.mm = (A.mm || 0) + mom * mom; A.mimp = (A.mimp || 0) + mom * imp; A.mrec = (A.mrec || 0) + mom * rec; A.recabs2 = (A.recabs2 || 0) + Math.abs(rec); A.ababs2 = (A.ababs2 || 0) + Math.abs(ab); A.impabs2 = (A.impabs2 || 0) + Math.abs(imp); A.aa2 = (A.aa2 || 0) + ab * ab; A.ii2 = (A.ii2 || 0) + imp * imp; A.rr2 = (A.rr2 || 0) + rec * rec; }
      A.n++; A.ii += imp * imp; A.ia += imp * ab; A.aa += ab * ab; A.rr += rec * rec; A.ra += rec * ab; A.absab += Math.abs(ab); A.absrec += Math.abs(rec); A.absimp += Math.abs(imp);
    }
  }
});
console.log(`관절 표본 ${used} (검산 5 % 넘어 뺀 것 ${skipped})`);
console.log('축(S 디딤 · W 뜸 · T* 디딘 뒤 4 스텝)   n   |AB| 평균  |imp| 평균  |rec| 평균   AB÷imp 기울기  상관   AB÷rec 기울기  상관   평균|AB|÷평균|rec|');
for (const [k, A] of Object.entries(acc).sort()) {
  if (k.endsWith('*') && !k.includes('.T*')) continue;
  const f = (x) => x.toFixed(2).padStart(7);
  console.log(k.padEnd(22), String(A.n).padStart(5), f(A.absab / A.n), f(A.absimp / A.n), f(A.absrec / A.n), f(A.ia / A.ii), f(A.ia / Math.sqrt(A.ii * A.aa)), f(A.ra / A.rr), f(A.ra / Math.sqrt(A.rr * A.aa)), f(A.absab / Math.max(1e-9, A.absrec)));
}
console.log('뜬 발 발목: 발 한 몸 운동량으로 잰 정답(mom)과 견줌');
for (const [k, A] of Object.entries(acc).sort()) if (A.mn) console.log(k.padEnd(22), 'n', A.mn, '|mom| 평균', (A.mabs / A.mn).toFixed(2), '|AB|', (A.ababs2 / A.mn).toFixed(2), '|imp|', (A.impabs2 / A.mn).toFixed(2), '|rec|', (A.recabs2 / A.mn).toFixed(2), ' AB÷mom 기울기', (A.mab / A.mm).toFixed(3), '상관', (A.mab / Math.sqrt(A.mm * A.aa2)).toFixed(3), ' imp÷mom', (A.mimp / A.mm).toFixed(3), '상관', (A.mimp / Math.sqrt(A.mm * A.ii2)).toFixed(3), ' rec÷mom', (A.mrec / A.mm).toFixed(3), '상관', (A.mrec / Math.sqrt(A.mm * A.rr2)).toFixed(3));
