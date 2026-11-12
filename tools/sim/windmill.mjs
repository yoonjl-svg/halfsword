// ─────────────────────────────────────────────────────────────
//  windmill.mjs — 풍차 베기(싱지르 · 이베리아 특수 공격) 동작 재기 · 그림용 흔적 (11/12 사장님 '먼저 빠르게 돌고 그 다음 발을 내딛으면서 베야지' ·
//   '돌려면 앞 디딤발 각도를 90도 정도 틀어서 미리 바꿔야 할 수도 있어' — 기록 docs/strike/windmill_2026-11-12.md). 읽기만 (판 값 그대로 · --set 은 이 프로세스 안에서만).
//
//  판 하나 = 서 있는 과녁(롱소드 · AI 끔 · 상처는 몸에 안 걸고 기록만 — ib_swap.mjs spinRun 과 같은 자리)에 가슴 거리 gap 에서 특수 공격 싱지르를 곧장 낸다
//   (skill.secret special 'cingir' — 사람 · AI 같은 실행부). 낸 때부터 대본 · 따라 지나감이 끝나고 after 초까지 물리 스텝마다 잰다:
//   마디(발 틀기 prep · 돌기 spin · 내딛기 step · 받아 멈춤 settle · 따라 지나감 follow) · 몸이 돈 각 · 골반 옮김(돌기 동안 · 그 뒤) ·
//   축발 갈림(디딘 채 발이 돈 각 — 땅에 비빈 몫) · 엉덩이 비틀림(발 방향 − 골반 방향, 낼 때 값을 뺌 · 허벅지 비틀기 한계 0.6 rad = 34°) ·
//   두 발 엇갈림(iberian_spin_feet footSnap lat < 0) · 몸 기울기 · 넘어짐 · 팔 관절(iberian_finish_arms armSample — 범위 밖 스텝 수) ·
//   칼 ↔ 제 몸 · 다리 거리(칼날 0.2 ~ 1 다섯 점 ↔ 골반 · 배 · 가슴 · 머리 · 허벅지 · 정강이 · 발 — m · − = 파고듦) · 칼 가장 낮은 높이 ·
//   칼이 상대 앞을 가로지른 때(칼끝이 나 → 상대 줄을 칼 든 쪽에서 반대쪽으로 넘음 · 몸 앞) · 그때 마디 · 칼끝 빠르기 · 맞음(때 · 마디 · 자리 · J · 심각도)
//  node tools/sim/windmill.mjs [--ws=zweihander,flamberge,tizona,durandal] [--gaps=1.6,2.1,2.6] [--seeds=1] [--set=SECRET.ibSpin.split=0,…] [--trace=파일.json] [--rows]
//   --trace: 첫 판의 스텝마다 몸 · 발 · 칼 자리(월드)를 JSON 으로 — tools/sim/windmill_draw.py 가 차례 그림으로
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, CONFIG, THREE } from './harness_m.mjs';
import { IBERIAN_SPIN_DEF } from '../../src/schools.js';
import { armSample, outOf, RANGE } from './iberian_finish_arms.mjs';
import { footSnap } from './iberian_spin_feet.mjs';
import { partDist } from './envelope_check.mjs';
import { applySets } from './ib_swap.mjs';
import { isMain } from './is_main.mjs';

const R2D = 180 / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const yawOf = (b) => {
  const r = b.rotation();
  _v.set(1, 0, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
  return Math.atan2(-_v.z, _v.x); // heading 과 같은 각
};
const tilt = (P) => {
  const r = P.bodies.chest.rotation();
  return Math.acos(Math.min(1, new THREE.Vector3(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).y)) * R2D;
};
const OWN = ['pelvis', 'abdomen', 'chest', 'head', 'thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB'];

/** 마디 이름 (대본 · 실행부 읽기) */
export function phaseOf(P) {
  const S = P.ibSpin;
  const sec = P.skill.sec;
  if (S) {
    if (S.settle) return 'settle';
    if (S.stepPh) return 'step';
    if (S.tp < S.pre) return 'prep';
    return 'spin';
  }
  if (sec) return sec.stage === 'stiff' ? 'stiff' : 'follow';
  return 'after';
}

/** 그림용 한 스텝 (월드 자리) */
function snap(P, E, t, ph) {
  const p = (b) => {
    const x = b.translation();
    return [r3(x.x), r3(x.y), r3(x.z)];
  };
  const seg = (b) => {
    const c = b.collider(0);
    const r = c.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const o = c.translation();
    const hh = c.shape.halfHeight ?? 0;
    const a = new THREE.Vector3(0, -hh, 0).applyQuaternion(q).add(o);
    const z = new THREE.Vector3(0, hh, 0).applyQuaternion(q).add(o);
    return [r3(a.x), r3(a.y), r3(a.z), r3(z.x), r3(z.y), r3(z.z)];
  };
  const B = P.bodies;
  const G = P.gait;
  const h = P.bladePoint(0, new THREE.Vector3());
  const tp = P.bladePoint(1, new THREE.Vector3());
  const o = {
    t: r3(t), ph, hd: r3(P.heading), pel: p(B.pelvis), ch: p(B.chest), hdp: p(B.head),
    feet: ['F', 'B'].map((k) => {
      const L = G.legs[k];
      const fb = B[L.foot];
      return { k, side: k === 'F' ? 1 : -1, c: p(fb), yaw: r3(yawOf(fb)), st: !!L.stance };
    }),
    seg: {},
    hilt: [r3(h.x), r3(h.y), r3(h.z)], tip: [r3(tp.x), r3(tp.y), r3(tp.z)],
    foe: { ch: p(E.bodies.chest), pel: p(E.bodies.pelvis), hd: p(E.bodies.head) },
    pk: P.ibSpin?.pk ?? null,
  };
  for (const n of ['thighF', 'shinF', 'thighB', 'shinB', 'uarmS', 'farmS', 'uarmO', 'farmO']) if (B[n]) o.seg[n] = seg(B[n]);
  return o;
}

/** 판 하나 */
export function windRun({ w = 'zweihander', gap = 2.1, seed = 1, after = 0.6, trace = false, fireAt = 3.0, walk = 0 } = {}) {
  const G = newRound({ walls: false, seed, weapon: w, weapon2: 'longsword', gap });
  const P = G.player;
  const E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  E.applyWound = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const K = CONFIG.TIME.k;
  const wounds = [];
  let t0 = null;
  let fired = false;
  G.combat.hooks.onWound = ((pw) => (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === P && vic === E && t0 != null) wounds.push({ t: r3(G.t - t0), ph: phaseOf(P), zone: r.zone, type: r.type, sev: r3(r.type === 'blunt' ? 0 : r.severity ?? 0), E: r1(r.energy) });
  })(G.combat.hooks.onWound);
  const R = {
    w, seed, gap, d0: null, turned: 0, phases: {}, pelEnd: {}, crossAt: {}, travelTurn: null, travelAll: null, grindPivot: 0, grindOther: 0, twistMax: 0, twistAt: null, cross: 0, tiltMax: 0, fell: false,
    arms: { n: 0, out: {}, ph: {}, max: {}, base: null }, wristMax: 0, ownMin: Infinity, ownAt: null, lowMin: Infinity, crossT: null, crossPh: null, crossTip: null, crossD: null, tipMax: 0, tipSpin: 0, frames: trace ? [] : null,
  };
  let last = null;
  let p0 = null;
  let tw0 = null;
  let pk0 = null;
  let yawPrev = null;
  let side = null; // 칼끝이 나 → 상대 줄 어느 쪽 (칼 든 쪽 +)
  let tEnd = null;
  let turnEnd = null;
  try {
    while (G.t < 20) {
      P.move.set(0, t0 == null && walk && G.t > fireAt - 0.8 ? walk : 0); // walk: 낼 때까지 앞으로 걸음 (걷다 냄 — 한 발이 떠 있을 수 있음)
      if (t0 == null && G.t >= fireAt) {
        R.d0 = r3(P.foeDistance());
        R.bothAtFire = !!(P.gait.legs.F.stance && P.gait.legs.B.stance);
        const pp = P.bodies.pelvis.translation();
        p0 = { x: pp.x, z: pp.z };
        if (trace) R.frames.push(snap(P, E, 0, 'stand'));
        fired = P.skill.secret({ S: IBERIAN_SPIN_DEF, ctx: { ev: 'spin', turnDir: 0 }, special: 'cingir' });
        if (!fired) throw new Error('싱지르를 못 냄');
        t0 = G.t;
        last = P.heading;
        pk0 = P.ibSpin.axisK ?? P.ibSpin.pk; // 축발 (11/12 두 마디는 발 틀기 동안 pk 가 뒷발 — axisK)
        R.h0 = P.heading;
        R.vmax = r3(P.ibSpin.vmax);
        R.split = !!P.ibSpin.sp;
        const L = P.gait.legs;
        R.axisYaw0 = yawOf(P.bodies[L[pk0].foot]);
        tw0 = Object.fromEntries(['F', 'B'].map((k) => [k, wrap(yawOf(P.bodies[L[k].foot]) - yawOf(P.bodies.pelvis))]));
        yawPrev = Object.fromEntries(['F', 'B'].map((k) => [k, yawOf(P.bodies[L[k].foot])]));
      }
      G.step();
      if (t0 == null) {
        if (G.t > fireAt - 0.5) {
          const sb = armSample(P);
          if (sb) {
            R.arms.base ??= { n: 0, out: {}, max: {} };
            R.arms.base.n++;
            for (const k of Object.keys(RANGE)) if (outOf(k, sb)) R.arms.base.out[k] = (R.arms.base.out[k] ?? 0) + 1;
            for (const k of ['wristFE', 'pen']) if (sb[k] != null) R.arms.base.max[k] = Math.max(R.arms.base.max[k] ?? -Infinity, Math.abs(sb[k]));
          }
        }
        continue;
      }
      const t = G.t - t0;
      const ph = phaseOf(P);
      R.phases[ph] ??= [r3(t), null];
      R.phases[ph][1] = r3(t);
      {
        const pp = P.bodies.pelvis.translation();
        const fw = { x: Math.cos(R.h0), z: -Math.sin(R.h0) };
        R.pelEnd[ph] = r3((pp.x - p0.x) * fw.x + (pp.z - p0.z) * fw.z); // 그 마디 끝 골반 옮김 (낼 때 상대 쪽 몫 · m)
      }
      if (P.ibSpin) {
        R.turned += wrap(P.heading - last);
        last = P.heading;
        if (turnEnd == null && Math.abs(R.turned) >= 2 * Math.PI - 0.02) {
          turnEnd = t;
          const pp = P.bodies.pelvis.translation();
          R.travelTurn = r3(Math.hypot(pp.x - p0.x, pp.z - p0.z));
          R.turnEnd = r3(t);
        }
      }
      // 축발 갈림 · 엉덩이 비틀림
      const L = P.gait.legs;
      const py = yawOf(P.bodies.pelvis);
      for (const k of ['F', 'B']) {
        const fy = yawOf(P.bodies[L[k].foot]);
        const d = Math.abs(wrap(fy - yawPrev[k]));
        yawPrev[k] = fy;
        if (P.ibSpin && L[k].stance) {
          if (k === pk0) R.grindPivot += d;
          else R.grindOther += d;
        }
        if (P.ibSpin || ph === 'follow') {
          const tw = Math.abs(wrap(fy - py - tw0[k]));
          if (tw > R.twistMax) (R.twistMax = tw), (R.twistAt = `${k === pk0 ? 'pivot' : 'other'}:${ph}`);
        }
      }
      if (ph === 'spin' && R.prepEnd == null) {
        // 돌기 첫 스텝: 축발이 처음보다 돈 각 (° · 도는 쪽 +) · 골반에서 축발 발목까지 (m)
        const La = L[pk0];
        const pp = P.bodies.pelvis.translation();
        R.prepEnd = { turn: r1((wrap(yawOf(P.bodies[La.foot]) - R.axisYaw0) * R2D) * (P.side >= 0 ? 1 : -1)), dist: r3(Math.hypot(La.ankle.x - pp.x, La.ankle.z - pp.z)) };
      }
      if (ph === 'spin' && !L[pk0].stance) R.axisLiftSpin = (R.axisLiftSpin ?? 0) + 1; // 돌기 동안 축발이 떠 있음 (없어야)
      if (ph === 'step') {
        if (!L[pk0].stance) R.axisLiftStep = (R.axisLiftStep ?? 0) + 1; // 내딛기 동안 앞발이 들림 (있어야)
        if (!L[pk0 === 'F' ? 'B' : 'F'].stance) R.otherLiftStep = (R.otherLiftStep ?? 0) + 1; // 내딛기 동안 뒷발이 떠 있음 (없어야)
      }
      if (P.ibSpin && footSnap(P).lat < 0) (R.cross++, (R.crossAt[ph] = (R.crossAt[ph] ?? 0) + 1));
      R.tiltMax = Math.max(R.tiltMax, tilt(P));
      if (P.state !== 'stand') R.fell = true;
      // 팔
      const s = armSample(P);
      if (s && P.state === 'stand') {
        R.arms.n++;
        for (const k of Object.keys(RANGE)) if (outOf(k, s)) (R.arms.out[k] = (R.arms.out[k] ?? 0) + 1), (R.arms.ph[`${k}:${ph}`] = (R.arms.ph[`${k}:${ph}`] ?? 0) + 1);
        for (const k of ['wristFE', 'pen']) if (s[k] != null) R.arms.max[k] = Math.max(R.arms.max[k] ?? -Infinity, Math.abs(s[k]));
        if (s.wrist != null) R.wristMax = Math.max(R.wristMax, s.wrist);
      }
      // 칼 ↔ 제 몸 · 땅
      if (P.armed) {
        for (const u of [0.2, 0.4, 0.6, 0.8, 1]) {
          const b = P.bladePoint(u, new THREE.Vector3());
          R.lowMin = Math.min(R.lowMin, b.y);
          for (const n of OWN) {
            const d = partDist(P.bodies[n], b);
            if (d < R.ownMin) (R.ownMin = d), (R.ownAt = `${n}@${u}:${ph}`);
          }
        }
        // 칼끝이 나 → 상대 줄을 넘음 (몸 앞)
        const pe = P.bodies.pelvis.translation();
        const fc = E.bodies.chest.translation();
        const ux = fc.x - pe.x;
        const uz = fc.z - pe.z;
        const Lu = Math.hypot(ux, uz) || 1;
        const tip = P.bladePoint(1, new THREE.Vector3());
        const ax = (tip.x - pe.x) * (ux / Lu) + (tip.z - pe.z) * (uz / Lu); // 상대 쪽 몫
        const lat = (tip.x - pe.x) * (-uz / Lu) + (tip.z - pe.z) * (ux / Lu); // 상대 줄에서 옆 (오른쪽 +)
        const sd = Math.sign(lat) * (P.side >= 0 ? 1 : -1);
        const tv = P.tipVel.length();
        R.tipMax = Math.max(R.tipMax, tv);
        if (ph === 'spin' && !P.ibSpin?.free) R.tipSpin = Math.max(R.tipSpin, tv);
        if (side != null && R.crossT == null && ax > 0.3 && side > 0 && sd < 0 && (P.ibSpin?.free || ph === 'follow')) {
          R.crossT = r3(t);
          R.crossPh = ph;
          R.crossTip = r1(tv);
          R.crossD = r3(Math.hypot(fc.x - pe.x, fc.z - pe.z));
        }
        if (ax > 0.3) side = sd;
        else if (ax < -0.3) side = null;
      }
      if (trace) R.frames.push(snap(P, E, t, ph));
      if (ph === 'after') tEnd ??= t;
      if (tEnd != null && t - tEnd >= after) break;
    }
    const pp = P.bodies.pelvis.translation();
    R.travelAll = r3(Math.hypot(pp.x - p0.x, pp.z - p0.z));
    const fs = footSnap(P);
    R.feetLon = r3(fs.lon);
    R.feetLat = r3(fs.lat);
    R.done = r3(tEnd);
    R.turned = r3(R.turned * R2D);
    R.grindPivot = r1(R.grindPivot * R2D);
    R.grindOther = r1(R.grindOther * R2D);
    R.twistMax = r1(R.twistMax * R2D);
    R.tiltMax = r1(R.tiltMax);
    R.wristMax = r1(R.wristMax);
    R.ownMin = r3(R.ownMin);
    R.lowMin = r3(R.lowMin);
    R.tipMax = r1(R.tipMax);
    R.tipSpin = r1(R.tipSpin);
    R.hit = wounds.some((x) => x.sev > 0);
    R.first = wounds.find((x) => x.sev > 0) ?? wounds[0] ?? null;
    R.sev = r3(wounds.reduce((a, x) => a + x.sev, 0));
    R.state = P.state;
    R.K = K;
    return R;
  } finally {
    G.world.free();
  }
}

if (isMain(import.meta.url)) {
  const rest = process.argv.slice(2);
  const arg = (k, d) => {
    const a = rest.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : d;
  };
  applySets(arg('set', ''));
  const tr = arg('trace', null);
  let first = true;
  const rows = [];
  for (const w of arg('ws', 'zweihander,flamberge,tizona,durandal').split(','))
    for (const gap of arg('gaps', '1.6,2.1,2.6').split(',').map(Number))
      for (const seed of arg('seeds', '1').split(',').map(Number)) {
        const r = windRun({ w, gap, seed, trace: tr && first });
        if (tr && first) {
          writeFileSync(tr, JSON.stringify({ w, gap, seed, set: arg('set', ''), first: r.first, phases: r.phases, frames: r.frames }));
          first = false;
        }
        delete r.frames;
        rows.push(r);
        console.log(JSON.stringify(r));
      }
  if (rest.includes('--rows')) {
    const n = rows.length;
    const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
    console.log(
      JSON.stringify({
        n, hit: sum((r) => (r.hit ? 1 : 0)), fell: sum((r) => (r.fell ? 1 : 0)), cross: sum((r) => (r.cross > 0 ? 1 : 0)), tiltMax: Math.max(...rows.map((r) => r.tiltMax)),
        twistMax: Math.max(...rows.map((r) => r.twistMax)), grindPivot: r1(sum((r) => r.grindPivot) / n), armsOut: sum((r) => Object.values(r.arms.out).reduce((a, x) => a + x, 0)),
        wristMax: Math.max(...rows.map((r) => r.wristMax)), ownMin: Math.min(...rows.map((r) => r.ownMin)), lowMin: Math.min(...rows.map((r) => r.lowMin)),
        crossPh: rows.reduce((a, r) => ((a[r.crossPh ?? 'none'] = (a[r.crossPh ?? 'none'] ?? 0) + 1), a), {}), hitPh: rows.reduce((a, r) => ((a[r.first?.ph ?? 'none'] = (a[r.first?.ph ?? 'none'] ?? 0) + 1), a), {}),
      }),
    );
  }
}
