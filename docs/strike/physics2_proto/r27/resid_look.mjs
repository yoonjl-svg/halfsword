// r27 C2 진단: 구동이 한도에 닿은(|명시| ÷ 한도 ≥ 0.999) 믿을 표본(나머지 스텝)을 A/B 풀이 상대 잔차(per[0])로 나눠 > 1 몫과 넘친 크기를 봄 — 잔차가 작은 표본에서 사라지면 풀이 오차.
//  node resid_look.mjs <probe 폴더> <이름>...
import { readFileSync, existsSync } from 'node:fs';
const [dir, ...tags] = process.argv.slice(2);
const SC = ['fight', 'lunge', 'walk', 'back', 'strafe', 'stand'];
const B = [[0, 0.02], [0.02, 0.05], [0.05, 0.1], [0.1, 0.2], [0.2, 9]];
for (const tag of tags) {
  const R = B.map(() => ({ n: 0, o: 0, ex: [] }));
  for (const sc of SC) { const f = `${dir}/${tag}_${sc}.ab.jsonl`; if (!existsSync(f)) continue;
    for (const l of readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse)) {
      if ((l.state ?? 'stand') !== 'stand' || !l.reg || l.cc) continue;
      l.J.forEach((j, ji) => {
        const good = !(l.val && l.val.ej && l.val.ej[ji] > 0.05) && ((l.per?.[ji]?.[0] ?? 0) <= 0.5 || (l.per?.[ji]?.[3] ?? 0) <= 0.02);
        if (!good) return;
        const r = l.per?.[ji]?.[0] ?? 0, bi0 = B.findIndex(([a, b]) => r >= a && r < b), bi = bi0 < 0 ? B.length - 1 : bi0;
        for (const a of Object.values(j.ax)) { if (Math.abs(a[4]) / a[10] < 0.999) continue; const X = R[bi]; X.n++; if (a[5] > 1) { X.o++; X.ex.push(Math.abs(a[9]) - a[10]); } }
      });
    } }
  console.log(`${tag} 구동이 한도에 닿은 표본 — 풀이 잔차 칸마다 n · > 1 몫 · 넘친 크기 가운데(N·m): ` + R.map((X, i) => `[${B[i][0]}, ${B[i][1]}) ${X.n} · ${X.n ? (100 * X.o / X.n).toFixed(0) : '-'}% · ${X.ex.length ? X.ex.sort((a, b) => a - b)[X.ex.length >> 1].toFixed(2) : '-'}`).join(' | '));
}
