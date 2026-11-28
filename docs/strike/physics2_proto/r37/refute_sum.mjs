// r37 반박 요약 (읽기만) — refute_split.mjs 의 결과 (split_*.json) 를 표로
//  node refute_sum.mjs <json> [<json> …]
//   칼이 안 닿고 놓기 없는 스텝만 (사람 장면은 관문 획 창 t0 ~ 창 끝 · AI 는 선 채 스텝 · 이름표별)
//   A 검산: 느슨 스텝 |res| ÷ |tot| 가운데 / 95 % · |jud − 심판 mHist| 가운데 / 95 % · jud > 25 와 심판 > 25 몫
//   B 다시 판정 흔들림: wr > W (W 10 · 15 · 20 · 25) 또는 lev > d × F (F 150 · 200 · 250) 의 몫
//   C 방향 잣대: 옆 꺾기 몫 wRU > R (R 10 · 15) · 굽힘/폄 wFE > 25 · 비틀기 wPS > 13 · 셋 가운데 하나 또는 lev > d × F
//   D 새는 길: 서보 srv 최고 · 칼 팔 팔꿈치 > 80 · 어깨 > 100 · 빈팔 팔꿈치 > 80 · 어깨 > 100 (심판 mHist · 잰 스텝 몫) · 빈손 F 95 %
import { readFileSync } from 'node:fs';
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pc = (a, fn) => (a.length ? (100 * a.filter(fn).length / a.length).toFixed(1) : '-');
const G = new Map(); const add = (k, x) => { let g = G.get(k); if (!g) G.set(k, (g = [])); g.push(x); };
for (const fn of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(fn, 'utf8'));
  for (const r of d.rows) {
    if (r.scene === 'ai') { for (const x of r.steps) if (x && x.st === 'stand' && !x.nc && !x.placed) add(`ai · ${r.weapon} · ${x.lab}`, x); }
    else { const k = `${r.scene} · ${r.weapon} · ${r.form ?? 'tap'}`; for (let i = Math.max(0, r.k0); i <= Math.min(r.steps.length - 1, r.kEnd); i++) { const x = r.steps[i]; if (x && !x.nc && !x.placed) add(k, x); } }
  }
}
const keys = [...G.keys()].sort();
const lo = (x, F) => x.d != null && x.lev > x.d * F + 1e-9;
console.log('## A 검산');
console.log('| 묶음 | 스텝 | 느슨 res÷tot 가운데 / 95 % | |jud−심판| 가운데 / 95 % (잰 몫) | jud > 25 | 심판 > 25 |'); console.log('|---|---|---|---|---|---|');
for (const k of keys) { const g = G.get(k); const taut = (x) => x.a1 > 162.7 || x.a2 > 79.7; const sl = g.filter((x) => !taut(x) && x.tot > 1).map((x) => x.res / x.tot); const J = g.filter((x) => x.judge != null); const dif = J.map((x) => Math.abs(x.jud - x.judge));
  console.log(`| ${k} | ${g.length} | ${f2(q(sl, 0.5))} / ${f2(q(sl, 0.95))} | ${f2(q(dif, 0.5))} / ${f2(q(dif, 0.95))} (${pc(g, (x) => x.judge != null)} %) | ${pc(g, (x) => x.jud > 25)} | ${pc(J, (x) => x.judge > 25)} |`); }
const WW = [10, 15, 20, 25], FF = [150, 200, 250];
console.log('\n## B 다시 판정 — wr > W 또는 lev > d×F (스텝 %) · 앞 넷은 wr 만 · lev 만');
console.log(`| 묶음 | ${WW.map((w) => `wr>${w}`).join(' | ')} | ${FF.map((f) => `lev>d·${f}`).join(' | ')} | ${WW.flatMap((w) => FF.map((f) => `W${w}F${f}`)).join(' | ')} |`); console.log('|---|' + '---|'.repeat(WW.length + FF.length + WW.length * FF.length));
for (const k of keys) { const g = G.get(k); console.log(`| ${k} | ${WW.map((w) => pc(g, (x) => x.wr > w)).join(' | ')} | ${FF.map((f) => pc(g, (x) => lo(x, f))).join(' | ')} | ${WW.flatMap((w) => FF.map((f) => pc(g, (x) => x.wr > w || lo(x, f)))).join(' | ')} |`); }
console.log('\n## C 방향 잣대 (N·m 가운데 / 95 % · 몫 %)');
console.log('| 묶음 | 옆 꺾기 wRU | 굽힘/폄 wFE | 비틀기 wPS | wRU>10 | wRU>15 | wFE>25 | wPS>13 | 셋 중 하나(R10) | 하나(R10) 또는 lev>d·250 | 하나(R15) 또는 lev>d·250 | 하나(R10) 또는 lev>d·150 |'); console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const k of keys) { const g = G.get(k); const t = (c) => `${f1(q(g.map((x) => x[c]), 0.5))} / ${f1(q(g.map((x) => x[c]), 0.95))}`; const ax = (x, R) => x.wRU > R || x.wFE > 25 || x.wPS > 13;
  console.log(`| ${k} | ${t('wRU')} | ${t('wFE')} | ${t('wPS')} | ${pc(g, (x) => x.wRU > 10)} | ${pc(g, (x) => x.wRU > 15)} | ${pc(g, (x) => x.wFE > 25)} | ${pc(g, (x) => x.wPS > 13)} | ${pc(g, (x) => ax(x, 10))} | ${pc(g, (x) => ax(x, 10) || lo(x, 250))} | ${pc(g, (x) => ax(x, 15) || lo(x, 250))} | ${pc(g, (x) => ax(x, 10) || lo(x, 150))} |`); }
console.log('\n## D 새는 길');
console.log('| 묶음 | 서보 srv 95 % / 최고 | wr 95 % / 최고 | 빈손 F 95 % / 최고 | lev 95 % | 칼 팔꿈치 >80 | 칼 어깨 >100 | 빈 팔꿈치 >80 | 빈 어깨 >100 | 칼 어깨 95 % |'); console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const k of keys) { const g = G.get(k); const J = (n) => g.map((x) => x.jx?.[n]).filter((v) => v != null); const ov = (n, L) => { const a = J(n); return a.length ? (100 * a.filter((v) => v > L).length / a.length).toFixed(1) : '-'; };
  const mx = (c) => f1(Math.max(...g.map((x) => x[c] ?? 0)));
  console.log(`| ${k} | ${f1(q(g.map((x) => x.srv), 0.95))} / ${mx('srv')} | ${f1(q(g.map((x) => x.wr), 0.95))} / ${mx('wr')} | ${f1(q(g.map((x) => x.F), 0.95))} / ${mx('F')} | ${f1(q(g.map((x) => x.lev), 0.95))} | ${ov('farmS', 80)} | ${ov('uarmS', 100)} | ${ov('farmO', 80)} | ${ov('uarmO', 100)} | ${f1(q(J('uarmS'), 0.95))} |`); }
