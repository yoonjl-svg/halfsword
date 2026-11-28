// r41 — 정직 심판 결과 표 (시뮬 없음 · honesty_fp.mjs 의 json 만 읽음)
//  node hon_table.mjs --out=<결과 폴더> → 칸(바탕 · FP 10 · FP 230) × 무기마다: 관절 전달 토크(운동량으로 잰 값)가 사람 한도를 넘은 스텝 몫(measOverShare)과
//   요구 토크(다시 센 값)의 넘은 몫(overShare) — 두 몸 · 씨앗 · 관절 14 개의 평균 · 가장 큰 관절 · 칼 든 팔(uarmS · farmS · sword) 평균
import { readFileSync, readdirSync } from 'node:fs'; import { join } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const O = String(args.out ?? '.');
const files = readdirSync(O).filter((f) => /^hon_.*\.json$/.test(f)).sort();
const G = new Map();
for (const f of files) {
  const [, v, w, sd] = f.match(/^hon_(base|fp\d+)_(\w+)_(\d+)\.json$/) ?? []; if (!v) continue;
  const k = `${w} | ${v}`; if (!G.has(k)) G.set(k, { meas: [], req: [], arm: [], max: { v: 0, j: '' }, n: 0 });
  const g = G.get(k);
  for (const e of JSON.parse(readFileSync(join(O, f), 'utf8'))) { g.n++;
    for (const [j, x] of Object.entries(e.joints ?? {})) { g.meas.push(x.measOverShare); g.req.push(x.overShare); if (/^(uarmS|farmS|sword)$/.test(j)) g.arm.push(x.measOverShare); if (x.measOverShare > g.max.v) g.max = { v: x.measOverShare, j: `${j} (${sd} · ${e.title.split(' ')[1]})` }; }
  }
}
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN); const pc = (x) => (x * 100).toFixed(3) + ' %';
console.log('무기 | 칸 | 몸 수 | 전달 넘은 몫 평균 · 칼 든 팔 평균 · 가장 큰 관절 | 요구 넘은 몫 평균');
for (const [k, g] of [...G.entries()].sort()) console.log(`${k} | ${g.n} | ${pc(mean(g.meas))} · ${pc(mean(g.arm))} · ${pc(g.max.v)} ${g.max.j} | ${pc(mean(g.req))}`);
