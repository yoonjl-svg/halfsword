// r35 반박 — 진단(ai_tip_sum.mjs)의 갈래 정의를 다른 판에 대어 보고, 문턱을 흔들어 보고, 맞음 · 토크를 따로 셈 (읽기만 · 시뮬 없음)
//  node refute_sum.mjs --trace=<trace.json> --rows=<ai_tip_sum --json 결과> [--w=rapier] [--hand=1]
//  rows 의 F(갈래 g · k · aimRot · dAimPk · θ0 · 쉼 무게 idle0)는 ai_tip_sum.mjs 가 낸 그대로 · 여기서는 문턱만 바꿔 다시 가름
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const W = String(args.w ?? 'rapier');
const T = JSON.parse(readFileSync(String(args.trace), 'utf8')).strokes; const R = JSON.parse(readFileSync(String(args.rows), 'utf8'));
if (T.length !== R.length) throw new Error('trace · rows 줄 수 다름');
const X = T.map((r, i) => ({ r, F: R[i] })).filter((x) => x.r.weapon === W);
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? (b[(b.length - 1) >> 1] + b[b.length >> 1]) / 2 : null; };
const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const S = (r, i) => r.steps[i - r.a];
// 1) 갈래 다시 가름 (문턱 바꿈) — 정의는 ai_tip_sum.mjs feat 의 g 와 같은 차례
function grp(x, o = {}) { const { fast = 8, kA = 24, a2 = 60, dX = 1.5 } = o; const { r, F } = x; if (!(r.tipPk > fast)) return '-'; const p = S(r, r.iT) ?? {};
  if (!r.steps.some((s) => s.tap)) return F.dAimPk >= 8 ? 'J' : 'L';
  if (r.iT < r.o || (F.spO ?? 0) > 4) return 'P'; if (!p.tap || p.ph === '되돌림') return 'T';
  if (F.k <= kA) return F.aimRot >= a2 ? 'A2' : 'A1'; return F.dAimPk >= dX ? 'X' : 'E'; }
const G = ['P', 'T', 'A1', 'A2', 'X', 'E', 'J', 'L'];
const cnt = (o) => { const c = {}; for (const x of X) { const g = grp(x, o); c[g] = (c[g] ?? 0) + 1; } return c; };
console.log(`# ${W} 줄 ${X.length} (판 ${Math.min(...X.map((x) => x.r.seed))} ~ ${Math.max(...X.map((x) => x.r.seed))})`);
console.log('\n## 갈래 수 · 문턱 흔듦 (fast · A 창 스텝 kA · A2 금 · X 금)');
console.log('문턱 | 빠른 | ' + G.join(' | ') + ' | ROC 검산(ai_tip_sum g 와 같은 줄)');
for (const o of [{}, { fast: 7 }, { fast: 9 }, { fast: 10 }, { kA: 13 }, { kA: 18 }, { kA: 36 }, { a2: 45 }, { a2: 75 }, { dX: 3 }, { dX: 0.75 }]) { const c = cnt(o); const n = X.filter((x) => grp(x, o) !== '-').length;
  const same = Object.keys(o).length ? '' : `${X.filter((x) => grp(x) === x.F.g).length}/${X.length}`;
  console.log(`${JSON.stringify(o)} | ${n} | ${G.map((g) => c[g] ?? 0).join(' | ')} | ${same}`); }
// 2) A1 의 가장 빠른 단계 · k 분포
const A1 = X.filter((x) => x.F.g === 'A1'), Rest = X.filter((x) => x.F.g === '-');
const phD = (L) => { const c = {}; for (const x of L) c[x.F.pkPh] = (c[x.F.pkPh] ?? 0) + 1; return JSON.stringify(c); };
console.log(`\n## A1 가장 빠른 때 단계 ${phD(A1)} · k 가운데 ${f(med(A1.map((x) => x.F.k)), 0)} (13 = 당김 끝) · 나머지 줄 ${phD(Rest)} k ${f(med(Rest.map((x) => x.F.k)), 0)}`);
// 3) θ0 · 쉼 무게 대 칼끝 (띠마다)
console.log('\n## 쉼 무게(탭 앞) · θ0 띠마다 빠른 몫');
const idl = X.map((x) => x.F.idle0).filter((v) => v != null); console.log(`쉼 무게 0 (< 0.05) ${idl.filter((v) => v < 0.05).length}/${idl.length} · 가운데 ${f(med(idl), 2)}`);
for (const [lo, hi] of [[0, 15], [15, 25], [25, 35], [35, 50], [50, 70], [70, 200]]) { const B = X.filter((x) => x.F.th0 != null && x.F.th0 >= lo && x.F.th0 < hi); if (!B.length) continue; console.log(`θ0 ${lo}-${hi}° | ${B.length} | 빠른 ${B.filter((x) => x.r.tipPk > 8).length} | 칼끝 가운데 ${f(med(B.map((x) => x.r.tipPk)))} | 맞음 ${B.filter((x) => x.r.hit).length}`); }
{ const P = X.filter((x) => x.F.th0 != null); const rk = (a) => { const s = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const o = Array(a.length); s.forEach(([, i], j) => (o[i] = j)); return o; };
  const a = rk(P.map((x) => x.F.th0)), b = rk(P.map((x) => x.r.tipPk)); const n = a.length, ma = (n - 1) / 2; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - ma); saa += (a[i] - ma) ** 2; sbb += (b[i] - ma) ** 2; }
  console.log(`θ0 대 칼끝 가장 빠름 순위 상관 ${f(sab / Math.sqrt(saa * sbb), 2)} (n ${n})`); }
// 4) 맞음이 무엇으로 세어지나 — 맞은 스텝의 단계 · 그 스텝 칼끝 · 상처
console.log('\n## 맞음 (첫 맞음 스텝) — 갈래 | 맞음 | 맞은 단계 | 맞은 스텝 칼끝 가운데 | 맞음 − 가장 빠름 스텝 가운데 | stab/cut/blunt | 에너지 J | 닿는 m/s | 관통 ≥ 문턱');
for (const g of ['A1', 'A2', 'X', 'E', 'T', 'P', '-']) { const L = X.filter((x) => x.F.g === g && x.r.hit && x.r.hitI != null); if (!L.length) continue;
  const ph = {}; for (const x of L) { const s = S(x.r, x.r.hitI); const k = s ? (s.tap ? s.ph : '탭 뒤') : '?'; ph[k] = (ph[k] ?? 0) + 1; }
  const Wd = L.map((x) => x.r.wound).filter(Boolean); const ty = (t) => Wd.filter((w) => w.type === t).length;
  console.log(`${g} | ${L.length} | ${JSON.stringify(ph)} | ${f(med(L.map((x) => S(x.r, x.r.hitI - 1)?.sp)))} | ${f(med(L.map((x) => x.r.hitI - x.r.iT)), 0)} | ${ty('stab')}/${ty('cut')}/${ty('blunt')} | ${f(med(Wd.map((w) => w.E)))} | ${f(med(Wd.map((w) => w.sp)))} | ${Wd.filter((w) => w.eff != null && w.thr != null && w.eff >= w.thr).length}/${Wd.length}`); }
// 5) 손으로 셈 — 대표 스텝의 칼 각가속도에서 손목 토크 어림 (I 손 둘레 · 무게) 대 심판 값
if (args.hand) { const I = +(args.I ?? 0.0791), mg = +(args.mgr ?? 1.1 * 9.81 * 0.157), Lt = +(args.L ?? 1.0), DT = 1 / 120;
  console.log(`\n## 손으로 셈 (I ${I} · 무게 토크 ≤ ${f(mg, 2)} N m · 칼끝 팔 ${Lt} m · ω ≈ mRot ÷ 팔) — 줄 | 스텝 | 칼끝 | ω rad/s | α rad/s² | Iα N m | 어림 ÷ 25 (무게 0 ~ 다) | 심판 손목 ÷ 25`);
  const picks = ['A1', 'A2', 'X', 'E'].flatMap((g) => X.filter((x) => x.F.g === g).slice(0, 2));
  for (const x of picks) for (let i = x.r.iT - 3; i <= x.r.iT; i++) { const s = S(x.r, i), p = S(x.r, i - 1); if (!s || !p) continue; const w1 = s.mRot / Lt, w0 = p.mRot / Lt; const al = Math.abs(w1 - w0) / DT;
    console.log(`${x.F.g} ${x.r.seed} ${x.r.who} | ${i - x.r.o} | ${f(s.sp)} | ${f(w1)} | ${f(al, 0)} | ${f(I * al, 1)} | ${f(I * al / 25, 2)} ~ ${f((I * al + mg) / 25, 2)} | ${f(s.tqWr, 2)}`); } }
