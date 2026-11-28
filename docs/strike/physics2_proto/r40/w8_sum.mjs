// r40 W8 (읽기만 · 판정 줄 아님) — r37 wrist_split.mjs 사람 베기 결과(split_*.json)에서 맞기 앞의 박자
//  node w8_sum.mjs 이름=<json> [이름=<json> …]
//   맞은 획만. 무기 · 꼴마다:
//    ① 맞기 바로 앞(칼이 아무것과도 안 닿은 마지막 스텝)의 칼끝 빠르기 ÷ 그 획의 칼끝 가장 빠름 (가운데)
//    ② 맞기 앞 0.05 s (6 스텝) 동안 한 일 J: 손목 관절 몫이 칼에(pw) · 손목이 낸 일(pwr · 칼과 아래팔 사이) · 지렛대가 칼에(pwL) — 가운데 · 그리고 손목 일(pw)이 + 인 획의 몫(던짐) 
//    ③ 칼끝 가장 빠름 → 맞음 시간 s (가운데)
import { readFileSync } from 'node:fs';
const DT = 1 / 120, N = 6;
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-'), f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-'), f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const sets = process.argv.slice(2).filter((a) => a.includes('=')).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), JSON.parse(readFileSync(a.slice(i + 1), 'utf8')).rows]; });
const key = (r) => `${r.weapon} · ${r.form}`;
const keys = [...new Set(sets.flatMap(([, rows]) => rows.map(key)))].sort();
console.log('| 묶음 | 칸 | 맞은 획 | ① 맞기 앞 칼끝 ÷ 가장 빠름 | ② 손목이 칼에 한 일 J (맞기 앞 0.05 s) | 그 일이 + 인 획 | 손목이 낸 일 J | 지렛대가 칼에 한 일 J | ③ 가장 빠름 → 맞음 s |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const k of keys) for (const [name, rows] of sets) {
  const R = rows.filter((r) => key(r) === k && r.hit && r.kHit != null && r.steps?.length);
  const ratio = [], w = [], wr = [], wl = [], lag = []; let noPw = 0;
  for (const r of R) {
    const S = r.steps; let j = Math.min(r.kHit, S.length - 1); while (j > r.k0 && S[j] && S[j].nc > 0) j--;   // 안 닿은 마지막 스텝
    const pk = Math.max(...S.slice(r.k0, r.kEnd + 1).filter(Boolean).map((s) => s.tip));
    if (S[j]) ratio.push(S[j].tip / pk);
    const win = S.slice(Math.max(r.k0, j - N + 1), j + 1).filter(Boolean);
    if (win.some((s) => s.pw == null)) { noPw++; } else { w.push(win.reduce((a, s) => a + s.pw, 0) * DT); wr.push(win.reduce((a, s) => a + s.pwr, 0) * DT); wl.push(win.reduce((a, s) => a + s.pwL, 0) * DT); }
    lag.push((r.kHit - r.kTip) * DT);
  }
  const pos = w.length ? `${w.filter((x) => x > 0).length} / ${w.length}` : '-';
  console.log(`| ${k} | ${name} | ${R.length} | ${f2(q(ratio, 0.5))} | ${f1(q(w, 0.5))} | ${pos} | ${f1(q(wr, 0.5))} | ${f1(q(wl, 0.5))} | ${f3(q(lag, 0.5))} |${noPw ? ` (일률 칸 없는 획 ${noPw})` : ''}`);
}
