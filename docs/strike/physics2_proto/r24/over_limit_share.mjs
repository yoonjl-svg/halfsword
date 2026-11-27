// 오늘 몸에서 잰 다리 전달 토크(r19 표본)를 높인 한도에 대 봄: |전달 실제| ÷ 오늘 한도 가 문턱(1.0 · 1.25 · 1.625)을 넘는 표본 몫.
//  node thr.mjs <ab.jsonl>...   — 믿을 표본만(analyze.mjs 와 같은 거름) · 선 몸만 · 축 묶음마다 몫을 내고 가장 큰 묶음과 전체를 적음
import { readFileSync } from 'node:fs';
const THR = [1.0, 1.25, 1.625];
console.log('| 장면 | 표본 | >1.0 전체 (가장 큰 묶음) | >1.25 | >1.625 | 가장 큰 묶음(>1.0) |'); console.log('|---|---|---|---|---|---|');
for (const f of process.argv.slice(2)) {
  const L = readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter((l) => (l.state ?? 'stand') === 'stand');
  const G = {}; let n = 0; const tot = THR.map(() => 0);
  for (const l of L) l.J.forEach((j, ji) => {
    const good = !(l.val && l.val.ej && l.val.ej[ji] > 0.05) && ((l.per?.[ji]?.[0] ?? 0) <= 0.5 || (l.per?.[ji]?.[3] ?? 0) <= 0.02);
    if (!good) return;
    const grp = j.n.startsWith('thigh') ? 'hip' : j.n.startsWith('shin') ? 'knee' : 'ankle';
    for (const [an, a] of Object.entries(j.ax)) {
      const r = a[5]; if (!Number.isFinite(r)) continue;
      const k = `${grp}.${an}.${j.st ? 'S' : 'W'}`, A = (G[k] ||= { n: 0, c: THR.map(() => 0) });
      A.n++; n++; THR.forEach((t, i) => { if (r > t) { A.c[i]++; tot[i]++; } });
    }
  });
  const pc = (x) => (100 * x).toFixed(2) + ' %';
  const mx = THR.map((_, i) => Object.entries(G).filter(([, A]) => A.n >= 200).map(([k, A]) => [A.c[i] / A.n, k]).sort((a, b) => b[0] - a[0])[0] ?? [NaN, '-']);
  console.log(`| ${f.split('/').pop().replace('.ab.jsonl', '')} | ${n} | ${pc(tot[0] / n)} (${pc(mx[0][0])}) | ${pc(tot[1] / n)} (${pc(mx[1][0])}) | ${pc(tot[2] / n)} (${pc(mx[2][0])}) | ${mx[0][1]} |`);
}
