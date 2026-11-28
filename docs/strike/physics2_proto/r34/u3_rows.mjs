// ─────────────────────────────────────────────────────────────
//  u3_rows.mjs (r34 · 뛰기 여섯째 진단 · 안 본 판) — 관문 판 파일(run_scenes 요약)을 묶음마다 넘어짐 수와 '버틴 판'의 줄 가운데값 / 가장 나쁜 값으로 견준다. 읽기만.
//   node u3_rows.mjs <이름>=<판 파일,판 파일…> [<이름>=…]   (예: base.seen=$S/cache_base/<해시>/hop.zweihander.0-7.json)
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const st99 = (r, ax) => r.share?.[ax]?.st99 ?? NaN;
// [이름, 뽑기, 나쁜 쪽(+1 큰 것이 나쁨 · −1 작은 것이 나쁨)]
const COLS = [
  ['힘20Hz', (r) => r.fyPeakLpBW, 1], ['충격량최소', (r) => r.impRatioMin, -1], ['충격량최대', (r) => r.impRatioMax, 1], ['뜬디딤몫', (r) => r.flightShare05, -1],
  ['숙임바뀜', (r) => r.pitchFlightMax, 1], ['기울평균', (r) => r.tiltMean, 1], ['흐름6s', (r) => r.drift, 1], ['뒤3s빠르기', (r) => r.drift3sSpeed, 1],
  ['깎임몫', (r) => r.cutShare, 1], ['무릎99', (r) => st99(r, 'knee'), 1], ['발목99', (r) => st99(r, 'ankle'), 1], ['관절끝', (r) => r.endMax, 1], ['골반최저', (r) => r.pelvisMin, -1], ['무릎깊이°', (r) => r.kneeDeepDeg, 1],
];
console.log(['묶음', '판', '넘어짐', ...COLS.map((c) => c[0] + '(가운데/나쁨)')].join(' | '));
for (const a of process.argv.slice(2)) {
  const [name, list] = a.split('=');
  const runs = list.split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
  const ok = runs.filter((r) => !r.fell);
  const cells = COLS.map(([, g, s]) => { const v = ok.map(g).filter(Number.isFinite); return `${f(med(v))}/${f(s > 0 ? Math.max(...v) : Math.min(...v))}`; });
  console.log([name, runs.length, runs.length - ok.length, ...cells].join(' | '));
}
