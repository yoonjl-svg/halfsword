// r24 A1 · A3 표: probe24.mjs 가 쓴 jsonl 을 읽는다.  node a13.mjs [--a3only] <이름=파일.jsonl> ...
//  A1 (나무 = 명시 근육): 엔진 모터가 실제로 낸 몫 = x − 근육 (x = 사본에서 찾은 관절 토크 · 근육 = legMuscle 이 건 값).
//      축마다 |모터| ÷ 그 축 한도의 99 % 값 (≤ 0.02 이면 PASS) · 디딘 무릎 · 디딘 엉덩이 세 축에서 x 를 근육에 맞춘 기울기(원점 지남 · 0.95 ~ 1.05 PASS) · 상관.
//      믿을 표본만: 그 관절 사본 풀이 잔차(per[관절][0]) < 0.05 (--nolim 이면 관절 각도 끝 0.03 rad 안의 표본도 뺌 — 줄을 둘 다 찍어 둠).
//  A3 떨림: (가) 축마다 근육 토크의 스텝 사이 부호 바뀜 — 앞뒤 두 스텝 모두 |τ| > 0.1 × 한도 인 채 부호가 바뀐 수 ÷ 초 (연속 스텝 표본만 · R19_EVERY=1 로 돈 것)
//      근육 토크 = 본판(근육 표가 비어 있음)은 x (= 엔진 모터가 실제로 낸 몫) · 이 나무는 legMuscle 이 건 값.
//   (나) 서 있는 동안 관절 빠르기의 60 Hz 몫: hp_n = ω_n − (ω_{n−1} + ω_{n+1})/2 (곧은 흐름은 0 · 스텝마다 뒤집히는 진폭 A 는 2A) → a60 = RMS(hp)/2 (rad/s).
//      상태 stand 이고 판 앞 3 s(자리 잡기)를 뺀 연속 스텝 · 이름이 stand 로 시작하는 파일만.
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const pct = (v, p) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const f2 = (x, w = 7, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '-').padStart(w);
const AXN = ['abd', 'rot', 'flex', 'knee', 'ankInv', 'ankRot', 'ankle'];
const out = {};
const NOLIM = process.argv.includes('--nolim'); // 관절 각도 끝 0.03 rad 안의 표본을 뺌 (probe24 의 nearLim — 끝에 닿은 관절은 제한이 토크를 받아 사본 풀이가 근육과 모터를 못 가름)
for (const a of args) {
  const [name, file] = a.split('=');
  const rows = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const A1 = {}; // key 'S knee' → {m: [|motor|/lim], xs: [], ys: []}
  const series = new Map(); // wid:who:joint:axis → [{s, tau, lim+, lim-, w, state}]
  let hasMus = false;
  for (const r of rows) {
    r.J.forEach((j, ji) => {
      const ok = (r.per?.[ji]?.[0] ?? 1) < 0.05 && !(NOLIM && j.nearLim);
      for (const [an, v] of Object.entries(j.ax)) {
        const x = v[1], mus = v[9] ?? 0, lp = v[11], ln = v[12];
        if (mus !== 0) hasMus = true;
        const key = `${j.st ? 'S' : 'W'} ${an}`;
        const A = (A1[key] ||= { m: [], xs: [], ys: [], n: 0 });
        A.n++;
        if (ok) { const mo = x - mus; A.m.push(Math.abs(mo) / (mo >= 0 ? lp : ln)); A.xs.push(mus); A.ys.push(x); }
        const sk = `${r.wid}:${r.who}:${j.n}:${an}`;
        if (!series.has(sk)) series.set(sk, []);
        series.get(sk).push({ s: r.s, x, mus, lp, ln, w: v[10], state: r.state });
      }
    });
  }
  // A1
  const a1 = {};
  for (const [k, A] of Object.entries(A1)) {
    let sxy = 0, sxx = 0, syy = 0;
    A.xs.forEach((x, i) => { sxy += x * A.ys[i]; sxx += x * x; syy += A.ys[i] * A.ys[i]; });
    a1[k] = { n: A.n, ok: A.m.length, p99: pct(A.m, 0.99), max: Math.max(0, ...A.m), slope: sxx > 0 ? sxy / sxx : NaN, corr: sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN };
  }
  // A3 (가) 부호 바뀜 · (나) 60 Hz
  const flips = {}, a60 = {};
  let T = 0;
  const counted = new Set();
  for (const [sk, v] of series) {
    v.sort((p, q) => p.s - q.s);
    const an = sk.split(':')[3], jn = sk.split(':')[2];
    const leg = jn.endsWith('F') ? 'F' : 'B';
    const fk = `${an}${leg}`;
    let nf = 0, nsteps = 0;
    for (let i = 1; i < v.length; i++) {
      if (v[i].s !== v[i - 1].s + 1) continue;
      nsteps++;
      const t0 = hasMus ? v[i - 1].mus : v[i - 1].x, t1 = hasMus ? v[i].mus : v[i].x;
      const big = (t) => Math.abs(t) > 0.1 * (t >= 0 ? v[i].lp : v[i].ln);
      if (Math.sign(t0) !== Math.sign(t1) && big(t0) && big(t1)) nf++;
    }
    const F = (flips[fk] ||= { n: 0, steps: 0 });
    F.n += nf;
    F.steps += nsteps;
    const wk = sk.split(':').slice(0, 2).join(':');
    if (!counted.has(wk) && an === 'abd' && jn === 'thighF') { counted.add(wk); T += nsteps / 120; }
    if (name.startsWith('stand')) {
      const hp = [];
      for (let i = 1; i + 1 < v.length; i++) if (v[i].s >= 360 && v[i].state === 'stand' && v[i + 1].s === v[i].s + 1 && v[i - 1].s === v[i].s - 1) hp.push(v[i].w - (v[i - 1].w + v[i + 1].w) / 2);
      if (hp.length) { const A = (a60[fk] ||= { ss: 0, n: 0 }); for (const h of hp) { A.ss += h * h; A.n++; } }
    }
  }
  out[name] = { hasMus, a1, flips: Object.fromEntries(Object.entries(flips).map(([k, F]) => [k, { perSec: F.n / Math.max(1e-9, F.steps / 120), n: F.n, steps: F.steps }])), a60: Object.fromEntries(Object.entries(a60).map(([k, A]) => [k, Math.sqrt(A.ss / A.n) / 2])) };
}
// 찍기
for (const [name, o] of Object.entries(out)) {
  console.log(`■ ${name} (${o.hasMus ? '명시 근육 나무' : '엔진 모터 나무'})`);
  if (!process.argv.includes('--a3only')) {
    console.log('  A1 축      표본(믿을)   |모터|÷한도 99 %   최고    기울기(x ÷ 근육)   상관');
    for (const [k, A] of Object.entries(o.a1).sort()) console.log(`  ${k.padEnd(9)} ${String(A.n).padStart(6)}(${String(A.ok).padStart(5)}) ${f2(A.p99, 12)} ${f2(A.max, 9)} ${f2(A.slope, 12)} ${f2(A.corr, 12)}`);
    const worst = Math.max(...Object.values(o.a1).map((A) => A.p99).filter(Number.isFinite));
    const sl = ['S knee', 'S abd', 'S rot', 'S flex'].map((k) => o.a1[k]?.slope).filter(Number.isFinite);
    if (o.hasMus) console.log(`  A1 줄: 모터 몫 99 % 최대 ${worst.toFixed(4)} (≤ 0.02 ${worst <= 0.02 ? 'PASS' : 'FAIL'}) · 디딘 무릎 · 엉덩이 기울기 ${sl.map((x) => x.toFixed(3)).join(' ')} (0.95 ~ 1.05 ${sl.length && sl.every((x) => x >= 0.95 && x <= 1.05) ? 'PASS' : 'FAIL'})`);
  }
  console.log('  A3 (가) 근육 토크 부호 바뀜 (|τ| > 0.1 한도) /s: ' + AXN.flatMap((a) => ['F', 'B'].map((l) => a + l)).filter((k) => o.flips[k]).map((k) => `${k} ${o.flips[k].perSec.toFixed(2)}`).join(' · '));
  const tot = Object.values(o.flips).reduce((t, F) => t + F.n, 0), st = Math.max(...Object.values(o.flips).map((F) => F.steps));
  console.log(`     합 ${tot} 번 · ${(tot / Math.max(1e-9, st / 120)).toFixed(2)} /s (연속 스텝 ${st})`);
  if (Object.keys(o.a60).length) console.log('  A3 (나) 서 있는 동안 관절 빠르기 60 Hz 몫 a60 (rad/s): ' + AXN.flatMap((a) => ['F', 'B'].map((l) => a + l)).filter((k) => o.a60[k] != null).map((k) => `${k} ${o.a60[k].toFixed(4)}`).join(' · '));
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out));
