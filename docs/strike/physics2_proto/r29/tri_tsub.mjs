// r29 새 실패 가름 2 — '제비 베기 견줌 판' (tools/sim/schielhau_strike.test.mjs · tsubameRun(seed, { immortal, dur 14, ghostDown })) 을 씨앗 1 ~ 8 로 풀어 봄:
//  시험이 보는 수(한 벌 combos ≥ 2 · 제비 베기 firedCombos ≥ 1 · 아래 칼 맞음 downContacts 0) + 왜 그런지 보는 수(사람 몸이 넘어진 수 falls · 가장 가까운 거리 · 칠 거리 REACH + 0.3 안에 든 스텝 몫 · 지침)
//  쓰는 법: (cd <나무> && node <이 파일> [--root=.])
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const { tsubameRun, tsubameSummary } = await import(pathToFileURL(join(ROOT, 'tools/sim/schielhau_strike.mjs')).href);
let pass = 0;
for (let seed = 1; seed <= 8; seed++) {
  let n = 0, dMin = 9, notStand = 0, exh = 0;
  const r = tsubameRun(seed, { immortal: true, dur: 14, ghostDown: true, onStep: (G, P) => { n++; const d = P.foeDistance(); dMin = Math.min(dMin, d); if (P.state !== 'stand') notStand++; if (P.stamina.exhausted) exh++; } });
  const d = tsubameSummary([r]);
  const ok = d.combos >= 2 && d.firedCombos >= 1 && d.downContacts === 0;
  if (ok) pass++;
  console.log(`씨앗 ${seed}: ${ok ? '통과' : '실패'} · 한 벌 ${d.combos} · 제비 베기 ${d.firedCombos} · 아래 칼 맞음 ${d.downContacts} · 넘어짐 ${JSON.stringify(r.falls)} · 판 ${r.t.toFixed(1)} s · 잰 스텝 ${n} · 가장 가까움 ${dMin.toFixed(2)} m · 선 자세 아님 ${n ? ((100 * notStand) / n).toFixed(0) : '-'} % · 지침 ${n ? ((100 * exh) / n).toFixed(0) : '-'} %`);
}
console.log(`씨앗 8 가운데 통과 ${pass}`);
