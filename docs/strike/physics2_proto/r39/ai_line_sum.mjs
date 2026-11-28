// r39 확인표 28 — 읽는 값(D7)과 D1 을 trace(ai_line_trace.mjs 가 낸 것)에서 셈 (읽기만)
//  node ai_line_sum.mjs --trace=<trace json> [--waits=<waits json>] [--label=…]
//  무기마다: 탭 획 수(관문과 같은 사건 찾기) · 빠른 줄(칼끝 가장 빠름 > 8 m/s) 몫 · 맞음 몫(모두 · 가까운 장면) · 탭 → 맞음(o → hitI) 가운데 · 상처 갈래 · 탭 앞 쉼 무게 가운데
//  기다림(waits): 수 · 끝 갈래(line · cap · abort · lost) · 길이 가운데 · 90 % · 그 사이 받은 상처 수
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const DT = 1 / 120; const FAST = 8;
const T = JSON.parse(readFileSync(String(args.trace), 'utf8')).strokes;
const qt = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const i = (b.length - 1) * p, l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f = (x, d = 3) => (x == null ? '-' : x.toFixed(d)); const pc = (n, d) => (d ? `${n} / ${d} (${((100 * n) / d).toFixed(1)} %)` : '-');
console.log(`# ${args.label ?? args.trace}`);
console.log('| 무기 | 획 | 빠른 줄 | 맞음 (모두) | 맞음 (가까운) | 탭 → 맞음 가운데 s | 상처 stab / cut / blunt | 빠른 줄의 맞음 | 탭 앞 쉼 무게 가운데 |\n|---|---|---|---|---|---|---|---|---|');
for (const w of ['rapier', 'longsword']) {
  const R = T.filter((r) => r.weapon === w); if (!R.length) continue; const N = R.filter((r) => r.scene === 'near'); const fa = R.filter((r) => r.tipPk > FAST);
  const W = R.filter((r) => r.wound).map((r) => r.wound.type); const c = (t) => W.filter((x) => x === t).length;
  const idle0 = R.map((r) => r.steps[r.o - 1 - r.a]?.idle ?? null);
  console.log(`| ${w} | ${R.length} | ${pc(fa.length, R.length)} | ${pc(R.filter((r) => r.hit).length, R.length)} | ${pc(N.filter((r) => r.hit).length, N.length)} | ${f(qt(R.filter((r) => r.hitI != null).map((r) => (r.hitI - r.o) * DT), 0.5))} | ${c('stab')} / ${c('cut')} / ${c('blunt')} | ${fa.filter((r) => r.hit).length} | ${f(qt(idle0, 0.5), 2)} |`);
}
if (args.waits) {
  const J = JSON.parse(readFileSync(String(args.waits), 'utf8')); const Wt = J.waits;
  console.log(`\n기다림 (상한 ${J.capWait} s · 끝을 못 본 것 ${J.open})`);
  console.log('| 무기 | 수 | line / cap / abort / lost | 길이 가운데 s | 90 % s | 그 사이 받은 상처 (기다림 수) |\n|---|---|---|---|---|---|');
  for (const w of [...new Set(Wt.map((x) => x.w))]) { const X = Wt.filter((x) => x.w === w); const e = (k) => X.filter((x) => x.end === k).length; const d = X.map((x) => x.dur);
    console.log(`| ${w} | ${X.length} | ${e('line')} / ${e('cap')} / ${e('abort')} / ${e('lost')} | ${f(qt(d, 0.5))} | ${f(qt(d, 0.9))} | ${X.reduce((s, x) => s + Math.max(0, x.hurt), 0)} (${X.filter((x) => x.hurt > 0).length}) |`); }
}
