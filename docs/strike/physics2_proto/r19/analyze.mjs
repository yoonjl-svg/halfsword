// r19 표 만들기: probe 의 A/B 표본(<이름>.ab.jsonl)에서 Q1(실제 ÷ 다시 센 모터) · Q2/Q3(전달 토크 ÷ 한도) 표.
//  node analyze.mjs <ab.jsonl> [--run] [--gate=<run_scenes json>]
//   --run  = 뛰는 동안(run 1) 표본만 (뛰는 나무 hop) · 판(wid)마다 honesty 줄과 같은 꼴(관절.축.S|W 마다 최고 · 모터 몫 99 %)도 셈
//  표본 줄 ax 칸 = [imp, 실제 모터(A/B), 발 운동량(뜬 발만), 다시 센 모터, 명시, |전달 실제|÷한도, |전달 다시 셈|÷한도, |실제 모터|÷한도, |다시 센 모터|÷한도]
//  한도 = LEGS.limit 의 그 축 · 그 방향 칸 × 근력 몫. 알려진 답 검산(val.ej)이 5 % 넘는 관절 표본은 뺀다(몇 개 뺐는지 적음).
import { readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const L = readFileSync(process.argv[2], 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
  .filter((l) => (l.state ?? 'stand') === 'stand' && (!args.run || l.run));
const q = (a, p) => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
let nJ = 0, nBad = 0, resid = [];
const G = {}; // 'hip.flex.S' → arrays
const perRun = {}; // wid → key(n.ax.tag) → {tR:[], mR:[], tC:[], mC:[]}
for (const l of L) l.J.forEach((j, ji) => {
  nJ++;
  if (l.val && l.val.ej && l.val.ej[ji] > 0.05) { nBad++; return; }
  resid.push(l.per?.[ji]?.[0] ?? 0);
  const grp = j.n.startsWith('thigh') ? 'hip' : j.n.startsWith('shin') ? 'knee' : 'ankle';
  const td = j.st && j.since >= 0 && j.since < 4;
  for (const [an, a] of Object.entries(j.ax)) {
    const [imp, mR, mom, mC, e, tRl, tCl, mRl, mCl] = a;
    for (const tag of [j.st ? 'S' : 'W', ...(td ? ['T'] : [])]) {
      const k = `${grp}.${an}.${tag}`, A = (G[k] ||= { mR: [], mC: [], imp: [], tRl: [], tCl: [], mRl: [], mCl: [], reg: [], xy: 0, xx: 0 });
      A.mR.push(Math.abs(mR)); A.mC.push(Math.abs(mC)); A.imp.push(Math.abs(imp)); A.tRl.push(tRl); A.tCl.push(tCl); A.mRl.push(mRl); A.mCl.push(mCl); A.reg.push(!!l.reg);
      A.xy += mR * mC; A.xx += mC * mC;
    }
    if (args.run) { const k = `${j.n}.${an}.${j.st ? 'S' : 'W'}`, R = ((perRun[l.wid] ||= {})[k] ||= { tR: [], mR: [], tC: [], mC: [] }); R.tR.push(tRl); R.mR.push(mRl); R.tC.push(tCl); R.mC.push(mCl); }
  }
});
console.log(`표본 줄 ${L.length} · 관절 표본 ${nJ} · 검산(알려진 답 5 %) 못 넘어 뺀 것 ${nBad} (${(100 * nBad / Math.max(1, nJ)).toFixed(1)} %) · 풀이 상대 잔차 중앙 ${f2(q(resid, 0.5))} · 95 % ${f2(q(resid, 0.95))}`);
const order = ['hip.abd', 'hip.rot', 'hip.flex', 'knee.knee', 'ankle.ankle', 'ankle.ankInv', 'ankle.ankRot'];
const keys = Object.keys(G).sort((a, b) => order.indexOf(a.replace(/\.[STW]$/, '')) - order.indexOf(b.replace(/\.[STW]$/, '')) || a.localeCompare(b));
console.log('\nQ1 실제 모터(A/B) 대 다시 센 값 — S 디딤 · W 뜸 · T 디딘 뒤 첫 4 스텝 (모든 표본)');
console.log('축'.padEnd(18), 'n'.padStart(5), '|실제| 평균'.padStart(10), '|다시셈| 평균'.padStart(11), '평균비'.padStart(7), '기울기'.padStart(7), '|imp| 평균'.padStart(10));
for (const k of keys) { const A = G[k]; const m = (a) => a.reduce((s, x) => s + x, 0) / a.length; console.log(k.padEnd(18), String(A.mR.length).padStart(5), f2(m(A.mR)).padStart(10), f2(m(A.mC)).padStart(11), f2(m(A.mR) / m(A.mC)).padStart(7), f2(A.xy / A.xx).padStart(7), f2(m(A.imp)).padStart(10)); }
console.log('\nQ2/Q3 전달 토크(명시 + 실제 모터) ÷ 한도 · 고른 스텝 표본으로 95 % · 99 % · 넘는 몫, 최고는 모든 표본 · 괄호 = 다시 센 모터로 셈한 같은 값');
console.log('축'.padEnd(18), 'n'.padStart(5), '95 %'.padStart(12), '99 %'.padStart(12), '최고'.padStart(12), '>1.0'.padStart(13), '>1.5'.padStart(13), '모터 몫 99 %'.padStart(14), '모터 몫 최고'.padStart(14));
for (const k of keys) {
  const A = G[k], R = (arr) => arr.filter((_, i) => A.reg[i]);
  const tR = R(A.tRl), tC = R(A.tCl), mRl = R(A.mRl), mCl = R(A.mCl);
  const sh = (a, t) => (a.length ? (100 * a.filter((x) => x > t).length / a.length).toFixed(1) + '%' : '-');
  const two = (a, b) => `${f2(a)} (${f2(b)})`;
  console.log(k.padEnd(18), String(tR.length).padStart(5), two(q(tR, 0.95), q(tC, 0.95)).padStart(12), two(q(tR, 0.99), q(tC, 0.99)).padStart(12), two(Math.max(...A.tRl), Math.max(...A.tCl)).padStart(12),
    `${sh(tR, 1)} (${sh(tC, 1)})`.padStart(13), `${sh(tR, 1.5)} (${sh(tC, 1.5)})`.padStart(13), two(q(mRl, 0.99), q(mCl, 0.99)).padStart(14), two(Math.max(...A.mRl), Math.max(...A.mCl)).padStart(14));
}
if (args.run) {
  console.log('\n판마다 honesty 줄 꼴 (관절.축.S|W 마다 최고 · 모터 몫 99 % 의 최대) — 실제 / 다시 셈');
  let gD = [0, 0], gM = [0, 0];
  for (const [wid, K] of Object.entries(perRun)) {
    let d = [0, 0, ''], m = [0, 0, ''];
    for (const [k, R] of Object.entries(K)) {
      const pr = Math.max(...R.tR), pc = Math.max(...R.tC), m9 = q(R.mR, 0.99), c9 = q(R.mC, 0.99);
      if (pr > d[0]) { d[0] = pr; d[2] = k; } d[1] = Math.max(d[1], pc);
      if (m9 > m[0]) { m[0] = m9; m[2] = k; } m[1] = Math.max(m[1], c9);
    }
    gD = [Math.max(gD[0], d[0]), Math.max(gD[1], d[1])]; gM = [Math.max(gM[0], m[0]), Math.max(gM[1], m[1])];
    console.log(`판 ${wid}: 전달 최고 ÷ 한도 실제 ${f2(d[0])} (${d[2]}) · 다시 셈 ${f2(d[1])} | 모터 몫 99 % 실제 ${f2(m[0])} (${m[2]}) · 다시 셈 ${f2(m[1])}`);
  }
  console.log(`모든 판 최대: 전달 최고 ÷ 한도 실제 ${f2(gD[0])} · 다시 셈 ${f2(gD[1])} | 모터 몫 99 % 실제 ${f2(gM[0])} · 다시 셈 ${f2(gM[1])}`);
  if (args.gate) { const J = JSON.parse(readFileSync(args.gate, 'utf8')); console.log('도구(run_scenes json) 값: delivPeakMax ' + J.runs.map((r) => r.delivPeakMax).join(' ') + ' · motorP99Max ' + J.runs.map((r) => r.motorP99Max).join(' ') + ' · fyPeakBW ' + J.runs.map((r) => r.fyPeakBW).join(' ')); }
}
