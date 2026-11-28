// r35 — trace_*.json 의 AI 길 찌르기 획을 빠른 줄(칼끝 가장 빠름 > 8 m/s)과 나머지로 · 빠른 줄을 갈래로 (읽기만)
//  node ai_tip_sum.mjs --trace=<파일>[,<파일>…] [--list=1] [--json=<파일>]
//  획마다 셈 (s = 스텝 · o = 탭을 부른 스텝 · iT = 칼끝 가장 빠른 스텝):
//   spO      탭을 부른 스텝의 칼끝 빠르기             pre      o − 0.3 s ~ o − 1 의 칼끝 가장 빠름
//   pkPh     iT 의 찌르기 단계 (탭 앞 · 당김 · 머묾발 · 뻗음 · 머묾 · 되돌림 · 탭 뒤)
//   dAimPk   iT − 4 ~ iT 의 명령 칼 방향(aimDirW) 한 스텝 각 가장 큼 °     aimRot = 당김 동안 명령 칼 방향이 돈 각의 합 °
//   sRot · sTrk · sPel · sArm = iT 의 칼끝 빠르기 가름 몫 (칼이 손 둘레로 · 몸통 돌림 · 골반 · 팔)
//  갈래 (빠른 줄만 · 차례대로 첫째 맞는 것):
//   P '탭 앞 동작'   : iT < o (탭을 부르기 전에 이미 가장 빠름) 또는 spO > 4 m/s
//   T '탭 뒤 동작'   : iT 에 탭이 없음(끝남) 또는 단계 = 되돌림
//   A '겨눔 돌림'    : 단계 = 당김 · dAimPk ≥ 1.5 °/스텝 (180 °/s) · sRot ≥ 0.5
//   B '몸 돌림'      : sTrk ≥ 0.5
//   E '뻗음 · 맞음'  : 단계 = 뻗음 · 머묾 · 머묾발
//   ? 나머지
import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const T = String(args.trace).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).strokes);
const FAST = +(args.fast ?? 8);
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[(b.length - 1) >> 1] * 0.5 + b[b.length >> 1] * 0.5 : null; };
const qt = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const i = (b.length - 1) * p, l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
function feat(r) {
  const S = (i) => r.steps[i - r.a]; const o = r.o, iT = r.iT; const p = S(iT) ?? {};
  let pre = 0; for (let i = Math.max(r.a, o - 36); i < o; i++) pre = Math.max(pre, S(i)?.sp ?? 0);
  let dAimPk = 0; for (let i = iT - 4; i <= iT; i++) dAimPk = Math.max(dAimPk, S(i)?.dAim ?? 0);
  let aimRot = 0, aimN = 0; for (let i = o; i < r.a + r.steps.length; i++) { const s = S(i); if (!s || s.ph !== '당김') { if (i > o + 2) break; continue; } aimRot += s.dAim ?? 0; aimN++; }
  const pkPh = iT < o ? '탭 앞' : !p.tap ? '탭 뒤' : p.ph;
  // 탭 직전에 하던 것 (o − 0.3 s ~ o − 1)
  const preS = r.steps.slice(Math.max(0, o - 36 - r.a), o - r.a);
  const doing = { swing: preS.some((s) => s.swing), defend: preS.some((s) => s.mode === 'defend'), walk: preS.some((s) => s.walk), turn: Math.max(0, ...preS.map((s) => s.dYaw ?? 0)), pad: preS.reduce((m, s, j) => (j ? Math.max(m, Math.hypot((s.aimx ?? 0) - (preS[j - 1].aimx ?? 0), (s.aimy ?? 0) - (preS[j - 1].aimy ?? 0))) : m), 0), tap: preS.some((s) => s.tap) };
  const hitNear = r.hit && r.hitI != null && Math.abs(r.hitI - iT) <= 6;
  const k = iT - o; const isTap = r.steps.some((x) => x.tap);
  const g = r.tipPk <= FAST ? '-' : !isTap ? (dAimPk >= 8 ? 'J' : 'L') : iT < o || (S(o)?.sp ?? 0) > 4 ? 'P' : !p.tap || p.ph === '되돌림' ? 'T' : k <= 24 ? (aimRot >= 60 ? 'A2' : 'A1') : dAimPk >= 1.5 ? 'X' : 'E';
  // θ0 = 탭 앞 스텝(o − 1)의 명령 칼 방향과 당김 끝(tap.t ≥ aim 첫 스텝)의 명령 칼 방향 사이 각 (벡터가 적힌 기록만)
  let th0 = null; const s0 = S(o - 1); if (s0?.aWv) { for (let i = o; i < r.a + r.steps.length; i++) { const x = S(i); if (x?.tap && x.ph !== '당김') { const a = s0.aWv, b = x.aWv; th0 = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI; break; } } }
  // θ0 을 몸 yaw 틀의 방위(옆) · 높이(위아래) 몫으로: az = atan2(옆 z, 앞 x) · el = asin(위 y)
  let dAz = null, dEl = null; if (s0?.aWb) { for (let i = o; i < r.a + r.steps.length; i++) { const x = S(i); if (x?.tap && x.ph !== '당김') { const A = s0.aWb, Bv = x.aWb; const az = (v) => Math.atan2(v[2], v[0]) * 180 / Math.PI, el = (v) => Math.asin(Math.max(-1, Math.min(1, v[1]))) * 180 / Math.PI; dAz = az(Bv) - az(A); dEl = el(Bv) - el(A); break; } } }
  const hErr0 = S(o)?.hErr ?? null;
  const padY = S(o)?.aimy ?? null, techO = S(o)?.tech ?? null;
  return { th0, dAz, dEl, hErr0, padY, techO, k, spO: S(o)?.sp ?? null, pre, pkPh, dAimPk, aimRot, aimN, sRot: p.sRot, sTrk: p.sTrk, sPel: p.sPel, sArm: p.sArm, lat: p.sp ? p.vlat / p.sp : null, hand: p.hand, dYaw: p.dYaw, mv: Math.hypot(p.mvx ?? 0, p.mvy ?? 0), swing: p.swing, mode: p.mode, doing, hitNear, g, vital: p.vital, head: p.head };
}
const rows = T.map((r) => ({ r, F: feat(r) }));
const grp = (w, scene) => rows.filter(({ r }) => r.weapon === w && (scene === 'all' || r.scene === scene));
const SC = [['rapier', 'near'], ['rapier', 'far'], ['rapier', 'farClose'], ['rapier', 'mid'], ['longsword', 'near'], ['longsword', 'mid'], ['longsword', 'far'], ['longsword', 'farClose']];
console.log(`획 ${rows.length} · 빠른 줄 = 칼끝 가장 빠름 > ${FAST} m/s`);
console.log('\n## 장면별 (관문 장면 갈래 · 셈 밖 줄 포함)');
console.log('무기 장면 | 줄 | 빠른 | 빠른 맞음 | 나머지 맞음');
for (const [w, sc] of SC) { const R = grp(w, sc); if (!R.length) continue; const fa = R.filter((x) => x.r.tipPk > FAST); const sl = R.filter((x) => !(x.r.tipPk > FAST)); console.log(`${w} ${sc} | ${R.length} | ${fa.length} | ${fa.filter((x) => x.r.hit).length} | ${sl.filter((x) => x.r.hit).length}/${sl.length}`); }
const GN = { P: '탭 앞 동작', T: '탭 뒤(되돌림 · 다음 동작)', A1: '당김 돌림 (돎 < 60°)', A2: '당김 돌림 큼 (돎 ≥ 60°)', X: '뻗음 중 명령 칼 뜀', E: '뻗음 끝 · 늦은 뻗음', J: '장검 휘두름 끝 명령 뜀', L: '장검 그 밖', '-': '안 빠른 줄' };
const GS = ['P', 'T', 'A1', 'A2', 'X', 'E', 'J', 'L', '-'];
function block(R, title) {
  console.log(`\n## ${title}`);
  console.log('갈래 | 줄 | 맞음 | 칼끝 가운데 | θ0 ° 가운데 | 탭 때 칼끝 가운데 | 당김 중 명령 돎 합 ° 가운데 | 가장 빠른 때 명령 한 스텝 ° 가운데 | 몫 칼돌림 · 몸통 · 골반 · 팔 (가운데) | 옆 몫 | 맞음이 가장 빠름 ±0.05 s | 상처 stab/cut/blunt | 에너지 J 가운데 | 닿는 m/s 가운데 | 관통/문턱 가운데');
  for (const g of GS) { const X = R.filter((x) => x.F.g === g); if (!X.length) continue; const W = X.filter((x) => x.r.wound).map((x) => x.r.wound);
    const ty = (t) => W.filter((w) => w.type === t).length;
    console.log(`${g} ${GN[g]} | ${X.length} | ${X.filter((x) => x.r.hit).length} | ${f(med(X.map((x) => x.r.tipPk)))} | ${f(med(X.map((x) => x.F.th0)), 0)} (|옆| ${f(med(X.map((x) => x.F.dAz == null ? null : Math.abs(x.F.dAz))), 0)} · |위| ${f(med(X.map((x) => x.F.dEl == null ? null : Math.abs(x.F.dEl))), 0)} · |몸 yaw 어긋남| ${f(med(X.map((x) => x.F.hErr0 == null ? null : Math.abs(x.F.hErr0))), 0)}) | ${f(med(X.map((x) => x.F.spO)))} | ${f(med(X.map((x) => x.F.aimRot)), 0)} | ${f(med(X.map((x) => x.F.dAimPk)), 2)} | ${f(med(X.map((x) => x.F.sRot)), 2)} · ${f(med(X.map((x) => x.F.sTrk)), 2)} · ${f(med(X.map((x) => x.F.sPel)), 2)} · ${f(med(X.map((x) => x.F.sArm)), 2)} | ${f(med(X.map((x) => x.F.lat)), 2)} | ${X.filter((x) => x.F.hitNear).length} | ${ty('stab')}/${ty('cut')}/${ty('blunt')} | ${f(med(W.map((w) => w.E)))} | ${f(med(W.map((w) => w.sp)))} | ${f(med(W.map((w) => w.eff)))}/${f(med(W.map((w) => w.thr)))}`); }
}
block(rows.filter(({ r }) => r.weapon === 'rapier'), '레이피어 AI 탭 (모든 장면)');
for (const sc of ['near', 'far', 'farClose']) block(grp('rapier', sc), `레이피어 ${sc}`);
block(rows.filter(({ r }) => r.weapon === 'longsword'), '장검 AI 찌르기 (모든 장면)');
block(grp('longsword', 'near'), '장검 near');
// 탭 앞에 하던 것 (빠른 줄 대 나머지)
console.log('\n## 탭 직전 0.3 s 에 하던 것 (몫)');
for (const w of ['rapier', 'longsword']) for (const g of GS) { const X = rows.filter((x) => x.r.weapon === w && x.F.g === g); if (!X.length) continue; const n = X.length, c = (k) => `${X.filter((x) => x.F.doing[k]).length}`;
  console.log(`${w} ${g} | ${n} | 휘두름 ${c('swing')} · 막기(defend) ${c('defend')} · 걸음 ${c('walk')} · 앞 탭 ${c('tap')} · 몸 돌림 > 1°/스텝 ${X.filter((x) => x.F.doing.turn > 1).length} · 겨눔 패드 > 0.01/스텝 ${X.filter((x) => x.F.doing.pad > 0.01).length} · 머리 겨눔 ${X.filter((x) => x.F.head).length} · 급소 ${X.filter((x) => x.F.vital).length}`); }
// 관절 토크 ÷ 한도 · 명령 뜀 (빠른 스텝 = 칼끝 > 8 인 스텝 · 빠른 줄 / 나머지 줄의 창 t0 ~ 끝)
console.log('\n## 몸이 할 수 있나 — 스텝 분포 (창 t0 ~ 끝)');
console.log('무리 | 스텝 | 손목 가운데 · 99 % · > 1 몫 | 팔꿈치 | 어깨 | Δ명령 손(몸 틀) cm 가운데 · 99 % | Δ명령 칼 ° 가운데 · 99 % | 칼↔명령 ° 가운데');
for (const w of ['rapier', 'longsword']) for (const [nm, sel] of [['빠른 줄의 칼끝 > 8 스텝', (x, s) => x.r.tipPk > FAST && s.sp > FAST], ['빠른 줄의 나머지 스텝', (x, s) => x.r.tipPk > FAST && !(s.sp > FAST)], ['안 빠른 줄', (x) => !(x.r.tipPk > FAST)]]) {
  const st = []; for (const x of rows.filter((x) => x.r.weapon === w)) { for (let i = x.r.t0; i <= x.r.end; i++) { const s = x.r.steps[i - x.r.a]; if (s && sel(x, s)) st.push(s); } }
  const d = (k) => { const a = st.map((s) => s[k]).filter((v) => v != null); return `${f(med(a), 2)} · ${f(qt(a, 0.99), 2)} · ${a.length ? f(a.filter((v) => v > 1).length / a.length, 3) : '-'} (${a.length})`; };
  console.log(`${w} ${nm} | ${st.length} | ${d('tqWr')} | ${d('tqEl')} | ${d('tqSh')} | ${f(med(st.map((s) => s.dHandB * 100)), 2)} · ${f(qt(st.map((s) => s.dHandB * 100), 0.99), 2)} | ${f(med(st.map((s) => s.dAim)), 2)} · ${f(qt(st.map((s) => s.dAim), 0.99), 2)} | ${f(med(st.map((s) => s.aimSword)), 1)}`); }
if (args.list) { console.log('\n## 빠른 줄 목록'); for (const { r, F } of rows.filter((x) => x.r.tipPk > FAST)) console.log(`${F.g} θ0 ${f(F.th0, 0)} (옆 ${f(F.dAz, 0)} 위 ${f(F.dEl, 0)} yaw ${f(F.hErr0, 0)}) pad ${f(F.padY, 2)} ${F.techO} · ${r.weapon} ${r.seed} ${r.who} ${r.scene} k${T.filter((y) => y.weapon === r.weapon && y.seed === r.seed).indexOf(r)} pk ${f(r.tipPk)} @${r.iT - r.o} ${F.pkPh} · spO ${f(F.spO)} pre ${f(F.pre)} · aimRot ${f(F.aimRot, 0)}/${F.aimN} dAimPk ${f(F.dAimPk, 2)} · 몫 ${f(F.sRot, 2)} ${f(F.sTrk, 2)} ${f(F.sPel, 2)} ${f(F.sArm, 2)} · 맞음 ${r.hit ? (r.hitI - r.o) + (F.hitNear ? '(가까움)' : '') + ' ' + (r.wound?.type ?? '') + ' ' + f(r.wound?.E) : '-'} · 하던 ${Object.entries(F.doing).filter(([, v]) => v === true).map(([k]) => k).join('+')} turn ${f(F.doing.turn, 2)}`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify(rows.map(({ r, F }) => ({ seed: r.seed, weapon: r.weapon, who: r.who, scene: r.scene, tipPk: r.tipPk, hit: r.hit, wound: r.wound, ...F }))));
