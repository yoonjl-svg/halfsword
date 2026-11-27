// r29 뛰기 관문(제자리 뜀) 다시 판정 — 새로 돌리지 않고 관문 캐시의 판 파일(hop.<무기>.<판 범위>.json)만 읽는다. 고친 줄은 physics2_notes/r29_hop_rejudge.md (셈 앞에 적음).
//  쓰는 법: node rejudge.mjs "<이름>" <hop.*.json> [...] [--gateTxt=<그 관문 줄 글 — 옛 판정이 내 셈과 같은지 검산>]
//  줄마다: 옛 금의 판정(관문 도구와 같은 셈) · 가장 나쁜 값 · 가운데값 · 판 사이 표준편차 · 금을 넘은 판 수 · 새 판정(통과 / 금 위(흔들림 안) / 못 넘음 / 뺌 · 바꿈).
import { readFileSync } from 'node:fs';
const argv = process.argv.slice(2), NAME = argv[0], files = argv.slice(1).filter((a) => !a.startsWith('--'));
const GT = argv.find((a) => a.startsWith('--gateTxt='))?.slice(10);
const runs = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).runs);
const N = runs.length, med = (a) => { const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
const sd = (a) => { const m = a.reduce((p, q) => p + q, 0) / a.length; return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, a.length - 1)); };
// [글, 값(판) → 수 또는 [작은, 큰], 꼴, 아래, 위, 고침]
const L = [
  ['0.05 s 넘게 뜬 디딤 몫', (r) => r.flightShare05, 'ge', 0.9, 0],
  ['두 발 모두 뜬 스텝 몫', (r) => r.flyStepShare, 'in', 0.15, 0.40],
  ['접촉 수직 힘 최고 ÷ 몸무게 (20 Hz 거름)', (r) => r.fyPeakLp20BW, 'le', 0, 2.4, { hi: 3.0, alt: 2.74, why: '금 2.4 → 3.00 (사람 달리기 가장 높은 평균 + 2 표준편차)' }],
  ['받은 ÷ 계획 수직 충격량', (r) => [r.impRatioMin, r.impRatioMax], 'in', 0.9, 1.1],
  ['디딜 때 골반 높이가 5 s 에 내려간 것 cm', (r) => r.tdPelvisDrop5s, 'le', 0, 2],
  ['바란 ÷ 한도 99 % — 디딘 무릎 · 발목', (r) => Math.max(r.share.knee.st99 ?? 0, r.share.ankle.st99 ?? 0), 'le', 0, 0.75],
  ['바란 ÷ 한도 99 % — 디딘 엉덩이 벌림', (r) => r.share.hipAbd.st99, 'le', 0, 0.85],
  ['힘 한도가 깎은 디딘 스텝 몫', (r) => r.cutShare, 'le', 0, 0.01],
  ['한 번 뜰 때 몸통 숙임 바뀜 최고 °', (r) => r.pitchFlightMax, 'le', 0, 5],
  ['자리 흐름 (6 s) m', (r) => r.drift, 'le', 0, 0.5],
  ['뒤 3 s 흐르는 빠르기 m/s', (r) => r.drift3sSpeed, 'le', 0, 0.08],
  ['물리: 수직 힘 평균 ÷ 몸무게', (r) => r.fyMeanBW, 'in', 0.98, 1.02],
  ['정직: 받침 · 밀기 · 닻 · 속도 쓰기 · 몸 밖 관절', (r) => r.hon.supportNs + r.hon.pushNs + r.hon.anchorNms + r.hon.writeNs + r.hon.extJoints, 'le', 0, 0],
  ['정직: 뛰는 동안 선언된 밖 도움 최고', (r) => Math.max(r.hon.aidRun.yawPeak, r.hon.aidRun.tiltPeak, r.hon.aidRun.forcePeak), 'le', 0, 0],
  ['정직: 전달 토크 스텝 최고 ÷ 한도', (r) => r.delivPeakMax, 'le', 0, 1.1, { merge: true, why: '구조상 못 넘음 (선임의 읽기) — 새 줄에 합침' }],
  ['정직: 다리 관절 모터 몫 99 % ÷ 한도', (r) => r.motorP99Max, 'le', 0, 0.1, { drop: true, why: '구조상 못 넘음 — 뺌 (감사의 권고)' }],
  ['정직: 관절 끝 0.03 rad 안 스텝 몫', (r) => r.endMax, 'le', 0, 0.02],
];
const f = (x) => (x == null || Number.isNaN(x) ? '-' : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(3));
const rows = [], old = [];
function judge(vals, kind, lo, hi) { // 가장 나쁜 값 · 벗어난 크기 · 넘은 판 수
  const xs = vals.filter((v) => v != null && !Number.isNaN(v));
  if (kind === 'ge') { const w = Math.min(...xs); return { worst: w, miss: lo - w, bad: xs.filter((v) => v < lo - 1e-12).length, s: sd(xs), m: med(xs) }; }
  const w = Math.max(...xs); return { worst: w, miss: w - hi, bad: xs.filter((v) => v > hi + 1e-12).length, s: sd(xs), m: med(xs) };
}
const stand = runs.filter((r) => !r.fell).length;
rows.push(['넘어짐 없음', `${stand}/${N}`, '-', '-', N - stand, stand === N ? 'PASS' : 'FAIL', stand === N ? '통과' : '못 넘음']); old.push(stand === N);
{ const w = Math.min(...runs.map((r) => r.strides ?? 0)); rows.push(['재는 창: 온 걸음 수 ≥ 8', f(w), f(med(runs.map((r) => r.strides ?? 0))), '-', runs.filter((r) => (r.strides ?? 0) < 8).length, w >= 8 ? 'PASS' : 'FAIL', w >= 8 ? '통과' : '못 넘음']); old.push(w >= 8); }
for (const [txt, get, kind, lo, hi, fix] of L) {
  const v = runs.map(get); let J, J2 = null, thr;
  if (kind === 'in') {
    const a = v.map((x) => (Array.isArray(x) ? x[0] : x)), b = v.map((x) => (Array.isArray(x) ? x[1] : x));
    const A = judge(a, 'ge', lo), B = judge(b, 'le', 0, hi); J = A.miss > B.miss ? A : B; J.bad = v.filter((x) => { const p = Array.isArray(x) ? x : [x, x]; return p[0] < lo - 1e-12 || p[1] > hi + 1e-12; }).length;
    J.show = `${f(A.worst)} ~ ${f(B.worst)}`; thr = `${lo} ~ ${hi}`;
  } else { J = judge(v, kind, lo, hi); J.show = f(J.worst); thr = kind === 'ge' ? `≥ ${lo}` : `≤ ${hi}`; }
  const oldPass = J.miss <= 1e-12; old.push(oldPass);
  let nw;
  if (fix?.drop) nw = '뺌 → 새 줄';
  else if (fix?.merge) nw = oldPass ? '통과' : '구조상 못 넘음 → 새 줄에 합침 (선임의 읽기 · 안 합치면 못 넘음)';
  else if (fix?.hi != null) { J2 = judge(v, 'le', 0, fix.hi); const J3 = judge(v, 'le', 0, fix.alt); nw = (J2.miss <= 1e-12 ? '통과' : J2.miss < J2.s ? '금 위 (흔들림 안)' : '못 넘음') + ` [새 금 ≤ ${fix.hi}: 넘은 판 ${J2.bad} · 좁은 금 ≤ ${fix.alt}: 넘은 판 ${J3.bad} → ${J3.miss <= 1e-12 ? '통과' : J3.miss < J3.s ? '금 위' : '못 넘음'}]`; }
  else nw = oldPass ? '통과' : J.miss < J.s ? '금 위 (흔들림 안)' : '못 넘음';
  rows.push([`${txt} (${thr})`, J.show, f(J.m), f(J.s), J.bad, oldPass ? 'PASS' : 'FAIL', nw]);
}
// 새 줄: 전달 토크가 한도를 넘는 표본 몫 (모든 판 · 모든 축을 표본 수로 무게 주어 합침)
let o = 0, n = 0; const per = [];
for (const r of runs) { let a = 0, b = 0; for (const x of Object.values(r.legAxes ?? {})) { a += x.n * x.overShare; b += x.n; } o += a; n += b; per.push(b ? (100 * a) / b : 0); }
const pool = (100 * o) / n, newPass = pool <= 0.68;
rows.push(['새 줄: 전달 토크가 한도를 넘는 표본 몫 % — 모두 합쳐 (≤ 0.68)', f(pool), f(med(per)), f(sd(per)), per.filter((v) => v > 0.68).length, '(없던 줄)', (newPass ? '통과' : '못 넘음') + ` [판 하나 가장 큼 ${f(Math.max(...per))} — 읽기만]`]);
console.log(`## ${NAME} — 판 ${N}\n\n| 줄 (옛 금) | 가장 나쁜 값 | 가운데값 | 판 사이 표준편차 | 금 넘은 판 | 옛 판정 | 새 판정 |\n|---|---|---|---|---|---|---|\n` + rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n'));
const cnt = (re) => rows.filter((r) => re.test(r[6])).length;
const oldFail = old.filter((x) => !x).length;
console.log(`\n옛 금: 못 넘은 줄 ${oldFail} / 19`);
console.log(`새 판정 (줄 18 을 빼고 새 줄을 넣음 · 19 줄): 진짜로 못 넘음 ${cnt(/^못 넘음/)} · 금 위(흔들림 안) ${cnt(/^금 위/)} · 구조상 못 넘어 새 줄에 합침 ${cnt(/^구조상/)} · 통과 ${cnt(/^통과/)}`);
console.log(`  └ 줄 17 을 안 합치고 옛 금 그대로 두면: 진짜로 못 넘음 ${cnt(/^못 넘음/) + cnt(/^구조상/)}`);
if (GT) { // 검산: 관문 줄 글의 PASS/FAIL 차례가 내 옛 판정 차례와 같은가
  const g = readFileSync(GT, 'utf8').split('\n').filter((l) => /^(PASS|FAIL) /.test(l)).map((l) => l.startsWith('PASS'));
  const same = g.length === old.length && g.every((x, i) => x === old[i]);
  console.log(`검산: 관문 도구의 줄 판정 ${g.length} 개와 이 대본의 옛 판정 ${old.length} 개 — ${same ? '모두 같음' : '다름: ' + g.map((x, i) => (x === old[i] ? '' : i + 1)).filter(Boolean).join(',')}`);
}
