// r35 jump ③ — 실험 견줌 표 (읽기만): 이름=trace[,trace] 여럿을 한 표로
//  node jump_exp.mjs base=a.json,b.json nowg=c.json,d.json ... [--thr=3]
//   뻗음 뜀 스텝 = 단계 뻗음 · 머묾 · dAim ≥ thr · 뻗음 빠른 = 칼끝 가장 빠른 스텝(iT)의 단계가 뻗음 · 머묾이고 > 8 m/s · 뜀 뒤 맞음 = 뜀 스텝 뒤 ≤ 12 스텝 안 맞음
import { readFileSync } from 'node:fs';
const sets = []; let THR = 3; for (const a of process.argv.slice(2)) { if (a.startsWith('--thr=')) THR = +a.slice(6); else { const [n, p] = a.split('='); sets.push([n, p.split(',')]); } }
const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)].toFixed(1) : '-'; };
console.log('| 실험 | 탭 | 뻗음 뜀 스텝 (탭당) | 뜀 있는 탭 | 빠른 탭 (몫) | 뻗음 · 머묾에서 가장 빠른 빠른 탭 | 맞음 | stab / blunt | 맞음 E 가운데 J | 맞음 ≥ 50 J | 뜀 뒤 ≤ 12 스텝 맞음 (≥ 50 J) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const [name, paths] of sets) { const T = paths.flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).strokes).filter((s) => s.tech === 'tap');
  let js = 0, jt = 0, fast = 0, fastExt = 0, hit = 0, st = 0, bl = 0, big = 0, jh = 0, jhBig = 0; const E = [];
  for (const s of T) { const i0 = s.t0 - s.a; const jumps = [];
    for (let i = Math.max(1, i0); i < s.steps.length; i++) { const c = s.steps[i]; if (c && (c.ph === '뻗음' || c.ph === '머묾') && c.dAim >= THR) jumps.push(s.a + i); }
    js += jumps.length; if (jumps.length) jt++; if (s.tipPk > 8) { fast++; const cT = s.steps[s.iT - s.a]; if (cT && (cT.ph === '뻗음' || cT.ph === '머묾')) fastExt++; }
    if (s.hit) { hit++; const w = s.wound; if (w?.type === 'stab') st++; if (w?.type === 'blunt') bl++; E.push(w?.E ?? null); if ((w?.E ?? 0) >= 50) big++;
      if (s.hitI != null && jumps.some((i) => s.hitI >= i && s.hitI <= i + 12)) { jh++; if ((w?.E ?? 0) >= 50) jhBig++; } } }
  console.log(`| ${name} | ${T.length} | ${js} (${(js / T.length).toFixed(2)}) | ${jt} | ${fast} (${((100 * fast) / T.length).toFixed(0)} %) | ${fastExt} | ${hit} | ${st} / ${bl} | ${med(E)} | ${big} | ${jh} (${jhBig}) |`); }
