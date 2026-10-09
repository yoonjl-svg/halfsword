// ─────────────────────────────────────────────────────────────
//  순간 베기 — 일본 비기 고노센의 실행 (10/10 사장님: '뭐가 나가긴 한 건지 식별 불가 · 전광석화처럼 · 물리 조건을 다 무시할 수 있는 방법 —
//   도착 지점에 순간이동해서 꽂히고 궤적이 잔상으로 남는다거나 · 경직은 더 길어도' → 디렉터 안 승인 "그렇게 하자").
//
//  **물리 원칙의 예외** (이 게임에서 '대가는 물리로만'을 깨는 곳 — docs/strike/school_secret_2026-10-09.md §13):
//   ① 내딛음: 몸의 강체 전부(골반 닻·칼 포함)를 같은 만큼 앞으로 평행 이동(속도 유지, 최대 SECRET.instantStep, 맞닿기 거리에서 멈추고 clinch 안으로는 안 감).
//      다리 걸음(gait)의 딛은 자리·목표도 같이 옮긴다.
//   ② 팔(칼 쪽 위팔·아래팔)과 칼을 한 프레임에 真向 끝 자세로: 손 목표(skill.aim)를 끝 패드에 두고 driveSword 가 그 패드로 정한 팔 관절 목표
//      (armIK — 서보가 쫓는 바로 그 자세)대로 강체를 놓는다 → 관절 기준점(어깨·팔꿈치·손목)이 맞고, 서보가 다음 스텝에 끌어당기지 않는다.
//      칼날 축 = 서보의 칼끝 목표(aimDirW), 날 = 쓸고 내려온 방향. 두 손 칼이면 빈팔도 빈손 IK(offArmIK)대로 칼자루 끝에. 팔·칼 속도는 가슴과 같게(각속도 0).
//   ③ 맞음은 충돌이 아니라 **쓸고 지나간 자리**: (시작 칼날 → 上段 → 끝 칼날)을 조각으로 보간한 칼날 선분과 상대 몸 부위 콜라이더(공·캡슐·상자)
//      거리로 첫 부위를 찾고, combat.analyze(기존 상처 함수 — 갑옷·투구·문턱·감정 그대로)로 상처를 준다. 에너지 = SECRET.instantJ × hitMul
//      (분석에 넣는 칼 속도를 그 에너지가 나오게 고른다). 결과 보장 아님 — 쓸린 자리에 몸이 없으면 헛침.
//   ④ 칼이 상대 몸 안에 놓일 수 있어 SECRET.instantNoCollide 초 동안 내 칼 ↔ 상대 몸 충돌을 끈다(combat.filterContactPair).
//   ⑤ 잔상: f.instantArc(조각마다 칼자루·칼끝 점)를 sword_trail.js 가 읽어 비기 색으로 한 번에 그린다.
//  부르는 곳: ai.js secretInstant · skill.js secret()(플레이어) 가 requestInstant → combat.afterStep 끝(world.step 뒤 — 권총 한 발과 같은 자리)에서 runInstants.
//  난수 없음. 비기가 아니면(요청 없음) 아무 일도 없다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, ARM, STRIKE } from './config.js';

const _qc = new THREE.Quaternion();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const clamp = THREE.MathUtils.clamp;
const LEG_POS = ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']; // gait 다리의 월드 자리 칸 (평행 이동에 같이 옮김)

/** 순간 베기를 걸어 둔다 (다음 combat.afterStep 이 실행). 결과는 f.instantResult = { ok, hit, energy, part, zone } */
export function requestInstant(f, opt = {}) {
  f.instantReq = { endPad: opt.endPad ?? SECRET.instantEndPad, at: opt.at ?? null };
  f.instantResult = null;
}

/** combat.afterStep 끝에서: 걸어 둔 순간 베기 실행 · 충돌 끔 시간 줄이기 */
export function runInstants(combat) {
  for (const f of combat.fighters) {
    if (f.instantGhost > 0) f.instantGhost--;
    if (f.instantReq) runInstant(f, combat);
  }
}

/** 칼 ↔ 몸 충돌을 끄는 중인가 (combat.filterContactPair) */
export function instantGhost(f) {
  return f.instantGhost > 0;
}

function tv(t, out) {
  return out.set(t.x, t.y, t.z);
}
function tq(r, out) {
  return out.set(r.x, r.y, r.z, r.w);
}

/** 몸 강체 전부·칼·골반 닻·다리 걸음 자리를 (dx, 0, dz) 만큼 평행 이동 (속도 그대로) */
function shiftFighter(f, dx, dz) {
  const bodies = [...Object.values(f.bodies), f.sword];
  for (const b of bodies) {
    const t = b.translation();
    b.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
  }
  if (f.anchor) {
    const t = f.anchor.translation();
    f.anchor.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
  }
  const g = f.gait;
  if (g?.legs) {
    for (const l of Object.values(g.legs)) {
      for (const k of LEG_POS) {
        const v = l[k];
        if (v?.isVector3) {
          v.x += dx;
          v.z += dz;
        }
      }
    }
  }
}

/** 손 목표를 패드 p 에 곧장 (거르기·가죽끈·이어 베기 모두 그 자리, 속도 0) — 서보가 끝 자세를 붙잡게 */
export function snapAim(f, p) {
  const s = f.skill;
  f.handOffset.set(p[0], p[1]);
  for (const v of [s.aim, s.aimRaw, s.anchor, s.prev]) v.set(p[0], p[1]);
  s.aimVel.set(0, 0);
  s.vel.set(0, 0);
  s.follow.set(0, 0);
}

/** 몸체 하나를 놓는다 (속도 = vel, 각속도 0) */
function place(b, p, q, vel) {
  b.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
  b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
  b.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
  b.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

/** 칼 몸체 자세: 칼날 축(y) = D, 날(x) = 쓸고 내려온 방향(D 에 수직인 아래쪽) */
function swordQuat(D, out) {
  const x = _v1.set(0, -1, 0).addScaledVector(D, D.y); // −up 의 D 수직 성분
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0).addScaledVector(D, -D.x);
  x.normalize();
  const z = _v2.crossVectors(x, D).normalize();
  _m.makeBasis(x, D, z);
  return out.setFromRotationMatrix(_m);
}

/** 팔(칼 쪽 위팔·아래팔)·칼(·빈팔)을 끝 패드의 서보 목표 자세로 놓는다. 끝 칼날 { B, D } (월드) */
function poseEnd(f, pad) {
  snapAim(f, pad);
  f.driveSword(); // 그 패드의 팔 관절 목표(armIK)와 칼끝 목표(aimDirW)를 정한다 (이 스텝 힘은 다음 스텝 머리에서 지워진다)
  const J = f.jointByName;
  const chest = f.bodies.chest;
  tq(chest.rotation(), _qc);
  const c = tv(chest.translation(), new THREE.Vector3());
  const vel = tv(chest.linvel(), new THREE.Vector3());
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(_qc).add(c);
  const qu = _q1.copy(_qc).multiply(J.uarmS.target);
  const qf = _q2.copy(qu).multiply(J.farmS.target);
  const elbow = new THREE.Vector3(0.3, 0, 0).applyQuaternion(qu).add(S);
  place(f.bodies.uarmS, new THREE.Vector3(0.15, 0, 0).applyQuaternion(qu).add(S), qu, vel);
  const fp = new THREE.Vector3(0.135, 0, 0).applyQuaternion(qf).add(elbow);
  place(f.bodies.farmS, fp, qf, vel);
  const wrist = new THREE.Vector3(0.13, 0, 0).applyQuaternion(qf).add(fp);
  J.uarmS.prevTarget?.copy(J.uarmS.target); // 서보 목표 속도가 튀지 않게
  const D = f.aimDirW.clone().normalize();
  const qs = swordQuat(D, _qs);
  place(f.sword, wrist, qs, vel);
  // 두 손 칼: 빈팔을 빈손 IK 대로 칼자루 끝으로
  if (f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3) {
    const pommel = new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(qs).add(wrist);
    f.offArmIK(pommel);
    const So = new THREE.Vector3(0, 0.1, -f.side * 0.2).applyQuaternion(_qc).add(c);
    const quo = new THREE.Quaternion().copy(_qc).multiply(J.uarmO.target);
    const qfo = new THREE.Quaternion().copy(quo).multiply(J.farmO.target);
    const eo = new THREE.Vector3(0, -0.3, 0).applyQuaternion(quo).add(So);
    place(f.bodies.uarmO, new THREE.Vector3(0, -0.15, 0).applyQuaternion(quo).add(So), quo, vel);
    place(f.bodies.farmO, new THREE.Vector3(0, -0.14, 0).applyQuaternion(qfo).add(eo), qfo, vel);
  }
  const B = new THREE.Vector3(0, f.weaponCfg.hiltLength, 0).applyQuaternion(qs).add(wrist);
  return { B, D, q: qs.clone() };
}

/** 선분 a–b 와 점 p 사이 거리 · 선분 위 가장 가까운 점 t */
function segPointT(a, b, p) {
  const u = _v3.subVectors(b, a);
  const L2 = u.lengthSq();
  const t = L2 > 1e-9 ? clamp(_v1.subVectors(p, a).dot(u) / L2, 0, 1) : 0;
  return { d: _v2.copy(a).addScaledVector(u, t).distanceTo(p), t };
}

/** 두 선분 사이 거리 (근사 — 한쪽을 9 점으로) */
function segSegApprox(a, b, c, d) {
  let best = Infinity;
  const p = new THREE.Vector3();
  for (let i = 0; i <= 8; i++) {
    p.lerpVectors(a, b, i / 8);
    const r = segPointT(c, d, p).d;
    if (r < best) best = r;
  }
  return best;
}

/** 칼날 선분 a–b 와 콜라이더 겉 사이 거리 (공·캡슐·상자) — 음수/0 이면 겹침 */
function segToCollider(a, b, col) {
  const sh = col.shape;
  const ct = tv(col.translation(), new THREE.Vector3());
  const cq = tq(col.rotation(), new THREE.Quaternion());
  if (sh.type === 0) return segPointT(a, b, ct).d - sh.radius; // 공
  if (sh.type === 2) {
    // 캡슐: 몸 축 = 콜라이더 y
    const ax = new THREE.Vector3(0, sh.halfHeight, 0).applyQuaternion(cq);
    return segSegApprox(a, b, ct.clone().sub(ax), ct.clone().add(ax)) - sh.radius;
  }
  if (sh.type === 1) {
    // 상자: 선분 위 9 점의 상자 겉 거리 가운데 가장 작은 것
    const he = sh.halfExtents;
    const inv = cq.clone().invert();
    let best = Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i <= 8; i++) {
      p.lerpVectors(a, b, i / 8).sub(ct).applyQuaternion(inv);
      const qx = Math.abs(p.x) - he.x;
      const qy = Math.abs(p.y) - he.y;
      const qz = Math.abs(p.z) - he.z;
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
      const r = out + Math.min(Math.max(qx, qy, qz), 0);
      if (r < best) best = r;
    }
    return best;
  }
  return Infinity;
}

/** 칼날 자세 둘 사이 보간 (자루 끝 B lerp, 칼날 축 D slerp) */
function lerpPose(A, Bp, t) {
  const B = new THREE.Vector3().lerpVectors(A.B, Bp.B, t);
  const q = new THREE.Quaternion().setFromUnitVectors(A.D, Bp.D);
  const D = A.D.clone().applyQuaternion(new THREE.Quaternion().slerp(q, t)).normalize();
  return { B, D };
}

function runInstant(f, combat) {
  const req = f.instantReq;
  f.instantReq = null;
  const foe = f.foe;
  if (!foe || !f.alive || !f.armed || f.state !== 'stand' || !f.sword) {
    f.instantResult = { ok: false, hit: false };
    return;
  }
  const BL = f.weaponCfg.bladeLength;
  const M = f.swordArt.measure;
  // ① 내딛음
  const c = f.bodies.chest.translation();
  const fc = foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  dx /= d;
  dz /= d;
  const step = Math.min(clamp(d - M.contact, 0, SECRET.instantStep), Math.max(0, d - M.clinch));
  if (step > 1e-3) shiftFighter(f, dx * step, dz * step);
  // 시작 칼날 (내디딘 뒤)
  const K0 = { B: f.bladePoint(0, new THREE.Vector3()), D: f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize() };
  // 上段 (머리 위, 칼끝 위·조금 뒤) — 시작이 이미 높으면 건너뜀
  tq(f.bodies.chest.rotation(), _qc);
  const c2 = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const K1 = { B: new THREE.Vector3(0.15, 0.5, f.side * 0.05).applyQuaternion(_qc).add(c2), D: new THREE.Vector3(-0.35, 0.94, 0).normalize().applyQuaternion(_qc) };
  const high = K0.B.y > c2.y + 0.3;
  // ② 끝 자세
  const K2 = poseEnd(f, req.endPad);
  // 쓸린 자리 (그리기: 올림 + 내려벰 · 맞음: 내려벰 조각만 — 올리는 길은 베는 길이 아니다 [해석])
  const N = SECRET.instantSlices;
  const raise = high ? [] : Array.from({ length: 5 }, (_, i) => lerpPose(K0, K1, i / 5));
  const from = high ? K0 : K1;
  const cut = Array.from({ length: N + 1 }, (_, i) => lerpPose(from, K2, i / N));
  const tip = (P) => P.B.clone().addScaledVector(P.D, BL);
  // ③ 맞음: 조각마다 상대 몸 부위 콜라이더와 거리
  const parts = [];
  const world = f.world;
  for (const [h, info] of f.colliderInfo) {
    if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
    const col = world.getCollider(h);
    if (col) parts.push({ h, info, col });
  }
  let hit = null;
  for (let i = 1; i <= N && !hit; i++) {
    const a = cut[i].B;
    const b = tip(cut[i]);
    let best = null;
    for (const P of parts) {
      const r = segToCollider(a, b, P.col);
      if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { ...P, r };
    }
    if (best) hit = { i, best };
  }
  let res = null;
  if (hit && foe.alive && foe.state !== 'dead') res = instantWound(f, foe, cut, hit, combat);
  // ④ 충돌 끔 · ⑤ 잔상
  f.instantGhost = Math.ceil(SECRET.instantNoCollide / (combat.dt || 1 / 120));
  const pts = [...raise, ...cut].map((P) => {
    const t = tip(P);
    return [P.B.x, P.B.y, P.B.z, t.x, t.y, t.z];
  });
  f.instantArc = { id: (f.instantArc?.id ?? 0) + 1, pts };
  // 칼끝 추적 다시 (순간이동을 속도로 읽지 않게)
  f.tipPrev = f.bladePoint(1, new THREE.Vector3());
  f.hitPointPrev = f.bladePoint(0.7, new THREE.Vector3());
  f.tipVel.set(0, 0, 0);
  f.hitPointVel.set(0, 0, 0);
  f.instantResult = { ok: true, hit: !!res, energy: res?.energy ?? 0, part: hit?.best.info.part ?? null, zone: res?.zone ?? null, type: res?.type ?? null, step };
}

/** 쓸린 자리의 첫 부위에 기존 상처 함수(combat.analyze → applyWound)로 상처. 에너지 = instantJ × hitMul 이 나오게 분석 속도를 고른다 */
function instantWound(f, foe, cut, hit, combat) {
  const { i, best } = hit;
  const P = cut[i];
  const P0 = cut[i - 1];
  const BL = f.weaponCfg.bladeLength;
  const HL = f.weaponCfg.hiltLength;
  const a = P.B;
  const b = P.B.clone().addScaledVector(P.D, BL);
  const bc = tv(best.col.translation(), new THREE.Vector3());
  const { t } = segPointT(a, b, bc);
  const point = a.clone().lerp(b, t);
  // 그 점이 쓸려 온 방향 (앞 조각의 같은 칼날 자리 → 이 조각)
  const prev = P0.B.clone().addScaledVector(P0.D, BL * t);
  const tang = point.clone().sub(prev);
  if (tang.lengthSq() < 1e-8) tang.set(0, -1, 0);
  tang.normalize();
  const bladeInfo = f.colliderInfo.get(f.bladeColliders[0]?.handle);
  if (!bladeInfo) return null;
  const pr = { w: bladeInfo, v: best.info, wc: f.bladeColliders[0].handle, vc: best.h };
  const qs = swordQuat(P.D, new THREE.Quaternion());
  const sp = P.B.clone().addScaledVector(P.D, -HL);
  const S = { p: sp, q: qs, com: sp.clone().addScaledVector(P.D, f.swordCom ?? 0.3), v: new THREE.Vector3(), w: new THREE.Vector3() };
  const vb = best.info.body;
  const Pst = { p: tv(vb.translation(), new THREE.Vector3()), q: tq(vb.rotation(), new THREE.Quaternion()), com: tv(vb.worldCom(), new THREE.Vector3()), v: tv(vb.linvel(), new THREE.Vector3()), w: tv(vb.angvel(), new THREE.Vector3()) };
  const target = SECRET.instantJ * SECRET.hitMul;
  const h0 = f.secretHit;
  f.secretHit = SECRET.hitMul;
  S.v.copy(tang).multiplyScalar(10).add(Pst.v);
  const r10 = combat.analyze(pr, point, S, Pst);
  let r = null;
  if (r10 && r10.energy > 0) {
    const v = clamp(10 * Math.sqrt(target / r10.energy), 0.6, 29.5);
    S.v.copy(tang).multiplyScalar(v).add(Pst.v);
    r = combat.analyze(pr, point, S, Pst);
  }
  f.secretHit = h0;
  if (!r || r.energy < STRIKE.minEnergy) return null;
  foe.hitCooldowns.set(`${f.index}:${best.info.part}`, STRIKE.hitCooldown);
  if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) foe.applyWound({ ...r, part: best.info.part, passing: true });
  combat.hooks.onWound?.(f, foe, r, point, pr);
  return r;
}
