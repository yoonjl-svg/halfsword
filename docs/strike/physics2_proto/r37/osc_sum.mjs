// r37 떪 · 어긋남 요약 (읽기만) — wrist_split.mjs 의 ai · stand 결과
//  node osc_sum.mjs <split_ai_*.json> [--trace=4002:E] [--n=40]
//   A. 이름표 idle · block (칼끝 < 2 m/s · 선 채 · 칼이 안 닿은) 스텝 — 닿은 스텝은 각만 따로: jud · wr · lev > 25 몫 · 칼 ↔ 명령 각(aimSw) 가운데 / 90 %
//   B. 떪: 이어진 idle 덩이(≥ 24 스텝)마다 jud · |servo| · |off| 의 자기 상관(뒤처짐 1 ~ 6 스텝) 가운데 · servo 벡터와 off 모멘트 벡터의 상관(성분마다 평균 뺀 뒤 · − = 맞섬)
//      · 한 스텝 차 부호가 번갈아 바뀌는 몫(2 스텝 주기) · 4 스텝 주기 세기 = 뒤처짐 4 의 상관 − 뒤처짐 2 의 상관
//   C. --trace=씨앗:P|E — 그 몸의 첫 'thrust' 이름표 앞 n 스텝을 줄마다 (서보 · 지렛대 · 두 벡터의 cos · 손목 서보 포화 · 빈손 힘 · 칼 ↔ 명령 각 · 밧줄 각)
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-'), f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + ' %' : '-');
const ac = (s, L) => { const n = s.length; const m = s.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; for (let i = 0; i < n; i++) { den += (s[i] - m) ** 2; if (i + L < n) num += (s[i] - m) * (s[i + L] - m); } return den > 1e-12 ? num / den : NaN; };
const vcorr = (A, B) => { const n = A.length; let num = 0, da = 0, db = 0; for (let k = 0; k < 3; k++) { const ma = A.reduce((s, v) => s + v[k], 0) / n, mb = B.reduce((s, v) => s + v[k], 0) / n; for (let i = 0; i < n; i++) { num += (A[i][k] - ma) * (B[i][k] - mb); da += (A[i][k] - ma) ** 2; db += (B[i][k] - mb) ** 2; } } return da > 1e-12 && db > 1e-12 ? num / Math.sqrt(da * db) : NaN; };
for (const fn of files) {
  const d = JSON.parse(readFileSync(fn, 'utf8'));
  const byW = new Map();
  for (const r of d.rows) { if (r.scene !== 'ai' && r.scene !== 'stand') continue; const W = byW.get(r.weapon) ?? byW.set(r.weapon, { st: [], runs: [], con: [] }).get(r.weapon);
    let run = [];
    const flush = () => { if (run.length >= 24) W.runs.push(run); run = []; };
    for (const x of r.steps) { const ok0 = x && (r.scene === 'stand' || ((x.lab === 'idle' || x.lab === 'block') && x.st === 'stand')) && x.tip < 2; if (ok0 && x.nc) W.con.push(x); const ok = ok0 && !x.nc && !x.placed; if (ok) { W.st.push(x); run.push(x); } else flush(); }
    flush(); }
  for (const [w, W] of byW) {
    const s = W.st, n = s.length; if (!n) continue;
    console.log(`\n### ${fn.split('/').pop()} · ${w} — 가만한 스텝 ${n} (idle · block · 칼끝 < 2 m/s)`);
    console.log(`- 넘음 몫: jud > 25 ${pc(s.filter((x) => x.jud > 25).length / n)} · wr > 25 ${pc(s.filter((x) => x.wr > 25).length / n)} · lev > 25 ${pc(s.filter((x) => x.lev > 25).length / n)} · jud 가운데 / 95 % ${f1(q(s.map((x) => x.jud), 0.5))} / ${f1(q(s.map((x) => x.jud), 0.95))} · wr ${f1(q(s.map((x) => x.wr), 0.5))} / ${f1(q(s.map((x) => x.wr), 0.95))} · lev ${f1(q(s.map((x) => x.lev), 0.5))} / ${f1(q(s.map((x) => x.lev), 0.95))}`);
    console.log(`- 칼 ↔ 명령 각 aimSw 가운데 / 90 %: ${f1(q(s.map((x) => x.aimSw), 0.5))} / ${f1(q(s.map((x) => x.aimSw), 0.9))}° · 서보 포화 몫 ${pc(s.filter((x) => x.sat >= 0.99).length / n)} · 빈손 F 가운데 / 95 % ${f1(q(s.map((x) => x.F), 0.5))} / ${f1(q(s.map((x) => x.F), 0.95))} N · F = 250 몫 ${pc(s.filter((x) => x.F >= 249.9).length / n)} · 쥠 몫 ${pc(s.filter((x) => x.grip).length / n)} · 빈손 실제 거리 dh 가운데 ${f2(q(s.map((x) => x.dh), 0.5))} m (d = ${f2(q(s.map((x) => x.d), 0.5))})`);
    { const c = W.con; console.log(`- 칼이 닿은 가만한 스텝 ${c.length} (${pc(c.length / (c.length + n))}): 칼 ↔ 명령 각 가운데 / 90 % ${f1(q(c.map((x) => x.aimSw), 0.5))} / ${f1(q(c.map((x) => x.aimSw), 0.9))}° · 닿음 모멘트 con 가운데 ${f1(q(c.map((x) => x.con), 0.5))} N·m (위 줄들은 안 닿은 스텝만)`); }
    console.log(`- 밧줄: 굽힘 각 a1 > 162.7 몫 ${pc(s.filter((x) => x.a1 > 162.7).length / n)} · 돌림 각 a2 > 79.7 몫 ${pc(s.filter((x) => x.a2 > 79.7).length / n)} · |res| 가운데 / 95 % ${f2(q(s.map((x) => x.res), 0.5))} / ${f2(q(s.map((x) => x.res), 0.95))} · cos(서보, 지렛대) 가운데 ${f2(q(s.map((x) => x.cosSO), 0.5))} · cos < −0.5 몫 ${pc(s.filter((x) => x.cosSO < -0.5).length / n)}`);
    const R = W.runs; if (R.length) {
      const lagT = (key) => [1, 2, 3, 4, 5, 6].map((L) => f2(q(R.map((r) => ac(r.map((x) => x[key]), L)), 0.5))).join(' · ');
      console.log(`- 떪 (idle 덩이 ${R.length} · 덩이 길이 가운데 ${q(R.map((r) => r.length), 0.5)}) 자기 상관 뒤처짐 1 ~ 6: jud ${lagT('jud')} | 서보 ${lagT('srv')} | 지렛대 ${lagT('lev')} | 빈손 F ${lagT('F')}`);
      const alt = (key) => q(R.map((r) => { let c = 0; for (let i = 2; i < r.length; i++) if ((r[i][key] - r[i - 1][key]) * (r[i - 1][key] - r[i - 2][key]) < 0) c++; return c / (r.length - 2); }), 0.5);
      console.log(`- 한 스텝 차 부호 바뀜 몫 가운데: jud ${f2(alt('jud'))} · 서보 ${f2(alt('srv'))} · 지렛대 ${f2(alt('lev'))} (아무 떪 없으면 ~0.33 · 2 스텝 주기면 1)`);
      console.log(`- 벡터 상관(서보 ↔ 지렛대 모멘트 · 덩이마다 · − = 맞섬) 가운데 / 10 % / 90 %: ${f2(q(R.map((r) => vcorr(r.map((x) => x.sV), r.map((x) => x.oV))), 0.5))} / ${f2(q(R.map((r) => vcorr(r.map((x) => x.sV), r.map((x) => x.oV))), 0.1))} / ${f2(q(R.map((r) => vcorr(r.map((x) => x.sV), r.map((x) => x.oV))), 0.9))} · (서보 + 밧줄 ↔ 지렛대) 같은 셈은 cosWL 가운데 ${f2(q(s.map((x) => x.cosWL), 0.5))}`);
    }
  }
  if (args.trace) { const [sd, who] = String(args.trace).split(':'); const r = d.rows.find((x) => x.seed === +sd && x.who === who); if (r) { const N = +(args.n ?? 40); const i1 = r.steps.findIndex((x) => x && x.lab === 'thrust'); const a = Math.max(0, i1 - N);
    console.log(`\n### 줄 ${sd} ${who} · 첫 찌르기 이름표 스텝 ${r.steps[i1]?.k} 앞 ${N} 스텝`);
    console.log('| k | 이름표 | jud | wr | 서보 | 지렛대 | cos(서보,지렛대) | 서보 포화 | F | Fp | 칼↔명령° | a1 | a2 | 칼끝 | 서보 벡터 | 지렛대 벡터 |'); console.log('|' + '---|'.repeat(16));
    for (let i = a; i <= i1 + 4 && i < r.steps.length; i++) { const x = r.steps[i]; if (!x) continue; console.log(`| ${x.k} | ${x.lab} | ${f1(x.jud)} | ${f1(x.wr)} | ${f1(x.srv)} | ${f1(x.lev)} | ${f2(x.cosSO)} | ${f2(x.sat)} | ${f1(x.F)} | ${f1(x.Fp)} | ${f1(x.aimSw)} | ${f1(x.a1)} | ${f1(x.a2)} | ${f1(x.tip)} | ${x.sV.join(',')} | ${x.oV.join(',')} |`); } } }
}
