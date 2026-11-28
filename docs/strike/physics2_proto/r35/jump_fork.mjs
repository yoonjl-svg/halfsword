// r35 jump ③ 갈래 실험 견줌 (읽기만): 바탕 줄과 갈래(그 탭 하나만 실험) 줄의 같은 탭(같은 몸 · 같은 o)을 나란히
//  node jump_fork.mjs --base=a.json,b.json --dir=<폴더> --list=<fork_list.txt> [--thr=3]   (fork 결과 파일 = trace_fork_<seed>_<who>_<o>.json)
import { readFileSync, existsSync } from 'node:fs'; import { join } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const THR = +(args.thr ?? 3); const B = String(args.base).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).strokes);
const ext = (s) => { const i0 = s.t0 - s.a; let mx = 0, n = 0; for (let i = Math.max(1, i0); i < s.steps.length; i++) { const c = s.steps[i]; if (c && (c.ph === '뻗음' || c.ph === '머묾')) { if (c.dAim > mx) mx = c.dAim; if (c.dAim >= THR) n++; } } return { mx, n }; };
const d = (s) => { if (!s) return '줄 없음'; const e = ext(s); return `칼끝 ${s.tipPk.toFixed(1)} (iT k${s.iT - s.t0}) · 뻗음 뜀 ${e.n} · 가장 큰 ${e.mx.toFixed(1)}° · ${s.hit ? `${s.wound?.type} ${(s.wound?.E ?? 0).toFixed(1)} J · 닿는 ${(s.wound?.sp ?? 0).toFixed(1)}` : '안 맞음'}`; };
console.log('| 판 · 몸 · o | 실험 | 바탕 | 그 탭만 실험 |'); console.log('|---|---|---|---|');
for (const line of readFileSync(String(args.list), 'utf8').trim().split('\n')) { const [seed, who, , o, exp] = line.split(' '); const f = join(String(args.dir), `trace_fork_${seed}_${who}_${o}.json`); if (!existsSync(f)) continue;
  const b = B.find((s) => s.seed === +seed && s.who === who && s.o === +o); const F = JSON.parse(readFileSync(f, 'utf8')).strokes.find((s) => s.who === who && Math.abs(s.o - +o) <= 2);
  console.log(`| ${seed} ${who} ${o} | ${exp} | ${d(b)} | ${d(F)} |`); }
