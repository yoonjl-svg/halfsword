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
//  ② 끝점 겨눔 (플레이어만: skill.corrTip·손목 원뿔 fighter.gripCone(BODY.humanLimits)·선 자세·총 아님·찌르기 아님 th.w = 0):
//   켜짐 = 손 뗌 사건(skill.lift, handHeld 참 → 거짓)인 스텝에만, 그 손가락이 긋는 중에 뗐을 때(skill.quiet = 0: 기존 휘두르기 깃발,
//   패드 빠르기 > SKILL.swingSpeed — 누른 채 멈췄다 뗀 것은 켜지 않는다, 비판 H1), ㉠ 칼이 아직 손가락 목표 쪽으로 돈다(toward > 0, fighter.js:1756 식을
//   여기서 직접 계산 — 손목 걸쇠는 쓰지 않음) ㉡ 겨눈 부위가 Π 안 앞쪽 ㉢ 면 안 각 φ손가락 < φ* ㉣ th.w = 0.
//   a* = Π 안 부위 단면의 먼 가장자리: φ* = φ(c_Π) + asin(√(r² − h²)/|c_Π − H|) (기하). aim 을 n 축으로 s·(φ* − φ손가락)만 돌린다 —
//   손가락 aim 의 면 밖 성분은 그대로(tipOut = 0). 손 목표는 안 건드린다. 닫힘: 닿음·칼끝이 a* 를 지남·v_close ≤ 0·띠 밖·toward ≤ 0.
//   닫힐 때의 aim 을 몸 틀에 붙잡고(되튐 없음, 몸이 돌면 같이 돈다), 되돌아옴 걷기 진행 p = skill.recoverP 로 slerp(붙잡음, 걷기 aim, p) 하며 풀거나(③),
//   손가락이 다시 닿으면 그 스텝에 손가락에 넘긴다(튐 = tipJump, ≤ 옮긴 각). 시간값 없음
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
const _w = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _rq = new THREE.Quaternion();
const _f = new THREE.Vector3();
const _hw = new THREE.Vector3();
const _yi = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
/** 면 Π(b, t 로 펼친) 안에서 b 로부터 v 까지 도는 쪽(+ = 쓸기 쪽) 각 */
const inPlane = (v, b, t) => Math.atan2(v.dot(t), v.dot(b));

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
    tipPart: null, tipN: new THREE.Vector3(), tipA: new THREE.Vector3(), holdAim: new THREE.Vector3() /* 몸 틀 */, cmdAim: new THREE.Vector3(), tipJump: null, heldPrev: false, arcDone: 0, prevB: null,
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

function tipEnd(C, why) {
  C.tip = false;
  C.tipEnd = why;
}
/** ② 끝점 겨눔 (corrStep 이 쓸기 면을 정한 뒤, ① 앞에서). aim = 세계 틀 손가락 aim, 여기서만 고친다 */
function tipStep(f, C, aim, s, L, HL) {
  const sk = f.skill;
  C.fingerAim.copy(aim);
  // 새 손길(손가락이 다시 닿음, handHeld 거짓 → 참): 붙잡음·열린 겨눔을 그 스텝에 손가락에 넘긴다
  const held = !!f.handHeld;
  const touch = held && !C.heldPrev;
  C.heldPrev = held;
  // 손길 없이 손 입력이 움직이면(PC 포인터 잠금 마우스: handHeld 거짓·inputActive 참) 손길과 똑같이 넘긴다 — 폰은 닿아야만 움직이니 그대로.
  //  (숨은 상한 점검 F1 10/1: 마우스에서는 붙잡음이 풀리지 않아 베기를 막았다. 새 수 없음, 걷기를 멈추는 같은 사건 inputActive 를 쓴다)
  const resume = !held && !!f.inputActive && (C.tip || C.tipHold);
  // 이번 손길에 칼이 면 안에서 쓴 각 (켜질 때 남은 호 몫을 재는 데만)
  if (touch || resume) C.arcDone = 0;
  if (C.prevB && C.plane) C.arcDone += Math.abs(Math.atan2(_w.crossVectors(C.prevB, _b).length(), C.prevB.dot(_b)));
  (C.prevB ||= new THREE.Vector3()).copy(_b);
  const ok = sk.corrTip && f.gripCone && f.state === 'stand' && !f.weapon?.gun && f.foe && !f.foe.revival;
  if (!ok || touch || resume) {
    if (C.tip || C.tipHold) {
      C.tipJump = touch || resume ? Math.acos(THREE.MathUtils.clamp(C.cmdAim.dot(aim), -1, 1)) : null; // 넘김 튐: 지난 스텝 명령 aim ↔ 손가락 aim
      C.tipEnd = touch ? 'touch' : resume ? 'mouse' : 'gate';
    }
    C.tip = false;
    C.tipHold = false;
    return;
  }
  // 칼이 손가락 목표 쪽으로 도는 빠르기 (fighter.js:1756 과 같은 식: toward = ω⊥·(b × aim)/sinA)
  const w = f.sword.angvel();
  _w.set(w.x, w.y, w.z);
  _w.addScaledVector(_b, -_w.dot(_b));
  const toward = (tgt) => {
    _ax.crossVectors(_b, tgt);
    const sinA = _ax.length();
    return sinA > 1e-5 ? _w.dot(_ax) / sinA : 0;
  };
  if (C.tip) {
    // 열려 있음: 닫힘 사건
    let why = null;
    if (f.bladeTouch) why = 'contact';
    else if (!C.plane) why = 'stopped';
    else if (_ax.crossVectors(_b, C.tipA).dot(C.tipN) <= 0) why = 'pastEdge';
    else {
      const body = f.foe.bodies[C.tipPart];
      evalPart(f, body, L, HL, _ev);
      if (!_ev.band) why = 'band';
      else if (!(_ev.vClose > 0)) why = 'recede';
    }
    // 명령 aim = 손가락 aim 을 켤 때의 면 법선 축으로 옮긴 각만큼 (면 밖 성분 그대로)
    _rq.setFromAxisAngle(C.tipN, C.tipCarried);
    _f.copy(aim).applyQuaternion(_rq);
    if (!why && toward(_f) <= 0) why = 'stopped';
    aim.copy(_f);
    C.cmdAim.copy(aim);
    if (why) {
      tipEnd(C, why);
      C.tipHold = true;
      C.walked = false;
      // 닫힐 때의 aim 을 붙잡는다 (되튐 없음). 몸 틀(f.yaw)에 적어 둔다: 손가락 aim 도 몸 틀에서 오니, 몸이 돌거나 걸어도
      //  붙잡음이 세계 한 방향에 박히지 않는다 (몸이 돌면 손가락 aim 과 같이 돈다, 새 수 없음)
      C.holdAim.copy(aim).applyQuaternion(_yi.copy(f.yaw).invert());
    }
    return;
  }
  if (C.tipHold) {
    // 붙잡음: 되돌아옴 걷기 진행 p 로 손가락(걷는 패드) aim 쪽으로 푼다. 걷기가 끝나면(p = 1) 놓는다
    if (sk.recovering) C.walked = true;
    const p = sk.recovering ? sk.recoverP ?? 0 : C.walked && sk.recoverP === 1 ? 1 : 0;
    if (p >= 1) {
      C.tipHold = false;
      C.tipEnd = 'walk';
      return;
    }
    _hw.copy(C.holdAim).applyQuaternion(f.yaw); // 붙잡은 aim (몸 틀 → 세계)
    if (p > 0) {
      _rq.setFromUnitVectors(_hw, aim);
      _rq.slerp(_q.identity(), 1 - p); // hold → finger 로 p 만큼
      aim.copy(_hw).applyQuaternion(_rq);
    } else aim.copy(_hw);
    C.cmdAim.copy(aim);
    return;
  }
  // 켜짐: 손 뗌 스텝에만
  if (!sk.lift || sk.quiet !== 0 || !C.plane || sk.thrustPose.w !== 0) return;
  if (!(toward(aim) > 0)) return;
  // 겨눈 부위: Π 안(띠)·닿는 거리·앞쪽·다가옴 중 d/v_close 최소 (① 과 같은 열쇠)
  let best = null;
  let bestTau = Infinity;
  for (const name in f.foe.bodies) {
    if (!evalPart(f, f.foe.bodies[name], L, HL, _ev) || !_ev.ahead) continue;
    if (_ev.tau < bestTau) {
      bestTau = _ev.tau;
      best = name;
    }
  }
  if (!best) return;
  const body = f.foe.bodies[best];
  evalPart(f, body, L, HL, _ev);
  // a*: Π 안 부위 단면(반지름 √(r² − h²))의 먼 가장자리
  _u.subVectors(_ev.c, _H).addScaledVector(_n, -_ev.c.clone().sub(_H).dot(_n)); // c_Π − H
  const dc = _u.length();
  const rho = Math.sqrt(Math.max(0, _ev.r * _ev.r - _ev.h * _ev.h));
  const phiStar = inPlane(_u, _b, _t) + Math.asin(Math.min(1, rho / dc));
  const phiF = inPlane(_f.copy(aim), _b, _t);
  if (!(phiF < phiStar)) return;
  C.tip = true;
  C.tipHold = false;
  C.tipPart = best;
  C.tipOnsets++;
  C.tipN.copy(_n);
  C.tipCarried = s * (phiStar - phiF);
  C.tipA.copy(_b).applyAxisAngle(_n, phiStar); // a* (세계)
  C.tipArcLeft = phiF > 0 ? phiF / (C.arcDone + phiF) : 0;
  C.tipEnd = null;
  C.tipJump = null;
  _rq.setFromAxisAngle(_n, C.tipCarried);
  aim.applyQuaternion(_rq);
  C.cmdAim.copy(aim);
  // 면 밖 각(명령 aim ↔ 손가락 aim, 법선 n 기준): 축 회전이라 0 (재어 둔다)
  C.tipOut = Math.abs(Math.asin(THREE.MathUtils.clamp(aim.dot(_n), -1, 1)) - Math.asin(THREE.MathUtils.clamp(C.fingerAim.dot(_n), -1, 1)));
}

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
  tipStep(f, C, aim, s, L, HL);
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
