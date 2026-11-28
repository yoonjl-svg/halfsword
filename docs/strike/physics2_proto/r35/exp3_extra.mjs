// r35 exp3 — trace_*.json 여럿을 나란히: 빠른 줄 갈래(칼끝 가장 빠른 때의 단계) · 뻗는 중 명령 뜀 · θ0 · 당김 시간 · 맞음 (읽기만 · proto_sum.mjs 곁)
//  node exp3_extra.mjs 이름=trace.json[,trace2.json] 이름2=… [--fast=8] [--thr=3] [--w=rapier]
//   빠른 줄 = tipPk > fast. 갈래 = iT 의 단계 (탭 앞: iT < o · 탭 뒤: iT 에 탭 없음 · 아니면 trace 의 ph — 당김 · 머묾발 · 뻗음 · 머묾 · 되돌림)
//   뜀 스텝 = jump_sum.mjs 와 같은 정의 — tap 획 · t0 부터 · 단계 뻗음 · 머묾 · dAim(서보로 가는 명령 칼 방향 한 스텝 각) ≥ thr °
//   (θ0 는 trace 에 찌르기 선이 없어 여기서 적지 않음 — 당김 시간은 proto_sum.mjs)
//   당김 명령 한 스텝 각 = 당김 스텝 dAim 의 가운데 · 99 % · 가장 큼 (E1 묶음이 걸렸는지 — 290 °/s = 2.42 ° · 145 °/s = 1.21 °/스텝)
import { readFileSync } from 'node:fs';
const args = {}, sets = [];
for (const a of process.argv.slice(2)) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (m) args[m[1]] = m[2] ?? true; else { const i = a.indexOf('='); sets.push([a.slice(0, i), a.slice(i + 1)]); } }
const FAST = +(args.fast ?? 8), THR = +(args.thr ?? 3), W = args.w ? String(args.w) : null, DT = 1 / 120;
const qt = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const i = (b.length - 1) * p, l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const PH = ['탭 앞', '당김', '머묾발', '뻗음', '머묾', '되돌림', '탭 뒤'];
function one(R) {
  const fast = R.filter((r) => r.tipPk > FAST); const ph = {}; for (const k of PH) ph[k] = 0;
  for (const r of fast) { const p = r.steps[r.iT - r.a]; const k = r.iT < r.o ? '탭 앞' : !p?.tap ? '탭 뒤' : p.ph; ph[k] = (ph[k] ?? 0) + 1; }
  let jSteps = 0, jTaps = 0, jFast = 0; const jBig = [];
  const pullD = [];
  for (const r of R) { if (r.tech !== 'tap') continue; const i0 = r.t0 - r.a; let n = 0, big = 0;
    for (let i = Math.max(1, i0); i < r.steps.length; i++) { const c = r.steps[i]; if (!c || !(c.ph === '뻗음' || c.ph === '머묾')) continue; if (!(c.dAim >= THR)) continue; n++; big = Math.max(big, c.dAim); }
    jSteps += n; if (n) { jTaps++; jBig.push(big); if (r.tipPk > FAST) jFast++; }
    for (let i = r.o - r.a; i < r.steps.length; i++) { const s = r.steps[i]; if (!s) continue; if (s.tap && s.ph === '당김') pullD.push(s.dAim); else if (i > r.o - r.a + 2) break; } }
  const hit = R.filter((r) => r.hit), Wd = hit.map((r) => r.wound).filter(Boolean); const ty = (t) => Wd.filter((w) => w.type === t).length;
  return [
    ['줄', R.length],
    [`빠른 줄 > ${FAST}`, `${fast.length} (${f((100 * fast.length) / Math.max(1, R.length), 1)} %)`],
    ['빠른 줄 갈래 (가장 빠른 때) ' + PH.join(' · '), PH.map((k) => ph[k]).join(' · ')],
    ['맞음 · stab / cut / blunt', `${hit.length} · ${ty('stab')} / ${ty('cut')} / ${ty('blunt')}`],
    ['빠른 줄의 맞음 · stab / blunt', (() => { const h = fast.filter((r) => r.hit).map((r) => r.wound).filter(Boolean); return `${fast.filter((r) => r.hit).length} · ${h.filter((w) => w.type === 'stab').length} / ${h.filter((w) => w.type === 'blunt').length}`; })()],
    [`뻗는 중 뜀 스텝 (≥ ${THR}°) · 뜀 탭 · 그 가운데 빠른`, `${jSteps} · ${jTaps} · ${jFast}`],
    ['뜀 탭의 가장 큰 뜀 ° 가운데 · 가장 큼', `${f(qt(jBig, 0.5))} · ${f(jBig.length ? Math.max(...jBig) : null)}`],
    ['당김 스텝 명령 한 스텝 ° 가운데 · 99 % · 가장 큼', `${f(qt(pullD, 0.5), 2)} · ${f(qt(pullD, 0.99), 2)} · ${f(pullD.length ? Math.max(...pullD) : null, 2)} (${pullD.length})`],
  ];
}
const cols = sets.map(([n, p]) => [n, one(String(p).split(',').flatMap((q) => JSON.parse(readFileSync(q, 'utf8')).strokes).filter((r) => !W || r.weapon === W))]);
console.log(`| 줄 | ${cols.map((c) => c[0]).join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|`);
for (let i = 0; i < cols[0][1].length; i++) console.log(`| ${cols[0][1][i][0]} | ${cols.map((c) => c[1][i][1]).join(' | ')} |`);
