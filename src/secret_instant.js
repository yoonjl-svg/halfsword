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
import { SECRET, ARM, STRIKE, GAIT } from './config.js';
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
    if (f.instantGhost > 0) f.instantGhost--;
    if (f.instantReq) runInstant(f, combat);
    if (f.iaiReq) startIai(f, combat);
    if (f.iai) stepIai(f, combat);
    if (f.iaiHoldT > 0 || f.iaiFade > 0) holdIai(f, combat.dt || 1 / 120);
    stanceTick(f, combat.dt || 1 / 120);
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
function instantWound(f, foe, cut, hit, combat, J = SECRET.instantJ) {
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
  const qs = swordQuat(P.D, new THREE.Quaternion(), tang); // 날이 쓸린 방향을 향하게 (가로 발도·세로 真向 모두)
  const sp = P.B.clone().addScaledVector(P.D, -HL);
  const S = { p: sp, q: qs, com: sp.clone().addScaledVector(P.D, f.swordCom ?? 0.3), v: new THREE.Vector3(), w: new THREE.Vector3() };
  const vb = best.info.body;
  const Pst = { p: tv(vb.translation(), new THREE.Vector3()), q: tq(vb.rotation(), new THREE.Quaternion()), com: tv(vb.worldCom(), new THREE.Vector3()), v: tv(vb.linvel(), new THREE.Vector3()), w: tv(vb.angvel(), new THREE.Vector3()) };
  const target = J * SECRET.hitMul;
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

/** 발도를 걸어 둔다 (다음 combat.afterStep 이 시작). opt.player: 플레이어(지금 손에서 왼 허리를 거쳐 — 전체 iaiPlayerTime) */
export function requestIai(f, opt = {}) {
  f.iaiReq = { player: !!opt.player };
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
  const K = SECRET.iaiPath;
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

/** 손 자리 H·칼날 D(몸 기준)로 팔·칼(·빈팔)을 놓는다 — now: 지금 자리로(첫 스텝), 아니면 다음 스텝 운동학 목표. 칼날 선분 { B, D, tip } (월드) */
function placeIai(f, H, D, now) {
  const J = f.jointByName;
  const chest = f.bodies.chest;
  const qc = tq(chest.rotation(), new THREE.Quaternion());
  const c = tv(chest.translation(), new THREE.Vector3());
  const yaw = f.iai.yaw;
  const target = H.clone().applyQuaternion(yaw).add(c);
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
  const Dw = D.clone().applyQuaternion(yaw).normalize();
  const edge = new THREE.Vector3().crossVectors(Dw, new THREE.Vector3(0, 1, 0)); // 가로로 칼 든 쪽으로 쓸린다 → 날 = D × 위
  const qs = swordQuat(Dw, new THREE.Quaternion(), edge.lengthSq() > 1e-6 ? edge.normalize() : null);
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
  put(f.sword, wrist, qs);
  if (f.iai.off) {
    const pommel = new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(qs).add(wrist);
    f.offArmIK(pommel);
    const So = new THREE.Vector3(0, 0.1, -f.side * 0.2).applyQuaternion(qc).add(c);
    const quo = qc.clone().multiply(J.uarmO.target);
    const qfo = quo.clone().multiply(J.farmO.target);
    const eo = new THREE.Vector3(0, -0.3, 0).applyQuaternion(quo).add(So);
    put(f.bodies.uarmO, new THREE.Vector3(0, -0.15, 0).applyQuaternion(quo).add(So), quo);
    put(f.bodies.farmO, new THREE.Vector3(0, -0.14, 0).applyQuaternion(qfo).add(eo), qfo);
  }
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
  f.iai = { kind: 'iai', J: SECRET.instantJ, body: SECRET.iaiPath.E.body, hold: SECRET.stiff.japanese, pose: (I, u) => iaiPose(I, u), t: 0, T, ab: far ? SECRET.iaiDrawShare : 0, A: { H: AH, D: AD }, DB, yaw, slide, dx, dz, off: !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), prev: null, hit: null, res: null, arc: null };
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
  const ds = I.slide * (pr(I.t + dt) - pr(I.t));
  if (ds > 1e-5) shiftFighter(f, I.dx * ds, I.dz * ds);
  I.t += dt;
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
        sweepShove(f, foe);
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
        if (best) {
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
