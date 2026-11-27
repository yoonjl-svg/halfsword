// r27 표: run_probe.sh 나옴에서 C2 · C3 · C4.  node analyze.mjs <probe 폴더> <옛 이름> <새 이름>
//  [--resid=x] C2 만: 믿을 표본에 풀이 상대 잔차(per[0]) < x 를 더함 (두 나무 같게 — 풀이 오차가 남은 넘침을 만드는지 보는 곁줄)
//  C2 (ab.jsonl · 고른 스텝 · 믿을 표본 = r19/analyze.mjs 와 같은 거름 · 선 상태만): 축 무리(축 · 디딤 S / 뜸 W)마다 전달 토크 ÷ 한도 > 1.0 · > 1.25 몫,
//     넘친 충격량 몫 = Σ max(0, |전달| − 한도) ÷ Σ |전달| (표본 간격이 같아 dt 는 지워짐) — 디딤 바뀜 스텝(cc: 어느 발이든 닿거나 뗀 지 4 스텝 안)과 나머지로 가름.
//     판정: 나머지 스텝의 > 1.0 몫이 모두 합쳐서 · 가장 나쁜 무리(옛 나무에서 > 1.0 몫이 가장 큰 무리)에서 옛 값의 1/5 이하면 PASS.
//  C3 (sp.jsonl · stand · walk · lunge · 스텝마다): 관절 빠르기(한도 축 · 스텝 뒤) 부호 바뀜 = 이웃 두 스텝 모두 |w| > 0.5 rad/s 이고 부호가 다름 (r24/ba_check.mjs 셋째 셈과 같음) · 1000 축-스텝당 ·
//     번갈이 = 이웃 세 스텝이 +,−,+ 또는 −,+,− 이고 셋 모두 |w| > 0.5 · 1000 축-스텝당. 판정: 새 부호 바뀜 ≤ 1.2 × 옛. 새 나무의 바뀜이 어디서(축 · 디딤/뜸 · 그 스텝에 감쇠가 잘렸나) 나는지도 적음.
//  C4 (새 나무): sp.jsonl 모든 장면 — 모터 축 무리(엉덩이 m.x · m.y · m.z 는 골반 틀 · 무릎 · 발목 m.x · m.y · m.z 는 정강이 틀)마다 디딤/뜸으로 감쇠가 잘린(d_eff < d) 몫 · 스프링이 잘린 몫;
//     ab.jsonl 믿을 표본 중 잘린 스텝에서 실제 모터 ÷ 그 쪽 여유 (가운데 · 10 %) — 여유 0 인 표본은 따로 셈.
import { readFileSync, existsSync } from 'node:fs';
const [dir, OLD, NEW] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const RESID = +(process.argv.find((a) => a.startsWith('--resid='))?.slice(8) ?? Infinity);
const load = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const q = (a, p) => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const pc = (a, b) => (b ? ((100 * a) / b).toFixed(2) + '%' : '-');
const SC = ['fight', 'lunge', 'walk', 'back', 'strafe', 'stand'];
const ORDER = ['hip.abd', 'hip.rot', 'hip.flex', 'knee.knee', 'ankle.ankle', 'ankle.ankInv', 'ankle.ankRot'];
// ── C2 ──
function c2(tag) {
  const G = {}; // key → {cc:{n,o1,o125,ex,tot}, ot:{...}}
  const add = (k, part, r) => { const A = ((G[k] ||= {})[part] ||= { n: 0, o1: 0, o125: 0, ex: 0, tot: 0 }); A.n++; if (r.ratio > 1) A.o1++; if (r.ratio > 1.25) A.o125++; A.ex += Math.max(0, Math.abs(r.t) - r.lim); A.tot += Math.abs(r.t); };
  let nAll = 0, nBad = 0;
  for (const sc of SC) for (const l of load(`${dir}/${tag}_${sc}.ab.jsonl`)) {
    if ((l.state ?? 'stand') !== 'stand' || !l.reg) continue;
    l.J.forEach((j, ji) => {
      nAll++;
      const good = !(l.val && l.val.ej && l.val.ej[ji] > 0.05) && ((l.per?.[ji]?.[0] ?? 0) <= 0.5 || (l.per?.[ji]?.[3] ?? 0) <= 0.02);
      if (!good || !((l.per?.[ji]?.[0] ?? 0) < RESID)) { nBad++; return; }
      const grp = j.n.startsWith('thigh') ? 'hip' : j.n.startsWith('shin') ? 'knee' : 'ankle';
      for (const [an, a] of Object.entries(j.ax)) {
        const r = { ratio: a[5], t: a[9], lim: a[10] };
        const part = l.cc ? 'cc' : 'ot';
        for (const k of [`${grp}.${an}.${j.st ? 'S' : 'W'}`, `ALL`, `scene:${sc}`]) add(k, part, r);
      }
    });
  }
  return { G, nAll, nBad };
}
const O2 = c2(OLD), N2 = c2(NEW);
const cell = (A) => (A ? `${pc(A.o1, A.n)} / ${pc(A.o125, A.n)} / ${pc(A.ex, A.tot)} (n ${A.n})` : '-');
console.log(`C2 전달 토크 ÷ 한도 (> 1.0 / > 1.25 / 넘친 충격량 몫) — 옛 ${OLD} → 새 ${NEW} · 믿을 표본 못 돼 뺀 몫 옛 ${pc(O2.nBad, O2.nAll)} 새 ${pc(N2.nBad, N2.nAll)}`);
const keys = [...new Set([...Object.keys(O2.G), ...Object.keys(N2.G)])].sort((a, b) => {
  const r = (k) => (k === 'ALL' ? -2 : k.startsWith('scene:') ? -1 + SC.indexOf(k.slice(6)) / 10 : ORDER.indexOf(k.replace(/\.[SW]$/, '')));
  return r(a) - r(b) || a.localeCompare(b);
});
console.log('무리'.padEnd(16), '나머지 스텝: 옛'.padEnd(40), '새'.padEnd(40), '디딤 바뀜 스텝: 옛'.padEnd(40), '새');
for (const k of keys) console.log(k.padEnd(16), cell(O2.G[k]?.ot).padEnd(40), cell(N2.G[k]?.ot).padEnd(40), cell(O2.G[k]?.cc).padEnd(40), cell(N2.G[k]?.cc));
const sh = (A) => (A && A.n ? A.o1 / A.n : 0);
let worst = null, wv = -1;
for (const k of Object.keys(O2.G)) if (/\.[SW]$/.test(k) && sh(O2.G[k].ot) > wv) { wv = sh(O2.G[k].ot); worst = k; }
const allO = sh(O2.G.ALL?.ot), allN = sh(N2.G.ALL?.ot), wO = sh(O2.G[worst]?.ot), wN = sh(N2.G[worst]?.ot);
const pass2 = allN <= allO / 5 && wN <= wO / 5;
console.log(`C2 판정 (나머지 스텝 > 1.0 몫): 모두 ${(100 * allO).toFixed(2)}% → ${(100 * allN).toFixed(2)}% (문턱 ${(20 * allO).toFixed(2)}%) · 가장 나쁜 무리 ${worst} ${(100 * wO).toFixed(2)}% → ${(100 * wN).toFixed(2)}% (문턱 ${(20 * wO).toFixed(2)}%) → ${pass2 ? 'PASS' : 'FAIL'}`);
// ── C3 ──
function c3(tag, diag) {
  let flips = 0, pairs = 0, alt = 0, trip = 0;
  const where = {};
  for (const sc of ['stand', 'walk', 'lunge']) {
    const ser = new Map();
    for (const l of load(`${dir}/${tag}_${sc}.sp.jsonl`)) for (const [n, J] of Object.entries(l.J)) {
      const st = n.endsWith('F') ? l.stF : l.stB;
      const cut = J.mo ? J.mo.some((m) => m[1] < 1) : false;
      J.w.forEach((w, i) => { const k = `${sc}:${l.wid}:${l.who}:${n}:${i}`; if (!ser.has(k)) ser.set(k, []); ser.get(k).push({ s: l.s, w, st, cut }); });
    }
    for (const [k, v] of ser) {
      v.sort((a, b) => a.s - b.s);
      const [, , , n, i] = k.split(':');
      for (let x = 1; x < v.length; x++) {
        if (v[x].s !== v[x - 1].s + 1) continue;
        pairs++;
        const a = v[x - 1].w, b = v[x].w;
        if (Math.abs(a) > 0.5 && Math.abs(b) > 0.5 && Math.sign(a) !== Math.sign(b)) {
          flips++;
          if (diag) { const g = `${n.replace(/[FB]$/, '')}.${i} ${v[x].st ? 'S' : 'W'} ${v[x].cut || v[x - 1].cut ? '감쇠 잘림' : '안 잘림'}`; where[g] = (where[g] ?? 0) + 1; }
        }
        if (x >= 2 && v[x - 1].s === v[x - 2].s + 1) {
          trip++;
          const c = v[x - 2].w;
          if (Math.abs(a) > 0.5 && Math.abs(b) > 0.5 && Math.abs(c) > 0.5 && Math.sign(c) !== Math.sign(a) && Math.sign(a) !== Math.sign(b)) alt++;
        }
      }
    }
  }
  return { flips, pairs, alt, trip, where };
}
const O3 = c3(OLD, true), N3 = c3(NEW, true);
const pm = (a, b) => (b ? ((1000 * a) / b).toFixed(2) : '-');
const pass3 = N3.flips / N3.pairs <= 1.2 * (O3.flips / O3.pairs);
console.log(`\nC3 관절 빠르기 부호 바뀜 (stand + walk + lunge): 옛 ${O3.flips} / ${O3.pairs} = ${pm(O3.flips, O3.pairs)}‰ → 새 ${N3.flips} / ${N3.pairs} = ${pm(N3.flips, N3.pairs)}‰ (문턱 ${(1.2 * 1000 * O3.flips / O3.pairs).toFixed(2)}‰) → ${pass3 ? 'PASS' : 'FAIL'}`);
console.log(`   번갈이 (+,−,+ · |w| > 0.5): 옛 ${O3.alt} / ${O3.trip} = ${pm(O3.alt, O3.trip)}‰ → 새 ${N3.alt} / ${N3.trip} = ${pm(N3.alt, N3.trip)}‰`);
for (const [tg, R] of [['옛', O3], ['새', N3]]) console.log(`   ${tg} 바뀜 자리 (관절.한도 축 · 디딤 · 감쇠): ` + Object.entries(R.where).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g, c]) => `${g} ${c}`).join(' · '));
// ── C4 ──
const C4 = {}; let c4n = 0;
for (const sc of SC) for (const l of load(`${dir}/${NEW}_${sc}.sp.jsonl`)) for (const [n, J] of Object.entries(l.J)) {
  if (!J.mo) continue;
  const st = n.endsWith('F') ? l.stF : l.stB;
  J.mo.forEach((m, i) => { const g = `${n.replace(/[FB]$/, '').replace('thigh', 'hip').replace('shin', 'knee').replace('foot', 'ankle')}${J.mo.length > 1 ? '.m' + 'xyz'[i] : ''}.${st ? 'S' : 'W'}`; const A = (C4[g] ||= { n: 0, d: 0, k: 0 }); A.n++; c4n++; if (m[1] < 1) A.d++; if (m[0]) A.k++; });
}
const R4 = {};
for (const sc of SC) for (const l of load(`${dir}/${NEW}_${sc}.ab.jsonl`)) l.J.forEach((j, ji) => {
  if (!j.mo) return;
  const good = !(l.val && l.val.ej && l.val.ej[ji] > 0.05) && ((l.per?.[ji]?.[0] ?? 0) <= 0.5 || (l.per?.[ji]?.[3] ?? 0) <= 0.02);
  if (!good) return;
  j.mo.forEach(([m, rp, rm, ck, df], i) => {
    if (!(df < 1 || ck)) return;
    const g = `${j.n.replace(/[FB]$/, '').replace('thigh', 'hip').replace('shin', 'knee').replace('foot', 'ankle')}${j.mo.length > 1 ? '.m' + 'xyz'[i] : ''}.${j.st ? 'S' : 'W'}`;
    const A = (R4[g] ||= { r: [], z: 0 });
    const room = m >= 0 ? rp : rm;
    if (room < 1e-6) A.z++; else A.r.push(Math.abs(m) / room);
  });
});
console.log(`\nC4 모터 몫 자르기가 걸린 몫 (새 · 모든 장면 · 모터 축-스텝 ${c4n}) · 잘린 스텝의 실제 모터 ÷ 그 쪽 여유 (믿을 A/B 표본)`);
console.log('모터 축 무리'.padEnd(14), 'n'.padStart(7), '감쇠 잘림'.padStart(10), '스프링 잘림'.padStart(11), '  실제÷여유 가운데 / 10 % (n · 여유 0 인 표본)');
for (const g of Object.keys(C4).sort()) { const A = C4[g], R = R4[g]; console.log(g.padEnd(14), String(A.n).padStart(7), pc(A.d, A.n).padStart(10), pc(A.k, A.n).padStart(11), R ? `  ${q(R.r, 0.5).toFixed(2)} / ${q(R.r, 0.1).toFixed(2)} (n ${R.r.length} · 0 ${R.z})` : '  -'); }
