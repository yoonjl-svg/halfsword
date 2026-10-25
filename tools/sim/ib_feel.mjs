// ─────────────────────────────────────────────────────────────
//  ib_feel.mjs — 이베리아 대검 손맛 계기 (10/25 사장님 '이베리아 무기는 손맛이 달라야 하지만 확실히 묵직한 대검 느낌이 사라지면 안돼')
//   docs/strike/iberian_feel_2026-10-25.md. 읽기만 한다 (게임 값을 바꾸지 않는다).
//   몸: 질량 · 손에서 무게중심 · 손 둘레 관성 — 엔진 값(weaponPhysics: 부품 무게중심 comY · 부품 관성 Ie 포함)과 부품 가운데 값(Σm·y² — 부품 자리만) 둘 다
//   자세: 손가락을 떼고 쉰 자세 마지막 0.5 s — 칼 축이 겨눔(debug.aim)보다 아래로 처진 각(°) · 칼끝 높이(m)
//   획: swing_feel.mjs 와 같은 손가락 길(60 Hz 프레임마다 handOffset · handHeld · inputActive · 숙련 0.7 · corr · autoGuard)로 허공을 긋는다 —
//    감는 자리 A 로 2 m/s → 0.6 s 쉼 → A→B 긋기(v 패드 m/s) → 손가락을 B 에 댄 채 1.5 s (헛친 칼: 되긋기 없음).
//    손 빠르기 = 칼 원점(오른손 주먹 가운데) 점 빠르기 최고 · 칼끝 = 칼날 끝 점 빠르기 최고(둘 다 velocityAtPoint — 강체 linvel 은 무게중심 빠르기라 쓰지 않는다)
//    닿기 = 긋기 시작 → 칼끝 최고 s · 90 % = 긋기 시작 → 칼끝이 그 획 최고의 90 % 에 처음 닿은 s · 8 m/s 까지 s · 0.15 s 때 칼끝 m/s · 손목 포화 = 긋는 동안 손목 서보가 상한에 닿은 스텝 몫
//    지나침 = 손가락이 B 에 멈춘 뒤 칼 축이 마지막(1.5 s 끝) 자리를 휘두른 쪽으로 넘어간 가장 큰 각(°) · 멈춤 = 손가락 멈춤 → 칼끝 < 1.5 m/s 가 0.1 s 이어진 때(s)
//    끝 처짐 = 손가락을 B 에 댄 1.5 s 의 마지막 0.3 s 에 칼 축이 겨눔보다 아래로 처진 각(°)
//   길: ober 정수리 내려 베기 · oberUp 같은 길 거꾸로(곧게 올려 베기) · unterR 오른 아래 → 왼 위 올려 베기 · zwerchR 오른 → 왼 가로 베기 ·
//    drop · lift = 감지 않고 쉰 자세(손가락 자리 그대로)에서 곧장 내려 · 올려 벰 (머리 위로 감은 칼은 내려 벨 때 먼저 칼끝을 넘겨야 해서 중력이 처음엔 거스른다)
//   맞는 무게 = 칼날 70 % 지점의 자유 강체 유효 질량 1 / (1/m + (r − 무게중심)² / 무게중심 둘레 관성) (kg — 같은 빠르기로 그 자리가 맞을 때 실리는 무게) ·
//    70 % 운동 에너지 = ½ × 맞는 무게 × (그 획에서 칼날 70 % 지점 빠르기 최고)² (J — 칼만의 몫 · 판정의 팔 몫 armAssist · energyScale 은 넣지 않음)
//   --nograv: 재기용 — 칼에만 중력을 끄고(칼 몸 중력 몫 0) 서보 · 팔의 칼 무게 미리 버팀에서도 칼을 뺀다. 중력 몫 = 보통 판 − 이 판 (게임 판은 늘 중력 그대로)
//
//   node tools/sim/ib_feel.mjs [무기...=zweihander flamberge tizona durandal longsword] [--speeds=12] [--lines=ober,oberUp,unterR,zwerchR] [--seeds=1] [--nograv] [--json=<파일>]
// ─────────────────────────────────────────────────────────────
import { newRound, THREE, CONFIG, DT, seedRandom } from './harness_m.mjs';
import { weaponPhysics } from '../../src/weapon_class.js';
import { getWeapon } from '../../src/weapons.js';
import { Fighter } from '../../src/fighter.js';
import { writeFileSync } from 'node:fs';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const IDS = pos.length ? pos : ['zweihander', 'flamberge', 'tizona', 'durandal', 'longsword'];
const SPEEDS = String(args.speeds ?? '12').split(',').map(Number);
const SEEDS = +(args.seeds ?? 1);
const FRAME = 1 / 60;
const HOLD = 1.5;
const { SKILL } = CONFIG;
const ALL_LINES = {
  ober: [[0.02, 0.52], [0.0, -0.45]],
  oberUp: [[0.0, -0.45], [0.02, 0.52]],
  unterR: [[0.38, -0.44], [-0.3, 0.26]],
  zwerchR: [[0.52, 0.06], [-0.5, 0.06]],
  drop: [null, [0.0, -0.45]], // 쉰 자세(감지 않고 그 자리)에서 곧장 내려 벰 (기본 길 아님 — --lines=drop,lift)
  lift: [null, [0.02, 0.52]], // 쉰 자세에서 곧장 머리 위로 올려 벰
};
const LINES = String(args.lines ?? 'ober,oberUp,unterR,zwerchR').split(',');
if (args.nograv) { // 재기용 (위 머리말): 칼 몸 중력 0 · 미리 버팀에서 칼을 뺌
  const g0 = Fighter.prototype.gravityTorque;
  Fighter.prototype.gravityTorque = function (bodies, ...rest) {
    if (this.sword && this._noGrav !== this.sword) { this.sword.setGravityScale(0, true); this._noGrav = this.sword; }
    return g0.call(this, bodies.map((b) => (b === this.sword ? null : b)), ...rest);
  };
}

/** 부품 가운데 값 (부품 자리 y 만 — 부품 무게중심 comY · 부품 관성 Ie 를 뺀 어림) */
function geoPhysics(spec) {
  let m = 0, my = 0, I = 0;
  for (const q of spec.buildParts.call(spec, {})) { m += q[2][0]; my += q[2][0] * q[1]; I += q[2][0] * q[1] * q[1]; }
  return { com: my / m, I };
}
/** 칼날 70 % 지점의 자유 강체 유효 질량 (kg — 위 머리말 '맞는 무게') */
function hitMass(spec, ph) {
  const r = spec.hiltLength + 0.7 * spec.bladeLength, Ic = ph.I - ph.mass * ph.com * ph.com;
  return 1 / (1 / ph.mass + (r - ph.com) ** 2 / Ic);
}

const _q = new THREE.Quaternion(), _o = new THREE.Vector3(), _ax = new THREE.Vector3();
function axisOf(P, out) {
  const q = P.sword.rotation();
  return out.set(0, 1, 0).applyQuaternion(_q.set(q.x, q.y, q.z, q.w));
}
function pointVel(P, t) {
  const p = t < 0 ? P.sword.translation() : P.bladePoint(t, _o);
  const v = P.sword.velocityAtPoint({ x: p.x, y: p.y, z: p.z });
  return new THREE.Vector3(v.x, v.y, v.z);
}
const deg = (r) => (r * 180) / Math.PI;

function setup(wid, seed) {
  seedRandom(seed);
  const G = newRound({ walls: true, weapon: wid, weapon2: 'longsword', seed });
  const P = G.player, E = G.enemy;
  P.skill.level = 0.7;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  for (const f of [P, E]) f.die = () => {};
  G.ai.update = () => E.move.set(0, 0);
  return { G, P };
}

function trial(wid, lineKey, v, seed) {
  const { G, P } = setup(wid, seed);
  const [A0, B] = ALL_LINES[lineKey];
  const A = A0 ?? 'here'; // 'here' = 감지 않음 (쉰 자세 손가락 자리)
  const legs = [[null, 2.6, 'settle'], [A, 2, 'wind'], [null, 0.6, 'pause'], [B, v, 'cut'], [null, HOLD, 'hold']];
  let li = 0, legT = 0, from = null, dur = 0, t = 0, stepAcc = 0, cutT = null, endT = null;
  const R = { hand: 0, tip: 0, v70: 0, tPeak: null, t90: null, t8: null, v15: null, sat: 0, dirPeak: null, over: 0, stop: null, ok: true, droop: [], tipY: [], endDroop: [] };
  let satN = 0, cutN = 0;
  const samples = []; // 손가락이 멈춘 뒤 칼 축 (지나침을 마지막 자리 기준으로 셈)
  const tips = []; // 긋기 동안 [시각, 칼끝 빠르기]
  let below = 0;
  while (li < legs.length && t < 9) {
    const [to0, sp, tag] = legs[li];
    const off = P.handOffset;
    const to = to0 === 'here' ? [off.x, off.y] : to0;
    let moved = false;
    if (to == null) {
      legT += FRAME;
      if (legT >= sp) { li++; legT = 0; from = null; }
    } else {
      if (!from) {
        from = [off.x, off.y];
        dur = Math.max(FRAME, Math.hypot(to[0] - off.x, to[1] - off.y) / sp);
        legT = 0;
        if (tag === 'cut') cutT = t;
      }
      legT += FRAME;
      const k = Math.min(1, legT / dur);
      const nx = from[0] + (to[0] - from[0]) * k, ny = from[1] + (to[1] - from[1]) * k;
      moved = Math.abs(nx - off.x) + Math.abs(ny - off.y) > 1e-5;
      off.x = nx; off.y = ny;
      if (k >= 1) { li++; from = null; if (tag === 'cut') endT = t + FRAME; }
    }
    P.handHeld = tag !== 'settle';
    P.inputActive = moved;
    P.move.set(0, 0);
    stepAcc += FRAME;
    while (stepAcc >= DT - 1e-9) {
      stepAcc -= DT;
      G.step();
      if (!P.sword || P.armed === false || P.state !== 'stand') { R.ok = false; continue; }
      const tt = t + FRAME - stepAcc;
      if (tag === 'settle' && legT > 2.1) { // 쉰 자세 마지막 0.5 s: 칼 축이 겨눔보다 아래로 처진 각
        const ax = axisOf(P, _ax), aim = P.debug.aim;
        if (aim.lengthSq() > 0.5) R.droop.push(deg(Math.asin(Math.max(-1, Math.min(1, aim.y / aim.length()))) - Math.asin(Math.max(-1, Math.min(1, ax.y)))));
        R.tipY.push(P.bladePoint(1, _o).y);
      }
      if (tag === 'hold' && legT > HOLD - 0.3) { // 끝 처짐: 손가락을 B 에 댄 마지막 0.3 s
        const ax = axisOf(P, _ax), aim = P.debug.aim;
        if (aim.lengthSq() > 0.5) R.endDroop.push(deg(Math.asin(Math.max(-1, Math.min(1, aim.y / aim.length()))) - Math.asin(Math.max(-1, Math.min(1, ax.y)))));
      }
      if (cutT == null) continue;
      const tv = pointVel(P, 1), sp2 = tv.length(), hv = pointVel(P, -1).length();
      if (endT == null || tt < endT + 0.4) { // 긋기 동안 (+ 손가락이 멈춘 뒤 0.4 s — 칼은 손가락보다 늦다)
        tips.push([tt - cutT, sp2]);
        if (R.t8 == null && sp2 >= 8) R.t8 = tt - cutT;
        if (R.v15 == null && tt - cutT >= 0.15) R.v15 = sp2;
        if (endT == null) { cutN++; if (P.debug.wristTorque.length() >= 0.98 * P.debug.wristCap) satN++; }
        if (sp2 > R.tip) { R.tip = sp2; R.tPeak = tt - cutT; R.dirPeak = tv.clone().normalize(); }
        if (hv > R.hand) R.hand = hv;
        const v70 = pointVel(P, 0.7).length();
        if (v70 > R.v70) R.v70 = v70;
      }
      if (endT != null && tt >= endT) {
        samples.push(axisOf(P, new THREE.Vector3()));
        if (R.stop == null) {
          below = sp2 < 1.5 ? below + DT : 0;
          if (below >= 0.1) R.stop = tt - endT - 0.1;
        }
      }
    }
    t += FRAME;
  }
  for (const [ts, s] of tips) if (R.t90 == null && s >= 0.9 * R.tip) R.t90 = ts;
  R.sat = cutN ? satN / cutN : NaN;
  // 지나침: 마지막 칼 축 a 에서 휘두른 쪽(칼끝 최고 때 빠르기 방향 d)으로 넘어간 각의 최고
  if (samples.length && R.dirPeak) {
    const a = samples[samples.length - 1];
    for (const b of samples) {
      const s = b.clone().sub(a).dot(R.dirPeak);
      if (s > 0) R.over = Math.max(R.over, deg(Math.acos(Math.max(-1, Math.min(1, a.dot(b))))));
    }
  }
  R.droopMean = R.droop.length ? R.droop.reduce((x, y) => x + y, 0) / R.droop.length : NaN;
  R.tipYMean = R.tipY.length ? R.tipY.reduce((x, y) => x + y, 0) / R.tipY.length : NaN;
  R.endDroopMean = R.endDroop.length ? R.endDroop.reduce((x, y) => x + y, 0) / R.endDroop.length : NaN;
  delete R.droop; delete R.tipY; delete R.endDroop; delete R.dirPeak;
  return R;
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const f2 = (x, n = 2) => (Number.isFinite(x) ? x.toFixed(n) : '—');
const out = {};
for (const wid of IDS) {
  const spec = getWeapon(wid), ph = weaponPhysics(spec), geo = geoPhysics(spec);
  const rows = [];
  for (const v of SPEEDS) for (const k of LINES) for (let s = 1; s <= SEEDS; s++) rows.push({ line: k, v, seed: s, ...trial(wid, k, v, s) });
  const ok = rows.filter((r) => r.ok);
  const by = (k) => ok.filter((r) => r.line === k);
  const o = {
    body: { mass: +ph.mass.toFixed(3), com: +ph.com.toFixed(3), I: +ph.I.toFixed(3), geoCom: +geo.com.toFixed(3), geoI: +geo.I.toFixed(3), reach: +(spec.hiltLength + spec.bladeLength).toFixed(3), cap: spec.controlOverrides.maxAimTorque, hitMass: +hitMass(spec, ph).toFixed(3) },
    droop: +mean(ok.map((r) => r.droopMean)).toFixed(1), tipY: +mean(ok.map((r) => r.tipYMean)).toFixed(3),
    lines: {},
  };
  for (const k of LINES) {
    const r = by(k);
    o.lines[k] = { n: r.length, hand: +mean(r.map((x) => x.hand)).toFixed(2), tip: +mean(r.map((x) => x.tip)).toFixed(2), e70: +mean(r.map((x) => 0.5 * o.body.hitMass * x.v70 * x.v70)).toFixed(1), tPeak: +mean(r.map((x) => x.tPeak)).toFixed(3), t90: +mean(r.map((x) => x.t90)).toFixed(3),
      t8: +mean(r.filter((x) => x.t8 != null).map((x) => x.t8)).toFixed(3), v15: +mean(r.map((x) => x.v15)).toFixed(2), sat: +mean(r.map((x) => x.sat)).toFixed(2), over: +mean(r.map((x) => x.over)).toFixed(1), endDroop: +mean(r.map((x) => x.endDroopMean)).toFixed(1), stop: +mean(r.filter((x) => x.stop != null).map((x) => x.stop)).toFixed(3) };
  }
  const L = o.lines;
  o.all = { hand: +mean(ok.map((x) => x.hand)).toFixed(2), tip: +mean(ok.map((x) => x.tip)).toFixed(2), e70: +mean(ok.map((x) => 0.5 * o.body.hitMass * x.v70 * x.v70)).toFixed(1), t90: +mean(ok.map((x) => x.t90)).toFixed(3), over: +mean(ok.map((x) => x.over)).toFixed(1), stop: +mean(ok.filter((x) => x.stop != null).map((x) => x.stop)).toFixed(3) };
  if (L.ober && L.oberUp) o.downUp = { tip: +(L.ober.tip / L.oberUp.tip).toFixed(2), v15: +(L.ober.v15 / L.oberUp.v15).toFixed(2), t8: +(L.oberUp.t8 / L.ober.t8).toFixed(2) };
  if (L.drop && L.lift) o.dropLift = { tip: +(L.drop.tip / L.lift.tip).toFixed(2), v15: +(L.drop.v15 / L.lift.v15).toFixed(2), t8: +(L.lift.t8 / L.drop.t8).toFixed(2) };
  out[wid] = o;
  const b = o.body;
  console.log(`${wid}: ${b.mass} kg · 무게중심 ${b.com} m · 관성 ${b.I} (부품 가운데 값 ${b.geoCom} · ${b.geoI}) · 손 ~ 칼끝 ${b.reach} m · 서보 ${b.cap} · 맞는 무게 ${b.hitMass} kg · 쉰 자세 처짐 ${f2(o.droop, 1)}° · 칼끝 높이 ${f2(o.tipY, 3)} m`);
  for (const k of LINES) {
    const x = L[k];
    console.log(`  ${k.padEnd(8)} (${x.n} 획) 손 ${f2(x.hand)} · 칼끝 ${f2(x.tip)} m/s · 70 % 운동 에너지 ${f2(x.e70, 1)} J · 0.15 s 때 ${f2(x.v15)} · 8 m/s 까지 ${f2(x.t8, 3)} s · 90 % ${f2(x.t90, 3)} s · 최고 ${f2(x.tPeak, 3)} s · 손목 포화 ${f2(x.sat)} · 지나침 ${f2(x.over, 1)}° · 멈춤 ${f2(x.stop, 3)} s · 끝 처짐 ${f2(x.endDroop, 1)}°`);
  }
  console.log(`  모두: 손 ${f2(o.all.hand)} · 칼끝 ${f2(o.all.tip)} m/s · 70 % 운동 에너지 ${f2(o.all.e70, 1)} J · 90 % ${f2(o.all.t90, 3)} s · 지나침 ${f2(o.all.over, 1)}° · 멈춤 ${f2(o.all.stop, 3)} s${o.downUp ? ` · 내려/올려 칼끝 최고 ${o.downUp.tip} · 0.15 s 때 ${o.downUp.v15} · 8 m/s 까지 시간 올려/내려 ${o.downUp.t8}` : ''}${o.dropLift ? ` · 쉰 자세에서 내려/올려 칼끝 최고 ${o.dropLift.tip} · 0.15 s 때 ${o.dropLift.v15} · 8 m/s 까지 시간 올려/내려 ${o.dropLift.t8}` : ''}`);
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
