// r35 jump ⑤ — 장검 AI 찌르기 기술 길(stich)의 끝(휘두름 깃발이 꺼지는 스텝 ± 2)에 명령 칼 방향 뜀의 출처 (읽기만 · jump_trace 탐침 기록)
//  node jump_ls.mjs --trace=a.json[,b] [--thr=8]   (thr = 진단 J 의 dAimPk ≥ 8°)
//   획마다 t0 ~ 창 끝에서 swing 참 → 거짓 스텝을 찾고 그 −2 ~ +2 스텝의 가장 큰 dAim · 출처(source2 · 위쪽이면 단계) · 단계 값(n = 그 스텝 driveSword 부름 수 · thw · tilt 유무)
import { readFileSync } from 'node:fs';
import { stepSources, source2, ang } from './jump_lib.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const THR = +(args.thr ?? 8);
const T = String(args.trace).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).strokes.map((s, j) => ({ ...s, j })));
const cnt = {}; let n = 0, nJ = 0; const out = [];
for (const s of T) { if (s.tech === 'tap') continue; n++; const i0 = s.t0 - s.a; let off = null;
  for (let i = i0 + 1; i < s.steps.length; i++) if (s.steps[i - 1]?.swing && !s.steps[i]?.swing) { off = i; break; }
  if (off == null) continue; let best = null;
  for (let i = off - 2; i <= off + 2; i++) { const c = s.steps[i], p = s.steps[i - 1]; if (!c || !p) continue; if (!best || c.dAim > best.d) best = { i, d: c.dAim, src: stepSources(p, c), c, p }; }
  if (!best || !(best.d >= THR)) continue; nJ++; const k = source2(best.src); cnt[k] = (cnt[k] || 0) + 1;
  const tiltOn = best.c.as && best.p.as ? ang(best.c.as.wi, best.c.as.tilt) - ang(best.p.as.wi, best.p.as.tilt) : null;
  out.push(`${s.seed} ${s.who} #${s.j} ${s.tech} 꺼짐 k${off - i0} · 가장 큰 뜀 k${best.i - i0} ${best.d.toFixed(1)}° · 출처 ${k} · 기술 길 칼끝 들기 각 변화 ${tiltOn == null ? '-' : tiltOn.toFixed(1)}° · 가지 ${best.p.as?.wgBr}>${best.c.as?.wgBr} · 칼끝 ${s.tipPk.toFixed(1)} · ${s.hit ? s.wound?.type + ' ' + (s.wound?.E ?? 0).toFixed(1) + ' J' : '안 맞음'}`); }
console.log(`장검 기술 길 찌르기 ${n} · 꺼짐 ± 2 스텝 뜀 ≥ ${THR}° ${nJ}`); for (const [k, v] of Object.entries(cnt)) console.log(`  ${k}: ${v}`); for (const l of out) console.log('  ' + l);
