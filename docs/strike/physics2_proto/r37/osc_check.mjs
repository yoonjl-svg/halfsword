// r37 반박 — 떪 창 세기 (읽기만) · refute_split.mjs / wrist_split.mjs 의 ai 결과
//  node osc_check.mjs 이름=<json> [이름=<json> …]
//   가만한 스텝(이름표 idle · block · 선 채 · 칼끝 < 2 m/s · 안 닿음 · 놓기 없음)의 이어진 덩이에서 16 스텝 창을 8 스텝씩 밀며 본다.
//   창이 '떤다' = 그 값의 뒤처짐 4 자기 상관 > 0.5 · 뒤처짐 2 < −0.3 · 흩어짐(표준편차) > 문턱 (F 20 N · srv 2 N·m · wr 2 N·m · aimSw 0.5°)
//   칸: 창 수 · 떠는 창 몫 (F · 서보 · 손목 관절 몫 wr · 칼 ↔ 명령 각) · 가만한 스텝 jud > 25 · wr > 25 · 칼 ↔ 명령 각 가운데 / 90 % · 칼 ↔ 명령 > 30° 몫 · 닿은 스텝 몫(가만한 스텝 중)
import { readFileSync } from 'node:fs';
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const ac = (s, L) => { const n = s.length; const m = s.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; for (let i = 0; i < n; i++) { den += (s[i] - m) ** 2; if (i + L < n) num += (s[i] - m) * (s[i + L] - m); } return den > 1e-12 ? num / den : NaN; };
const sd = (s) => { const m = s.reduce((a, b) => a + b, 0) / s.length; return Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / s.length); };
const TH = { F: 20, srv: 2, wr: 2, aimSw: 0.5 };
const osc = (w, k) => { const s = w.map((x) => x[k] ?? 0); return sd(s) > TH[k] && ac(s, 4) > 0.5 && ac(s, 2) < -0.3; };
console.log('| 칸 | 무기 | 가만한 스텝 | 창 | 떠는 창 % F · 서보 · wr · 각 | jud>25 % | wr>25 % | 각 가운데 / 90 % | 각>30° % | 닿은 몫 % |'); console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const a of process.argv.slice(2)) {
  const i = a.indexOf('='); const nm = a.slice(0, i); const d = JSON.parse(readFileSync(a.slice(i + 1), 'utf8'));
  const byW = new Map();
  for (const r of d.rows) { if (r.scene !== 'ai') continue; const W = byW.get(r.weapon) ?? byW.set(r.weapon, { st: [], runs: [], nCon: 0 }).get(r.weapon); let run = [];
    const flush = () => { if (run.length >= 16) W.runs.push(run); run = []; };
    for (const x of r.steps) { const ok0 = x && (x.lab === 'idle' || x.lab === 'block') && x.st === 'stand' && x.tip < 2; if (ok0 && x.nc) W.nCon++; if (ok0 && !x.nc && !x.placed) { W.st.push(x); run.push(x); } else flush(); } flush(); }
  for (const [w, W] of byW) { const s = W.st; const wins = []; for (const r of W.runs) for (let k = 0; k + 16 <= r.length; k += 8) wins.push(r.slice(k, k + 16));
    const p = (fn, arr) => (arr.length ? (100 * arr.filter(fn).length / arr.length).toFixed(2) : '-');
    console.log(`| ${nm} | ${w} | ${s.length} | ${wins.length} | ${['F', 'srv', 'wr', 'aimSw'].map((k) => p((x) => osc(x, k), wins)).join(' · ')} | ${p((x) => x.jud > 25, s)} | ${p((x) => x.wr > 25, s)} | ${q(s.map((x) => x.aimSw), 0.5).toFixed(1)} / ${q(s.map((x) => x.aimSw), 0.9).toFixed(1)} | ${p((x) => x.aimSw > 30, s)} | ${(100 * W.nCon / (W.nCon + s.length)).toFixed(1)} |`); }
}
