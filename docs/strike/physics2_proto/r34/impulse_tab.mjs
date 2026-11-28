// 받은 충격량 ÷ (계획 J | 시킨 힘 적분) — 판 파일에서 읽기만. node pj_tab.mjs <이름> <hop.*.json ...>
import { readFileSync } from 'node:fs';
const [name, ...files] = process.argv.slice(2);
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const f = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');
for (const p of files) { const R = JSON.parse(readFileSync(p, 'utf8')).runs; const w = p.split('/').pop().split('.')[1];
  const ok = R.filter((r) => r.impByPlan && r.impByPlan.n > 0);
  const bp = ok.map((r) => r.impByPlan.mean), bpMin = ok.map((r) => r.impByPlan.min), bpMax = ok.map((r) => r.impByPlan.max), bc = ok.map((r) => r.impByCmd.mean), cp = ok.map((r) => r.impCmdOverPlan.mean);
  const inBand = ok.filter((r) => r.impByPlan.min >= 0.9 && r.impByPlan.max <= 1.1).length, inBandC = ok.filter((r) => r.impByCmd.min >= 0.9 && r.impByCmd.max <= 1.1).length, inBandGate = R.filter((r) => r.impRatioMin >= 0.9 && r.impRatioMax <= 1.1).length;
  console.log(`${name} ${w} · 판 ${R.length} (받침 있는 판 ${ok.length}) · 받은÷계획 평균의 가운데 ${f(q(bp, .5))} (10 % ${f(q(bp, .1))} · 90 % ${f(q(bp, .9))}) · 판 안 가장 작음의 가운데 ${f(q(bpMin, .5))} · 가장 큼의 가운데 ${f(q(bpMax, .5))} · 받은÷시킨 가운데 ${f(q(bc, .5))} · 시킨÷계획 가운데 ${f(q(cp, .5))} · 금(0.9 ~ 1.1) 안 판: 계획 ${inBand} · 시킨 ${inBandC} · 관문 줄 ${inBandGate} · 디딤 첫 스텝에 계획이 읽힌 받침 ${ok.reduce((s, r) => s + r.impByPlan.atStart, 0)} / ${ok.reduce((s, r) => s + r.impByPlan.phases, 0)} · 계획 끝÷처음 ${f(q(ok.map((r) => r.impByPlan.lastOverFirst), .5))}`); }
