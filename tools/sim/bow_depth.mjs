// 중국 활 자세 깊이 (10/10 청강검 자세 고증 — docs/motion/chinese_guards_2026-10-10.md §5): 플레이어 청강검이 앞으로 내딛는 기술 걸음을 할 때
//  앞 허벅지가 얼마나 눕는지(90° = 수평), 넘어짐·휘청·붙잡기 반사·되찾기가 나빠지는지를 잰다. 상대는 제자리(AI 멈춤), 가슴 거리 2.6 m 에서 부탁.
//  부탁 둘: 플레이어 베기 걸음(skill.js 와 같은 pass 0.6 · SKILL.lungeTime → 유파 passAs = lunge 0.51 + 끌어붙임) · 連環三擊 반걸음(lunge 0.25 + 끌어붙임).
//  칸: 골반 최저 m · 앞 허벅지 기움 최대 °(그때 앞무릎·뒷무릎 굽힘 °, 가슴 기움 °) · 넘어짐 · 휘청 몫(offBalance > GAIT.hurryFrom, 부탁 뒤 1.6 s) ·
//   붙잡기 반사 몫(gait.levC > 0.3) · catch 걸음 · 되찾기 s(입력 없는 판: 부탁 → 활 무게 0·두 발 딛음·걷지 않음·골반 빠르기 < 0.15 m/s, 1.6 s 안) ·
//   물러나기 m(따로 돌린 판: 부탁 0.6 s 뒤 스틱을 뒤로 0.5 s — 내딛은 뒤 다음 입력이 얼마나 곧 먹히나) · 판 시드 셋 평균 (넘어짐·catch 는 합)
//  읽기만 — 물리·난수는 게임 그대로. 손잡이(값 고르기용, src 그대로): BOW_JSON='{"drop":0.2,"lowMax":0.22}' → 중국 활 자세 칸 덮음
//  실행: node tools/sim/bow_depth.mjs
import { newRound, DT, THREE } from './harness_m.mjs';
import { GAIT, SKILL } from '../../src/config.js';
import { TRADITIONS } from '../../src/schools.js';
if (process.env.BOW_JSON) TRADITIONS.chinese.gait = { ...TRADITIONS.chinese.gait, bow: { ...TRADITIONS.chinese.gait.bow, ...JSON.parse(process.env.BOW_JSON) } };
const UP = new THREE.Vector3(0, 1, 0);
const axis = (b) => UP.clone().applyQuaternion(new THREE.Quaternion(b.rotation().x, b.rotation().y, b.rotation().z, b.rotation().w));
const deg = (a, b) => (Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180) / Math.PI;

function run(seed, ask, pushBack) {
  const G = newRound({ walls: true, seed, weapon: 'qinggang', weapon2: 'longsword' });
  G.ai.update = () => G.enemy.move.set(0, 0);
  const P = G.player;
  const g = P.gait;
  let t = 0;
  const step = (x, y) => {
    P.move.set(x, y);
    G.step();
    t += DT;
  };
  while (t < 2.3) step(0, 0);
  const t1 = t;
  while (P.foeDistance() > 2.6 && t - t1 < 8) step(0, 1);
  for (let i = 0; i < 1.0 / DT; i++) step(0, 0);
  const x0 = P.bodies.pelvis.translation();
  const fwd = new THREE.Vector3();
  P.forward?.(fwd);
  if (!g.requestStep(ask)) return null;
  const tr = t;
  const r = { yMin: 9, thigh: 0, kF: 0, kB: 0, chest: 0, fall: 0, wob: 0, lev: 0, n: 0, catches: 0, rec: NaN, back: 0 };
  let wasStance = { F: true, B: true };
  let backFrom = null;
  while (t - tr < 1.6) {
    const back = pushBack && t - tr > 0.6 && t - tr < 1.1;
    if (back && !backFrom) {
      const p = P.bodies.pelvis.translation();
      backFrom = { x: p.x, z: p.z };
    }
    step(0, back ? -1 : 0);
    if (P.state !== 'stand') r.fall = 1;
    const y = P.bodies.pelvis.translation().y;
    r.yMin = Math.min(r.yMin, y);
    // 앞다리 = 정강이가 상대 쪽으로 더 나간 다리 (몸체 이름 F·B 는 왼·오른 고정이라 걸음의 앞·뒤와 다를 수 있다)
    const pe = P.bodies.pelvis.translation(), E = G.enemy.bodies.pelvis.translation();
    const dir = new THREE.Vector3(E.x - pe.x, 0, E.z - pe.z).normalize();
    const ahead = (b) => (b.translation().x - pe.x) * dir.x + (b.translation().z - pe.z) * dir.z;
    const [fT, fS, bT, bS] = ahead(P.bodies.shinF) >= ahead(P.bodies.shinB) ? ['thighF', 'shinF', 'thighB', 'shinB'] : ['thighB', 'shinB', 'thighF', 'shinF'];
    const tF = axis(P.bodies[fT]);
    const th0 = deg(tF, UP);
    const th = Math.min(th0, 180 - th0);
    if (th > r.thigh) {
      r.thigh = th;
      r.kF = deg(tF, axis(P.bodies[fS]));
      r.kB = deg(axis(P.bodies[bT]), axis(P.bodies[bS]));
      r.chest = deg(axis(P.bodies.chest), UP);
    }
    r.n++;
    if (P.offBalance > GAIT.hurryFrom) r.wob++;
    if (g.levC > 0.3) r.lev++;
    for (const k of ['F', 'B']) {
      const l = g.legs[k];
      if (wasStance[k] && !l.stance && l.kind === 'catch') r.catches++;
      wasStance[k] = l.stance;
    }
    const v = P.bodies.pelvis.linvel();
    if (!Number.isFinite(r.rec) && t - tr > 0.2 && !(g.bowW > 0) && g.legs.F.stance && g.legs.B.stance && Math.hypot(v.x, v.z) < 0.15 && !g.walking) r.rec = t - tr;
    if (t - tr >= 1.1 && backFrom && !r.backDone) {
      const p = P.bodies.pelvis.translation();
      r.back = Math.hypot(p.x - backFrom.x, p.z - backFrom.z);
      r.backDone = true;
    }
  }
  r.wob /= r.n;
  r.lev /= r.n;
  void x0;
  return r;
}
const B = TRADITIONS.chinese.gait.bow;
console.log(`활 자세 깊이 · 청강검 플레이어 · bow drop ${B.drop} · lowMax ${B.lowMax ?? GAIT.lowMax} (전역 ${GAIT.lowMax}) · hold ${B.hold} · 시드 3 평균`);
console.log('| 부탁 | 골반 최저 m | 앞 허벅지 ° | 앞무릎 ° | 뒷무릎 ° | 가슴 ° | 넘어짐 | 휘청 몫 | 붙잡기 몫 | catch | 되찾기 s | 물러나기 m |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [name, ask] of [['베기 걸음 (pass 0.6)', { kind: 'pass', fwd: 0.6, duration: SKILL.lungeTime }], ['반걸음 (lunge 0.25)', { kind: 'lunge', fwd: 0.25, duration: 0.35, draw: true }]]) {
  const rs = [7, 11, 23].map((s) => run(s, ask, false)).filter(Boolean);
  const rb = [7, 11, 23].map((s) => run(s, ask, true)).filter(Boolean);
  for (let i = 0; i < rs.length; i++) rs[i].back = rb[i]?.back ?? NaN;
  const M = (k) => rs.reduce((a, b) => a + b[k], 0) / rs.length;
  const S = (k) => rs.reduce((a, b) => a + b[k], 0);
  console.log(`| ${name} | ${M('yMin').toFixed(3)} | ${M('thigh').toFixed(0)} | ${M('kF').toFixed(0)} | ${M('kB').toFixed(0)} | ${M('chest').toFixed(0)} | ${S('fall')} | ${M('wob').toFixed(2)} | ${M('lev').toFixed(2)} | ${S('catches')} | ${M('rec').toFixed(2)} | ${M('back').toFixed(2)} |`);
}
