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
import { SECRET, ARM, STRIKE, GAIT, ARENA, JOINTS } from './config.js';
const GAIT_REACH = GAIT.reachMax;

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
    if (f.stamina?.exhausted) {
      if (f.iai) setKinematic(f, false);
      if (f.iaiRopes) {
        if (f.iaiRopes.grip && f.armed && !f.gripCone) f.gripConeOn();
        if (f.iaiRopes.shoulder && !f.shoulderRopes) f.shoulderOn();
        f.iaiRopes = null;
      }
      f.secretStance = null;
      f.instantReq = f.iaiReq = f.iai = null;
      f.instantGhost = f.iaiHoldT = f.iaiFade = f.holdGhost = 0;
      f.iaiOneHold = false;
      continue;
    }
    if (f.instantGhost > 0) f.instantGhost--;
    if (f.holdGhost > 0) f.holdGhost--;
    if (f.instantReq) runInstant(f, combat);
    if (f.iaiReq) startIai(f, combat);
    if (f.iai) (f.iai.kind === 'combo' ? stepCombo : stepIai)(f, combat);
    if (f.iaiHoldT > 0 || f.iaiFade > 0) holdIai(f, combat.dt || 1 / 120);
    stanceTick(f, combat.dt || 1 / 120);
    artTrailTick(f);
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
function swordQuat(D, out, hint = null) {
  const x = hint ? _v1.copy(hint).addScaledVector(D, -hint.dot(D)) : _v1.set(0, -1, 0).addScaledVector(D, D.y); // 날 = hint(쓸린 방향)의 D 수직 성분, 없으면 −up 의 D 수직 성분
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
function instantWound(f, foe, cut, hit, combat, J = SECRET.instantJ, dtSub = 0, hitMul = SECRET.hitMul, effMul = null, grip = null) {
  const { i, best } = hit;
  const P = cut[i];
  const P0 = cut[i - 1];
  const BL = f.weaponCfg.bladeLength;
  const HL = f.weaponCfg.hiltLength;
  // grip (죽음의 일격 운동학 길 — 10/22 밤): P.B = 손목 · P.D = 칼자루 쪽 · 치는 막대 = 손목 → 칼자루 끝(grip.Lp). 맞은 점의 칼 축 자리 = g − (손에서 거리) —
  //  코등이 아래(칼자루)면 칼자루 부품으로(둔타), 위(손과 코등이 사이 칼날)면 칼날 부품으로 기존 판정(combat.analyze — 날 맞춤으로 베임 · 둔타)
  const len = grip ? grip.Lp : BL;
  const a = P.B;
  const b = P.B.clone().addScaledVector(P.D, len);
  const bc = tv(best.col.translation(), new THREE.Vector3());
  const { t } = segPointT(a, b, bc);
  const point = a.clone().lerp(b, t);
  // 그 점이 쓸려 온 방향 (앞 조각의 같은 칼날 자리 → 이 조각)
  const prev = P0.B.clone().addScaledVector(P0.D, len * t);
  const tang = point.clone().sub(prev);
  const swept = tang.length(); // 그 점이 이 조각에 쓸려 온 길이 (m) — dtSub 가 있으면 빠르기 = swept / dtSub (중국 빠른 연환)
  if (tang.lengthSq() < 1e-8) tang.set(0, -1, 0);
  tang.normalize();
  let wCol = f.bladeColliders[0];
  const hy = grip ? grip.g - len * t : null; // 맞은 점의 칼 축 자리 (죽음의 일격)
  if (grip && hy < HL) {
    // 칼자루 부품 가운데 그 자리에 가장 가까운 것 (폼멜 · 손잡이 · 코등이)
    let bd = Infinity;
    for (const c of f.swordColliders ?? []) {
      if (f.colliderInfo.get(c.handle)?.part !== 'hilt') continue;
      const d = Math.abs(c.translationWrtParent().y - hy);
      if (d < bd) (bd = d), (wCol = c);
    }
  }
  const bladeInfo = f.colliderInfo.get(wCol?.handle);
  if (!bladeInfo) return null;
  if (grip && f.iai) (f.iai.wPart = bladeInfo.part), (f.iai.hy = +hy.toFixed(3)); // 재기 (판정에는 안 씀)
  const pr = { w: bladeInfo, v: best.info, wc: wCol.handle, vc: best.h };
  const yAx = grip ? P.D.clone().negate() : P.D;
  const qs = swordQuat(yAx, new THREE.Quaternion(), tang); // 날이 쓸린 방향을 향하게 (가로 발도·세로 真向 모두)
  const sp = grip ? P.B.clone().addScaledVector(P.D, grip.g) : P.B.clone().addScaledVector(P.D, -HL); // 칼 원점 (죽음의 일격: 손목 + 칼자루 쪽 × g)
  const S = { p: sp, q: qs, com: sp.clone().addScaledVector(yAx, f.swordCom ?? 0.3), v: new THREE.Vector3(), w: new THREE.Vector3() };
  const vb = best.info.body;
  const Pst = { p: tv(vb.translation(), new THREE.Vector3()), q: tq(vb.rotation(), new THREE.Quaternion()), com: tv(vb.worldCom(), new THREE.Vector3()), v: tv(vb.linvel(), new THREE.Vector3()), w: tv(vb.angvel(), new THREE.Vector3()) };
  const target = J * hitMul;
  const h0 = f.secretHit;
  f.secretHit = hitMul; // 비기 판정 배율 (진 · 츠바메가에시 되돌림 칼은 1 — 비기가 아니다)
  let r = null;
  if (dtSub > 0) {
    // 중국 빠른 연환 (10/12): 에너지를 정하지 않고 쓸린 그 점의 실제 빠르기로 분석 (기존 상처 함수 그대로 — 판정 배율 hitMul 은 아래 secretHit)
    //  격살(10/22): effMul 이 있으면 그 분석 동안만 f.effMul — combat.js analyze 가 문턱과 견주는 판정 에너지(eff)에 곱한다 (마무리 찍기 FINISH.power 와 같은 자리)
    S.v.copy(tang).multiplyScalar(swept / dtSub).add(Pst.v);
    const e0 = f.effMul;
    if (effMul) f.effMul = effMul;
    r = combat.analyze(pr, point, S, Pst);
    f.effMul = e0;
    f.secretHit = h0;
    if (!r || r.energy < STRIKE.minEnergy) return null;
    foe.hitCooldowns.set(`${f.index}:${best.info.part}`, STRIKE.hitCooldown);
    if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) {
      foe.applyWound({ ...r, part: best.info.part, passing: true });
      if (r.schoolK) f.schoolPassive?.onHit(r); // 유파 패시브 몫이 실린 맞음 (combat.js strike 와 같음 — 손가락 긋기를 이어 끄는 칼만 몫이 실림: 제비 베기 되돌림 칼의 켄타이 · 10/25)
    }
    combat.hooks.onWound?.(f, foe, r, point, pr);
    return r;
  }
  S.v.copy(tang).multiplyScalar(10).add(Pst.v);
  const r10 = combat.analyze(pr, point, S, Pst);
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

// ─────────────────────────────────────────────────────────────
//  발도 (10/10 02:3x 사장님 발도술 GIF — '저 동작을 매우 빨리 할 방법은? 아니면 섬광만 날릴까? 물리를 초월해서' → 디렉터 결정 '보이는 초고속 + 섬광').
//  고노센 = 발도 (SECRET.iai 1, `?iai=0` 이면 위의 순간이동 고노센). **물리 원칙의 예외** — 이 파일 안:
//   · 팔 사슬(칼 쪽 위팔·아래팔, 두 손 칼이면 빈팔도)과 칼을 SECRET.iaiTime 초 동안 운동학 몸(kinematicPositionBased)으로 돌려
//     발도 길(왼 허리 → 상대 가슴~목 높이로 **가로** 휩쓸기 → 오른 앞으로 다 뻗은 따라 베기 끝)을 그대로 따라 움직인다.
//     길은 몸(가슴 자리 · 시작 때 몸 방향 yaw) 기준 손 자리 + 칼날 방향(가로 각) 열쇠 셋, 팔은 그 손 자리로 armIK — 관절 기준점이 맞다.
//   · 그동안 몸 전체가 앞으로 미끄러진다(순간 베기와 같은 한도 — 최대 instantStep, 맞닿기에서 멈춤, clinch 안 금지).
//   · 맞음은 쓸린 자리(스텝마다 칼날 선분 + 그 사이 조각)로, 상처는 instantWound(에너지 instantJ × hitMul). 운동학 칼·팔 ↔ 상대 몸·칼 충돌은 끈다(instantGhost).
//   · 끝나면 dynamic 으로 되돌리고(속도 = 가슴, 각속도 0) 경직 동안 덧씌우기 칸(skill.thrustPose)으로 따라 베기 끝 자세를 붙잡는다(앞으로 뻗은 채 굳음).
//   · 잔상: f.instantArc(kind 'iai')를 sword_trail.js 가 청백색 초승달 + 0.08 s 흰 섬광 선으로 그리고 main.js 가 화면을 아주 짧게 번쩍인다.
//  대기 자세(10/10 02:4x 사장님 수정): 일본 AI 가 상대 간격 밖에 SECRET.iaiArmTime 초 머물면 웅크린 발도 대기(iaiReadyPose — 덧씌우기 칸)로 들어가고,
//   고노센은 그 자세에서만 나간다(secret.js IaiArm · cond.armed). 플레이어는 자세를 바꾸지 않고 '고노센 준비' 표시만.
// ─────────────────────────────────────────────────────────────
const D2R = Math.PI / 180;
const ARM_PARTS = ['uarmS', 'farmS'];
const OFF_PARTS = ['uarmO', 'farmO'];

/** 발도를 걸어 둔다 (다음 combat.afterStep 이 시작). opt.player: 플레이어(지금 손에서 왼 허리를 거쳐 — 전체 iaiPlayerTime) ·
 *  opt.block: 막힐 수 있는 발도 — 칼이 몸보다 먼저 상대 칼에 닿으면 막힘(이베리아 휩쓸기 · 연환과 같은 거리 iberianBlockDist · 밀어냄 없음). 고노센 B(SECRET.gnsEnterBlock — 천천히 걸어 든 들어옴 창에서 낸 것만 · 10/25) ·
 *  'cover' = 그에 더해 상대 칼끝이 내 몸을 겨누고 있었음(낼 때 — secret.js foeOnline) — 몸에 닿는 그 자리에서 그 칼에 막힘 (SECRET.gnsEnterBlock 2 · 10/25 16:0x 시험) */
export function requestIai(f, opt = {}) {
  f.iaiReq = { player: !!opt.player, block: opt.block === 'cover' ? 'cover' : !!opt.block };
  f.instantResult = null;
}

/** 몸 기준(가슴 원점 · yaw 틀: x 앞, y 위, z 칼 든 쪽) 칼날 방향: 가로 각 yaw(°, 앞 0 → 칼 든 쪽 +), 높이 각 el(°) */
function dirOf(yawDeg, elDeg, out = new THREE.Vector3()) {
  const a = yawDeg * D2R;
  const e = elDeg * D2R;
  return out.set(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a));
}

/** 발도 길의 u(0~1) 자리: 손 H·칼날 D (몸 기준) */
function iaiPose(I, u) {
  const K = I.K ?? SECRET.iaiPath; // I.K: 이 발도의 길 (SECRET.iaiRise 면 올려베기 길 iaiPathRise — startIai). 없으면 가로 길 (연환 빠르기 기준 iaiTipSpeed 는 늘 가로 길)
  if (u < I.ab) {
    const v = u / I.ab;
    const H = I.A.H.clone().lerp(new THREE.Vector3(...K.B.hand), v);
    const q = new THREE.Quaternion().setFromUnitVectors(I.A.D, I.DB);
    const D = I.A.D.clone().applyQuaternion(new THREE.Quaternion().slerp(q, v)).normalize();
    return { H, D };
  }
  const v = I.ab < 1 ? (u - I.ab) / (1 - I.ab) : 1;
  const [P, Q, w] = v < 0.5 ? [K.B, K.M, v / 0.5] : [K.M, K.E, (v - 0.5) / 0.5];
  const k = w * w * (3 - 2 * w) * 0.5 + w * 0.5; // 반쯤 부드럽게 (이음새에서 멈추지 않게)
  const H = new THREE.Vector3(...P.hand).lerp(new THREE.Vector3(...Q.hand), k);
  const D = dirOf(P.yaw + (Q.yaw - P.yaw) * k, P.el + (Q.el - P.el) * k);
  return { H, D };
}

/**
 * 고노센 팔 뻗음 (10/12 사장님 03:1x '고노센도 관절 비기 풀어' — SECRET.secretReach): 발도 길의 손 자리(iaiPath M·E)는 어깨에서 팔 길이의 0.83~0.92 라
 *  팔꿈치가 36° 안팎 굽은 채 휩쓸었다(tools/sim/secret_reach.mjs). 베는 몫에서 손 자리를 어깨 → 손 방향으로 팔 길이(위팔 + 아래팔 — 팔꿈치 곧게)까지 밀어낸다:
 *  왼 허리에서 뽑는 자리(B)는 그대로(0) → 가운데(M)에서 다 뻗음(1) → 끝(E)까지 다 뻗음. 어깨 = 지금 가슴의 칼 어깨 자리(발도 몸 틀). 방향·칼날·시간은 그대로 (새 값 없음)
 */
function iaiReach(f, I, P, u) {
  if (!SECRET.secretReach || u < I.ab) return P;
  const v = I.ab < 1 ? (u - I.ab) / (1 - I.ab) : 1;
  const x = Math.min(1, v / 0.5); // B → M 사이 몫 (iaiPose 의 가운데 이음새 v 0.5)
  const w = x * x * (3 - 2 * x);
  const chest = f.bodies.chest;
  const c = chest.translation();
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(tq(chest.rotation(), new THREE.Quaternion())).add(tv(c, new THREE.Vector3())).sub(tv(c, new THREE.Vector3())).applyQuaternion(I.yaw.clone().invert());
  const r = P.H.clone().sub(S);
  const d = r.length();
  const Lf = ARM.upper + ARM.fore;
  if (d < 1e-6 || d >= Lf) return P;
  return { H: S.add(r.multiplyScalar((d + w * (Lf - d)) / d)), D: P.D };
}

/** 휩쓸기 동안 손목 원뿔·칼 어깨 면 밧줄을 잠깐 뗀다 (머리 위 고리는 그 한도를 넘는 자리를 지나 — 밧줄이 매 스텝 팔·가슴을 잡아채 몸이 50° 넘게 기울었다). 끝나면 다시 건다 */
function ropes(f, on) {
  if (!on) {
    if (f.gripCone) for (const j of f.gripCone) f.world.removeImpulseJoint(j, true);
    f.gripCone = null;
    if (f.shoulderRopes) for (const j of f.shoulderRopes) f.world.removeImpulseJoint(j, true);
    f.shoulderRopes = null;
    return;
  }
  if (f.armed && f.weaponCfg.hiltLength && !f.gripCone) f.gripConeOn();
  if (!f.shoulderRopes && f.bodies.uarmS && f.jointByName.uarmS) f.shoulderOn();
}

function setKinematic(f, on) {
  if (!SECRET.iaiKinematic) return;
  const R = f.R;
  const parts = [...ARM_PARTS, ...(f.iai?.off ? OFF_PARTS : [])];
  for (const n of parts) f.bodies[n]?.setBodyType(on ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
  f.sword.setBodyType(on ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
}

const _wz = new THREE.Vector3(); // placeIai 손목 교정 (칼 면 · 날)
const _wx = new THREE.Vector3();
/** 손 자리 H·칼날 D(몸 기준)로 팔·칼(·빈팔)을 놓는다 — now: 지금 자리로(첫 스텝), 아니면 다음 스텝 운동학 목표. 칼날 선분 { B, D, tip } (월드) */
function placeIai(f, H, D, now, turn = 0, edgeHint = null, rollCap = false) {
  const J = f.jointByName;
  const chest = f.bodies.chest;
  const qc = tq(chest.rotation(), new THREE.Quaternion());
  const c = tv(chest.translation(), new THREE.Vector3());
  const yaw = f.iai.yaw;
  const target = H.clone().applyQuaternion(yaw).add(c);
  const M = f.iai.mord; // 죽음의 일격 (10/22 밤 — 운동학 길): D = 칼자루 쪽 · 칼 축(+y) = −D · 칼 원점 = 손목 + D × g (거꾸로 쥔 자리 g 가 손목에) · 날은 휘두르는 면 안(몸 옆 축 × 칼 축)
  const Dw = D.clone().applyQuaternion(yaw).normalize();
  if (!M) (f.aimRawW ||= new THREE.Vector3()).copy(Dw); // 팔꿈치 돌림(armIK)이 이 칼날을 읽는다 (교정 전)
  f.armIK(target);
  // 서보 목표도 같은 자세로 (덧씌우기 칸 = 이 손 자리·칼날): 팔 근육이 다른 자리로 당기며 가슴을 비틀어 넘어뜨리지 않게
  const th = f.skill.thrustPose;
  const Hy = H.clone().applyQuaternion(yaw).applyQuaternion(f.yaw.clone().invert());
  const Dy = D.clone().applyQuaternion(yaw).applyQuaternion(f.yaw.clone().invert());
  th.w = 1;
  th.hand[0] = Hy.x;
  th.hand[1] = Hy.y;
  th.hand[2] = Hy.z;
  th.dir[0] = Dy.x;
  th.dir[1] = Dy.y;
  th.dir[2] = Dy.z;
  const EB = f.iai.bodyAt ? f.iai.bodyAt(f.iai.u ?? 0) : f.iai.body; // 휩쓸기: 몸 비틀기가 길을 따라 (감기 → 돌리기)
  th.pelvisYaw = EB.pelvisYaw * D2R;
  th.chestYaw = EB.chestYaw * D2R;
  th.pitch = EB.pitch * D2R;
  th.drop = EB.drop;
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(qc).add(c);
  const qu = qc.clone().multiply(J.uarmS.target);
  const qf = qu.clone().multiply(J.farmS.target);
  const elbow = new THREE.Vector3(0.3, 0, 0).applyQuaternion(qu).add(S);
  const up = new THREE.Vector3(0.15, 0, 0).applyQuaternion(qu).add(S);
  const fp = new THREE.Vector3(0.135, 0, 0).applyQuaternion(qf).add(elbow);
  const wrist = new THREE.Vector3(0.13, 0, 0).applyQuaternion(qf).add(fp);
  const yAx = M ? Dw.clone().negate() : Dw;
  // 날: 가로로 칼 든 쪽으로 쓸린다 → 날 = D × 위 · edgeHint(제비 베기 되돌림 칼 — 10/25)가 있으면 칼이 가는 쪽(날 세우기 — 날이 앞장섬, instantWound 와 같은 뜻)
  const edge = M ? new THREE.Vector3(0, 0, 1).applyQuaternion(yaw).cross(yAx) : edgeHint ? edgeHint.clone().addScaledVector(Dw, -edgeHint.dot(Dw)) : new THREE.Vector3().crossVectors(Dw, new THREE.Vector3(0, 1, 0));
  if (turn && !M) edge.applyAxisAngle(Dw, f.side * turn); // 길 덧칸 손 돌리기 (제비 베기 되돌림 칼 — 10/25): 칼 면을 칼 축 둘레로 (칼 든 쪽 + = 엎침 · fighter.js driveSword techPlan.turn 과 같은 식)
  const qs = swordQuat(yAx, new THREE.Quaternion(), edge.lengthSq() > 1e-6 ? edge.normalize() : null);
  // 굴림 묶음 (rollCap — 제비 베기 되돌림 칼 몸통 띠 판 · 10/25 23:1x): 운동학 칼은 손목 밧줄(HUMAN.forearmRoll — 아래팔 z ↔ 칼 면 z 각)이 못 막으므로
  //  놓을 아래팔(qf)과 칼 면이 그 한도 밖이면 칼 면을 칼 축 둘레로 아래팔 쪽에 한도까지만 돌린다(가장 작은 돌림 · 칼끝 · 손 자리 그대로 · 새 수 없음 — 반으로 나눠 찾기 14 번)
  if (rollCap && !M && f.rollMax) {
    const lim = Math.cos(f.rollMax() * D2R);
    const zF = new THREE.Vector3(0, 0, 1).applyQuaternion(qf);
    const zS = new THREE.Vector3(0, 0, 1).applyQuaternion(qs);
    //  날 세우기 두 쪽(날 = 칼끝이 가는 쪽 · 그 반대 — 칼 면을 칼 축 둘레로 180°: 칼 줄 · 칼끝 그대로 · 판정의 날 맞춤 |cos| 같음) 가운데 아래팔에 덜 돈 쪽 —
    //   전엔 늘 가는 쪽이라 올려 긋는 칼 면이 손에 대해 164° 돌았다(사람 밖 · 손목 교정이 손 면 각을 잃어 칼 줄이 스텝마다 튐)
    if (edgeHint && zF.dot(zS) < 0) {
      edge.negate();
      swordQuat(yAx, qs, edge);
      zS.negate();
    }
    if (zF.dot(zS) < lim) {
      const w = new THREE.Vector3().crossVectors(Dw, zS); // 칼 면 z 를 칼 축 둘레로 +90°
      const full = Math.atan2(zF.dot(w), zF.dot(zS)); // 아래팔 z 에 가장 가까워지는 돌림
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 14; i++) {
        const t = (lo + hi) / 2;
        if (zF.dot(zS.clone().multiplyScalar(Math.cos(full * t)).addScaledVector(w, Math.sin(full * t))) >= lim) hi = t;
        else lo = t;
      }
      edge.applyAxisAngle(Dw, full * hi);
      swordQuat(yAx, qs, edge.normalize());
    }
  }
  // 비정상 손목 교정 (JOINTS.wristGuard — driveSword 와 같은 wristClamp): 놓을 아래팔(qf)과 칼날이 사람 손목 범위 밖이면 칼날을 칼 면 안에서 범위 끝으로. 손 자리 · 팔 · 칼 면 그대로
  //  겨눈 찌름(comboPlanAim thrust · SECRET.thrustArm — 런지 · 격살 허파 찌르기)은 칼이 어깨 → 겨눈 곳 줄 위라 건드리지 않는다: 칼끝을 줄에서 비키면 찌름이 베기가 된다(탭 찌르기와 같은 원칙 — 손목은 팔이 맡음)
  const thrustSeg = SECRET.thrustArm && f.iai.kind === 'combo' && f.iai.moves?.[f.iai.mi]?.dyn?.thrust;
  f.wristFixDeg = JOINTS.wristGuard && !M && !thrustSeg ? f.wristClamp(new THREE.Vector3(1, 0, 0).applyQuaternion(qf), Dw, _wz.set(0, 0, 1).applyQuaternion(qs)) : 0; // fighter.js wristClamp (몸의 메서드로 — 이 모듈이 fighter.js 를 부르면 모듈 차례가 꼬인다)
  if (f.wristFixDeg) swordQuat(Dw, qs, _wx.crossVectors(Dw, _wz));
  const kin = SECRET.iaiKinematic;
  const cv = chest.linvel();
  const put = (b, p, q) => {
    if (now || !kin) {
      b.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
      b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    }
    if (kin) {
      b.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
      b.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    } else {
      b.setLinvel({ x: cv.x, y: cv.y, z: cv.z }, true); // 동역학 몸 그대로 스텝마다 자리를 정한다 (속도 = 가슴 — 다음 스텝이 자리를 흩뜨리지 않게)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  };
  put(f.bodies.uarmS, up, qu);
  put(f.bodies.farmS, fp, qf);
  put(f.sword, M ? wrist.clone().addScaledVector(Dw, M.g) : wrist, qs);
  if (f.iai.off) {
    const pommel = M ? wrist.clone().addScaledVector(Dw, M.g - M.gOff) : new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(qs).add(wrist); // 죽음의 일격: 빈손 = 칼 축 gOff
    f.offArmIK(pommel);
    const So = new THREE.Vector3(0, 0.1, -f.side * 0.2).applyQuaternion(qc).add(c);
    const quo = qc.clone().multiply(J.uarmO.target);
    const qfo = quo.clone().multiply(J.farmO.target);
    const eo = new THREE.Vector3(0, -0.3, 0).applyQuaternion(quo).add(So);
    put(f.bodies.uarmO, new THREE.Vector3(0, -0.15, 0).applyQuaternion(quo).add(So), quo);
    put(f.bodies.farmO, new THREE.Vector3(0, -0.14, 0).applyQuaternion(qfo).add(eo), qfo);
  }
  if (M) return { B: wrist.clone(), D: Dw, tip: wrist.clone().addScaledVector(Dw, M.Lp) }; // 죽음의 일격: 치는 막대 = 손목 → 칼자루 끝
  const B = new THREE.Vector3(0, f.weaponCfg.hiltLength, 0).applyQuaternion(qs).add(wrist);
  return { B, D: Dw, tip: B.clone().addScaledVector(Dw, f.weaponCfg.bladeLength) };
}

function startIai(f, combat) {
  const req = f.iaiReq;
  f.iaiReq = null;
  const foe = f.foe;
  if (!foe || !f.alive || !f.armed || f.state !== 'stand' || !f.sword || f.iai) {
    f.instantResult = { ok: false, hit: false };
    return;
  }
  if (req.sweep) return startSweep(f, combat, req);
  if (req.combo) return startCombo(f, combat, req);
  const M = f.swordArt.measure;
  const c = f.bodies.chest.translation();
  const fc = foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  dx /= d;
  dz /= d;
  const slide = Math.min(clamp(d - M.contact, 0, SECRET.iaiStep), Math.max(0, d - M.clinch));
  const yaw = f.yaw.clone();
  const inv = yaw.clone().invert();
  // 지금 손(손목)·칼날 (몸 기준)
  const sw = tv(f.sword.translation(), new THREE.Vector3());
  const AH = sw.clone().sub(tv(c, new THREE.Vector3())).applyQuaternion(inv);
  const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  const K = SECRET.iaiPath;
  const DB = dirOf(K.B.yaw, K.B.el);
  const far = AH.distanceTo(new THREE.Vector3(...K.B.hand)) > 0.12 || AD.angleTo(DB) > 0.6;
  const T = req.player || far ? SECRET.iaiPlayerTime : SECRET.iaiTime; // 대기 자세(손이 왼 허리)면 곧장 가로, 아니면 왼 허리를 거쳐
  // 10/12 03:2x 사장님 '기술길이 좀 더 상승하게 … 사선 올려베기처럼' · '한 팔 완전히 쭉 뻗어서 써야 맞는 거 아냐?' (SECRET.iaiRise): 길 = 올려베기 iaiPathRise ·
  //  한 손 = 칼 쪽 손만 쥐고 빈손은 칼을 놓고 배 앞으로(10/14 — 전 왼 허리 뒤 鞘引き · fighter.js applyPose 가 iai.oneHand 를 읽어 빈팔을 SECRET.iaiSayaHand 로 · offHand 쥐기 쉼).
  //  틀이 무거운 칼(frame 'heavy' — 모노호시자오)은 한 손이 무리라 두 손 그대로 (무기 표에 이미 있는 틀 값을 읽음 — 새 규칙 없음). 다시 쥐기는 발도 뒤(경직 붙잡기) — iai 가 끝나면 offHand 가 다시 쥔다
  const rise = !!SECRET.iaiRise;
  const oneHand = rise && !!f.weaponCfg.twoHand && f.weapon?.frame !== 'heavy';
  f.iai = { kind: 'iai', K: rise ? SECRET.iaiPathRise : SECRET.iaiPath, oneHand, J: SECRET.instantJ, body: SECRET.iaiPath.E.body, hold: SECRET.stiff.japanese, pose: (I, u) => iaiReach(f, I, iaiPose(I, u), u), t: 0, T, ab: far ? SECRET.iaiDrawShare : 0, A: { H: AH, D: AD }, DB, yaw, slide, dx, dz, off: !oneHand && !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), prev: null, hit: null, res: null, arc: null };
  if (req.block) f.iai.block = true; // 고노센 B (SECRET.gnsEnterBlock — 천천히 걸어 든 들어옴 창에서 낸 발도): 몸보다 먼저 상대 칼에 닿으면 막힘 (아래 stepIai — 밀어냄은 휩쓸기만)
  if (req.block === 'cover') f.iai.cover = true; // gnsEnterBlock 2: 칼끝이 내 몸을 겨눈 채 천천히 든 상대 — 몸에 닿는 자리에서 막힘
  setKinematic(f, true);
  if (f.gait?.active && SECRET.iaiDrawStep > 0) f.gait.requestStep({ kind: 'lunge', fwd: SECRET.iaiDrawStep, duration: 0.3 }); // 발도 순간 앞발을 크게 (10/10 04:2x)
  f.instantGhost = Math.ceil((T + SECRET.instantNoCollide) / (combat.dt || 1 / 120)) + 1;
  const P0 = f.iai.pose(f.iai, 0);
  f.iai.prev = placeIai(f, P0.H, P0.D, true);
}

function stepIai(f, combat) {
  const I = f.iai;
  const dt = combat.dt || 1 / 120;
  const foe = f.foe;
  if (!f.alive || !f.armed || !foe) return endIai(f, combat);
  // 몸 미끄러짐: 칼이 가운데를 지나기 전(SECRET.iaiSlideShare 몫 안)에 다 내딛는다 (부드럽게 줄며)
  const pr = (t) => {
    const x = Math.min(1, t / (I.T * (I.slideShare ?? SECRET.iaiSlideShare)));
    return 1 - (1 - x) * (1 - x);
  };
  const ds = I.slide * (pr(I.t + dt * f.stamina.attackSpeed) - pr(I.t));
  if (ds > 1e-5) shiftFighter(f, I.dx * ds, I.dz * ds);
  I.t += dt * f.stamina.attackSpeed;
  const u = Math.min(1, I.t / I.T);
  I.u = u;
  const P = I.pose(I, u);
  const cur = placeIai(f, P.H, P.D, false);
  // 베는 몫(u ≥ ab): 잔상 점·쓸린 자리 맞음
  if (u >= I.ab) {
    if (!I.arc) {
      I.arc = { id: (f.instantArc?.id ?? 0) + 1, kind: I.kind, pts: [], side: I.sideW ?? null };
      f.instantArc = I.arc;
    }
    const subs = 3;
    for (let k = 1; k <= subs; k++) {
      const w = k / subs;
      const B = I.prev.B.clone().lerp(cur.B, w);
      const D = I.prev.D.clone().lerp(cur.D, w).normalize();
      const tip = B.clone().addScaledVector(D, f.weaponCfg.bladeLength);
      I.arc.pts.push([B.x, B.y, B.z, tip.x, tip.y, tip.z]);
      // 이베리아 휩쓸기: 몸보다 먼저 상대 칼에 닿으면 막힘 — 맞음 판정을 멈추고 상대를 밀어낸다 (sweepShove), 칼은 그 자리에서 멈춤
      if (I.block && !I.hit && !I.blocked && foe.armed && foe.sword && segSegApprox(B, tip, foe.bladePoint(0, new THREE.Vector3()), foe.bladePoint(1, new THREE.Vector3())) < SECRET.iberianBlockDist) {
        I.blocked = true;
        I.uEnd = Math.max(I.ab, u - (1 - w) * (dt / I.T));
        if (I.kind === 'sweep') sweepShove(f, foe); // 발도(고노센 여쭘 B)는 막힌 자리에서 멈추기만 — 연환 · 격살 · 런지 막힘과 같음
      }
      if (!I.hit && !I.blocked && foe.alive && foe.state !== 'dead') {
        let best = null;
        for (const [h, info] of f.colliderInfo) {
          if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
          const col = f.world.getCollider(h);
          if (!col) continue;
          const r = segToCollider(B, tip, col);
          if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { h, info, col, r };
        }
        if (best && I.cover) {
          I.blocked = true; // gnsEnterBlock 2 (10/25 16:0x 시험): 가운데를 겨눈 칼이 앞을 가림 — 상처 없이 이 자리에서 멈춤 · 굳음 그대로
          I.uEnd = Math.max(I.ab, u - (1 - w) * (dt / I.T));
        } else if (best) {
          const prevW = Math.max(0, w - 1 / subs);
          const P0 = { B: I.prev.B.clone().lerp(cur.B, prevW), D: I.prev.D.clone().lerp(cur.D, prevW).normalize() };
          I.hit = best;
          I.res = instantWound(f, foe, [P0, { B, D }], { i: 1, best }, combat, I.J);
        }
      }
    }
  }
  I.prev = cur;
  if (u >= 1 || I.blocked) endIai(f, combat);
}

function endIai(f, combat) {
  const I = f.iai;
  setKinematic(f, false);
  if (f.iaiRopes) {
    // 뗀 밧줄을 다시 (있던 것만)
    if (f.iaiRopes.grip && f.armed && !f.gripCone) f.gripConeOn();
    if (f.iaiRopes.shoulder && !f.shoulderRopes) f.shoulderOn();
    f.iaiRopes = null;
  }
  const v = tv(f.bodies.chest.linvel(), new THREE.Vector3());
  for (const n of [...ARM_PARTS, ...(I.off ? OFF_PARTS : []), null]) {
    const b = n ? f.bodies[n] : f.sword;
    if (!b) continue;
    b.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  // 따라 베기 끝 자세를 경직 동안 붙잡는다 (앞으로 뻗은 채 굳음)
  const uE = I.uEnd ?? 1; // 막힌 휩쓸기는 막힌 자리에서 굳는다
  const K = { body: I.bodyAt ? I.bodyAt(uE) : I.body };
  const E = I.pose(I, uE);
  const th = f.skill.thrustPose;
  th.w = 1;
  th.hand[0] = E.H.x;
  th.hand[1] = E.H.y;
  th.hand[2] = E.H.z;
  th.dir[0] = E.D.x;
  th.dir[1] = E.D.y;
  th.dir[2] = E.D.z;
  th.pelvisYaw = K.body.pelvisYaw * D2R;
  th.chestYaw = K.body.chestYaw * D2R;
  th.pitch = K.body.pitch * D2R;
  th.drop = K.body.drop;
  f.iaiHoldT = I.hold;
  f.iaiHoldKind = I.kind;
  f.iaiFade = 0;
  // 10/12 08:2x 사장님 '공격 후 경직 자세에서 바로 왼손이 따라 잡으니까 한 손으로 팔을 쭉 벌려서 비기를 쓴 당위성이 사라져': 한 손 발도면 경직(붙잡기) 동안도
  //  오른팔 한 손으로 뻗은 끝 자세를 두고 빈손은 배 앞(iaiSayaHand)에 남긴다(잔심). 붙잡기가 풀리며(iaiFade) 칼이 가운데로 돌아온 뒤 빈손이 다시 쥔다 (holdIai)
  f.iaiOneHold = !!I.oneHand;
  f.instantGhost = Math.max(f.instantGhost ?? 0, Math.ceil(SECRET.instantNoCollide / (combat.dt || 1 / 120)));
  f.tipPrev = f.bladePoint(1, new THREE.Vector3());
  f.hitPointPrev = f.bladePoint(0.7, new THREE.Vector3());
  f.tipVel.set(0, 0, 0);
  f.hitPointVel.set(0, 0, 0);
  const res = I.res;
  f.instantResult = { ok: true, hit: !!res, energy: res?.energy ?? 0, part: I.hit?.info.part ?? null, zone: res?.zone ?? null, type: res?.type ?? null, step: I.slide, iai: I.kind, blocked: !!I.blocked };
  f.iai = null;
}

/** 경직 동안 끝 자세 붙잡기 → 끝나면 0.2 s 에 풀기 */
function holdIai(f, dt) {
  const th = f.skill.thrustPose;
  if (f.iaiHoldT > 0) {
    f.iaiHoldT -= dt;
    th.w = 1;
    if (f.iaiHoldT <= 0) f.iaiFade = 0.2;
    if (!f.alive || f.state !== 'stand') {
      f.iaiHoldT = 0;
      f.iaiFade = 0.01;
    }
    return;
  }
  f.iaiFade -= dt;
  th.w = Math.max(0, f.iaiFade / 0.2);
  if (f.iaiFade <= 0) {
    f.iaiFade = 0;
    th.w = 0;
    f.iaiOneHold = false; // 한 손 발도 잔심 끝: 칼이 가운데로 돌아왔다 → 빈손이 다시 쥔다 (fighter.js offHand)
  }
}

/** 발도 중이거나 끝 자세를 붙잡는 중인가 (대기 자세·다른 덧씌우기가 칸을 건드리지 않게) */
export function iaiBusy(f) {
  return !!f.iai || !!f.iaiReq || f.iaiHoldT > 0 || f.iaiFade > 0;
}

/** 발도 대기 자세 (AI 일본, 대기 IaiArm 이 찼을 때): 덧씌우기 칸에 웅크린 왼 허리 자세를 on 이면 0.35 s 에 켜고, 아니면 0.12 s 에 끈다 */
export function iaiReadyPose(f, on, dt) {
  if (iaiBusy(f)) {
    f.iaiReadyW = 0;
    return;
  }
  const w0 = f.iaiReadyW ?? 0;
  if (!on && w0 <= 0) return;
  // 대기에 들어가는 순간 앞발을 내딛어 발을 넓게 (GIF 첫 장면 — 10/10 04:2x)
  if (on && w0 <= 0 && f.gait?.active && SECRET.stance.iai.step > 0) f.gait.requestStep({ kind: 'lunge', fwd: SECRET.stance.iai.step, duration: 0.35 });
  const w = on ? Math.min(1, w0 + dt / 0.35) : Math.max(0, w0 - dt / 0.12);
  f.iaiReadyW = w;
  const R = SECRET.iaiReady;
  const th = f.skill.thrustPose;
  th.w = w;
  th.hand[0] = R.hand[0];
  th.hand[1] = R.hand[1];
  th.hand[2] = R.hand[2];
  const D = dirOf(R.yaw, R.el);
  th.dir[0] = D.x;
  th.dir[1] = D.y;
  th.dir[2] = D.z;
  th.pelvisYaw = R.body.pelvisYaw * D2R;
  th.chestYaw = R.body.chestYaw * D2R;
  th.pitch = R.body.pitch * D2R;
  th.drop = R.body.drop;
}

// ─────────────────────────────────────────────────────────────
//  이베리아 휩쓸기 (10/10 02:5x 사장님 '이베리아 비기도 새 동작을 크게 만들어야겠다. 뭐가 나가는지 전혀 알 수 없었다'):
//   발도와 같은 틀(스텝마다 팔·칼 자리 지정 · 쓸린 자리 판정 · 충돌 끔 · 잔상)로 휘돌려 사선 베기를 크게 —
//   몸이 옆으로 크게 한 걸음(SECRET.iberianSweepSide, 즐겨 도는 쪽 — 닿기에 모자라면 앞으로도) 미끄러지는 동안 칼이 머리 위로 큰 고리를 한 바퀴 돌고
//   그대로 반대(왼) 허리 쪽까지 사선으로 내려 벤다. 전체 SECRET.iberianSweepTime. 맞음·잔상은 사선 몫(SECRET.iberianSweepPath.cut 부터)만.
//   잔상 kind 'sweep' + side(사이드스텝 방향, 월드) → main.js 가 카메라를 그쪽으로 SECRET.camSwing ° 돌렸다 되돌림
// ─────────────────────────────────────────────────────────────

/** 이베리아 휩쓸기를 걸어 둔다. opt.side: +1 칼 든 쪽(오른) · −1 왼 (즐겨 도는 쪽) */
export function requestSweep(f, opt = {}) {
  f.iaiReq = { sweep: true, side: opt.side >= 0 ? 1 : -1 };
  f.instantResult = null;
}

/** 휩쓸기 길의 u(0~1) 자리 (몸 기준): 지금 손 → 오른 어깨 뒤로 멀리 감기(wind) → 가운데를 지나 왼쪽 끝까지 한 번 가로 (고리 없음 — 10/10 04:4x) */
function sweepPose(I, u) {
  const P = SECRET.iberianSweepPath;
  if (u < P.wind) {
    const v = u / P.wind;
    const k = v * v * (3 - 2 * v);
    const H = I.A.H.clone().lerp(new THREE.Vector3(...P.w0.hand), k);
    const q = new THREE.Quaternion().setFromUnitVectors(I.A.D, I.DW);
    return { H, D: I.A.D.clone().applyQuaternion(new THREE.Quaternion().slerp(q, k)).normalize() };
  }
  // 가로: 감은 자리 → 가운데 → 왼쪽 끝 (칼날 가로 각 165° → 10° → −100°, 한 호)
  const v = (u - P.wind) / (1 - P.wind);
  const [A, B, w] = v < 0.55 ? [P.w0, P.c1, v / 0.55] : [P.c1, P.c2, (v - 0.55) / 0.45];
  const H = new THREE.Vector3(...A.hand).lerp(new THREE.Vector3(...B.hand), w);
  return { H, D: dirOf(A.yaw + (B.yaw - A.yaw) * w, A.el + (B.el - A.el) * w) };
}

/** 휩쓸기 동안 몸 비틀기 (덧씌우기 칸 몸 값): 감기에서 오른쪽으로 감고(w0.body) → 베며 몸 전체를 왼쪽으로 돌린다(body) */
function sweepBody(u) {
  const P = SECRET.iberianSweepPath;
  const A = P.w0.body;
  const B = P.body;
  const k = u < P.wind ? 0 : Math.min(1, (u - P.wind) / (1 - P.wind));
  const t = u < P.wind ? u / P.wind : 1;
  const mix = (key) => (u < P.wind ? A[key] * t : A[key] + (B[key] - A[key]) * k);
  return { pelvisYaw: mix('pelvisYaw'), chestYaw: mix('chestYaw'), pitch: mix('pitch'), drop: mix('drop') };
}

/** 이베리아 휩쓸기가 막혔다 (내 칼이 상대 칼에 몸보다 먼저 닿음): 상대 가슴·골반에 나에게서 먼 쪽으로 충격량 SECRET.iberianShove (물리 — 넘어짐 보장 없음) */
function sweepShove(f, foe) {
  const c = f.bodies.chest.translation();
  const fc = foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  const J = SECRET.iberianShove;
  for (const [n, k] of [['chest', 0.6], ['pelvis', 0.4]]) {
    const b = foe.bodies[n];
    if (b) b.applyImpulse({ x: dx * J * k, y: 0, z: dz * J * k }, true);
  }
}

/** 휩쓸기 시작 (startIai 가 req.sweep 이면 부른다) */
function startSweep(f, combat, req) {
  const foe = f.foe;
  const M = f.swordArt.measure;
  const c = f.bodies.chest.translation();
  const fc = foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  dx /= d;
  dz /= d;
  // 옆(즐겨 도는 쪽)으로 비켜 딛으며 반걸음 뒤(SECRET.iberianSweepBack — 호 안쪽으로 붙은 상대와 틈을 벌림, 10/10 04:4x) [해석]: 옆 = 앞을 칼 든 쪽으로 90° (yaw 틀 z+)
  const rx = -dz * req.side; // 오른쪽(칼 든 쪽) = (−앞z, 앞x)
  const rz = dx * req.side;
  const fwd = -Math.min(SECRET.iberianSweepBack, Math.max(0, M.reach - d)); // 뒤로 — 내 간격 끝을 넘지 않게
  const side = SECRET.iberianSweepSide;
  const yaw = f.yaw.clone();
  const inv = yaw.clone().invert();
  const sw = tv(f.sword.translation(), new THREE.Vector3());
  const AH = sw.clone().sub(tv(c, new THREE.Vector3())).applyQuaternion(inv);
  const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  f.iaiRopes = { grip: !!f.gripCone, shoulder: !!f.shoulderRopes };
  ropes(f, false);
  f.iai = {
    kind: 'sweep', slideShare: SECRET.iberianSweepSlideShare, J: SECRET.iberianSweepJ, body: SECRET.iberianSweepPath.body, bodyAt: sweepBody, hold: SECRET.stiff.iberian ?? 0.3, pose: sweepPose,
    t: 0, T: SECRET.iberianSweepTime, ab: SECRET.iberianSweepPath.wind, A: { H: AH, D: AD }, DW: dirOf(SECRET.iberianSweepPath.w0.yaw, SECRET.iberianSweepPath.w0.el), yaw, block: true, blocked: false,
    slide: 1, dx: dx * fwd + rx * side, dz: dz * fwd + rz * side, sideW: [rx, 0, rz],
    off: !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), prev: null, hit: null, res: null, arc: null,
  };
  setKinematic(f, true);
  f.instantGhost = Math.ceil((f.iai.T + SECRET.instantNoCollide) / (combat.dt || 1 / 120)) + 1;
  const P0 = sweepPose(f.iai, 0);
  f.iai.prev = placeIai(f, P0.H, P0.D, true);
}

// ─────────────────────────────────────────────────────────────
//  비기 자세 (10/10 04:2x 사장님 '고노센은 기술은 좋은데 자세가 어정쩡 — 발도술처럼 다리를 많이 굽히고 숙여야. 이탈리아도 마찬가지, 런지 자세 봐봐'):
//   f.secretStance = { drop(골반 더 낮춤 m), pitch(몸통 앞 숙임 rad), rate(골반 높이 바꾸는 빠르기 m/s), offArm?(빈팔 어깨 목표 — 뒤로 뻗기) } 를
//   gait.js(골반 목표 높이 hNomT·빠르기)와 fighter.js applyPose(몸통 숙임 bend · 빈팔)가 읽는다. 무게 w 로 켜고(inTime) 끈다(outTime) — 없으면 null(오늘 그대로).
//   일본 'iai': 발도 대기(iaiReadyW) · 발도 · 뻗은 경직 동안 / 이탈리아 'lunge': Passata 찌르기 시작부터 f.lungeT 초.
//   무릎은 낮춘 골반과 딛은 발 사이 다리 IK(gait)가 굽힌다 — 앞발을 멀리 딛을수록 앞무릎이 깊고 뒷다리는 펴진다
// ─────────────────────────────────────────────────────────────
function stanceTick(f, dt) {
  const ST = SECRET.stance;
  let key = null;
  let want = 0;
  if ((f.iai && f.iai.kind === 'iai') || ((f.iaiHoldT > 0 || f.iaiFade > 0) && f.iaiHoldKind === 'iai')) {
    key = 'iai';
    want = 1;
  } else if ((f.iaiReadyW ?? 0) > 0) {
    key = 'iai';
    want = f.iaiReadyW;
  } else if (f.lungeT > 0) {
    key = 'lunge';
    want = 1;
    f.lungeT -= dt;
  }
  if (!f.alive || f.state !== 'stand') {
    key = null;
    want = 0;
  }
  const cur = (f._stance ??= { key: null, w: 0 });
  if (key && (cur.key === key || cur.w <= 0)) {
    cur.key = key;
    const S = ST[key];
    const tin = key === 'iai' && f.iai ? 0.06 : S.inTime; // 발도 순간은 곧장 낮게
    cur.w = cur.w < want ? Math.min(want, cur.w + dt / tin) : Math.max(want, cur.w - dt / S.outTime);
  } else if (cur.key) cur.w = Math.max(0, cur.w - dt / ST[cur.key].outTime);
  if (!cur.key || cur.w <= 0) {
    cur.w = 0;
    cur.key = null;
    if (f.secretStance) f.secretStance = null;
    return;
  }
  const S = ST[cur.key];
  const st = (f.secretStance ??= {});
  // 발도·뻗은 경직 동안은 덧씌우기 칸 몸(iaiPath.E.body — 낮춤·숙임)이 함께 얹히니 그만큼 뺀 값(S.draw)으로 — 합이 대기 자세 깊이 안팎 (10/10 캡처: 둘을 다 얹으면 골반 0.58 m 쪼그려 앉음·숙임 54°)
  const drawing = cur.key === 'iai' && S.draw && (f.iai?.kind === 'iai' || ((f.iaiHoldT > 0 || f.iaiFade > 0) && f.iaiHoldKind === 'iai'));
  st.drop = (drawing ? S.draw.drop : S.drop) * cur.w;
  st.pitch = (drawing ? S.draw.pitch : S.pitch) * D2R * cur.w;
  st.rate = S.rate;
  st.offArm = S.offArm != null ? 0.5 + (S.offArm - 0.5) * cur.w : undefined;
  st.reach = S.reach != null ? GAIT_REACH + (S.reach - GAIT_REACH) * cur.w : undefined;
}

/** 런지 자세를 켠다 (이탈리아 Passata 찌르기 시작 — AI startStrike·플레이어 secretStrikeStart) */
export function startLunge(f) {
  f.lungeT = SECRET.stance.lunge.time;
}

// ─────────────────────────────────────────────────────────────
//  이베리아 길목 지키기 한 칼의 덧씌우기 자세 (10/11 v6 2차 — 디렉터 '칼끝 선에서 실제로 닿게'): 둘러 베는 두 토막 동안 덧씌우기 칸(skill.thrustPose)에
//   손·칼날 방향·몸 돌림 목표를 준다 — 물리 서보 목표(스텝마다 자리 지정 아님). 수는 일본 발도 길 SECRET.iaiPath 의 가운데(M)·끝(E) 자리를 거울로 다시 씀(새 값 아님):
//   가운데 = 손 앞 0.5 · 위 0.1 · 칼날 수평(앞 0°, 높이 −3°) — 팔을 앞으로 뻗어 칼끝이 상대 몸통 높이로 지난다 ·
//   끝 = 손을 반대쪽 앞으로 다 뻗고 칼날 반대쪽 75° · 몸 돌림(칼 든 어깨가 앞).
//   1차(덧씌우기 없음 — 자세 지도의 패드 길만): 옆 자세에서 칼이 몸 뒤로 감겨 칼끝이 앞 1.3 m · 가슴 +0.8~1.5 m(상대 머리 위)에서 그쳐 48 판 맞힘 0.
//  감는 토막(gilmokWind — 플레이어가 옆 자세 밖에서 창을 받은 때)에는 덧씌우지 않는다 (10/11 v6 4차): 3차에 자세표 옆 자세를 덧씌웠더니 플레이어 칼이 2/2 헛쳤다 —
//   덧씌우기를 빼면 2/2 넓적다리에 닿는다(2차와 같음). 남은 낮음의 원인은 감음 토막의 떨어지는 힘(손을 미리 옆 자세에 두면 칼끝이 가슴 +0.1~0.3 m — 탐침)
//  seg: 'mid'(가운데 토막) | 'end'(끝 토막·따라 지나감·경직) | null(끔 — 0.12 s 에 걷음, iaiReadyPose 끄는 빠르기와 같음) · s: +1 오른쪽에서 탈류 · −1 왼쪽에서 레베스
// ─────────────────────────────────────────────────────────────
const _gh = new THREE.Vector3();
const _gt = new THREE.Vector3();
export function gilmokCutPose(f, seg, s, dt) {
  const th = f.skill.thrustPose;
  if (iaiBusy(f) || f.skill.tap || f.skill.pom) {
    f.gilCutW = 0;
    return;
  }
  const w0 = f.gilCutW ?? 0;
  if (!seg && w0 <= 0) return;
  const w = seg ? 1 : Math.max(0, w0 - dt / 0.12);
  f.gilCutW = w;
  th.w = w;
  if (!seg) return; // 걷는 동안은 마지막 목표 그대로
  const K = SECRET.iaiPath;
  const P = seg === 'mid' ? K.M : K.E;
  // 발도는 왼 허리 → 칼 든 쪽(+)으로 벤다. 길목 탈류(s +1)는 칼 든 쪽 → 반대쪽(−)이라 옆 자리·옆 각을 −s 로 뒤집는다
  th.hand[0] = P.hand[0];
  th.hand[1] = P.hand[1];
  th.hand[2] = -s * P.hand[2];
  // 높이 각 (10/11 v6 3차 — 디렉터 '칼끝이 가운데 선에서 상대 몸통 높이를 지나게'): 발도 길의 고정 각(el) 대신 그 순간의 칼자루 높이·칼 길이로 계산 —
  //  sin(el) = (상대 가슴 몸체 높이 − 내 칼자루 높이) / (칼자루 → 칼끝 길이). 기하에서 나오는 값(고르는 수 없음). 2차(고정 −3°): 칼끝이 츠바이핸더 가슴 −0.13~+0.35 ·
  //  북부 대공의 검 +0.53~0.65 m 로 뜨고, 플레이어는 넓적다리·정강이로 지났다. 상대가 없으면 발도 길 각 그대로
  let el = P.el;
  const foe = f.foe;
  if (foe?.bodies?.chest) {
    const hp = f.bladePoint(0, _gh);
    const tp = f.bladePoint(1, _gt);
    const L = hp.distanceTo(tp);
    // 겨누는 몸 자리 (사장님 결정 10/11 13:5x — SECRET.gilmokAim): 가슴 · 머리 가운데 · 머리 꼭대기(+ 머리 반지름). 처지는 만큼 위를 겨눔 (AI·플레이어 같은 함수)
    const A = SECRET.gilmokAim;
    const ty = A === 'chest' || !foe.bodies.head ? foe.bodies.chest.translation().y : foe.bodies.head.translation().y + (A === 'headTop' ? foe.headR ?? 0 : 0);
    if (L > 0) el = Math.asin(THREE.MathUtils.clamp((ty - hp.y) / L, -1, 1)) / D2R;
  }
  const D = dirOf(-s * P.yaw, el);
  th.dir[0] = D.x;
  th.dir[1] = D.y;
  th.dir[2] = D.z;
  const B = P.body ?? { pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 };
  th.pelvisYaw = s * B.pelvisYaw * D2R; // 끝: 탈류는 칼 든 어깨가 앞(−) — 발도 E 와 같은 부호, 레베스는 거울
  th.chestYaw = s * B.chestYaw * D2R;
  th.pitch = B.pitch * D2R;
  th.drop = B.drop;
}

/** 길목 한 칼의 토막 이름 → gilmokCutPose 의 seg · s (그 밖이면 seg null) */
export function gilmokSeg(name, stiff) {
  const m = /^gilmok(Talho|Revez)(End)?$/.exec(name ?? '');
  if (!m) return { seg: null, s: 1 };
  return { seg: m[2] || stiff ? 'end' : 'mid', s: m[1] === 'Talho' ? 1 : -1 };
}

// ─────────────────────────────────────────────────────────────
//  중국 빠른 연환 (10/12 사장님 01:1x '연격은 기술 자체의 시각적 효과도 잘 안 보여서 … 고노센 50% 정도의 빠르기와 잔상' · 01:2x '잔상도 고노센의 50%나 65%로' —
//   docs/strike/cn_combo_play_2026-10-12.md §5). 서보는 손 빠르기 handSpeed 1.5 에서 포화돼 더 빨라지지 않는다 → 발도와 같은 틀(**물리 원칙의 예외** — 사장님 10/9 23:5x
//   '모든 비기 모션·판정 어드밴티지'): 팔 사슬·칼을 스텝마다 길 위 자리에 놓는다(placeIai — 관절 기준점이 맞음, 칼 쪽 팔·칼 ↔ 상대 몸·칼 충돌 끔 instantGhost).
//   길 = 막기 연환 두 수의 패드 길 그대로(schools.js CHINESE_SECRET_PARRY do.combo — 앞 수 끝에서 곧장): 지금 칼 → 첫 수 준비 자세(from) → 길 점 → 둘째 수 from → 길 점.
//   패드 → 손 자리·칼날 방향 = 휘두를 때 서보가 쫓는 목표와 같은 식(fighter.js padPose). 빠르기 = 칼끝(칼자루 끝 + 칼날 방향 × 칼 길이) 평균이 같은 칼의 발도 베는 몫
//   (iaiPath B→M→E 길이 / iaiTime)의 SECRET.cnFastShare 몫이 되게 토막마다 시간 = 칼끝 길이 / 그 빠르기 (새 시간 값 없음).
//   맞음 = 발도처럼 쓸린 자리(스텝마다 칼날 선분 3 조각 · 길 점 토막만 — 준비 토막은 베는 길이 아님) · 수마다 한 번. 상처 에너지는 정하지 않는다 — 쓸린 그 점의 실제 빠르기로
//   기존 상처 함수(combat.analyze, 판정 배율 hitMul) [발도는 칼끝 40 m/s 라 고정 J 를 썼다 — 연환은 그 절반이라 물리 빠르기 그대로가 자연스럽다]. 몸보다 먼저 상대 칼에 닿으면
//   (이베리아 휩쓸기와 같은 거리) 그 수는 막힘 — 남은 길을 건너뛰고 다음 수로(밀어냄 없음). 걸음 = 수마다 반걸음(step.fwd) 몸 미끄러짐(발도와 같은 한도 — 맞닿기에서 멈추고
//   clinch 안 금지) + 다리 걸음 요청. 잔상 = 발도와 같은 f.instantArc(kind 'combo', share — sword_trail.js 가 밝기·섬광을 share 배로). 끝나면 끝 자세를 경직 동안 붙잡는다(발도와 같음).
// ─────────────────────────────────────────────────────────────
const COMBO_TURN = 0.35; // 손이 있는 쪽으로 몸을 트는 계수 (rad / 패드 m) — fighter.js BODY_TURN 과 같은 수 (이름만 붙인 재사용)

/** 빠른 연환을 걸어 둔다. opt.moves = 두 수 (schools.js 막기 연환 seq 꼴, step.fwd 는 m 로 푼 것) */
export function requestCombo(f, opt = {}) {
  f.iaiReq = { combo: true, moves: opt.moves ?? [], share: opt.share, hold: opt.hold, hitMul: opt.hitMul, effMul: opt.effMul, width: opt.width, tech: opt.tech, mord: opt.mord ?? null, arcCut: !!opt.arcCut, face: opt.face || null, min: opt.min ?? 0, maxT: opt.maxT ?? 0 }; // width: 잔상 굵기 몫 (격살 시험 — sword_trail.js) · mord: 죽음의 일격 운동학 길(10/22 밤 — mordschlag.js) · arcCut: 잔상은 베는 토막만 · face: 마주 보는 띠('path' 치는 끝 길 · 'line' 찌르는 줄) · min: 잔상 밝기 바닥 (10/23 비기 잔상 점검 — 사람 비기만, 아래 stepCombo · sword_trail.js)
  f.instantResult = null;
}

/** 칼끝 자리 (몸 틀) = 손 자리 + 칼날 방향 × (칼자루 + 칼날) · L 을 주면 그 거리 (죽음의 일격: 칼자루 끝까지 — 방향은 칼자루 쪽) */
function comboTip(f, H, D, out = new THREE.Vector3(), L = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength) {
  return out.copy(H).addScaledVector(D, L);
}

/** 토막 안 u 자리: 손 lerp · 칼날 slerp (iaiPose 와 같은 보간) · 패드 x (몸 돌림) · 손 돌리기 rad (길 덧칸이 있는 수만 — 없으면 0) */
function comboLerp(sg, u) {
  const H = sg.A.H.clone().lerp(sg.B.H, u);
  const q = new THREE.Quaternion().setFromUnitVectors(sg.A.D, sg.B.D);
  const D = sg.A.D.clone().applyQuaternion(new THREE.Quaternion().slerp(q, u)).normalize();
  const ta = sg.A.turn ?? 0;
  return { H, D, px: sg.A.px + (sg.B.px - sg.A.px) * u, turn: ta + ((sg.B.turn ?? 0) - ta) * u };
}

/** 길 덧칸 (제비 베기 되돌림 칼 — 10/25 · 곁눈 베기 덧칸과 같은 칸 [칼끝 들기 °, 손 뻗기 m, 손 돌리기 °] · fighter.js driveSword techPlan 과 같은 식): 손 앞으로 · 칼 겨눔 높이각 · 손 돌리기(placeIai) */
function comboPlanAdd(B, pl) {
  B.H.x += pl[1] ?? 0;
  const tilt = (pl[0] ?? 0) * D2R;
  const h = Math.hypot(B.D.x, B.D.z);
  if (tilt && h > 1e-3) {
    const el = Math.atan2(B.D.y, h) + tilt;
    const c = Math.cos(el);
    B.D.set((B.D.x / h) * c, Math.sin(el), (B.D.z / h) * c);
  }
  B.turn = (pl[2] ?? 0) * D2R;
}

/** 토막의 칼끝 길이 (8 조각) · reach 를 주면 손에서 그 거리 점의 길이 (죽음의 일격 — 칼자루 끝) */
function comboSegLen(f, sg, reach) {
  let L = 0;
  let prev = comboTip(f, sg.A.H, sg.A.D, new THREE.Vector3(), reach);
  for (let i = 1; i <= 8; i++) {
    const P = comboLerp(sg, i / 8);
    const t = comboTip(f, P.H, P.D, new THREE.Vector3(), reach);
    L += t.distanceTo(prev);
    prev = t;
  }
  return L;
}

/** 같은 칼의 발도 베는 몫 칼끝 빠르기 (m/s): iaiPath B → M → E 칼끝 길이 / iaiTime (대기 자세에서 곧장 가로 — 고노센 기본 시간) */
export function iaiTipSpeed(f) {
  let L = 0;
  let prev = null;
  for (let i = 0; i <= 24; i++) {
    const P = iaiPose({ ab: 0 }, i / 24);
    const t = comboTip(f, P.H, P.D);
    if (prev) L += t.distanceTo(prev);
    prev = t;
  }
  return L / SECRET.iaiTime;
}

/** 몸 돌림 (덧씌우기 칸 몸 값, °): 손이 있는 쪽으로 — 검술 층의 휘두를 때 몸 돌림과 같은 계수 (가슴 전부 · 골반 반) */
function comboBody(px) {
  const ch = (-px * COMBO_TURN) / D2R;
  return { pelvisYaw: ch * 0.5, chestYaw: ch, pitch: 0, drop: 0 };
}

/**
 * 런지 빛줄기의 처음 점 (사장님 10/25 14:0x 리솔루토 연출 — sword_trail.js 런지 빛줄기): 런지를 시작하는 스텝의 칼날 밑동(칼자루 쪽 끝 — bladePoint 0, 월드 [x, y, z]) · 읽기만.
 *  칼끝이 아니라 밑동: 런지 칼끝은 0.24 m 남짓만 나가(가슴 사이 1.58 m — 탐침 · 몸 미끄러짐 한도 0.6 m 를 다 써도 1 m 안) 뒤 카메라에서 점에 가깝다 → 칼이 지나간 찌르는 줄 전체(처음 밑동 → 가장 멀리 간 칼끝)를 빛줄기로
 */
function lungeFrom(f) {
  const t = f.bladePoint(0, new THREE.Vector3());
  return [t.x, t.y, t.z];
}

function startCombo(f, combat, req) {
  const yaw = f.yaw.clone();
  const inv = yaw.clone().invert();
  const c = f.bodies.chest.translation();
  const AH = tv(f.sword.translation(), new THREE.Vector3()).sub(tv(c, new THREE.Vector3())).applyQuaternion(inv);
  const AD = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  if (req.mord) {
    // 죽음의 일격 (10/22 밤 — 운동학 길): 손 = 손목(아래팔 앞끝 — 거꾸로 쥐면 칼 원점이 손이 아니다) · 방향 = 칼자루 쪽(칼 축 −y). 손목 · 칼 든 어깨 밧줄은 휩쓸기처럼 떼었다가 끝에 다시
    const fa = f.bodies.farmS;
    AH.set(0.13, 0, 0).applyQuaternion(tq(fa.rotation(), _qs)).add(tv(fa.translation(), _v3)).sub(tv(c, new THREE.Vector3())).applyQuaternion(inv);
    AD.negate();
    f.iaiRopes = { grip: !!f.gripCone, shoulder: !!f.shoulderRopes };
    ropes(f, false);
  }
  const share = req.share ?? SECRET.cnFastShare; // 빠르기 · 잔상 몫 (연환 cnFastShare · 진 · 츠바메가에시 되돌림 칼 secretBlade.kin — 10/21)
  const v = Math.max(1e-3, share * iaiTipSpeed(f));
  if (!req.moves.length) {
    f.instantResult = { ok: false, hit: false };
    return;
  }
  f.iai = {
    kind: 'combo', moves: req.moves, segs: [], si: 0, ts: 0, t: 0, v, yaw, mi: -1, moveName: null, cutting: false, cur: { H: AH, D: AD, px: f.handOffset.x }, last: null,
    body: comboBody(f.handOffset.x), bodyAt: null, hold: req.hold ?? SECRET.stiff[f.swordArt?.tradition] ?? 0.3, hitMul: req.hitMul ?? SECRET.hitMul, effMul: req.effMul ?? null, tech: req.tech ?? null,
    off: !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), prev: null, hits: 0, E: 0, Emax: 0, blocked: 0, part: null, zone: null, type: null,
    arc: { id: (f.instantArc?.id ?? 0) + 1, kind: 'combo', share, pts: [], ...(req.width > 0 && req.width < 1 ? { width: req.width } : {}), ...(req.face ? { face: req.face } : {}), ...(req.min > 0 ? { min: req.min } : {}), ...(req.moves.some((m) => m.lunge) ? { lunge: lungeFrom(f) } : {}) }, slide: null, mord: req.mord ?? null, arcCut: !!req.arcCut,
    maxT: req.maxT ?? 0, // 끌고 가는 시간 상한 (s — 제비 베기 되돌림 칼 requestArtSnap · 0 = 없음, 길 끝까지)
  };
  if (!req.arcCut) f.instantArc = f.iai.arc; // 베는 토막만(arcCut)이면 첫 베는 점에서 건다 (stepCombo — 섬광 · 남는 시간이 베는 순간부터)
  f.artTech = req.tech ?? null; // 이 끌고 가는 칼이 어떤 기술인가 (unique_assist.js strokeTechOf — 진 · 츠바메가에시 피해 × 3)
  setKinematic(f, true);
  f.instantGhost = Math.ceil(SECRET.instantNoCollide / (combat.dt || 1 / 120)) + 1; // 수를 짤 때마다·스텝마다 다시 채운다 (stepCombo)
  f.iai.prev = placeIai(f, AH, AD, true);
  comboNext(f, f.iai);
}

/** 다음 수로: 반걸음·이름 → 길을 지금 자리에서 짠다 (cnPath 면 그때 계산, 아니면 패드 길). 수가 없으면 false */
function comboNext(f, I) {
  if (I.mi + 1 >= I.moves.length) return false;
  comboMoveStart(f, I, I.mi + 1);
  const m = I.moves[I.mi];
  const dyn = !!m.dyn && (!!SECRET.cnPath || !!m.lunge); // 안다레 리솔루토 런지(10/24 — m.lunge)는 연환 길 스위치(cnPath)와 따로 늘 그때 계산 찌름
  I.segs = (I.mord ? comboPlanMord(f, I, m, I.cur) : dyn ? comboPlanDyn(f, I, m, I.cur) : comboPlanPad(f, I, m, I.cur)).filter((sg) => sg.T > 0);
  I.si = 0;
  I.ts = I.t;
  I.segT0 = I.t; // 이 수 토막들이 시작한 때 (런지 쓸린 자리 — lungeSweep)
  let span = I.segs.reduce((a, sg) => a + sg.T, 0);
  if (I.slide && I.slide.slide > 0 && dyn && span > 0) {
    // 그때 계산 길 (10/12 03:0x): 길은 미끄러진 뒤의 상대 자리로 짜므로 몸 틀 칼끝 길이 짧아진다 — 칼끝이 땅에 대해 지나는 길 = 몸 틀 길 + 반걸음.
    //  그만큼 시간을 늘려 칼끝 빠르기를 같은 값(I.v)에 두고, 반걸음은 그 수 시간 내내 미끄러진다. (안 하면 찌름 길이 0.02 s 로 줄어 몸이 12 m/s 로 미끄러지며 그 빠르기가
    //  찌름에 실려 48 판 찌름 상처가 566~811 J 로 튀었다)
    const L = span * I.v;
    const k = (L + I.slide.slide) / L;
    for (const sg of I.segs) sg.T *= k;
    span *= k;
    I.slide.span = span;
  } else if (I.slide && I.slide.slide < 0) I.slide.span = Math.max(1e-3, span); // 물러남(10/12 3 연격 마지막 수): 그 수 시간 내내 뒤로 — 벰은 옆으로 가로질러 칼끝 길은 그대로 둔다
  else if (I.slide) I.slide.span = Math.max(1e-3, span * SECRET.iaiSlideShare); // 패드 길: 그 수 시간의 발도와 같은 몫 안에 (10/12 01:1x 그대로)
  return true;
}

/** 10/12 01:1x 패드 길: 지금 자리 → 준비 자세(from, 준비 토막 — 맞힘 없음) → 길 점 */
function comboPlanPad(f, I, m, A) {
  const segs = [];
  let cur = A;
  // 패드 → 손 자리 · 칼날 (dy: 몸통 띠 겨눔이 패드 높이를 옮긴 몫 — 자세 지도가 손 · 칼끝을 함께 정함)
  const build = (dy = 0) =>
    [m.from, ...m.path].map((p0, k) => {
      const p = dy ? [p0[0], p0[1] + dy] : p0;
      const B = { H: new THREE.Vector3(), D: new THREE.Vector3(), px: p[0], pad: p };
      f.padPose(p[0], p[1], B.H, B.D);
      if (m.plan?.[k]) comboPlanAdd(B, m.plan[k]); // 길 덧칸 ([from, ...path] 점마다 — 제비 베기 되돌림 칼만)
      return B;
    });
  const poses = m.band ? comboBandShift(f, I, build) : build(); // 몸통 띠 겨눔 (제비 베기 되돌림 칼 — 10/25 23:1x)
  poses.forEach((B, k) => {
    const sg = { cut: k > 0, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  });
  return segs;
}

const BAND_LEG = new Set(['thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB']);
/** 길 poses(몸 틀 — [from, ...path])의 베는 토막을 따라 칼날이 상대 몸(칼 · 떨어진 조각 빼고)에 처음 닿는 곳 { part, y(월드 높이) } · 없으면 null */
function bandFirst(f, I, poses) {
  const foe = f.foe;
  const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const HL = f.weaponCfg.hiltLength;
  const BL = f.weaponCfg.bladeLength;
  for (let k = 1; k < poses.length; k++) {
    for (let i = 1; i <= 12; i++) {
      const Q = comboLerp({ A: poses[k - 1], B: poses[k] }, i / 12);
      const Dw = Q.D.applyQuaternion(I.yaw).normalize();
      const a = Q.H.applyQuaternion(I.yaw).add(c).addScaledVector(Dw, HL);
      const b = a.clone().addScaledVector(Dw, BL);
      let best = null;
      for (const [h, info] of f.colliderInfo) {
        if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
        const col = f.world.getCollider(h);
        if (!col) continue;
        const r = segToCollider(a, b, col);
        if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { r, info, col };
      }
      if (best) {
        const p = tv(best.col.translation(), new THREE.Vector3());
        return { part: best.info.part, y: segPointT(a, b, p).t * (b.y - a.y) + a.y };
      }
    }
  }
  return null;
}
/**
 * 몸통 띠 겨눔 (사장님 10/25 23:1x '제비베기는 위팔·가슴을 노리기보다 자연스럽게 몸통 전체(다리 위 골반부터 목 아래 가슴까지)를 노리게' — config UNIQUE_ASSIST.tsuBand):
 *  올려 긋는 길(꺾은 자리 = 내려간 칼이 멈춘 자리부터)이 상대 몸에 처음 닿을 곳을 지금 상대 자세로 재고 — 몸통 띠(골반 · 배 · 가슴 · 앞을 막은 팔) 안이면 그대로,
 *  다리면 위로 · 목 · 머리면 아래로 가장 적게(패드 높이 0.025 씩 0.4 까지 — 띠 끝: 다리 위 = 골반 · 목 아래 = 가슴 몸체 가운데 0.11 m 위 combat.js zoneOf 목 경계) 길 점 모두의 패드 높이를 옮긴다
 *  (죽음의 일격 pull · 격살 겨눔처럼 길 점 모두를 옮김 — 손 자리만 옮기면 칼끝이 손에 대해 사람 손목 밖으로 꺾여 손목 교정이 켜졌다 꺼졌다 칼 줄이 스텝마다 튐: 자세 지도가 손 · 칼끝을 함께 정하게 패드로).
 *  닿는 곳이 없으면(멀리) 그대로. build(dy) = 그 높이의 몸 틀 길 · 옮긴 패드 높이 I.bandDy · 옮기기 전 처음 닿을 곳 I.bandFrom (재기)
 */
function comboBandShift(f, I, build) {
  const poses = build(0);
  if (!f.foe?.bodies?.chest) return poses;
  const neckY = f.foe.bodies.chest.translation().y + 0.11;
  const bad = (h) => (h ? (BAND_LEG.has(h.part) ? 1 : h.part === 'head' || (h.part === 'chest' && h.y > neckY) ? -1 : 0) : 0);
  const h0 = bandFirst(f, I, poses);
  const s = bad(h0);
  I.bandDy = 0;
  I.bandFrom = h0?.part ?? null;
  if (!s) return poses;
  for (let k = 1; k <= 16; k++) {
    const P = build(s * 0.025 * k);
    const h = bandFirst(f, I, P);
    if (h && !bad(h)) {
      I.bandDy = s * 0.025 * k;
      return P;
    }
  }
  return poses;
}

/**
 * 죽음의 일격 운동학 길 (10/22 밤 감독 — SECRET.mord.kin · 기본 끔): 지금 자리 → 시작 자세(준비 — 맞힘 없음) → 기술 길 점(맞힘) → 시작 자세(다시 세우기 — 맞힘 없음).
 *  패드 → 손 자리 · 방향은 서보 길과 같은 padPose — 방향은 칼자루 쪽(겨눔 뒤집기와 같음). 시간 = 칼자루 끝(I.mord.Lp) 길이 / I.v.
 *  I.mord.pull (SECRET.mord.aim 'pull'): 베는 길 위 칼자루 가운데 점(손에서 (Lc + Lp)/2)이 상대 머리 가운데에 가장 가까운 자리를 찾아, 시작 자세 · 길 점의 손 자리를
 *   그 차이만큼 옮긴다 — 칼자루 가운데가 머리 가운데를 지난다 (격살 겨눔 comboPlanAim 과 같은 꼴 · 새 수 없음 · 길을 짜는 그때의 머리 자리). 다시 세우기는 옮기기 전 시작 자세로
 */
function comboPlanMord(f, I, m, A) {
  const M = I.mord;
  const pose = (p) => {
    const B = { H: new THREE.Vector3(), D: new THREE.Vector3(), px: p[0], pad: p };
    f.padPose(p[0], p[1], B.H, B.D);
    return B;
  };
  const pts = [m.from, ...m.path].map(pose);
  const home = pose(m.from); // 다시 세우기 끝 = 옮기기 전 시작 자세 (굳음 붙잡기 · 원래 쥠으로 돌아가는 자리)
  if (M.pull && f.foe?.bodies.head) {
    const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
    const P = tv(f.foe.bodies.head.translation(), new THREE.Vector3()).sub(c).applyQuaternion(I.yaw.clone().invert());
    const r = (M.Lc + M.Lp) / 2;
    let best = null;
    for (let k = 0; k + 1 < pts.length; k++) {
      for (let i = 0; i <= 8; i++) {
        const Q = comboLerp({ A: pts[k], B: pts[k + 1] }, i / 8);
        const C = Q.H.clone().addScaledVector(Q.D, r);
        const d = C.distanceTo(P);
        if (!best || d < best.d) best = { d, C };
      }
    }
    if (best) {
      const delta = P.clone().sub(best.C);
      for (const B of pts) B.H.add(delta);
      M.pullD = delta.length(); // 재기 (옮긴 거리 m)
    }
  }
  const segs = [];
  let cur = A;
  const push = (B, cut) => {
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg, M.Lp) / I.v;
    segs.push(sg);
    cur = B;
  };
  push(pts[0], false);
  for (let k = 1; k < pts.length; k++) push(pts[k], true);
  push({ ...home, back: true }, false);
  return segs;
}

/** 죽음의 일격이 막혔을 때 (상대 칼이 칼자루 길에 먼저): 남은 베는 길을 건너뛰고 지금 자리에서 시작 자세로 곧장 (다시 세우기 — 맞힘 없음) */
function comboMordBack(f, I) {
  const last = I.segs[I.segs.length - 1];
  const sg = { cut: false, A: I.cur, B: last.B };
  sg.T = comboSegLen(f, sg, I.mord.Lp) / I.v;
  I.segs = [sg];
  I.si = 0;
  I.ts = I.t;
}

/** 몸 틀(발도 몸 틀 — 시작 yaw, 가슴 원점)의 칼 어깨 자리 (지금 가슴 기울기·돌림을 넣음) */
function comboShoulder(f, yaw) {
  const chest = f.bodies.chest;
  return new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(tq(chest.rotation(), new THREE.Quaternion())).applyQuaternion(yaw.clone().invert());
}

/** 칼 팔이 닿는 거리 — fighter.armIK 와 같은 끝 (비기 동안 SECRET.secretReach 면 위팔 + 아래팔, 아니면 평소 여유) · 10/24 모르트슐라크 AI 머리 닿음(mordschlag.js mordHeadReach)도 */
export function comboArmLen() {
  return ARM.upper + ARM.fore - (SECRET.secretReach ? 0 : ARM.slack);
}

/** 상대 몸통 선(가슴 → 골반 몸체 가운데) 두 끝을 몸 틀로 — 이 수의 반걸음 미끄러짐만큼 당겨 둔다(미끄러진 뒤의 자리) */
function comboTorso(f, I) {
  const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const inv = I.yaw.clone().invert();
  const sl = I.slide ? new THREE.Vector3(I.slide.dx * I.slide.slide, 0, I.slide.dz * I.slide.slide) : new THREE.Vector3();
  const at = (b) => tv(b.translation(), new THREE.Vector3()).sub(c).sub(sl).applyQuaternion(inv);
  return { a: at(f.foe.bodies.chest), b: at(f.foe.bodies.pelvis) };
}

/** 몸 틀 방향 (가로 각 ψ · 높이 각 ε, rad) */
function comboDir(psi, eps, out = new THREE.Vector3()) {
  return out.set(Math.cos(eps) * Math.cos(psi), Math.sin(eps), Math.cos(eps) * Math.sin(psi));
}

/**
 * 연환 길 그때 계산 (10/12 사장님 03:0x '막았다 칼이 떨어진 바로 그 순간에 상대 몸통과 가장 가까운 경로로 찌르고 … 그다음 베기는 찌른 곳에서 크게 호를 그리며(팔을 쭉 뻗어서)
 *  내 쪽으로 검을 회수' — docs/strike/cn_combo_play_2026-10-12.md §11):
 *  thrust — 지금 칼끝에서 상대 몸통 선(가슴~골반)의 가장 가까운 점으로 곧게: 손은 어깨 → 그 점 쪽으로 팔 길이까지(닿으면 그만큼만), 칼끝이 그 점까지(몸통 가운데 — 겉을 뚫음).
 *   칼끝을 곧은 줄로 옮기며 칼날은 손 → 칼끝 줄 (4 토막) · 모두 맞힘 토막. back 이면(마지막 수) 온 길로 뽑아 거둠 (맞힘 없음).
 *  draw — 팔을 쭉 뻗은 큰 호: 가로 각 = 상대 몸통 가운데 쪽 + side × yaw[0 → 1] · 높이 각 = 그 쪽 + el[0 → 1] (°, 6 토막). 손은 어깨에서 팔 길이(팔 방향 = 칼 방향의 반만 돎),
 *   마지막 ⅓ 은 손을 팔 길이의 0.75 까지 내 쪽으로 당기며 벤다(掣 — 당김). from 'stab' = 찌른 끝에서 곧장(이음 토막도 맞힘) · 'prep' = 호 첫 자리로 옮기는 이음 토막은 맞힘 없음.
 *   끝 = 호 끝(손을 당긴 자리 — 지킴 자세로 더 거두지 않음, 아래 까닭). 호의 각은 schools.js 에 [추정].
 */
function comboPlanDyn(f, I, m, A) {
  const D = m.dyn;
  if (D.kind === 'aim') return comboPlanAim(f, I, m, A, D); // 격살 (10/22): 그 순간 상대 몸의 겨눌 곳으로
  const S = comboShoulder(f, I.yaw);
  const Lf = comboArmLen();
  const Lb = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  const T = comboTorso(f, I);
  const segs = [];
  let cur = A;
  const push = (H, Dv, cut, pad = null) => {
    const B = { H, D: Dv, px: H.z - 0.1, pad }; // px: 날것 매핑 z = 0.1 + 패드 x 를 거꾸로 (몸 돌림)
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  if (D.kind === 'thrust') {
    const T0 = comboTip(f, A.H, A.D);
    const ab = T.b.clone().sub(T.a);
    const P = T.a.clone().addScaledVector(ab, clamp(T0.clone().sub(T.a).dot(ab) / Math.max(1e-6, ab.lengthSq()), 0, 1)); // 가장 가까운 점
    const dir = P.clone().sub(S);
    const dist = dir.length();
    dir.normalize();
    const H1 = S.clone().addScaledVector(dir, clamp(dist - Lb, 0.15, Lf));
    const E = H1.clone().addScaledVector(dir, Lb);
    for (let k = 1; k <= 4; k++) {
      const H = A.H.clone().lerp(H1, k / 4);
      const t = T0.clone().lerp(E, k / 4);
      const Dv = t.sub(H);
      push(H, Dv.lengthSq() > 1e-6 ? Dv.normalize() : dir.clone(), true);
    }
    if (D.back) push(A.H.clone(), A.D.clone(), false, comboPad(A.H)); // 마지막 수가 찌름이면 온 길로 뽑아 거둔다 (맞힘 없음 — 칼이 몸통 가운데에 꽂힌 채 경직 붙잡기에 들지 않게)
    return segs;
  }
  // draw — 큰 호
  const mid = T.a.clone().add(T.b).multiplyScalar(0.5);
  const Dc = mid.sub(S).normalize();
  const psi0 = Math.atan2(Dc.z, Dc.x);
  const eps0 = Math.asin(clamp(Dc.y, -1, 1));
  const N = 6;
  const pull = D.pull !== false; // 10/12 3 연격: pull false = 손을 당기지 않고 뻗은 채 끝냄 (다음 벰이 그 자리에서 곧장 이어짐)
  if (D.from === 'roll') {
    // 10/12 3 연격 滾手 (검결가 「滾手連環」): 앞 수 끝(찌른 칼끝은 몸통 안)에서 손목을 굴려 칼끝을 들며 호 첫 자리 바깥으로 — 맞힘 없음.
    //  (전 두 수의 벰은 찌른 칼끝에서 곧장 맞힘 토막으로 시작해 몸 안에서 첫 맞닿음이 잡혀 16 J 에 그쳤다 — 이제 바깥에서 들어와 몸을 가로지른다)
    const pa = Math.atan2(A.D.z, A.D.x);
    const ea = Math.asin(clamp(A.D.y, -1, 1));
    const ps = psi0 + D.side * D.yaw[0] * D2R;
    const es = eps0 + D.el[0] * D2R;
    const pm = 0.5 * (pa + ps);
    const em = Math.max(ea, es) + (D.roll ?? 0) * D2R;
    push(S.clone().addScaledVector(comboDir(psi0 + 0.5 * (pm - psi0), eps0 + 0.5 * (em - eps0)), Lf), comboDir(pm, em), false);
  }
  for (let j = 0; j <= N; j++) {
    const w = j / N;
    const psi = psi0 + D.side * (D.yaw[0] + (D.yaw[1] - D.yaw[0]) * w) * D2R;
    const eps = eps0 + (D.el[0] + (D.el[1] - D.el[0]) * w) * D2R;
    const r = Lf * (!pull || w <= 2 / 3 ? 1 : 1 - 0.25 * ((w - 2 / 3) / (1 / 3)));
    const H = S.clone().addScaledVector(comboDir(psi0 + 0.5 * (psi - psi0), eps0 + 0.5 * (eps - eps0)), r);
    push(H, comboDir(psi, eps), j > 0 || D.from === 'stab', j === N ? comboPad(H) : null);
  }
  return segs; // 끝 = 호 끝(손을 당긴 자리, 칼은 상대 몸 옆 밖). 지킴 자세(긴 자세)로 더 거두면 칼끝이 상대를 겨눠 가까운 거리에서 몸통에 꽂힌 채 붙잡혔다(48 판 상처 최대 811 J)
}

/**
 * 격살 겨눌 곳 (10/22 — schools.js CHINESE_SECRET_GYEOKSAL dyn.target): 몸 틀(시작 yaw · 가슴 원점 · 이 수의 반걸음만큼 당김 — comboTorso 와 같음)의 점 { P, part }.
 *  head = 머리 가운데에서 목 쪽으로 (가슴 → 머리 사이 0.8 — 목 점 0.6(lethalPath)과 머리 사이 · 「上殺」 머리 · 목) ·
 *  arm = 칼 든 팔꿈치(아래팔 관절) — 절단은 관절 곁 0.11 m 안 베기만(COMBAT.limbSeverRadius) · 「削殺兩手」 ·
 *  leg = 나에게 가까운 다리의 무릎(정강이 관절) · 「下殺」 · lung = 가슴 몸체 가운데 0.05 m 위(허파 — 0.11 m 위부터는 목) · 「刺」. 자리 [추정]
 */
function comboAimPoint(f, I, target) {
  const foe = f.foe;
  const B = foe.bodies;
  const c = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const inv = I.yaw.clone().invert();
  const sl = I.slide ? new THREE.Vector3(I.slide.dx * I.slide.slide, 0, I.slide.dz * I.slide.slide) : new THREE.Vector3();
  const at = (w) => w.clone().sub(c).sub(sl).applyQuaternion(inv);
  const W = (b) => tv(b.translation(), new THREE.Vector3());
  const jointW = (child, own) => {
    const J = foe.jointByName?.[child]?.joint;
    const body = own ? B[child] : B[{ farmS: 'uarmS', farmO: 'uarmO', shinF: 'thighF', shinB: 'thighB' }[child]];
    if (!J || !body) return null;
    const a = own ? J.anchor2() : J.anchor1();
    return new THREE.Vector3(a.x, a.y, a.z).applyQuaternion(tq(body.rotation(), new THREE.Quaternion())).add(W(body));
  };
  if (target === 'head' && B.head) return { P: at(W(B.chest).lerp(W(B.head), 0.8)), part: 'head' };
  if (target === 'arm' && B.farmS) {
    const e = jointW('farmS', false) ?? W(B.farmS); // 팔꿈치 — 절단은 관절 곁 0.11 m 안(COMBAT.limbSeverRadius): 아래팔 가운데를 겨누면 관절에서 0.15 ~ 0.17 m 라 잘리지 않았다(탐침)
    return { P: at(e), part: 'arm' };
  }
  if (target === 'leg') {
    let best = null;
    for (const k of ['shinF', 'shinB']) {
      if (foe.detachedParts?.has(k)) continue;
      const q = jointW(k, false);
      if (q && (!best || Math.hypot(q.x - c.x, q.z - c.z) < Math.hypot(best.x - c.x, best.z - c.z))) best = q;
    }
    if (best) return { P: at(best), part: 'leg' }; // 무릎 — 넓적다리 가운데와 무릎 사이를 겨누면 관절에서 0.18 m 라 잘리지 않았다(탐침)
  }
  const up = new THREE.Vector3(0, 0.05, 0); // 가슴 몸체 가운데에서 0.05 m 위 — 허파 (가슴 몸체 0.11 m 위부터는 목 — combat.js zoneOf · [추정])
  return { P: at(W(B.chest)).add(up), part: 'lung' }; // lung · 또는 겨눌 곳이 없어짐(이미 잘림) — 가슴
}

/**
 * 격살 한 칼의 길 (10/22): 겨눌 곳 P 를 지나도록 짠다.
 *  thrust — 어깨 → P 줄 위로 칼을 끌어 겨눈 뒤(맞힘 없음) 그 줄을 따라 곧게 찌름(손은 팔 길이까지 · 칼끝이 P 까지 · 4 토막 맞힘) + back(겨눈 자리로 뽑아 거둠, 맞힘 없음)
 *  벰 — 연환 'draw' 와 같은 큰 호(가로 각 side × yaw · 높이 각 el, 6 토막 · 마지막 ⅓ 은 손을 당겨 벰)인데 가운데 줄이 상대 몸통이 아니라 P 이고,
 *   손 거리 r 은 칼날 dyn.at(기본 0.6) 자리가 P 에 오게(칼자루 + 칼날 × at 을 뺀 거리 — [0.15, 팔 길이] 로 자름 · 비율 [추정]). from 'prep' = 호 첫 자리로 옮기는 이음 토막은 맞힘 없음.
 */
function comboPlanAim(f, I, m, A, D) {
  const S = comboShoulder(f, I.yaw);
  const Lf = comboArmLen();
  const HL = f.weaponCfg.hiltLength;
  const BL = f.weaponCfg.bladeLength;
  const { P, part } = comboAimPoint(f, I, D.target);
  I.aim = part;
  const segs = [];
  let cur = A;
  const push = (H, Dv, cut, pad = null) => {
    const B = { H, D: Dv, px: H.z - 0.1, pad };
    const sg = { cut, A: cur, B };
    sg.T = comboSegLen(f, sg) / I.v;
    segs.push(sg);
    cur = B;
  };
  const dc = P.clone().sub(S);
  const dist = dc.length();
  dc.normalize();
  if (D.thrust && SECRET.thrustArm) {
    // 10/24 15:5x 팔을 뻗은 찌름 (SECRET.thrustArm 1 — 사장님 '주먹 아래쪽으로 칼날이 향하도록 거꾸로 쥐고 있는 거 같은데?' · docs/strike/wrist_audit_2026-10-24.md):
    //  손을 어깨 → P 줄 위 팔 길이(Lf — 팔꿈치 곧게)에 두고 칼을 그 줄 = 곧게 편 아래팔의 연장으로 (카포 페로 · 파브리스 런지 도판: 맞히는 순간 칼 팔이 어깨 높이로 다 펴지고 팔과 칼이 한 줄).
    //  옛 길(아래 — `?thrustArm=0`)은 칼끝이 꼭 P 에 닿게 손을 어깨에서 dist − 칼 길이(맞닿기 거리에서 0.1 ~ 0.5 m) · 뽑아 붙잡는 자리는 다시 D.draw 만큼 어깨 쪽(0.1 ~ 0.2 m)에
    //  두고 칼은 같은 어깨 → P 줄로 눕혔다 — 팔꿈치가 굽은 채 칼이 어깨 → 손 줄을 따르면 칼은 늘 아래팔의 새끼 쪽으로, 굽은 팔 세모의 손 쪽 각만큼(팔 길이 18 ~ 37 % 면 75 ~ 85°) 꺾인다 = 거꾸로 쥔 꼴.
    //  찌름 = 손이 팔 길이 − D.draw 에서 팔 길이까지 그 줄을 따라 곧게 (칼끝 길이 D.draw 그대로 · 4 토막 맞힘) — 칼끝은 P 를 팔 길이 + 칼 길이 − dist 만큼 지난다(맞닿기 거리에서 0 ~ 0.15 m).
    //  back 이어도 뽑지 않고 다 뻗은 자리를 굳음 동안 붙잡는다(런지 · 맞힌 뒤 팔을 뻗은 채) — 뽑던 토막 자리에 같은 시간(D.draw ÷ 빠르기 — 옛 뽑음과 같은 칼끝 길이)만큼
    //  뻗은 채 머무는 토막(맞힘 없음)을 두고 그 손의 패드(굳음 뒤 손 목표)를 단다: 길 전체 시간이 옛 길과 같아야 몸 미끄러짐을 그 시간에 나눠 싣는 셈(comboNext)이
    //  찌르는 토막 칼끝 빠르기(고노센 × risolutoShare)를 옛 길과 같게 둔다 (머무는 토막을 빼면 간격을 아는 운전 30 판 칼끝 몫 p50 0.97 → 0.92). 새 수 없음
    const H1 = S.clone().addScaledVector(dc, Lf);
    const H0 = S.clone().addScaledVector(dc, Math.max(0.1, Lf - (D.draw ?? 0.35)));
    push(H0, dc.clone(), false);
    for (let k = 1; k <= 4; k++) push(H0.clone().lerp(H1, k / 4), dc.clone(), true);
    if (D.back) {
      push(H1.clone(), dc.clone(), false, comboPad(H1));
      segs[segs.length - 1].T = (D.draw ?? 0.35) / I.v; // 같은 자리 토막은 칼끝 길이 0 — 옛 뽑음 토막의 시간
    }
    I.overshoot = Lf + HL + BL - dist; // 재기 (판정에는 안 씀): 칼끝이 겨눈 곳을 지난 길이 (m)
    return segs;
  }
  if (D.thrust) {
    // 겨눔 (맞힘 없음): 칼을 어깨 → P 줄 위에 눕혀 칼끝이 P 앞 D.draw(0.35 m) 에 오게 끌어 둔다 → 찌름: 그 줄을 따라 곧게 (칼끝이 P 까지 — 몸 안, 겉을 뚫음 · 4 토막 맞힘).
    //  (지금 칼끝에서 곧장 찌르면 막은 자리에서 칼날이 상대 팔을 먼저 가로질러 찌르기가 아닌 벰으로 닿았다 — 탐침)
    const H1 = S.clone().addScaledVector(dc, clamp(dist - HL - BL, 0.15, Lf));
    const H0 = S.clone().addScaledVector(dc, clamp(dist - HL - BL - (D.draw ?? 0.35), 0.1, Lf));
    push(H0, dc.clone(), false);
    for (let k = 1; k <= 4; k++) push(H0.clone().lerp(H1, k / 4), dc.clone(), true);
    if (D.back) push(H0.clone(), dc.clone(), false, comboPad(H0));
    return segs;
  }
  const psi0 = Math.atan2(dc.z, dc.x);
  const eps0 = Math.asin(clamp(dc.y, -1, 1));
  const r0 = clamp(dist - HL - BL * (D.at ?? 0.6), 0.15, Lf); // 칼날 D.at 자리가 겨눈 곳에 오게 (넘어선 칼날이 뒤의 몸을 먼저 건드리지 않게 — 끝 쪽)
  const N = 6;
  for (let j = 0; j <= N; j++) {
    const w = j / N;
    const psi = psi0 + D.side * (D.yaw[0] + (D.yaw[1] - D.yaw[0]) * w) * D2R;
    const eps = eps0 + (D.el[0] + (D.el[1] - D.el[0]) * w) * D2R;
    const r = r0 * (w <= 2 / 3 ? 1 : 1 - 0.25 * ((w - 2 / 3) / (1 / 3)));
    const H = S.clone().addScaledVector(comboDir(psi0 + 0.5 * (psi - psi0), eps0 + 0.5 * (eps - eps0)), r);
    push(H, comboDir(psi, eps), j > 0 || D.from === 'stab', j === N ? comboPad(H) : null);
  }
  return segs;
}

/** 몸 틀 손 자리 → 그 손을 부르는 패드 (날것 매핑 z = 0.1 + x · y = 0.1 + y 를 거꾸로, 패드 안으로) — 연환이 끝난 뒤 손 목표를 그 자리에 둔다 (endCombo snapAim) */
function comboPad(H) {
  return [clamp(H.z - 0.1, -0.6, 0.6), clamp(H.y - 0.1, -0.6, 0.6)];
}

/** 두 발(다리 걸음이 딛은 자리)의 앞뒤 간격 (m — 몸 앞 방향으로) · 다리 걸음이 없으면 null (안다레 리솔루토 런지 되돌아오기 — skill.js) */
export function stanceSpread(f) {
  const L = f.gait?.legs;
  if (!L?.F || !L?.B) return null;
  const fw = f.forward(new THREE.Vector3());
  return Math.abs((L.F.plant.x - L.B.plant.x) * fw.x + (L.F.plant.z - L.B.plant.z) * fw.z);
}

/** 새 수에 들어섬: 이름 · 수마다 한 번 맞음 · 반걸음(몸 미끄러짐 + 다리 걸음 — 시간 몫은 comboNext 가 길을 짠 뒤 채움) */
function comboMoveStart(f, I, mi) {
  const m = I.moves[mi];
  I.mi = mi;
  if (!m.same) f.stamina.attack(m.kind === 'thrust' || m.dyn?.kind === 'thrust' ? 'thrust' : 'cut', true); // same: 손가락 긋기를 이어 끄는 칼(제비 베기 되돌림 칼 — 10/25)은 새 공격이 아니다 (기력 청구 · 유파 패시브 묶음 그대로 — 켄타이 넘김이 제비 베기에 실림)
  I.moveName = m.name;
  I.hitM = false;
  I.blockM = false;
  I.slide = null;
  const st = m.step;
  const fwd = typeof st?.fwd === 'number' ? st.fwd : 0;
  if (!fwd || !f.foe) return;
  const M = f.swordArt.measure;
  const c = f.bodies.chest.translation();
  const fc = f.foe.bodies.chest.translation();
  let dx = fc.x - c.x;
  let dz = fc.z - c.z;
  const d = Math.max(1e-3, Math.hypot(dx, dz));
  dx /= d;
  dz /= d;
  let slide = fwd > 0 ? Math.min(clamp(d - M.contact, 0, fwd), Math.max(0, d - M.clinch)) : fwd; // 앞 = 발도 미끄러짐과 같은 한도 · 뒤(물러남 — 10/12 3 연격) = 반걸음 그대로
  if (slide < 0) {
    // 물러남은 경기장 테두리(ARENA.radius — 이미 있는 값)를 넘지 않게: 끝 자리 가슴이 반지름 밖이면 그 안까지만
    const ex = c.x + dx * slide;
    const ez = c.z + dz * slide;
    if (Math.hypot(ex, ez) > ARENA.radius) slide = -Math.max(0, Math.min(-slide, ARENA.radius - Math.hypot(c.x, c.z)));
  }
  if (Math.abs(slide) > 1e-3) I.slide = { dx, dz, slide, t0: I.t, span: 1, done: 0 };

  // 앞발 걸음: st.foot 이 있으면 몸 미끄러짐(fwd)과 따로 (안다레 리솔루토 런지 — 앞발 SECRET.italianStep) · st.room 이면 미끄러짐과 같은 한도로 미끄러진 뒤 가슴 사이가
  //  맞붙는 거리(clinch) 안으로 들지 않을 만큼까지만(걸음 동안 몸이 따라 나가 상대 몸에 붙지 않게 — 브라우저: 0.9 m 그대로 디디면 가슴 사이 1.82 → 0.94 m · 기본 끔 SECRET.risolutoStep.room) ·
  //  st.draw 면 디딘 뒤 뒷발 끌어붙임 (유파 걸음 drawT — 런지 뒤 자세로). 둘 다 없으면 전과 같음
  const foot = st.foot != null ? (st.room ? Math.min(st.foot, Math.max(0, d - Math.max(0, slide) - M.clinch)) : st.foot) : fwd;
  if (st.foot != null) I.footStep = foot; // 재기
  //  st.push 면 걸음 동안 몸 따라감 배율 (런지 — 엇박 찌르기 런지와 같은 SECRET.stepPush: 골반이 앞발 쪽으로 실려 앞무릎이 굽고 뒷다리가 펴짐)
  const asked = f.gait?.active && (st.foot == null || foot > 1e-3) ? f.gait.requestStep({ kind: st.kind ?? 'lunge', fwd: foot, side: st.lat ?? 0, duration: st.dur ?? 0.35, ...(st.draw ? { draw: true } : {}), ...(st.push ? { push: st.push } : {}), ...(st.accel ? { accel: true } : {}) }) : false;
  if (st.foot != null) {
    f.lungeReq = asked ? f.gait.req : null; // 런지 앞발 걸음 (skill.js lungeRecoverTick — 디디고 몸이 다 실리면 앞발을 뒤로 거둠)
    f.lungeSpread0 = asked ? stanceSpread(f) : null; // 런지 전 두 발 앞뒤 간격 (되돌아오기가 그 보폭까지 거둠)
  }
}

function stepCombo(f, combat) {
  const I = f.iai;
  const dt = combat.dt || 1 / 120;
  const foe = f.foe;
  if (!f.alive || !f.armed || !foe) return endCombo(f, combat);
  if (I.mord && !f.mordAim) return endCombo(f, combat); // 죽음의 일격이 끊겨(skill.js secretEnd → mordEnd) 이미 원래 쥠이면 거꾸로 놓기를 멈춘다
  const t0 = I.t;
  const mi0 = I.mi;
  const si0 = I.si;
  I.t += dt * f.stamina.attackSpeed;
  f.instantGhost = Math.max(f.instantGhost ?? 0, Math.ceil(SECRET.instantNoCollide / dt) + 1);
  // 토막 넘기기 — 이 수의 토막이 끝나면 다음 수를 지금 자리에서 짠다 (없으면 끝)
  for (;;) {
    while (I.si < I.segs.length && I.t >= I.ts + I.segs[I.si].T) {
      I.ts += I.segs[I.si].T;
      I.cur = I.segs[I.si].B;
      I.last = I.segs[I.si].B;
      I.si++;
    }
    if (I.si < I.segs.length) break;
    if (!comboNext(f, I)) {
      placeIai(f, I.cur.H, I.cur.D, false, I.cur.turn ?? 0, I.edgeHint ?? null, !!I.moves[I.mi]?.band);
      if (I.moves[I.mi]?.lunge) lungeSweep(f, I, combat, t0, I.t); // 런지: 이 스텝에 남은 토막(찌름 · 뽑음)을 지났으면 그 길도 본다
      return endCombo(f, combat);
    }
  }
  const sg = I.segs[I.si];
  // 겨눈 찌름(comboPlanAim thrust — 격살 허파 찌르기): 이 스텝에 맞힘 없는 겨눔 토막에서 찌르는 토막으로 넘어왔으면 쓸린 자리를 찌르는 토막 첫 자리부터 본다.
  //  지난 스텝 자리(겨눔 토막 가운데)부터 보면 겨눔의 옆 움직임이 찌름 방향에 섞여, 칼끝이 이미 몸 깊이에 든 맞닿기 언저리에서 찌름이 베기로 셈됐다
  //  (10/24 17:2x 뒤 — 시작 자세가 바뀌면 겨눔이 끝나는 스텝이 달라져 맞닿기 −0.1 ~ +0.1 m 의 찌름 17 → 8 / 20 · 런지 lungeSweep 과 같은 까닭 · SECRET.thrustSweep)
  if (SECRET.thrustSweep && I.mi === mi0 && I.si > si0 && sg?.cut && !I.mord && I.moves[I.mi]?.dyn?.thrust) {
    let k = I.si;
    while (k > si0 && I.segs[k - 1].cut) k--;
    if (k > si0) {
      const A = I.segs[k].A;
      const D = A.D.clone().applyQuaternion(I.yaw).normalize();
      I.prev = { B: A.H.clone().applyQuaternion(I.yaw).add(tv(f.bodies.chest.translation(), new THREE.Vector3())).addScaledVector(D, f.weaponCfg.hiltLength), D };
    }
  }
  // 반걸음 몸 미끄러짐 (발도와 같은 꼴 — 부드럽게 줄며)
  const S = I.slide;
  if (S) {
    const x = Math.min(1, (I.t - S.t0) / S.span);
    const want = S.slide * (1 - (1 - x) * (1 - x));
    const ds = want - S.done;
    if (Math.abs(ds) > 1e-5) shiftFighter(f, S.dx * ds, S.dz * ds);
    S.done = want;
  }
  const u = sg.T > 0 ? clamp((I.t - I.ts) / sg.T, 0, 1) : 1;
  const P = comboLerp(sg, u);
  I.cutting = sg.cut;
  I.body = comboBody(P.px);
  I.cur = P;
  // 제비 베기 되돌림 칼(cutSweep — 10/25): 날이 칼끝이 가는 쪽(길 위 이 자리 칼끝 − 지난 스텝 칼끝)을 향하게 (날 세우기)
  if (I.moves[I.mi]?.cutSweep && I.prev?.tip) {
    const Dw = P.D.clone().applyQuaternion(I.yaw).normalize();
    const hint = P.H.clone().applyQuaternion(I.yaw).add(tv(f.bodies.chest.translation(), new THREE.Vector3())).addScaledVector(Dw, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength).sub(I.prev.tip);
    if (hint.lengthSq() > 1e-8) I.edgeHint = hint;
  }
  const cur = placeIai(f, P.H, P.D, false, P.turn, I.moves[I.mi]?.cutSweep ? I.edgeHint ?? null : null, !!I.moves[I.mi]?.band);
  const subs = I.moves[I.mi]?.lunge ? 0 : 3; // 런지는 아래 lungeSweep (지나온 토막 길을 따라)
  // 제비 베기 되돌림 칼(10/25 — requestArtSnap 의 cutSweep): 꺾은 자리로 거두는 준비 토막(맞힘 없음)에서 베는 토막으로 넘어온 스텝은 맞힘을 보지 않는다 —
  //  그 스텝 쓸린 자리가 준비 토막(내려간 칼 자리 — 상대 다리 곁)부터 베기로 셈됐다 (겨눈 찌름 thrustSweep 과 같은 까닭 · 길 점 자리는 팔이 다 닿지 않아 실제 놓인 칼과 달라 그 자리부터 재지 않음)
  const fresh = !!I.moves[I.mi]?.cutSweep && I.mi === mi0 && !!sg?.cut && !I.segs[si0]?.cut;
  if (!subs) lungeSweep(f, I, combat, t0, I.t);
  for (let k = 1; k <= subs; k++) {
    const w = k / subs;
    const B = I.prev.B.clone().lerp(cur.B, w);
    const D = I.prev.D.clone().lerp(cur.D, w).normalize();
    const tip = B.clone().addScaledVector(D, I.mord ? I.mord.Lp : f.weaponCfg.bladeLength); // 죽음의 일격: 손 → 칼자루 끝 (치는 막대)
    // 잔상 (10/23 사장님 '잔상과 궤적도 비기에 걸맞는지 체크해'): 사람 비기(모르트슐라크 · 격살 — arcCut)는 베는 토막(맞음이 날 수 있는 몫)만 — 준비 · 다시 세우기는 그리지 않는다
    if (!I.arcCut || sg.cut) {
      I.arc.pts.push([B.x, B.y, B.z, tip.x, tip.y, tip.z]);
      if (I.arcCut && f.instantArc !== I.arc) f.instantArc = I.arc;
    }
    if (!sg.cut || fresh || I.hitM || I.blockM || !foe.alive || foe.state === 'dead') continue;
    // 몸보다 먼저 상대 칼에 닿으면 이 수는 막힘 (이베리아 휩쓸기와 같은 거리 — 밀어냄 없음) · 죽음의 일격은 넘어 들어감 규칙(SECRET.mordOver)이면 막힘 없음
    if (!I.mord?.over && foe.armed && foe.sword && segSegApprox(B, tip, foe.bladePoint(0, new THREE.Vector3()), foe.bladePoint(1, new THREE.Vector3())) < SECRET.iberianBlockDist) {
      I.blockM = true;
      I.blocked++;
      continue;
    }
    let best = null;
    for (const [h, info] of f.colliderInfo) {
      if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
      const col = f.world.getCollider(h);
      if (!col) continue;
      const r = segToCollider(B, tip, col);
      if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { h, info, col, r };
    }
    if (best) {
      const prevW = Math.max(0, w - 1 / subs);
      const P0 = { B: I.prev.B.clone().lerp(cur.B, prevW), D: I.prev.D.clone().lerp(cur.D, prevW).normalize() };
      I.hitM = true;
      const res = instantWound(f, foe, [P0, { B, D }], { i: 1, best }, combat, 0, dt / subs, I.hitMul, I.effMul, I.mord);
      if (res) {
        I.hits++;
        I.E += res.energy;
        I.Emax = Math.max(I.Emax, res.energy);
        I.part = best.info.part;
        I.zone = res.zone;
        I.type = res.type;
        I.sev = Math.max(I.sev ?? 0, res.severity ?? 0); // 격살 재기 (판정에는 안 씀)
      }
    }
  }
  I.prev = cur;
  // 막힘: 이 수의 남은 길을 건너뛰고 다음 수를 지금 자리에서 짠다 (다음 수가 없으면 끝) · 죽음의 일격은 다시 세우기 토막으로 (한 번)
  if (I.blockM && I.mord && !I.mordBacked) {
    I.mordBacked = true;
    comboMordBack(f, I);
  } else if (I.blockM && !I.mord && !comboNext(f, I)) return endCombo(f, combat);
  else if (I.maxT > 0 && I.t >= I.maxT) return endCombo(f, combat); // 시간 상한 (제비 베기 되돌림 칼 — 이 스텝 자리에서 끝)
}

/**
 * 안다레 리솔루토 런지의 쓸린 자리 (10/24 — 고노센 칼끝 빠르기): 한 물리 스텝에 겨눔 → 찌름 → 뽑음 토막을 여럿 지나므로 연환처럼 '지난 자리 → 지금 자리' 사이만 보면
 *  찌른 끝을 건너뛴다(탐침: 맞힘 0 · 끝을 스텝마다 놓게 멈추면 빠르기가 줄어 마지막 짧은 스텝에 닿은 찌르기가 3 m/s · 13 J 로 셈됨). 그래서 이 스텝(t0 → t1)에 지난
 *  토막마다 3 조각으로 길 위 자리(comboLerp — 몸 틀)를 그때 가슴 자리(지난 · 지금 가슴 사이)로 월드에 옮겨(손 = 팔 IK 목표 · 칼자루 → 칼날) 맞힘을 본다 (지난 점도 같은 식 — 빠르기가 한 식에서).
 *  맞힘 토막만 잔상 · 맞힘(수마다 한 번) — 빠르기 = 그 조각 사이 칼 자리 옮김 ÷ 그 조각의 실제 시간 (연환과 같은 상처 함수 · 판정 배율 hitMul).
 *  막힘 = 연환과 같은 거리(iberianBlockDist) · 붙은 칼 따라 미끄러짐(m.glide · SECRET.risolutoGlide — 원전 [156] '칼날을 놓지 말고 따라 미끄러져 몸까지'): 처음 붙어 있던 상대 칼에
 *  닿아 있는 동안은 막힘이 아님 · 한 번 떨어진(같은 거리 밖) 뒤 다시 닿으면 막힘
 */
function lungeSweep(f, I, combat, t0, t1) {
  const foe = f.foe;
  const c1 = tv(f.bodies.chest.translation(), new THREE.Vector3());
  const c0 = I.cPrev ?? c1;
  I.cPrev = c1;
  const HL = f.weaponCfg.hiltLength;
  const BL = f.weaponCfg.bladeLength;
  const m = I.moves[I.mi];
  const T0 = I.segT0 ?? I.ts;
  const tEnd = I.segs.reduce((a, sg) => a + sg.T, T0);
  // 길 위 자리 (때 t — 몸 틀 길을 그때 가슴 자리로 월드에: 손 = 팔 IK 목표 · 칼자루 → 칼날). 지난 점 · 지금 점도 같은 식으로 (빠르기가 한 식에서 나오게)
  const poseAt = (t) => {
    let s0 = T0;
    let sg = I.segs[I.segs.length - 1];
    for (const g of I.segs) {
      if (t <= s0 + g.T + 1e-12) {
        sg = g;
        break;
      }
      s0 += g.T;
    }
    if (t > s0 + sg.T) s0 = t - sg.T;
    const P = comboLerp(sg, sg.T > 0 ? clamp((t - s0) / sg.T, 0, 1) : 1);
    const c = c0.clone().lerp(c1, t1 > t0 ? clamp((t - t0) / (t1 - t0), 0, 1) : 1);
    const D = P.D.clone().applyQuaternion(I.yaw).normalize();
    const B = P.H.clone().applyQuaternion(I.yaw).add(c).addScaledVector(D, HL);
    return { B, D, sg, t };
  };
  const ts = [];
  let s0 = T0;
  for (const sg of I.segs) {
    const s1 = s0 + sg.T;
    const a = Math.max(s0, t0);
    const b = Math.min(s1, t1, tEnd);
    if (b > a + 1e-9) for (let k = 1; k <= 3; k++) ts.push(a + ((b - a) * k) / 3);
    s0 = s1;
  }
  const rate = Math.max(1e-3, f.stamina.attackSpeed);
  let prev = poseAt(Math.min(t0, tEnd));
  for (const t of ts) {
    const q = poseAt(t);
    const { B, D } = q;
    const tip = B.clone().addScaledVector(D, BL);
    if (q.sg.cut) {
      I.arc.pts.push([B.x, B.y, B.z, tip.x, tip.y, tip.z]);
      if (f.instantArc !== I.arc) f.instantArc = I.arc;
      // 재기 (판정에는 안 씀): 찌르는 토막 칼끝 빠르기 (월드 — 조각 사이 칼끝 옮김 ÷ 실제 시간) — 같은 칼 고노센 칼끝 iaiTipSpeed 와 견줌
      const dtq = (t - prev.t) / rate;
      if (dtq > 1e-6) {
        const v = tip.distanceTo(prev.B.clone().addScaledVector(prev.D, BL)) / dtq;
        I.tipL = (I.tipL ?? 0) + v * dtq;
        I.tipT = (I.tipT ?? 0) + dtq;
        I.tipVmax = Math.max(I.tipVmax ?? 0, v);
      }
    }
    if (q.sg.cut && !I.hitM && !I.blockM && foe?.alive && foe.state !== 'dead') {
      let blocked = false;
      if (foe.armed && foe.sword) {
        const near = segSegApprox(B, tip, foe.bladePoint(0, new THREE.Vector3()), foe.bladePoint(1, new THREE.Vector3())) < SECRET.iberianBlockDist;
        const glide = !!m?.glide && !I.glideOff;
        if (glide && !near) I.glideOff = true;
        if (near && glide) I.glided = (I.glided ?? 0) + 1; // 재기 (판정에는 안 씀)
        if (near && !glide) {
          I.blockM = true;
          I.blocked++;
          blocked = true;
        }
      }
      let best = null;
      if (!blocked) {
        for (const [h, info] of f.colliderInfo) {
          if (info.fighter !== foe || info.kind === 'weapon' || info.detached) continue;
          const col = f.world.getCollider(h);
          if (!col) continue;
          const r = segToCollider(B, tip, col);
          if (r <= SECRET.instantTouch && (!best || r < best.r)) best = { h, info, col, r };
        }
      }
      if (best) {
        I.hitM = true;
        const res = instantWound(f, foe, [{ B: prev.B, D: prev.D }, { B, D }], { i: 1, best }, combat, 0, Math.max(1e-4, (t - prev.t) / rate), I.hitMul, I.effMul, null);
        if (res) {
          I.hits++;
          I.E += res.energy;
          I.Emax = Math.max(I.Emax, res.energy);
          I.part = best.info.part;
          I.zone = res.zone;
          I.type = res.type;
          I.sev = Math.max(I.sev ?? 0, res.severity ?? 0);
        }
      }
    }
    prev = q;
  }
}

function endCombo(f, combat) {
  const I = f.iai;
  setKinematic(f, false);
  const v = tv(f.bodies.chest.linvel(), new THREE.Vector3());
  for (const n of [...ARM_PARTS, ...(I.off ? OFF_PARTS : []), null]) {
    const b = n ? f.bodies[n] : f.sword;
    if (!b) continue;
    b.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  if (I.mord) {
    // 죽음의 일격: 원래 쥠으로(칼끝 곧게 위 — mordschlag.js mordEnd) 돌아간 뒤 뗀 밧줄을 다시 건다 (굳음 붙잡기 방향 = 시작 자세의 칼자루 쪽 → 이제 칼끝 쪽 — 지붕)
    I.mord.end?.(f);
    if (f.iaiRopes) {
      if (f.iaiRopes.grip && f.armed && !f.gripCone) f.gripConeOn();
      if (f.iaiRopes.shoulder && !f.shoulderRopes) f.shoulderOn();
      f.iaiRopes = null;
    }
  }
  // 끝 자세를 경직 동안 붙잡는다 (발도와 같음) · 손 목표도 지금 토막 끝 길 점으로 (붙잡기가 풀린 뒤 칼이 막기 자리로 튀어 돌아가지 않게)
  const last = I.last ?? I.cur;
  const E = I.cur ?? last;
  const th = f.skill.thrustPose;
  th.w = 1;
  th.hand[0] = E.H.x;
  th.hand[1] = E.H.y;
  th.hand[2] = E.H.z;
  th.dir[0] = E.D.x;
  th.dir[1] = E.D.y;
  th.dir[2] = E.D.z;
  const K = I.body;
  th.pelvisYaw = K.pelvisYaw * D2R;
  th.chestYaw = K.chestYaw * D2R;
  th.pitch = K.pitch * D2R;
  th.drop = K.drop;
  if (last?.pad) snapAim(f, last.pad);
  f.iaiHoldT = I.hold;
  f.iaiHoldKind = 'combo';
  f.iaiFade = I.hold > 0 ? 0 : 0.2; // 붙잡기 0 (제비 베기 되돌림 칼 — 비기 굳음이 아님)이면 곧장 손가락에 돌려준다 (holdIai 의 0.2 s 풀기 그대로)
  f.instantGhost = Math.max(f.instantGhost ?? 0, Math.ceil(SECRET.instantNoCollide / (combat.dt || 1 / 120)));
  // 10/24 15:5x 팔을 뻗은 겨눈 찌름(SECRET.thrustArm)이 맞혔으면: 뻗은 채 굳는 동안 칼은 이미 상처 속 — 내 칼 ↔ 상대 몸만 그 굳음 동안 부딪히지 않음(combat.js filterContactPair · 칼끼리 · 팔은 그대로)
  if (SECRET.thrustArm && I.hits > 0 && I.moves.some((m) => m.dyn?.thrust)) f.holdGhost = Math.ceil(I.hold / (combat.dt || 1 / 120));
  f.tipPrev = f.bladePoint(1, new THREE.Vector3());
  f.hitPointPrev = f.bladePoint(0.7, new THREE.Vector3());
  f.tipVel.set(0, 0, 0);
  f.hitPointVel.set(0, 0, 0);
  f.instantResult = { ok: true, hit: I.hits > 0, hits: I.hits, energy: I.E, Emax: I.Emax, part: I.part, zone: I.zone, type: I.type, blocked: I.blocked > 0, combo: true, T: I.t, tech: I.tech, aim: I.aim ?? null, sev: I.sev ?? 0, ...(I.mord ? { mord: true, pullD: I.mord.pullD ?? 0, wPart: I.wPart ?? null, hy: I.hy ?? null } : {}), ...(I.moves.some((m) => m.lunge) ? { lunge: true, glided: I.glided ?? 0, slide: I.slide?.slide ?? 0, foot: I.footStep ?? 0, tipV: I.tipT > 0 ? I.tipL / I.tipT : 0, tipVmax: I.tipVmax ?? 0, v: I.v } : {}) };
  f.iai = null;
  f.artTech = null;
}

// ─────────────────────────────────────────────────────────────
//  고유 동작 잔상 · 진 · 츠바메가에시 (10/21 15:5x 사장님 '고노센의 50% 빠르기에 잔상도 그에 비례해서 … 일반 츠바메가에시에도 잔상은 넣자')
//   · requestArtReturn: 무기 비검(weapons.js secretBlade.kin)의 되돌림 칼을 연환과 같은 틀로 — 칼끝 빠르기 = 고노센(발도 베는 몫)의 kin 몫 · 잔상 세기도 같은 몫 ·
//     맞음은 쓸린 자리의 실제 빠르기로 기존 상처 함수(비기 판정 배율 없음 — hitMul 1) · 끝 자세 붙잡기 hold s. 사람 · AI 같이 (unique_assist.js start · ai.js 베기 중)
//   · artTrailTick: 끌고 가지 않는 보통 츠바메가에시의 되돌림 칼(칼끝이 위로 움직이는 동안)에 잔상 — 비기 잔상과 같은 그림(sword_trail.js f.instantArc · kind 'combo'),
//     세기 = 그 칼끝 평균 빠르기 / 고노센 칼끝 빠르기 (잔상은 빠르기의 표시 — 연환 · 진과 같은 체계). 물리 · 판정 무관(읽기만)
// ─────────────────────────────────────────────────────────────
export const ART_TRAIL = new Set(['tsubameGaeshi']); // 되돌림 칼이 그리는 동안 잔상 (칼끝이 위로)
//  이점이 터진 순간 잔상 (10/21 16:1x 사장님 '잔상은 이점 터진 순간만 넣는 안으로 해'): 칼은 늘 최근 ART_HIST 초의 길(칼자루 · 칼끝)을 기억하고,
//  이점이 터지면(곁눈 베기 무릎 꺾임 · 내려 찌르기 상처 · 요격 몸통 출혈 — combat.js) 그 길을 한 번에 잔상으로 그린다(artFlash). 이베리아 머리 위 돌려 베기는
//  이어 그은 둘째 칼부터 그리는 동안 잔상(세기 + ART_STACK × 쌓인 수 — 몰아치는 흐름). 세기는 늘 칼끝 평균 빠르기 ÷ 고노센 칼끝 빠르기(ART_MIN 0.3 ~ 1)
/** 진 · 츠바메가에시 되돌림 칼: from(패드) → path(패드들)를 끌고 간다. 이미 끌고 가는 중이면 거절(false) */
export function requestArtReturn(f, from, path, SB) {
  if (f.iai || f.iaiReq || !SB?.kin || !path?.length) return false;
  requestCombo(f, { moves: [{ from, path, kind: 'cut', name: SB.tech }], share: SB.kin, hold: SB.hold ?? 0.2, hitMul: 1, tech: SB.tech });
  return true;
}
/**
 * 사람 제비 베기 되돌림 칼 (사장님 10/25 21:1x '해법 1~3 좋아' — 해법 ② 중력과 관성을 거스름 · config UNIQUE_ASSIST.tsuSnap · unique_assist.js start):
 *  꺾는 순간 from(손가락이 꺾은 자리 — 패드) → path(올려 긋는 길 패드들)를 진 · 츠바메가에시와 같은 틀(연환 — 운동학 · 쓸린 자리의 실제 빠르기 · 판정 배율 1)로 끌고 간다.
 *  칼끝 빠르기 = 고노센 발도 칼끝 빠르기 × share · 시간 상한 maxT · 끝 자세 붙잡기 없음(곧장 0.2 s 에 손가락으로). 이미 끌고 가는 중이면 거절(false)
 */
export function requestArtSnap(f, from, path, { share, maxT, tech, plan = null, band = false }) {
  if (f.iai || f.iaiReq || !path?.length || !(share > 0)) return false;
  requestCombo(f, { moves: [{ from, path, plan, kind: 'cut', name: tech, cutSweep: true, same: true, band }], share, hold: 0, hitMul: 1, tech, maxT }); // plan = [from, ...path] 점마다 길 덧칸 (comboPlanAdd) · cutSweep = 날 세우기 · 준비 토막에서 넘어온 스텝은 맞힘 안 봄 (stepCombo) · same = 손가락 긋기와 같은 공격 (comboMoveStart) · band = 몸통 띠 겨눔(comboBandShift) · 굴림 묶음(placeIai)
  return true;
}
export const ART_HIST = 0.3; // s — 잔상으로 그릴 지난 길 (감독 값)
export const ART_STACK = 0.1; // 이어 그은 수 하나마다 더하는 잔상 세기 (감독 값)
export const ART_MIN = 0.3; // 고유 동작 잔상의 가장 흐린 세기 (10/21 16:2x 사장님 '0.3' — 연환 잔상 30 % · 일반 칼 궤적 띠 가장 진한 30 % 와 같게 · 빠른 칼은 빠르기만큼 더 진함)
const HIST_N = 64;
function speedShare(f, sum, n) { return clamp(sum / Math.max(1, n) / Math.max(1, iaiTipSpeed(f)), ART_MIN, 1); }
function artTrailTick(f) {
  if (!f.armed || !f.sword) { f.artTrail = null; f.bladeHist = null; return; }
  const a = f.bladePoint(0, new THREE.Vector3());
  const b = f.bladePoint(1, new THREE.Vector3());
  const sp = f.tipVel?.length?.() ?? 0;
  const H = (f.bladeHist ??= { pts: [], t: 0 });
  H.pts.push([a.x, a.y, a.z, b.x, b.y, b.z, sp, H.t]);
  H.t += 1;
  if (H.pts.length > HIST_N) H.pts.shift();
  if (f.iai) { f.artTrail = null; return; }
  const name = artTechOf(f);
  const stack = name ? artStackOf(f) : 0;
  const on = name && ((ART_TRAIL.has(name) && (f.tipVel?.y ?? 0) > 1.5) || (stack >= 1 && sp > 8));
  if (!on) { f.artTrail = null; return; }
  let A = f.artTrail;
  if (!A || A.name !== name) {
    A = f.artTrail = { name, arc: { id: (f.instantArc?.id ?? 0) + 1, kind: 'combo', share: ART_MIN, pts: [] }, sum: 0, n: 0 };
    f.instantArc = A.arc;
  }
  A.arc.pts.push([a.x, a.y, a.z, b.x, b.y, b.z]);
  A.sum += sp;
  A.n++;
  A.arc.share = clamp(speedShare(f, A.sum, A.n) + ART_STACK * stack, ART_MIN, 1);
}
/** 이점이 터진 순간: 그 칼이 지나온 최근 ART_HIST 초의 길을 잔상으로 (비기 · 끌고 가는 칼이 그리는 중이면 안 함) */
export function artFlash(f, dt = 1 / 120) {
  if (f.iai || !f.bladeHist?.pts.length) return;
  const n = Math.max(2, Math.round(ART_HIST / Math.max(1e-3, dt)));
  const P = f.bladeHist.pts.slice(-n);
  const sum = P.reduce((s, p) => s + p[6], 0);
  f.instantArc = { id: (f.instantArc?.id ?? 0) + 1, kind: 'art', share: speedShare(f, sum, P.length), pts: P.map((p) => p.slice(0, 6)) };
  f.artTrail = null;
}
let artTechOf = () => null; // unique_assist.js strokeTechOf 를 이어 둔다 (서로 부르는 고리를 피함)
let artStackOf = () => 0; // unique_assist.js strokeStackN
export function setArtTechOf(fn, stackFn) { artTechOf = fn; if (stackFn) artStackOf = stackFn; }
