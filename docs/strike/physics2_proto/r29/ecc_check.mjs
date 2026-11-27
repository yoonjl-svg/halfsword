// r29 E2 — 방향 검사 (싸움 없음): 다리 구동의 일곱 자르기(legs_vmc.js clampLeg → legLimit)가 LEGS.ecc = 1.3 에서
//  관절이 잘리는 토크를 거슬러 eccW(1 rad/s) 이상으로 돌면 한도 × 1.3 · 토크 쪽으로 돌면 × 1.0 · 그 사이는 곧은 오름 · 빠르기 0 에서 끊김 없음 ·
//  네 다리(두 싸움꾼 × 앞 · 뒷다리)가 같은지를 본다.
//  쓰는 법: (cd <나무> && node docs/strike/physics2_proto/r29/ecc_check.mjs [--ecc=1.3] [--n=400])   — 롱소드 · 씨앗 100 · 선 자세 2 s 만 돌림(싸움 없음)
//  셈 길:
//   · 실제 틀: 선 자세 2 s 뒤 네 다리의 몸 회전 그대로 + 몸 각속도를 setAngvel 로 놓고 LegDrive.drive()(intent 없음 → 관절 빠르기만 읽고 멈춤)가 읽은 L.wH · wK · wA 를
//     이 대본이 몸 각속도에서 따로 셈한 값과 견줌 · 그다음 legTorques 를 큰 힘(1e5 N · 무작위 쪽)으로 불러 잘린 토크(pair 를 가로챔)를 틀로 돌려 그 축 한도를 읽음.
//   · 무작위 틀: 허벅지 · 발 회전(qT · qF)을 무작위로 놓고 같은 일 (n 번).
//   · 기대 한도는 이 대본이 따로 셈: base × str × (1 + (ecc − 1) × min(1, max(0, wE) ÷ eccW)), wE = (잘린 토크의 부호) × (그 축 관절 빠르기).
//   · '늘어나며 버팀'의 물리 뜻: 근육 쌍이 부모에 +τ · 자식에 −τ 를 걸 때 근육이 내는 일률 = −τ · (ω자식 − ω부모). wE > 0 ⇔ 일률 < 0 (근육이 일을 받음 = 늘어나며 버팀) 을 표본마다 셈.
//  pair 를 가로채므로 몸에 토크는 걸리지 않는다. 나오는 줄 끝 '어긋남 0' 이 통과.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { LEGS } = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
const { THREE, DT } = H;
const ECC = +(args.ecc ?? 1.3), NR = +(args.n ?? 400);
LEGS.ecc = ECC;
const W = LEGS.eccW;
const lim = LEGS.limit;
// 축: [이름, 관절, 틀 안 축 번호, − 쪽 칸, + 쪽 칸]  (부모 쪽 토크 · legs_vmc.js 의 clampLeg 부름과 같은 칸)
const AX = [
  ['hip.x', 'hip', 0, 'hipAbd', 'hipAbd'], ['hip.y', 'hip', 1, 'hipRot', 'hipRot'], ['hip.z', 'hip', 2, 'hipFlex', 'hipFlex'],
  ['knee', 'knee', 2, 'kneeExt', 'kneeFlex'],
  ['ankle.x', 'ankle', 0, 'ankleInv', 'ankleInv'], ['ankle.y', 'ankle', 1, 'ankleRot', 'ankleRot'], ['ankle.z', 'ankle', 2, 'ankleDorsi', 'anklePlantar'],
];
// 허용 차: 잘린 토크를 월드 → 틀로 되돌릴 때 엔진 몸 회전(f32 · 크기 1 ± 1e-7)을 단위로 보고 켤레로 되돌리므로 1e-7 꼴의 상대 차가 남는다 (자르기 자체는 같은 수)
const TOL = 1e-6;
const expLim = (base, str, wE) => base * str * (1 + (ECC - 1) * Math.min(1, Math.max(0, wE) / W));
let rng = 12345;
const rnd = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const V = () => new THREE.Vector3(), Qn = () => new THREE.Quaternion();
const randQ = (q) => { const u1 = rnd(), u2 = rnd() * 2 * Math.PI, u3 = rnd() * 2 * Math.PI; return q.set(Math.sqrt(1 - u1) * Math.sin(u2), Math.sqrt(1 - u1) * Math.cos(u2), Math.sqrt(u1) * Math.sin(u3), Math.sqrt(u1) * Math.cos(u3)); };
const randV = (v, s) => v.set((rnd() * 2 - 1) * s, (rnd() * 2 - 1) * s, (rnd() * 2 - 1) * s);

const G = H.newRound({ walls: false, weapon: 'longsword', seed: 100 });
G.park();
for (let i = 0; i < Math.round(2 / DT); i++) G.step();
const legs = [];
for (const [fn, F] of [['P', G.player], ['E', G.enemy]]) for (const k of ['F', 'B']) legs.push({ tag: `${fn}${k}`, F, D: F.legDrive, L: F.legDrive.legs[k], k });

// ── 1) 축의 물리 뜻 (선 자세 · 실제 틀) ──
const fwdOf = (F) => { const p = F.bodies.pelvis.translation(), t = F.faceTarget; return V().set(t.x - p.x, 0, t.z - p.z).normalize(); }; // 보는 쪽 (faceTarget)
console.log(`LEGS.ecc ${LEGS.ecc} · eccW ${W} rad/s · 롱소드 · 선 자세 2 s 뒤`);
console.log('축의 물리 뜻 (자식이 부모에 대해 그 축 + 로 돌 때):');
for (const g of legs) {
  const { L, F } = g, fwd = fwdOf(F), up = V().set(0, 1, 0);
  const zT = V().set(0, 0, 1).applyQuaternion(L.qT), zF = V().set(0, 0, 1).applyQuaternion(L.qF), xF = V().set(1, 0, 0).applyQuaternion(L.qF);
  const hipZ = V().copy(zT).cross(V().subVectors(L.pk, L.ph)).dot(fwd); // + : 무릎이 보는 쪽으로 = 엉덩이 굽힘
  const leg = V().subVectors(L.pa, L.ph).normalize();
  const kneeZ = V().copy(zT).cross(V().subVectors(L.pa, L.pk)).dot(leg); // d|엉덩이~발목|/dθ (m/rad) — + : 다리가 길어짐 = 무릎 폄
  const toes = V().subVectors(L.xF, L.pa).dot(xF); // + : 발 x 축이 발목 → 발끝 쪽 (발 질량중심이 발목 관절보다 발 x 로 앞)
  const toe = V().copy(L.xF).addScaledVector(xF, 0.12), shin = V().subVectors(L.pk, L.pa).normalize();
  const ankZ = V().copy(zF).cross(V().subVectors(toe, L.pa)).dot(shin); // 발끝이 정강이(무릎) 쪽으로 가는 빠르기 (m/rad) — + : 발등 굽힘
  console.log(`  ${g.tag}: 엉덩이 z ${hipZ.toFixed(3)} (＋ 면 굽힘) · 무릎 d다리길이/dθ ${kneeZ.toFixed(3)} m/rad (＋ 면 폄) · 발 x 축 발끝 쪽 ${toes.toFixed(3)} m · 발목 z 발끝→무릎 ${ankZ.toFixed(3)} m/rad (＋ 면 발등 굽힘)`);
}

// ── 2) 관절 빠르기 읽기 + 자르기 ──
const bodiesOf = (g) => { const f = g.F.bodies, L = g.L; return { pel: f.pelvis, th: f[L.thighN], sh: f[L.shinN], ft: f[L.footN] }; };
const cap = { hip: V(), knee: V(), ankle: V() };
for (const g of legs) {
  const b = g.F.bodies;
  g.D.pair = (p, c, x, y, z) => { const j = p === b.pelvis ? 'hip' : p === b.thighF || p === b.thighB ? 'knee' : 'ankle'; cap[j].set(x, y, z); };
}
const qi = Qn(), t = V();
/** 이 다리의 관절 빠르기(이 대본의 셈 · 몸 각속도에서) [7] */
function myW(g) {
  const B = bodiesOf(g), r = (b) => { const q = b.rotation(); return Qn().set(q.x, q.y, q.z, q.w); }, w = (b) => { const v = b.angvel(); return V().set(v.x, v.y, v.z); };
  const qT = r(B.th), qF = r(B.ft);
  const h = w(B.th).sub(w(B.pel)).applyQuaternion(Qn().copy(qT).invert());
  const k = w(B.sh).sub(w(B.th)).dot(V().set(0, 0, 1).applyQuaternion(qT));
  const a = w(B.ft).sub(w(B.sh)).applyQuaternion(Qn().copy(qF).invert());
  return [h.x, h.y, h.z, k, a.x, a.y, a.z];
}
/** 잘린 토크를 틀로: [7] */
function cutT(L) {
  qi.copy(L.qT).invert(); const h = V().copy(cap.hip).applyQuaternion(qi);
  const k = cap.knee.dot(t.set(0, 0, 1).applyQuaternion(L.qT));
  qi.copy(L.qF).invert(); const a = V().copy(cap.ankle).applyQuaternion(qi);
  return [h.x, h.y, h.z, k, a.x, a.y, a.z];
}
const stat = AX.map(() => ({ n: 0, bad: 0, maxRel: 0, ecc: 0, conc: 0, full: 0, ramp: 0, powBad: 0 }));
let senseBad = 0, senseMax = 0;
/** 표본 하나: 이 다리의 몸 각속도를 놓고 drive 로 읽고, 큰 힘으로 legTorques 를 불러 잘린 값을 견줌 */
function sample(g, wSet, randomFrame) {
  const B = bodiesOf(g), L = g.L, D = g.D;
  // 몸 각속도: 골반 무작위 + 관절 빠르기 wSet (틀 축마다) 를 얹음 — 실제 틀이면 틀은 몸 회전 그대로
  const wp = randV(V(), 2);
  B.pel.setAngvel(wp, false);
  const qT = Qn(), qF = Qn();
  { const q = B.th.rotation(); qT.set(q.x, q.y, q.z, q.w); } { const q = B.ft.rotation(); qF.set(q.x, q.y, q.z, q.w); }
  const wt = V().set(wSet[0], wSet[1], wSet[2]).applyQuaternion(qT).add(wp);
  // 무릎: 정강이 = 허벅지 + wK × 허벅지 z (+ 허벅지 z 에 수직인 무작위 몫 — 무릎 빠르기에 들지 않아야 함)
  const zT = V().set(0, 0, 1).applyQuaternion(qT), side = randV(V(), 1); side.addScaledVector(zT, -side.dot(zT));
  const ws = V().copy(wt).addScaledVector(zT, wSet[3]).add(side);
  const wf = V().set(wSet[4], wSet[5], wSet[6]).applyQuaternion(qF).add(ws);
  B.th.setAngvel(wt, false); B.sh.setAngvel(ws, false); B.ft.setAngvel(wf, false);
  D.intent = null;
  D.drive(); // intent 없음: 관절 빠르기 · 자리만 읽고 (내딛기 끌기 없으면) 멈춤
  const mine = myW(g), got = [L.wH.x, L.wH.y, L.wH.z, L.wK, L.wA.x, L.wA.y, L.wA.z];
  for (let i = 0; i < 7; i++) { const e = Math.abs(mine[i] - got[i]); senseMax = Math.max(senseMax, e); if (e > 1e-9 + 1e-6 * Math.abs(mine[i])) senseBad++; }
  if (randomFrame) { randQ(L.qT); randQ(L.qF); } // 무작위 틀: 자르기가 쓰는 틀만 바꿈 (관절 빠르기는 위에서 읽은 그대로 = 그 틀 축의 값으로 둠)
  if (randomFrame) { L.wH.set(wSet[0], wSet[1], wSet[2]); L.wK = wSet[3]; L.wA.set(wSet[4], wSet[5], wSet[6]); }
  const Wn = [L.wH.x, L.wH.y, L.wH.z, L.wK, L.wA.x, L.wA.y, L.wA.z];
  const str = D.strengthOf(g.k);
  const F = randV(V(), 1).normalize().multiplyScalar(1e5), c = V().copy(L.sole).add(randV(V(), 0.3));
  D.legTorques(L, c, F.x, F.y, F.z, 0, false, str, true, false);
  const out = cutT(L), raw = [L.raw.hx, L.raw.hy, L.raw.hz, L.raw.k, L.raw.ax, L.raw.ay, L.raw.az];
  for (let a = 0; a < 7; a++) {
    const [, , , lo, hi] = AX[a], s = Math.sign(raw[a]), base = s > 0 ? lim[hi] : lim[lo];
    if (Math.abs(raw[a]) < 3 * base * str * ECC) continue; // 안 잘린 축은 셈 밖
    const wE = s * Wn[a], ex = s * expLim(base, str, wE), rel = Math.abs(out[a] - ex) / Math.abs(ex);
    const S = stat[a]; S.n++; S.maxRel = Math.max(S.maxRel, rel); if (rel > TOL) S.bad++;
    if (wE >= W) S.ecc++; else if (wE <= 0) S.conc++; else S.ramp++;
    // 일률: 근육이 부모에 +τ · 자식에 −τ → 일률 = −τ · w. 늘어나며 버팀 ⇔ 일률 < 0
    const pow = -out[a] * Wn[a];
    if ((wE > 0) !== (pow < 0) && Math.abs(Wn[a]) > 1e-12) S.powBad++;
  }
}
const grid = [-2.5, -1.5, -1, -0.75, -0.5, -0.25, -1e-9, 0, 1e-9, 0.25, 0.5, 0.75, 1, 1.5, 2.5];
for (const g of legs) for (let r = 0; r < NR; r++) {
  const wSet = Array.from({ length: 7 }, () => (rnd() < 0.5 ? grid[Math.floor(rnd() * grid.length)] : (rnd() * 2 - 1) * 2.5));
  sample(g, wSet, r % 2 === 1);
}
console.log(`\n관절 빠르기 읽기 (drive → senseLeg 대 이 대본의 셈 · ${legs.length} 다리 × ${NR} 표본 × 7 축): 어긋남 ${senseBad} · 가장 큰 차 ${senseMax.toExponential(2)} rad/s`);
console.log('자르기 (큰 힘으로 잘린 축만 · 실제 틀 반 · 무작위 틀 반): 축 | 표본 | 늘어남 ≥ eccW · 오름 사이 · 줄거나 0 | 기대 한도와 가장 큰 상대 차 | 어긋남 | 일률 부호 어긋남');
let bad = senseBad;
for (let a = 0; a < 7; a++) { const S = stat[a]; bad += S.bad + S.powBad + (S.n ? 0 : 1); console.log(`  ${AX[a][0].padEnd(8)} | ${S.n} | ${S.ecc} · ${S.ramp} · ${S.conc} | ${S.maxRel.toExponential(2)} | ${S.bad} | ${S.powBad}`); }

// ── 3) 쓸기: 축마다 · 다리마다 · 두 쪽 토크마다 wE 를 −2 ~ 2 로 쓸어 한도 ÷ (base × str) 를 읽음 (실제 틀) ──
//  곧은 오름: 0 < wE < eccW 에서 (한도 ÷ base·str − 1) ÷ (ecc − 1) = wE ÷ eccW 인가 · 0 에서 끊김: wE = ±1e-9 의 차 · 네 다리 같은가
function limitAt(g, a, sgn, wE) {
  const L = g.L, D = g.D, str = D.strengthOf(g.k);
  const wSet = [0, 0, 0, 0, 0, 0, 0]; wSet[a] = sgn * wE;
  L.wH.set(wSet[0], wSet[1], wSet[2]); L.wK = wSet[3]; L.wA.set(wSet[4], wSet[5], wSet[6]);
  // 그 축 원 토크가 sgn 쪽으로 크도록 힘을 찾음 (무작위 쪽 몇 번)
  for (let tries = 0; tries < 200; tries++) {
    const F = randV(V(), 1).normalize().multiplyScalar(1e5), c = V().copy(L.sole).add(randV(V(), 0.3));
    D.legTorques(L, c, F.x, F.y, F.z, 0, false, str, true, false);
    const raw = [L.raw.hx, L.raw.hy, L.raw.hz, L.raw.k, L.raw.ax, L.raw.ay, L.raw.az];
    const [, , , lo, hi] = AX[a], base = sgn > 0 ? lim[hi] : lim[lo];
    if (Math.sign(raw[a]) === sgn && Math.abs(raw[a]) > 3 * base * str * ECC) return Math.abs(cutT(L)[a]) / (base * str);
  }
  return NaN;
}
const ws = [-2, -1, -0.5, -1e-9, 0, 1e-9, 0.1, 0.25, 0.5, 0.75, 0.9, 0.999, 1, 1.001, 2];
console.log(`\n쓸기 (한도 ÷ (칸 × 근력) · 실제 틀 · 무작위 힘으로 그 축 그 쪽을 잘리게): wE = ${ws.join(' ')}`);
let rampMax = 0, jumpMax = 0, mirMax = 0, endBad = 0;
for (let a = 0; a < 7; a++) for (const sgn of [1, -1]) {
  const rows = legs.map((g) => ws.map((w) => limitAt(g, a, sgn, w)));
  for (const row of rows) {
    ws.forEach((w, i) => {
      const v = row[i], e = 1 + (ECC - 1) * Math.min(1, Math.max(0, w) / W);
      if (!(Math.abs(v - e) < TOL)) endBad++;
      if (w > 0 && w < W) rampMax = Math.max(rampMax, Math.abs((v - 1) / (ECC - 1) - w / W));
    });
    jumpMax = Math.max(jumpMax, Math.abs(row[ws.indexOf(1e-9)] - row[ws.indexOf(-1e-9)]), Math.abs(row[ws.indexOf(0)] - row[ws.indexOf(-1e-9)]));
    for (const other of rows) row.forEach((v, i) => (mirMax = Math.max(mirMax, Math.abs(v - other[i]))));
  }
  console.log(`  ${AX[a][0].padEnd(8)} 토크 ${sgn > 0 ? '+' : '−'} (${sgn > 0 ? AX[a][4] : AX[a][3]}): ` + legs.map((g, li) => `${g.tag} [${rows[li].map((v) => v.toFixed(3)).join(' ')}]`).join(' '));
}
bad += endBad + (rampMax > TOL ? 1 : 0) + (jumpMax > 1e-6 ? 1 : 0) + (mirMax > TOL ? 1 : 0);
console.log(`쓸기 요약: 기대와 다른 칸 ${endBad} · 곧은 오름에서 가장 큰 차 ${rampMax.toExponential(2)} · 0 둘레(±1e-9) 뛰기 ${jumpMax.toExponential(2)} · 네 다리 사이 가장 큰 차 ${mirMax.toExponential(2)}`);
console.log(`어긋남 ${bad}`);
