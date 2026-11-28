// r35 jump — 뻗는 중(당김 끝 뒤 · 단계 뻗음 · 머묾) 명령 칼 방향 한 스텝 뜀의 출처 세기 (읽기만 · jump_trace 의 탐침 칸 기록)
//  node jump_sum.mjs --trace=a.json[,b.json] [--thr=3] [--list=1] [--tab=seed:who:j:k0:k1]
//   뜀 스텝 = 단계 뻗음 · 머묾 · dAim ≥ thr(°, 기본 3 — 과제의 '3.6 ~ 33°' 아래 끝 밑) · 출처 = jump_lib source2(wg 손목 지킴 · raw 세로 이월 · up:단계) + 손목 지킴 가지 바뀜(wgBr)
//   wg 는 가지로 셋: 켜짐(맞는 손 면 → 반씩 끌기) · 꺼짐(끌기 → 맞는 손 면) · 끌기 안(두 스텝 다 끌기 · 끄는 각이 바뀜)
//   획 갈래: J = 뜀 스텝이 있음 (출처 = 가장 큰 뜀의 출처) · N = 없음. 맞음 · 상처 갈래 · 에너지 · 빠름(> 8 m/s) · 뜀 뒤 0 ~ 6 스텝 안에 칼끝 가장 빠름 · 뜀 뒤 0 ~ 12 스텝 안에 맞음
import { readFileSync } from 'node:fs';
import { stepSources, source2, STAGES } from './jump_lib.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const THR = +(args.thr ?? 3);
const T = String(args.trace).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).strokes.map((s, j) => ({ ...s, j })));
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const f1 = (x) => (x == null ? '-' : x.toFixed(1));
const rows = [];
for (const s of T) { if (s.tech !== 'tap') continue; const i0 = s.t0 - s.a; const J = [];
  for (let i = Math.max(1, i0); i < s.steps.length; i++) { const c = s.steps[i], p = s.steps[i - 1]; if (!c || !p) continue; if (!(c.ph === '뻗음' || c.ph === '머묾')) continue; if (!(c.dAim >= THR)) continue;
    const src = stepSources(p, c); let top = source2(src); if (top === 'wg') { const a = p.as?.wgBr, b = c.as?.wgBr; top = a !== 'bis' && b === 'bis' ? 'wg:켜짐' : a === 'bis' && b !== 'bis' ? 'wg:꺼짐' : a === 'bis' && b === 'bis' ? 'wg:끌기 안' : 'wg:' + a + '>' + b; } J.push({ k: i - i0, i: s.a + i, d: c.dAim, top, br: `${p.as?.wgBr ?? '-'}>${c.as?.wgBr ?? '-'}`, wfix: c.wfix, wfixP: p.wfix, ph: c.ph, tapSame: c.tapId === p.tapId }); }
  const big = J.reduce((m, x) => (!m || x.d > m.d ? x : m), null);
  const nearTip = big ? s.iT >= big.i && s.iT <= big.i + 6 : false; const nearHit = big && s.hitI != null ? s.hitI >= big.i && s.hitI <= big.i + 12 : false;
  rows.push({ seed: s.seed, who: s.who, j: s.j, scene: s.scene, path: s.path ?? 'ai', tip: s.tipPk, fast: s.tipPk > 8, hit: !!s.hit, type: s.wound?.type ?? null, E: s.wound?.E ?? null, sp: s.wound?.sp ?? null, nJ: J.length, big, src: big ? big.top : 'N', nearTip, nearHit, J }); }
const groups = {}; for (const r of rows) (groups[r.src] ||= []).push(r);
console.log(`탭 ${rows.length} · 뜀 금 ${THR}° · 뜀 있는 탭 ${rows.filter((r) => r.nJ).length}`);
console.log('| 출처(가장 큰 뜀) | 탭 | 빠른 | 가장 큰 뜀 ° 가운데 · 가장 큼 | 가장 빠름이 뜀 뒤 ≤ 6 스텝 | 맞음 | 뜀 뒤 ≤ 12 스텝 맞음 | stab/cut/blunt | 에너지 J 가운데 | 닿는 m/s 가운데 | 칼끝 가운데 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, g] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) { const h = g.filter((r) => r.hit); const tc = (t) => h.filter((r) => r.type === t).length;
  console.log(`| ${k} | ${g.length} | ${g.filter((r) => r.fast).length} | ${k === 'N' ? '-' : f1(med(g.map((r) => r.big.d))) + ' · ' + f1(Math.max(...g.map((r) => r.big.d)))} | ${g.filter((r) => r.nearTip).length} | ${h.length} | ${g.filter((r) => r.nearHit).length} | ${tc('stab')}/${tc('cut')}/${tc('blunt')} | ${f1(med(h.map((r) => r.E)))} | ${f1(med(h.map((r) => r.sp)))} | ${f1(med(g.map((r) => r.tip)))} |`); }
// 모든 뜀 스텝의 출처 · 손목 지킴 가지 바뀜
const allJ = rows.flatMap((r) => r.J); const cnt = {}; for (const x of allJ) { const key = x.top; cnt[key] = (cnt[key] || 0) + 1; }
console.log(`\n뜀 스텝 ${allJ.length} — 출처 · (wg 이면 앞 > 이 스텝 가지):`); for (const [k, v] of Object.entries(cnt).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
// 뜀으로 맞은 탭 (뜀 뒤 ≤ 12 스텝 맞음) 대 나머지 맞음
const jh = rows.filter((r) => r.nearHit), oh = rows.filter((r) => r.hit && !r.nearHit); const tcs = (g, t) => g.filter((r) => r.type === t).length;
console.log(`\n맞음 견줌: 뜀 뒤 ≤ 12 스텝 맞음 ${jh.length} (stab ${tcs(jh, 'stab')} · cut ${tcs(jh, 'cut')} · blunt ${tcs(jh, 'blunt')} · E 가운데 ${f1(med(jh.map((r) => r.E)))} J · 닿는 ${f1(med(jh.map((r) => r.sp)))} m/s) · 나머지 맞음 ${oh.length} (stab ${tcs(oh, 'stab')} · cut ${tcs(oh, 'cut')} · blunt ${tcs(oh, 'blunt')} · E ${f1(med(oh.map((r) => r.E)))} J · 닿는 ${f1(med(oh.map((r) => r.sp)))} m/s)`);
if (args.list) for (const r of rows.filter((r) => r.nJ)) console.log(`  ${r.seed} ${r.who} #${r.j} ${r.scene} 칼끝 ${f1(r.tip)} · 뜀 ${r.nJ} · 가장 큰 k${r.big.k} ${f1(r.big.d)}° ${r.big.top} ${r.big.br} wfix ${f1(r.big.wfixP)}→${f1(r.big.wfix)} · ${r.hit ? `${r.type} ${f1(r.E)} J` : '안 맞음'}${r.nearHit ? ' (뜀 뒤)' : ''}`);
if (args.tab) { const [sd, who, jj, k0, k1] = String(args.tab).split(':'); const s = T.find((x) => x.seed === +sd && x.who === who && x.j === +jj); const i0 = s.t0 - s.a;
  console.log(`\n| k | 단계 | 칼끝 m/s | Δ명령칼 ° | 탭 섞기 단계 th 한 스텝 ° | 세로 이월이 바꾼 각 ° | 손목 지킴이 바꾼 각 ° | 가지 | 칼↔명령 ° | 손목 토크 ÷ 한도 |`); console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (let k = +k0; k <= +k1; k++) { const c = s.steps[i0 + k], p = s.steps[i0 + k - 1]; const src = stepSources(p, c);
    console.log(`| ${k}${s.t0 + k === s.iT ? '*' : ''}${s.t0 + k === s.hitI ? ' 맞음' : ''} | ${c.ph} | ${f1(c.sp)} | ${f1(c.dAim)} | ${f1(src?.th.d)} | ${f1(src?.raw.own)} | ${f1(src?.wg.own)} | ${c.as?.wgBr ?? '-'} | ${f1(c.aimSword)} | ${c.tqWr == null ? '-' : c.tqWr.toFixed(2)} |`); } }
