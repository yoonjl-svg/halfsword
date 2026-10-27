// ─────────────────────────────────────────────────────────────
//  duplieren_check.mjs — 겹치기(G7 두플리렌) 두 손 몸 검사 (10/28 감독 전달 '두 팔이 사람 한도 밖으로 비틀리거나 몸 · 상대 칼을 지나가지 않게 — 관절 표') · docs/strike/duplieren_2026-10-28.md
//   special_balance.mjs drillRun('dupTap') (맞물리는 자세의 상대 — guardHigh · guard) 의 겹치기 운동학 칼이 도는 스텝마다:
//    칼 팔 = wrist_audit.mjs wristSample (팔꿈치 굽힘 · 손 면 안 치우침 dev · 굽힘 · 폄 fe · 아래팔 굴림 roll · 범위 밖 oor · 위팔 돌림 shRot · 팔꿈치 들림 elbowUp)
//    빈팔 = 팔꿈치 굽힘(위팔 ↔ 아래팔 축 각) · 빈손 ↔ 폼멜 쥘 자리 틈(m — 팔이 못 닿으면 커짐) · 빈 어깨 ↔ 폼멜 / 팔 길이(0.575 m — fighter.js offArmIK a + b)
//    몸 지나감 = 내 아래팔 둘 ↔ 내 몸통(가슴 · 배 · 골반 · 머리) · 위팔 둘 ↔ 배 · 골반 · 머리 · 내 칼날 ↔ 몸통 · 머리 · 칼 팔 ↔ 빈팔의 콜라이더 겉 거리 최소(음수 = 겹침)
//    칼 지나감 = 내 칼날 ↔ 상대 칼날 거리 최소(맞닿은 자리) · 맞닿은 자리에서 0.12 m 밖 내 칼날이 상대 칼날에 0.01 m 안으로 든 스텝 수(farTouch — 칼이 칼을 지나감)
//   사용법: node tools/sim/duplieren_check.mjs [--seeds=8] [--foes=guardHigh,guard] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { THREE, CONFIG } from './harness_m.mjs';
import { drillRun } from './special_balance.mjs';
import { wristSample, outOfRange } from './wrist_audit.mjs';
import { isMain } from './is_main.mjs';

const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
const Q = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const R2D = 180 / Math.PI;
const OFF_LEN = 0.3 + 0.275; // fighter.js offArmIK a + b

function segPoint(a, b, p) {
  const u = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(u) / Math.max(1e-9, u.lengthSq())));
  return a.clone().addScaledVector(u, t).distanceTo(p);
}
function segSeg(a, b, c, d, n = 12) {
  let m = Infinity;
  for (let i = 0; i <= n; i++) m = Math.min(m, segPoint(c, d, a.clone().lerp(b, i / n)));
  return m;
}
/** 선분 ↔ 콜라이더 겉 (공 · 캡슐 · 상자 — secret_instant.js segToCollider 와 같은 셈) */
function segCol(a, b, col) {
  const sh = col.shape;
  const ct = V(col.translation());
  const cq = Q(col.rotation());
  if (sh.type === 0) return segPoint(a, b, ct) - sh.radius;
  if (sh.type === 2) {
    const ax = new THREE.Vector3(0, sh.halfHeight, 0).applyQuaternion(cq);
    return segSeg(a, b, ct.clone().sub(ax), ct.clone().add(ax)) - sh.radius;
  }
  if (sh.type === 1) {
    const he = sh.halfExtents;
    const inv = cq.clone().invert();
    let best = Infinity;
    for (let i = 0; i <= 8; i++) {
      const p = a.clone().lerp(b, i / 8).sub(ct).applyQuaternion(inv);
      const qx = Math.abs(p.x) - he.x;
      const qy = Math.abs(p.y) - he.y;
      const qz = Math.abs(p.z) - he.z;
      best = Math.min(best, Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0));
    }
    return best;
  }
  return Infinity;
}
/** 몸체 축 선분 (캡슐 = 콜라이더 y 축 ± halfHeight) */
function capSeg(f, name) {
  const col = f.bodies[name]?.collider(0);
  if (!col || col.shape.type !== 2) return null;
  const ct = V(col.translation());
  const ax = new THREE.Vector3(0, col.shape.halfHeight, 0).applyQuaternion(Q(col.rotation()));
  return { a: ct.clone().sub(ax), b: ct.clone().add(ax), r: col.shape.radius };
}

/** 한 스텝 표본 (겹치기 칼이 도는 동안) */
function sample(P, D, st) {
  const w = wristSample(P);
  const s = { w: w ? { elbow: w.elbow, dev: w.dev, fe: w.fe, roll: w.roll, oor: outOfRange(w), shRot: w.shRot, elbowUp: w.elbowUp } : null };
  // 빈팔
  const B = P.bodies;
  if (B.uarmO && B.farmO && P.sword) {
    const qu = Q(B.uarmO.rotation());
    const qf = Q(B.farmO.rotation());
    const uy = new THREE.Vector3(0, -1, 0).applyQuaternion(qu);
    const fy = new THREE.Vector3(0, -1, 0).applyQuaternion(qf);
    const hand = V(B.farmO.translation()).addScaledVector(fy, 0.14);
    const qs = Q(P.sword.rotation());
    const pommel = new THREE.Vector3(0, P.weaponCfg.gripAlong, 0).applyQuaternion(qs).add(V(P.sword.translation()));
    const ch = B.chest;
    const So = new THREE.Vector3(0, 0.1, -P.side * 0.2).applyQuaternion(Q(ch.rotation())).add(V(ch.translation()));
    s.off = { elbow: Math.acos(Math.max(-1, Math.min(1, uy.dot(fy)))) * R2D, gap: hand.distanceTo(pommel), reach: So.distanceTo(pommel) / OFF_LEN };
  }
  // 몸 지나감: 내 팔 · 칼날 ↔ 내 몸통 · 머리
  const torso = ['chest', 'abdomen', 'pelvis', 'head'].map((n) => B[n]?.collider(0)).filter(Boolean);
  const below = ['abdomen', 'pelvis', 'head'].map((n) => B[n]?.collider(0)).filter(Boolean); // 위팔은 어깨에서 가슴에 붙어 있으므로 가슴 빼고
  let selfArm = Infinity;
  let selfArmPart = null;
  for (const n of ['uarmS', 'farmS', 'uarmO', 'farmO']) {
    const c = capSeg(P, n);
    if (!c) continue;
    for (const col of n.startsWith('u') ? below : torso) {
      const d = segCol(c.a, c.b, col) - c.r;
      if (d < selfArm) (selfArm = d), (selfArmPart = n);
    }
  }
  const b0 = P.bladePoint(0, new THREE.Vector3());
  const b1 = P.bladePoint(1, new THREE.Vector3());
  let selfBlade = Infinity;
  for (const col of torso) selfBlade = Math.min(selfBlade, segCol(b0, b1, col));
  // 다른 팔 사이 (위팔 · 아래팔 S ↔ O — 엇갈린 손이 서로 지나가지 않나)
  let armArm = Infinity;
  for (const n of ['uarmS', 'farmS'])
    for (const m of ['uarmO', 'farmO']) {
      const x = capSeg(P, n);
      const y = capSeg(P, m);
      if (x && y) armArm = Math.min(armArm, segSeg(x.a, x.b, y.a, y.b) - x.r - y.r);
    }
  s.self = { arm: selfArm, armPart: selfArmPart, blade: selfBlade, armArm };
  // 칼 지나감
  if (D.armed && D.sword) {
    const f0 = D.bladePoint(0, new THREE.Vector3());
    const f1 = D.bladePoint(1, new THREE.Vector3());
    // 내 칼날 24 점 중 상대 칼날에 가장 가까운 점(맞닿은 자리) · 그 자리에서 0.12 m 밖 칼날의 가장 가까운 거리 (맞닿은 자리 밖에서 다시 닿음 = 칼이 칼을 지나감)
    const L = b0.distanceTo(b1);
    let k0 = 0;
    let d0 = Infinity;
    const ds = [];
    for (let i = 0; i <= 24; i++) {
      const d = segPoint(f0, f1, b0.clone().lerp(b1, i / 24));
      ds.push(d);
      if (d < d0) (d0 = d), (k0 = i);
    }
    let far = Infinity;
    for (let i = 0; i <= 24; i++) if (Math.abs(i - k0) * (L / 24) > 0.12) far = Math.min(far, ds[i]);
    if (far < 0.01) st.cross++;
    s.blade = d0;
    s.far = far;
  }
  return s;
}

export const BASE = []; // 견줌: 겹치기 칼이 돌지 않는 스텝 (손가락 긋기 · 자세 — 같은 몸의 두 손 쥠)
export function dupCheck({ seeds = 8, foes = ['guardHigh', 'guard'] } = {}) {
  const S = [];
  const runs = [];
  for (const foe of foes)
    for (let seed = 1; seed <= seeds; seed++) {
      let st = null;
      let n = 0;
      drillRun('dupTap', seed, {
        foe,
        variant: 'on',
        dur: 16,
        probe: (G, P, D) => {
          const I = P.iai;
          if (I?.moves?.[0]?.dup) {
            if (!st) {
              st = { cross: 0, n: 0 };
              n++;
            }
            st.n++;
            S.push({ foe, seed, ...sample(P, D, st), seg: I.segs[I.si]?.cut ? 'cut' : 'slide' });
          } else if (!I && G.t > 2) {
            const sm = sample(P, D, { cross: 0 });
            BASE.push({ armArm: sm.self.armArm, arm: sm.self.arm, armPart: sm.self.armPart, off: sm.off });
          }
          if (!I?.moves?.[0]?.dup && st) {
            runs.push({ foe, seed, steps: st.n, cross: st.cross, res: P.instantResult ? { hits: P.instantResult.hits, zone: P.instantResult.zone, type: P.instantResult.type, E: +(P.instantResult.energy ?? 0).toFixed(1), dup: P.instantResult.dup, glided: P.instantResult.glided } : null });
            st = null;
          }
        },
      });
    }
  return { S, runs };
}

const q = (a, p) => {
  const s = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))].toFixed(3) : null;
};
const mn = (a) => {
  const s = a.filter((x) => x != null && isFinite(x));
  return s.length ? +Math.min(...s).toFixed(3) : null;
};
const mx = (a) => {
  const s = a.filter((x) => x != null && isFinite(x));
  return s.length ? +Math.max(...s).toFixed(3) : null;
};

/** 관절 표 (스텝 묶음): 칸마다 p50 · 끝 (최소 / 최대) */
export function dupTable(S) {
  const W = S.map((s) => s.w).filter(Boolean);
  const O = S.map((s) => s.off).filter(Boolean);
  return {
    steps: S.length,
    sword: {
      elbow: [q(W.map((w) => w.elbow), 0.5), mx(W.map((w) => w.elbow))],
      dev: [q(W.map((w) => w.dev), 0.5), mn(W.map((w) => w.dev)), mx(W.map((w) => w.dev))],
      fe: [q(W.map((w) => Math.abs(w.fe)), 0.5), mx(W.map((w) => Math.abs(w.fe)))],
      roll: [q(W.map((w) => w.roll), 0.5), mx(W.map((w) => w.roll))],
      oorShare: W.length ? +(W.filter((w) => w.oor > 1).length / W.length).toFixed(3) : null,
      oorMax: mx(W.map((w) => w.oor)),
      shRot: [q(W.map((w) => w.shRot), 0.5), mn(W.map((w) => w.shRot)), mx(W.map((w) => w.shRot))],
      elbowUp: [q(W.map((w) => w.elbowUp), 0.5), mx(W.map((w) => w.elbowUp))],
    },
    off: {
      elbow: [q(O.map((o) => o.elbow), 0.5), mx(O.map((o) => o.elbow))],
      gap: [q(O.map((o) => o.gap), 0.5), mx(O.map((o) => o.gap))],
      reach: [q(O.map((o) => o.reach), 0.5), mx(O.map((o) => o.reach))],
    },
    self: {
      arm: [q(S.map((s) => s.self.arm), 0.5), mn(S.map((s) => s.self.arm))],
      armHitShare: +(S.filter((s) => s.self.arm < 0).length / Math.max(1, S.length)).toFixed(3),
      blade: [q(S.map((s) => s.self.blade), 0.5), mn(S.map((s) => s.self.blade))],
      bladeHitShare: +(S.filter((s) => s.self.blade < 0).length / Math.max(1, S.length)).toFixed(3),
      armArm: [q(S.map((s) => s.self.armArm), 0.5), mn(S.map((s) => s.self.armArm))],
      armArmHitShare: +(S.filter((s) => s.self.armArm < 0).length / Math.max(1, S.length)).toFixed(3),
      armParts: S.filter((s) => s.self.arm < 0).reduce((o, s) => ((o[s.self.armPart] = (o[s.self.armPart] ?? 0) + 1), o), {}),
    },
    foeBlade: { min: mn(S.map((s) => s.blade)), p50: q(S.map((s) => s.blade), 0.5), farMin: mn(S.map((s) => s.far)), farTouch: S.filter((s) => s.far < 0.01).length },
  };
}

if (isMain(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
  // --set=UNIQUE_ASSIST.dupBody=[0,0,0,0];… : 게임 값을 바꿔 견줌 (JSON 값 · ';' 로 여럿)
  for (const kv of String(args.set ?? '').split(';').filter(Boolean)) {
    const i = kv.indexOf('=');
    const ks = kv.slice(0, i).split('.');
    let o = CONFIG;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = JSON.parse(kv.slice(i + 1));
  }
  const { S, runs } = dupCheck({ seeds: +(args.seeds ?? 8), foes: String(args.foes ?? 'guardHigh,guard').split(',') });
  const T = dupTable(S);
  console.log(JSON.stringify(T, null, 1));
  console.log('base (손가락 · 자세 스텝)', JSON.stringify({ steps: BASE.length, armArm: [q(BASE.map((b) => b.armArm), 0.5), mn(BASE.map((b) => b.armArm))], armArmHitShare: +(BASE.filter((b) => b.armArm < 0).length / Math.max(1, BASE.length)).toFixed(3), arm: [q(BASE.map((b) => b.arm), 0.5), mn(BASE.map((b) => b.arm))], armHitShare: +(BASE.filter((b) => b.arm < 0).length / Math.max(1, BASE.length)).toFixed(3), offGap: [q(BASE.map((b) => b.off?.gap), 0.5), mx(BASE.map((b) => b.off?.gap))], offReach: mx(BASE.map((b) => b.off?.reach)) }));
  console.log(`snaps ${runs.length} · cross ${runs.reduce((a, r) => a + r.cross, 0)} · hits ${runs.filter((r) => r.res?.hits).length} · zones ${JSON.stringify(runs.map((r) => r.res?.zone ?? '-'))}`);
  if (args.json) writeFileSync(args.json, JSON.stringify({ T, runs }, null, 1));
}
