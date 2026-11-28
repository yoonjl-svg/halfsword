// r37 요약 — wrist_split.mjs 의 결과 (split_*.json) 를 표로 (읽기만)
//  node split_sum.mjs <json> [<json> …] [--lim=25]
//   묶음 = 장면 · 무기 · 동작(사람: 베기 꼴 / 찌르기 · AI: 스텝 이름표). 사람 장면은 관문 획 창(t0 ~ 맞음 또는 1.5 s) 안 스텝만.
//   표 1 가름: ① 손목 관절 몫 wr · ② 지렛대 몫 lev · ③ 닿음 con · ④ 무게 grav · 판정 충격 oth — 가운데 · 95 % · 최고 (N·m)
//   표 2 심판: 심판 정의 jud > 25 몫 · 엔진 심판 값(honesty mHist)과 견줌 · 빈손 힘 F · 곧은 몫 Fp (N) · 두 손 사이 d (m) · 빈손 실제 거리 dh
//   표 3 다시 판정: wr > W 몫 · lev > d × F 몫 · 둘 중 하나 몫 (W = 15 · 25 · 40 · F = 150 · 250 · 400)
//   표 4 검산: 닿음 없고 손목 밧줄 둘 다 느슨한 스텝의 |res| ÷ |tot| · |res| (N·m)
//   표 5 때: 사람 베기의 획 구간별 wr > 25 몫 (첫 움직임 → 칼끝 가장 빠름을 셋으로 · 그 뒤 → 창 끝)
import { readFileSync } from 'node:fs';
const files = process.argv.slice(2).filter((a) => !a.startsWith('--')); const ALL = process.argv.includes('--all');
//   기본: 칼이 아무것과도 안 닿은 스텝만 (닿은 스텝은 엔진이 접선 마찰을 안 내줘 res 에 마찰이 섞임 — 심판도 이 스텝은 안 잼). --all = 모든 스텝
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-'), pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + ' %' : '-');
const G = new Map(); const add = (k, x, meta) => { if (!x) return; let g = G.get(k); if (!g) G.set(k, (g = { xs: [], units: [], phase: {} })); g.xs.push({ ...x, ...meta }); };
for (const fn of files) {
  const d = JSON.parse(readFileSync(fn, 'utf8'));
  for (const r of d.rows) {
    if (r.scene === 'ai') {
      let run = null; const flush = () => { if (run && run.n >= 3) G.get(run.key)?.units.push(run); run = null; };
      for (const x of r.steps) { if (!x || x.st !== 'stand') { flush(); continue; } const key = `ai · ${r.weapon} · ${x.lab}`; add(key, x, { seed: r.seed, who: r.who });
        if (!run || run.lab !== x.lab) { flush(); run = { key, lab: x.lab, n: 0, pk: 0, over: 0 }; } if (!ALL && (x.nc || x.placed)) continue; run.n++; run.pk = Math.max(run.pk, x.wr); if (x.jud > 25) run.over++; }
      flush();
    } else if (r.scene === 'stand') { for (const x of r.steps) add(`stand · ${r.weapon} · pad ${r.pad.join(',')}`, x, {});
    } else {
      const key = `${r.scene} · ${r.weapon} · ${r.form ?? 'tap'}`; const g0 = G.get(key);
      const unit = { n: 0, pk: 0, over: 0, tip: r.tipPk, hit: r.hit };
      for (let i = Math.max(0, r.k0); i <= Math.min(r.steps.length - 1, r.kEnd); i++) { const x = r.steps[i]; if (!x) continue; add(key, x, { seed: r.seed });
        if (!ALL && (x.nc || x.placed)) continue; unit.n++; unit.pk = Math.max(unit.pk, x.wr); if (x.jud > 25) unit.over++;
        const u = i <= r.kTip ? (i - r.k0) / Math.max(1, r.kTip - r.k0) : 2; const ph = u < 1 / 3 ? 'a 첫 ⅓' : u < 2 / 3 ? 'b 가운데 ⅓' : u <= 1 ? 'c 끝 ⅓(가장 빠름까지)' : 'd 가장 빠름 뒤';
        const P = (G.get(key).phase[ph] ||= { n: 0, ow: 0, oj: 0 }); P.n++; if (x.wr > 25) P.ow++; if (x.jud > 25) P.oj++; }
      G.get(key)?.units.push(unit); void g0;
    }
  }
}
const keys = [...G.keys()].sort();
for (const g of G.values()) { g.all = g.xs; if (!ALL) g.xs = g.xs.filter((x) => !x.nc && !x.placed); }
console.log(ALL ? '(모든 스텝)' : '(칼이 안 닿은 스텝만 — 닿은 스텝 몫은 표 4)');
const col = (g, k) => g.xs.map((x) => x[k]);
console.log('\n## 표 1 가름 (N·m · 가운데 / 95 % / 최고)');
console.log('| 묶음 | 스텝 | ① 손목 관절 wr | ② 지렛대 lev | ③ 닿음 con | ④ 무게 grav | 판정 충격 oth | 심판 정의 jud |'); console.log('|---|---|---|---|---|---|---|---|');
for (const k of keys) { const g = G.get(k); const t = (c) => `${f1(q(col(g, c), 0.5))} / ${f1(q(col(g, c), 0.95))} / ${f1(Math.max(...col(g, c)))}`; console.log(`| ${k} | ${g.xs.length} | ${t('wr')} | ${t('lev')} | ${t('con')} | ${t('grav')} | ${t('oth')} | ${t('jud')} |`); }
console.log('\n## 표 2 심판 · 빈손 (지금 심판 한도 25)');
console.log('| 묶음 | jud > 25 | wr > 25 | 엔진 심판 값 > 25 (잰 스텝 몫) | |jud − 심판| 가운데 · 95 % | 빈손 힘 F 가운데 / 95 % / 최고 | 곧은 몫 Fp 95 % | d (m) | 빈손 실제 거리 dh 가운데 / 95 % | 손목 서보 포화 몫 (≥ 0.99 상한) | 쥠 몫 |'); console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const k of keys) { const g = G.get(k); const n = g.xs.length; const J = g.xs.filter((x) => x.judge != null);
  const dif = J.map((x) => Math.abs(x.jud - x.judge)); const ds = [...new Set(g.xs.map((x) => x.d).filter((v) => v != null).map((v) => v.toFixed(3)))].slice(0, 3).join(',');
  console.log(`| ${k} | ${pc(g.xs.filter((x) => x.jud > 25).length / n)} | ${pc(g.xs.filter((x) => x.wr > 25).length / n)} | ${J.length ? pc(J.filter((x) => x.judge > 25).length / J.length) + ` (${pc(J.length / n)})` : '-'} | ${J.length ? f2(q(dif, 0.5)) + ' · ' + f2(q(dif, 0.95)) : '-'} | ${f1(q(col(g, 'F'), 0.5))} / ${f1(q(col(g, 'F'), 0.95))} / ${f1(Math.max(...col(g, 'F')))} | ${f1(q(col(g, 'Fp'), 0.95))} | ${ds || '-'} | ${f2(q(col(g, 'dh'), 0.5))} / ${f2(q(col(g, 'dh'), 0.95))} | ${pc(g.xs.filter((x) => x.sat >= 0.99).length / n)} | ${pc(g.xs.filter((x) => x.grip).length / n)} |`); }
console.log('\n## 표 3 다시 판정 — 손목 관절 몫 > W · 지렛대 몫 > d × F · 둘 중 하나 (스텝 몫)');
const WW = [15, 25, 40], FF = [150, 250, 400];
console.log(`| 묶음 | ${WW.map((w) => `wr > ${w}`).join(' | ')} | ${FF.map((f) => `lev > d×${f}`).join(' | ')} | ${WW.flatMap((w) => FF.map((f) => `하나 W${w}·F${f}`)).join(' | ')} |`); console.log('|---|' + '---|'.repeat(WW.length + FF.length + WW.length * FF.length));
for (const k of keys) { const g = G.get(k); const n = g.xs.length; const lo = (x, f) => x.d != null && x.lev > x.d * f + 1e-9;
  console.log(`| ${k} | ${WW.map((w) => pc(g.xs.filter((x) => x.wr > w).length / n)).join(' | ')} | ${FF.map((f) => pc(g.xs.filter((x) => lo(x, f)).length / n)).join(' | ')} | ${WW.flatMap((w) => FF.map((f) => pc(g.xs.filter((x) => x.wr > w || lo(x, f)).length / n))).join(' | ')} |`); }
console.log('\n## 표 4 검산 — 닿음 없고 손목 밧줄 둘 다 느슨 · 놓기 없음 스텝: |res| ÷ |tot| 가운데 / 95 % · |res| 95 % (N·m) · 밧줄 팽팽 스텝의 |res| 95 %');
console.log('| 묶음 | 느슨 스텝 | res÷tot 가운데 / 95 % | |res| 95 % | 팽팽 스텝 몫 | 팽팽 |res| 95 % | 닿음 스텝 몫 |'); console.log('|---|---|---|---|---|---|---|');
for (const k of keys) { const g = G.get(k); const n = g.xs.length; const taut = (x) => x.a1 > 162.7 || x.a2 > 79.7; const sl = g.xs.filter((x) => !x.nc && !taut(x) && !x.placed && x.tot > 1); const tt = g.xs.filter((x) => taut(x)); const nA = g.all.length;
  console.log(`| ${k} | ${sl.length} | ${f2(q(sl.map((x) => x.res / x.tot), 0.5))} / ${f2(q(sl.map((x) => x.res / x.tot), 0.95))} | ${f2(q(sl.map((x) => x.res), 0.95))} | ${pc(tt.length / n)} | ${f1(q(tt.map((x) => x.res), 0.95))} | ${pc(g.all.filter((x) => x.nc).length / nA)} |`); }
console.log('\n## 표 5 때 — 사람 획 구간별 wr > 25 · jud > 25 (스텝 몫)');
for (const k of keys) { const g = G.get(k); const ph = Object.entries(g.phase).sort(); if (!ph.length) continue; console.log(`- ${k}: ` + ph.map(([p, v]) => `${p} ${v.n} 스텝 · wr ${pc(v.ow / v.n)} · jud ${pc(v.oj / v.n)}`).join(' | ')); }
console.log('\n## 표 6 동작 단위 (획 · 탭 · 막기 한 덩이): 단위 수 · 손목 관절 몫 최고 가운데 / 95 % · jud > 25 스텝이 하나라도 있는 단위 몫');
for (const k of keys) { const g = G.get(k); if (!g.units.length) continue; const u = g.units; console.log(`- ${k}: ${u.length} · ${f1(q(u.map((x) => x.pk), 0.5))} / ${f1(q(u.map((x) => x.pk), 0.95))} · ${pc(u.filter((x) => x.over > 0).length / u.length)}`); }
