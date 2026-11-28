// r35 시제품 (겨눔 따라옴) — trace_*.json 두 벌(바탕 · 시제품)을 나란히: 문턱 P1 · P2 · P4 · P5 의 수 (읽기만)
//  node proto_sum.mjs --a=<바탕 trace>[,…] --b=<시제품 trace>[,…] [--fast=8] [--w=rapier]
//  탭 = 획 가운데 tap 스텝이 있는 것. o = 탭을 부른 스텝.
//   당김 시간 = o 부터 당김 스텝(단계 '당김' · 시제품이 겨눈 채 기다린 '머묾발' tap.t < K.aim)이 이어진 수 × DT · 상한 걸림 = 당김 시간 ≥ 0.4 s − 1 스텝
//   맞음 시간 = (hitI − o) × DT · 칼↔명령 = aimSword (aimDirW ↔ 칼 축 °) 의 창 t0 ~ 끝 스텝
//   토크 = tqWr · tqEl · tqSh (honesty 장부 전달 토크 ÷ 한도) — 당김 스텝 · 칼끝 > fast 스텝
//   넘어짐 = 창 안에 state 가 stand · kneel 밖인 스텝이 있는 획
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const FAST = +(args.fast ?? 8), DT = 1 / 120, KAIM = 0.11 /* THRUST.aim — 기록의 tap.t 가 모두 이 값으로 끝남 */, W = args.w ? String(args.w) : null;
const load = (s) => String(s).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).strokes).filter((r) => !W || r.weapon === W);
const med = (a) => qt(a, 0.5);
const qt = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const i = (b.length - 1) * p, l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
function feat(r) {
  const S = (i) => r.steps[i - r.a];
  const isPull = (s) => s?.tap && (s.ph === '당김' || (s.ph === '머묾발' && s.tt < KAIM - 5e-7)); // 겨눈 채 기다림(tap.t = K.aim − 1e-6)은 당김 · 런지 발 기다림(tap.t = K.aim)은 아님
  let pullN = 0; for (let i = r.o; i < r.a + r.steps.length; i++) { const s = S(i); if (isPull(s)) pullN++; else if (pullN || i > r.o + 2) break; }
  const win = []; for (let i = r.t0; i <= r.end; i++) { const s = S(i); if (s) win.push(s); }
  const pull = []; for (let i = r.o; i < r.o + pullN + 1; i++) { const s = S(i); if (isPull(s)) pull.push(s); }
  const fall = win.some((s) => s.st && s.st !== 'stand' && s.st !== 'kneel');
  return { pullT: pullN * DT, capped: pullN * DT >= 0.4 - DT - 1e-9, hitT: r.hit && r.hitI != null ? (r.hitI - r.o) * DT : null, win, pull, fall, isTap: r.steps.some((s) => s.tap) };
}
function sum(R, name) {
  const X = R.map((r) => ({ r, F: feat(r) }));
  const fa = X.filter((x) => x.r.tipPk > FAST), hit = X.filter((x) => x.r.hit), W = hit.map((x) => x.r.wound).filter(Boolean);
  const ty = (t) => W.filter((w) => w.type === t).length;
  const near = X.filter((x) => x.r.scene === 'near');
  const pullT = X.map((x) => x.F.pullT);
  const band = (lo, hi) => pullT.filter((t) => t >= lo - 1e-9 && t < hi - 1e-9).length;
  const st = (sel) => X.flatMap((x) => (sel === 'pull' ? x.F.pull : x.F.win.filter((s) => s.sp > FAST)));
  const tq = (S, k) => { const a = S.map((s) => s[k]).filter((v) => v != null); return `${f(med(a), 2)} · ${f(qt(a, 0.99), 2)} · ${a.length ? f((100 * a.filter((v) => v > 1).length) / a.length, 1) : '-'} % (${a.length})`; };
  const aS = X.flatMap((x) => x.F.win.map((s) => s.aimSword));
  return [
    ['줄', X.length],
    ['빠른 줄 (> ' + FAST + ')', `${fa.length} (${f((100 * fa.length) / Math.max(1, X.length), 1)} %)`],
    ['맞음', `${hit.length} (${f((100 * hit.length) / Math.max(1, X.length), 1)} %)`],
    ['가까운 장면 맞음', `${near.filter((x) => x.r.hit).length} / ${near.length}`],
    ['상처 stab / cut / blunt', `${ty('stab')} / ${ty('cut')} / ${ty('blunt')}`],
    ['맞음 에너지 J 가운데 (stab · blunt)', `${f(med(W.filter((w) => w.type === 'stab').map((w) => w.energy)), 1)} · ${f(med(W.filter((w) => w.type === 'blunt').map((w) => w.energy)), 1)}`],
    ['탭 → 맞음 s 가운데 · 90 %', `${f(med(X.map((x) => x.F.hitT)), 3)} · ${f(qt(X.map((x) => x.F.hitT), 0.9), 3)}`],
    ['당김 시간 s 가운데 · 90 % · 가장 큼', `${f(med(pullT), 3)} · ${f(qt(pullT, 0.9), 3)} · ${f(Math.max(...pullT), 3)}`],
    ['당김 띠 ≤0.12 · 0.12~0.2 · 0.2~0.3 · 0.3~0.39 · 상한', `${band(0, 0.1201)} · ${band(0.1201, 0.2)} · ${band(0.2, 0.3)} · ${band(0.3, 0.4 - DT)} · ${X.filter((x) => x.F.capped).length}`],
    ['넘어짐(창 안)', X.filter((x) => x.F.fall).length],
    ['칼↔명령 ° 가운데 · 99 %', `${f(med(aS), 1)} · ${f(qt(aS, 0.99), 1)}`],
    ['당김 스텝 손목 가운데 · 99 % · 넘음', tq(st('pull'), 'tqWr')],
    ['당김 스텝 팔꿈치', tq(st('pull'), 'tqEl')],
    ['당김 스텝 어깨', tq(st('pull'), 'tqSh')],
    ['빠른 스텝 손목', tq(st('fast'), 'tqWr')],
    ['빠른 스텝 팔꿈치', tq(st('fast'), 'tqEl')],
    ['빠른 스텝 어깨', tq(st('fast'), 'tqSh')],
  ];
}
const A = sum(load(args.a), 'a'), B = args.b ? sum(load(args.b), 'b') : null;
console.log(`| 줄 | 바탕 | 시제품 |\n|---|---|---|`);
for (let i = 0; i < A.length; i++) console.log(`| ${A[i][0]} | ${A[i][1]} | ${B ? B[i][1] : ''} |`);
