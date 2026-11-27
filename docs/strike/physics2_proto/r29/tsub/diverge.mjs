// 두 lab.mjs --dump 파일(같은 판 · 값만 다름)이 처음 갈라지는 스텝: 골반 높이 차가 1e-9 · 1e-4 · 1e-3 · 1 cm 를 넘는 첫 스텝 · 거리 차 1 cm · 10 cm ·
//  어떤 관절이든 잘림(saturation) 여부가 처음 다른 스텝 · 걸음 꼴(디딤/뜸 · 걸음 갈래)이 처음 다른 스텝
//  node diverge.mjs a.jsonl b.jsonl
import { readFileSync } from 'node:fs';
const ld = (f) => { const m = new Map(); for (const l of readFileSync(f, 'utf8').split('\n')) if (l) { const r = JSON.parse(l); m.set(r.s, r); } return m; };
const [A, B] = process.argv.slice(2).map(ld);
const out = {};
const J = ['hx', 'hy', 'hz', 'k', 'ax', 'ay', 'az'];
const satA = (r) => ['F', 'B'].map((k) => (r[k].on ? J.filter((n) => r[k][n][2]).join('') : '')).join('|');
const gaitK = (r) => ['F', 'B'].map((k) => (r[k].st ? 'S' : (r[k].kind ?? 'w'))).join('');
const first = (name, pred) => { if (out[name]) return; };
const steps = [...A.keys()].filter((s) => B.has(s)).sort((x, y) => x - y);
for (const s of steps) {
  const a = A.get(s), b = B.get(s), dy = Math.abs(a.py - b.py), dd = Math.abs(a.dist - b.dist);
  for (const [n, th] of [['py>1e-9', 1e-9], ['py>1e-4', 1e-4], ['py>1e-3', 1e-3], ['py>1cm', 0.01]]) if (out[n] == null && dy > th) out[n] = { s, t: a.t, a: a.py, b: b.py };
  for (const [n, th] of [['dist>1cm', 0.01], ['dist>10cm', 0.1]]) if (out[n] == null && dd > th) out[n] = { s, t: a.t, a: a.dist, b: b.dist };
  if (out.sat == null && satA(a) !== satA(b)) out.sat = { s, t: a.t, a: satA(a), b: satA(b) };
  if (out.gait == null && gaitK(a) !== gaitK(b)) out.gait = { s, t: a.t, a: gaitK(a), b: gaitK(b) };
}
// 잘림이 있었던 스텝 수 (디딘 다리 · 관절별)
const satCount = (M) => { const c = {}; for (const r of M.values()) for (const k of ['F', 'B']) if (r[k].on) for (const n of J) if (r[k][n][2]) c[k + n] = (c[k + n] ?? 0) + 1; return c; };
out.satStepsA = satCount(A); out.satStepsB = satCount(B); out.steps = steps.length;
console.log(JSON.stringify(out));
