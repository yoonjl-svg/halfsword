// ─────────────────────────────────────────────────────────────
//  검술 보정 v2 — 마지막 궤적의 공통 탐지기 (docs/strike/correction_v2_design_2026-10-01.md '세 효과')
//
//  fighter.driveSword 가 aim.applyQuaternion(this.yaw) 바로 뒤, wAim 앞에서 부른다 (skill.corr 'v2' 이고 s > 0 일 때만).
//  살아 있는 몸(엔진 값)에서 제 scratch 로 읽는다 — fighter.js 의 _q1·_v1 은 쓰지 않는다. 난수 없음.
//   쓸기 면 Π: 손잡이 H, 칼 축 b, 칼끝 속도(v + ω×r) 의 b-수직 성분. 수치 보호는 fighter.js:1741 과 같은 lengthSq < 1e-4
//   후보: 상대 몸 부위(경계 반지름 r = 충돌체 모양). 띠 |n·(c−H)| < r, 닿는 거리 |c−H| ≤ 지금 칼 길이 + r, 쓸기 앞쪽,
//    다가옴 v_close = rel·(c−p)/|c−p| > 0 (p = combat.predict 규칙, rel = v칼(p) − v부위(p)). 상대 칼은 후보가 아니다(여쭘 17)
//   ① 날 맞춤 창: 겨눈 부위 = d/v_close 최소, 창이 열릴 때 고정. τ = d/v_close < T_roll 이면 열린다.
//    T_roll = 8·I/kd: 기존 굴림 서보(kd = 0.12·twistScale, I = 칼날 축 관성)의 2 % 안착 시간 4/(ζωn) = 8·I/kd (유도, 숫자 아님)
//    닫힘: v_close ≤ 0, 띠·거리 밖, 떨어짐(bladeTouch 참 → 거짓), 칼끼리 새로 부딪힘(그 뒤는 combat.js gripTwist)
//  모든 값은 fighter.corr 에 적는다 (측정 도구가 읽는다).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { BREAK } from './weapons.js';

const _H = new THREE.Vector3();
const _b = new THREE.Vector3();
const _vt = new THREE.Vector3();
const _n = new THREE.Vector3();
const _t = new THREE.Vector3();
const _c = new THREE.Vector3();
const _a = new THREE.Vector3();
const _e = new THREE.Vector3();
const _p = new THREE.Vector3();
const _u = new THREE.Vector3();
const _r = new THREE.Vector3();
const _q = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

/** 부위 경계 반지름 (충돌체 모양: 공 r, 캡슐 반길이 + r, 상자 반대각선) — 기하 */
const _radius = new WeakMap();
function partRadius(body) {
  let r = _radius.get(body);
  if (r != null) return r;
  const col = body.collider(0);
  const sh = col.shape;
  if (sh.halfExtents) r = Math.hypot(sh.halfExtents.x, sh.halfExtents.y, sh.halfExtents.z);
  else if (sh.halfHeight != null) r = sh.halfHeight + sh.radius;
  else r = sh.radius;
  _radius.set(body, r);
  return r;
}

export function newCorr(f) {
  // T_roll: 굴림 서보(fighter.js 날 세우기 kd = 0.12·twistScale)가 칼날 축 관성 I 를 2 % 안에 세우는 시간 (위 머리말)
  const I = f.swordProps.I.y;
  const kd = 0.12 * f.twistScale;
  return {
    win: false, part: null, tau: Infinity, vClose: 0, tRoll: (8 * I) / kd, opens: 0, closes: 0, switches: 0, winSteps: 0,
    rollTarget: new THREE.Vector3(), relPerp: new THREE.Vector3(), n: new THREE.Vector3(), plane: false, touchPrev: false, closeWhy: null,
    // ② 끝점 겨눔 (item 5)
    tip: false, tipHold: false, tipOnsets: 0, tipCarried: 0, tipArcLeft: null, tipOut: 0, tipEnd: null, fingerAim: new THREE.Vector3(),
  };
}

/** 부위 하나를 지금 쓸기 면에 대어 본다. out 에 적고 후보면 true */
function evalPart(f, body, L, HL, out) {
  const r = partRadius(body);
  const ct = body.translation();
  _c.set(ct.x, ct.y, ct.z);
  _u.subVectors(_c, _H);
  const dist = _u.length();
  const h = Math.abs(_u.dot(_n));
  out.band = h < r;
  out.reach = dist <= L + r;
  out.ahead = _u.dot(_t) > 0; // 면 안 각 φ(b → c−H) 가 도는 쪽
  out.h = h;
  out.r = r;
  // 닿는 점 p: 칼날 선분 위에서 부위 무게중심에 가장 가까운 점 (combat.js predict 와 같은 식, 살아 있는 몸)
  _a.copy(_b).multiplyScalar(HL).add(_H);
  _e.copy(_b).multiplyScalar(L - HL);
  const com = body.worldCom();
  _r.set(com.x, com.y, com.z);
  const s = THREE.MathUtils.clamp(_r.sub(_a).dot(_e) / _e.lengthSq(), 0, 1);
  _p.copy(_a).addScaledVector(_e, s);
  const vb = f.sword.velocityAtPoint(_p);
  const vp = body.velocityAtPoint(_p);
  out.rel.set(vb.x - vp.x, vb.y - vp.y, vb.z - vp.z);
  _r.subVectors(_c, _p);
  const rl = _r.length();
  out.vClose = rl > 0 ? out.rel.dot(_r) / rl : 0;
  // 닿기까지 거리 d: p 에서 부위 겉면까지 (충돌체 투영, 기하)
  const pr = body.collider(0).projectPoint({ x: _p.x, y: _p.y, z: _p.z }, true);
  out.d = pr && !pr.isInside ? Math.hypot(pr.point.x - _p.x, pr.point.y - _p.y, pr.point.z - _p.z) : 0;
  out.tau = out.vClose > 0 ? out.d / out.vClose : Infinity;
  out.c.copy(_c);
  out.p.copy(_p);
  return out.band && out.reach && out.vClose > 0;
}
const _ev = { rel: new THREE.Vector3(), c: new THREE.Vector3(), p: new THREE.Vector3() };

function closeWin(C, why) {
  if (!C.win) return;
  C.win = false;
  C.closes++;
  C.closeWhy = why;
  C.winSteps = 0;
}

/**
 * 매 스텝 (driveSword, 세계 틀 aim 이 정해진 바로 뒤). s = skill.level (> 0 일 때만 부른다)
 */
export function corrStep(f, aim, s) {
  if (!(s > 0)) return;
  const C = (f.corr ||= newCorr(f));
  const foe = f.foe;
  const cfg = f.weaponCfg;
  // 사건: 닿음·떨어짐 (combat.js 가 v2 공격자에게만 적는다), 칼끼리 새로 부딪힘 (combat.js bladeClash 가 적는 feel)
  const touch = !!f.bladeTouch;
  const separated = C.touchPrev && !touch;
  C.touchPrev = touch;
  const clash = f.feel.touching && f.feel.time === 0;
  // 쓸기 면
  const st = f.sword.translation();
  _H.set(st.x, st.y, st.z);
  const q = f.sword.rotation();
  _q.set(q.x, q.y, q.z, q.w);
  _b.copy(Y).applyQuaternion(_q);
  const HL = cfg.hiltLength;
  const L = HL + cfg.bladeLength; // 부러지면 남은 길이 (fighter.breakWeapon 이 bladeLength 를 줄인다)
  _a.copy(_b).multiplyScalar(L).add(_H);
  const vt = f.sword.velocityAtPoint(_a);
  _vt.set(vt.x, vt.y, vt.z).addScaledVector(_b, -(vt.x * _b.x + vt.y * _b.y + vt.z * _b.z));
  C.plane = _vt.lengthSq() >= 1e-4;
  if (C.plane) {
    _t.copy(_vt).normalize();
    _n.crossVectors(_b, _t);
    C.n.copy(_n);
  }
  // ① 날 맞춤: 날 있는 칼(부러지면 stubEdge 일 때만)·총 아님·서 있을 때
  const edgeOK = cfg.edged && !f.weapon?.gun && (!f.weaponBroken || BREAK.stubEdge) && f.state === 'stand';
  if (!edgeOK || !foe || foe.revival || !C.plane) {
    closeWin(C, !C.plane ? 'plane' : 'gate');
    return;
  }
  if (C.win) {
    if (separated) return closeWin(C, 'separate');
    if (clash) return closeWin(C, 'clash');
    const body = foe.bodies[C.part];
    const ok = evalPart(f, body, L, HL, _ev);
    if (!_ev.band || !_ev.reach) return closeWin(C, 'band');
    if (!ok) return closeWin(C, 'recede');
    C.tau = _ev.tau;
    C.vClose = _ev.vClose;
    C.relPerp.copy(_ev.rel).addScaledVector(_b, -_ev.rel.dot(_b));
    C.winSteps++;
    return;
  }
  // 창이 닫혀 있으면: 후보 중 d/v_close 최소 (창을 열 때 고정)
  let best = null;
  let bestTau = Infinity;
  for (const name in foe.bodies) {
    if (!evalPart(f, foe.bodies[name], L, HL, _ev) || !_ev.ahead) continue;
    if (_ev.tau < bestTau) {
      bestTau = _ev.tau;
      best = name;
      C.relPerp.copy(_ev.rel).addScaledVector(_b, -_ev.rel.dot(_b));
      C.vClose = _ev.vClose;
    }
  }
  C.tau = bestTau;
  if (best && bestTau < C.tRoll && !clash) {
    C.win = true;
    C.part = best;
    C.opens++;
    C.winSteps = 1;
  }
}
