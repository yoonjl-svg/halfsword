// ─────────────────────────────────────────────────────────────
//  hop_force_table.mjs — 제자리 뜀 수직 힘 최고: 거르지 않음 · 20 Hz · 25 Hz 를 판마다 나란히 (r27_hop_force.md 의 표). 재기만 — 시뮬레이션을 돌리지 않는다.
//
//   node tools/sim/hop_force_table.mjs <hop.<무기>.<판>.json> [...] [--gate=2.4]
//   입력 = run_scenes.mjs --scene=hop --json 의 결과(run_gate.mjs 캐시의 그 파일). 거른 값은 파일 안 판 전체 줄(fyBW · 창 fyWin)에서 lowpass.mjs 로 다시 센다.
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LP = await import(pathToFileURL(join(HERE, 'lowpass.mjs')).href);
const argv = process.argv.slice(2), files = argv.filter((a) => !a.startsWith('--'));
const GATE = +(argv.find((a) => a.startsWith('--gate='))?.slice(7) ?? 2.4), FS = 120;
const f2 = (x) => (x == null ? '-' : x.toFixed(2));
const rows = [], cols = { raw: [], 20: [], 25: [] };
for (const p of files) {
  const J = JSON.parse(readFileSync(p, 'utf8'));
  for (const r of J.runs) {
    const ok = r.fyBW && r.fyWin?.[0] >= 0, x = ok ? Float64Array.from(r.fyBW) : null;
    const v = { raw: r.fyPeakBW, 20: ok ? LP.peakFiltered(x, FS, 20, r.fyWin[0], r.fyWin[1]) : null, 25: ok ? LP.peakFiltered(x, FS, 25, r.fyWin[0], r.fyWin[1]) : null };
    for (const k of Object.keys(cols)) if (v[k] != null) cols[k].push(v[k]);
    rows.push(`| ${r.weapon} | ${r.variant} | ${r.fell ? '넘어짐 ' + (r.tFall ?? '') : '-'} | ${f2(v.raw)} | ${f2(v[20])} | ${f2(v[25])} | ${v[20] != null ? (100 * v[20] / v.raw).toFixed(0) + ' %' : '-'} |`);
  }
}
const sum = (k) => { const a = cols[k].slice().sort((p, q) => p - q); return a.length ? { mx: a[a.length - 1], med: a[a.length >> 1], mn: a[0], over: a.filter((v) => v > GATE + 1e-12).length, n: a.length } : null; };
console.log('| 무기 | 판 | 넘어짐 | 거르지 않음 (옛 값) | 20 Hz | 25 Hz | 20 Hz ÷ 옛 값 |\n|---|---|---|---|---|---|---|\n' + rows.join('\n'));
console.log(`\n| 읽는 법 | 가장 작음 | 가운데값 | 가장 큼 | 금 ${GATE} 넘은 판 | 줄 판정 |\n|---|---|---|---|---|---|`);
for (const [k, name] of [['raw', '거르지 않음 (옛 줄)'], ['20', '20 Hz (새 줄 기본)'], ['25', '25 Hz']]) {
  const s = sum(k); if (!s) continue;
  console.log(`| ${name} | ${f2(s.mn)} | ${f2(s.med)} | ${f2(s.mx)} | ${s.over} / ${s.n} | ${s.mx <= GATE + 1e-12 ? 'PASS' : 'FAIL'} |`);
}
